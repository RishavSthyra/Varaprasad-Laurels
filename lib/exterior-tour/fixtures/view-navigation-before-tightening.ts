// Frozen regression reference: original selector from commit 7be4cc5,
// before the restrictive road/corridor changes. Do not tune this fixture.
import { clamp, dotPlanar, negativeVec3, normalizePlanar, perpendicularRight, subVec3, type Vec3 } from "../math";
import { getSequentialNodeIds } from "../nodes";
import type { ExteriorTourGraph, ExteriorTourNode, NavigationDirection } from "../types";

const VIEW_DIRECTION_ALIGNMENT_FLOOR = 0.5;

function getViewForwardVector(node: ExteriorTourNode, yaw: number): Vec3 {
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

export function getLegacyViewDirectionalCandidates(
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
