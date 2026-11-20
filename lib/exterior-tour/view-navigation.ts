import confirmedRoadConnections from "../../data/exterior-road-connections.json";
import { clamp, dotPlanar, negativeVec3, normalizePlanar, perpendicularRight, subVec3, type Vec3 } from "./math";
import { getSequentialNodeIds } from "./nodes";
import type { ExteriorTourGraph, ExteriorTourNode, NavigationDirection } from "./types";

// Original pre-tightening selector from commit 7be4cc5: all arrows use the
// existing 60-degree cone, neighbour-first scoring and nearby fallback.
const VIEW_DIRECTION_ALIGNMENT_FLOOR = 0.5;

export function getViewForwardVector(node: ExteriorTourNode, yaw: number): Vec3 {
  const heading = Math.atan2(node.forward.y, node.forward.x) + yaw;

  return normalizePlanar(
    {
      x: Math.cos(heading),
      y: Math.sin(heading),
      z: 0,
    },
    node.forward,
  );
}

function getViewDirectionAxis(
  direction: NavigationDirection,
  viewForward: Vec3,
) {
  switch (direction) {
    case "left":
      return perpendicularRight(viewForward);
    case "right":
      return negativeVec3(perpendicularRight(viewForward));
    case "backward":
      return negativeVec3(viewForward);
    case "forward":
    default:
      return viewForward;
  }
}

export function getViewDirectionalCandidates(
  graph: ExteriorTourGraph,
  nodeId: string,
  direction: NavigationDirection,
  currentYaw: number,
  forceSequentialForwardBack = false,
) {
  const node = graph.byId[nodeId];
  if (!node) {
    return [] as Array<{ node: ExteriorTourNode; score: number }>;
  }

  if (
    forceSequentialForwardBack &&
    (direction === "forward" || direction === "backward")
  ) {
    const sequential = getSequentialNodeIds(graph, nodeId);
    const targetId =
      direction === "forward" ? sequential.nextId : sequential.previousId;
    const target = targetId ? graph.byId[targetId] : null;

    return target ? [{ node: target, score: 1 }] : [];
  }

  const viewForward = getViewForwardVector(node, currentYaw);
  const axis = getViewDirectionAxis(direction, viewForward);

  // Keep the original selector below unchanged. Only this user-confirmed
  // 15 <-> 61 road connection overrides its normal neighbour ranking.
  if (direction === "forward" || direction === "backward") {
    const linked = confirmedRoadConnections
      .filter(connection => connection.fromNodeId === nodeId)
      .flatMap(connection => {
        const target = graph.byId[connection.toNodeId];
        if (!target || target.id === nodeId) return [];
        const delta = subVec3(target.rawPosition, node.rawPosition);
        const alignment = dotPlanar(normalizePlanar(delta, axis), axis);
        return alignment >= Math.cos(Math.PI / 6)
          ? [{ node: target, score: alignment }]
          : [];
      })
      .sort((a, b) => b.score - a.score);
    if (linked.length > 0) return linked;
  }

  const neighborIds = new Set(node.neighbors.map((neighbor) => neighbor.id));
  const distanceScale = Math.max(
    graph.medianNearestDistance * 4,
    node.nearestDistance * 4,
    1,
  );

  const rankCandidates = (
    candidates: ExteriorTourNode[],
    alignmentFloor: number,
  ) =>
    candidates
      .map((candidate) => {
        const delta = subVec3(candidate.rawPosition, node.rawPosition);
        const candidateDirection = normalizePlanar(delta, axis);
        const alignment = dotPlanar(candidateDirection, axis);
        const distance = Math.hypot(delta.x, delta.y);
        const distanceBias = 1 - clamp(distance / distanceScale, 0, 1);
        const isNeighbor = neighborIds.has(candidate.id);
        const neighborBonus = isNeighbor ? 0.7 : 0;
        const farPenalty = isNeighbor ? 0 : 0.3;

        return {
          node: candidate,
          score:
            alignment * 1.8 + distanceBias * 0.42 + neighborBonus - farPenalty,
          alignment,
          distance,
        };
      })
      .filter((candidate) => candidate.alignment > alignmentFloor)
      .sort((a, b) => {
        const scoreDelta = b.score - a.score;
        if (Math.abs(scoreDelta) > 0.035) {
          return scoreDelta;
        }

        return a.distance - b.distance;
      });

  const neighborCandidates = rankCandidates(
    node.neighbors
      .map((neighbor) => graph.byId[neighbor.id])
      .filter((candidate): candidate is ExteriorTourNode => Boolean(candidate)),
    VIEW_DIRECTION_ALIGNMENT_FLOOR,
  );

  if (neighborCandidates.length > 0) {
    return neighborCandidates;
  }

  const nearbyDistanceLimit = Math.max(
    graph.medianNearestDistance * 2.8,
    node.nearestDistance * 3.2,
    1,
  );

  return rankCandidates(
    graph.nodes.filter((candidate) => {
      if (candidate.id === node.id || neighborIds.has(candidate.id)) {
        return false;
      }

      const delta = subVec3(candidate.rawPosition, node.rawPosition);
      return Math.hypot(delta.x, delta.y) <= nearbyDistanceLimit;
    }),
    Math.max(VIEW_DIRECTION_ALIGNMENT_FLOOR, 0.18),
  );
}
