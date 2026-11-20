import confirmedRoadConnections from "../../data/exterior-road-connections.json";
import { clamp, dotPlanar, negativeVec3, normalizePlanar, perpendicularRight, subVec3, type Vec3 } from "./math";
import { getSequentialNodeIds } from "./nodes";
import type { ExteriorTourGraph, ExteriorTourNode, NavigationDirection } from "./types";

// Forward/back are deliberately narrower than the turn controls. A camera
// 40-50 degrees to one side is a turn, not a continuation of the visible road.
export const STRAIGHT_NAVIGATION_CONE_DEGREES = 30;
const STRAIGHT_ALIGNMENT = Math.cos(STRAIGHT_NAVIGATION_CONE_DEGREES * Math.PI / 180);
const TURN_ALIGNMENT = Math.cos(Math.PI / 3);
const ALIGNMENT_TIE_RADIANS = 5 * Math.PI / 180;
type RoadSegment = { from: Vec3; to: Vec3 };
type RoadIndex = { segments: RoadSegment[]; candidates: Map<string, ExteriorTourNode[]> };
const roadIndexes = new WeakMap<ExteriorTourGraph, RoadIndex>();
const confirmedTargets = new Map<string, string[]>();
for (const connection of confirmedRoadConnections) {
  const targets = confirmedTargets.get(connection.fromNodeId) ?? [];
  targets.push(connection.toNodeId);
  confirmedTargets.set(connection.fromNodeId, targets);
}

export function getViewForwardVector(node: ExteriorTourNode, yaw: number): Vec3 {
  const heading = Math.atan2(node.forward.y, node.forward.x) + yaw;
  return { x: Math.cos(heading), y: Math.sin(heading), z: 0 };
}

function directionAxis(direction: NavigationDirection, forward: Vec3) {
  if (direction === "left") return perpendicularRight(forward);
  if (direction === "right") return negativeVec3(perpendicularRight(forward));
  if (direction === "backward") return negativeVec3(forward);
  return forward;
}

function pointToSegmentDistance(point: Vec3, { from, to }: RoadSegment) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const denominator = dx * dx + dy * dy;
  const t = denominator ? clamp(((point.x - from.x) * dx + (point.y - from.y) * dy) / denominator, 0, 1) : 0;
  return Math.hypot(point.x - from.x - t * dx, point.y - from.y - t * dy);
}

function getRoadIndex(graph: ExteriorTourGraph) {
  let index = roadIndexes.get(graph);
  if (!index) {
    const segments: RoadSegment[] = [];
    for (const node of graph.nodes) {
      const nextId = getSequentialNodeIds(graph, node.id).nextId;
      const next = nextId ? graph.byId[nextId] : null;
      // Never join unrelated render runs just because their counters adjoin.
      if (next) segments.push({ from: node.rawPosition, to: next.rawPosition });
    }
    index = { segments, candidates: new Map() };
    roadIndexes.set(graph, index);
  }
  return index;
}

/** Conservative local connections supported by the exported camera paths.
 * This is not a navmesh: unknown roads are not inferred through villa plots.
 */
export function getLocalRoadCandidates(graph: ExteriorTourGraph, node: ExteriorTourNode) {
  const index = getRoadIndex(graph);
  const cached = index.candidates.get(node.id);
  if (cached) return cached;
  const sequential = getSequentialNodeIds(graph, node.id);
  const maxDistance = Math.max(
    graph.medianNearestDistance * 2.8,
    Math.min(node.nearestDistance, graph.medianNearestDistance) * 3.2,
    1,
  );
  // Original and overlapping return passes have slightly offset centre lines.
  // Half the typical sampling interval accommodates the sampled entrance
  // bend and overlapping return lane (the source paths are not a navmesh).
  // A full villa-block shortcut still has an unsupported middle section.
  const corridorTolerance = Math.max(1, graph.medianNearestDistance * 0.5);
  const candidates = graph.nodes.filter(candidate => {
    if (candidate.id === node.id) return false;
    const delta = subVec3(candidate.rawPosition, node.rawPosition);
    const distance = Math.hypot(delta.x, delta.y);
    if (distance < 1e-6 || distance > maxDistance) return false;
    if (candidate.id === sequential.nextId || candidate.id === sequential.previousId) return true;
    // Include the midpoint and sample more finely than the corridor radius;
    // odd/coarse sampling can miss the unsupported centre between two roads.
    const steps = Math.max(2, Math.ceil(distance / corridorTolerance) * 2);
    for (let step = 0; step <= steps; step++) {
      const point = {
        x: node.rawPosition.x + delta.x * step / steps,
        y: node.rawPosition.y + delta.y * step / steps,
        z: 0,
      };
      if (!index.segments.some(segment => pointToSegmentDistance(point, segment) <= corridorTolerance)) return false;
    }
    return true;
  });
  index.candidates.set(node.id, candidates);
  return candidates;
}

export function getViewDirectionalCandidates(
  graph: ExteriorTourGraph,
  nodeId: string,
  direction: NavigationDirection,
  currentYaw: number,
  forceSequentialForwardBack = false,
) {
  const node = graph.byId[nodeId];
  if (!node) return [];
  const forwardBack = direction === "forward" || direction === "backward";
  if (forceSequentialForwardBack && forwardBack) {
    const sequential = getSequentialNodeIds(graph, nodeId);
    const targetId = direction === "forward" ? sequential.nextId : sequential.previousId;
    const target = targetId ? graph.byId[targetId] : null;
    // Explicit sequence mode remains separate from view-relative road arrows.
    return target ? [{ node: target, score: 1, alignment: 1, distance: Math.hypot(target.rawPosition.x - node.rawPosition.x, target.rawPosition.y - node.rawPosition.y) }] : [];
  }
  const axis = directionAxis(direction, getViewForwardVector(node, currentYaw));
  const alignmentFloor = forwardBack ? STRAIGHT_ALIGNMENT : TURN_ALIGNMENT;
  const localCandidates = getLocalRoadCandidates(graph, node);
  // Only explicitly confirmed road links may span a gap in sampled cameras.
  // They still obey the live-view straight cone, never replace local turns,
  // and do not alter the conservative radius/corridor check for other pairs.
  const linkedCandidates = forwardBack
    ? (confirmedTargets.get(nodeId) ?? []).flatMap(id => {
      const target = graph.byId[id];
      return target && target.id !== nodeId && !localCandidates.includes(target) ? [target] : [];
    })
    : [];
  const candidates = [...localCandidates, ...linkedCandidates].map(candidate => {
    const delta = subVec3(candidate.rawPosition, node.rawPosition);
    const distance = Math.hypot(delta.x, delta.y);
    const alignment = dotPlanar(normalizePlanar(delta, axis), axis);
    return { node: candidate, score: alignment, alignment, distance, angle: Math.acos(clamp(alignment, -1, 1)) };
  }).filter(candidate => candidate.alignment >= alignmentFloor);
  // A turn first enters its nearest local sample; don't skip the corner to a
  // farther sample simply because that one is closer to the side-axis centre.
  if (!forwardBack) return candidates.sort((a, b) => a.distance - b.distance || a.angle - b.angle);
  const bestAngle = Math.min(...candidates.map(candidate => candidate.angle));
  // Choose the nearest sample among similarly aligned cameras. A large old
  // neighbour bonus must not let a diagonal branch outrank a straight sample.
  return candidates.sort((a, b) => {
    const aAligned = a.angle <= bestAngle + ALIGNMENT_TIE_RADIANS;
    const bAligned = b.angle <= bestAngle + ALIGNMENT_TIE_RADIANS;
    if (aAligned !== bAligned) return aAligned ? -1 : 1;
    if (aAligned && bAligned) return a.distance - b.distance || a.angle - b.angle;
    return a.angle - b.angle || a.distance - b.distance;
  });
}
