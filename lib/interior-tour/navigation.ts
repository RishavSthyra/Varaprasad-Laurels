import { clamp, degToRad, distancePlanar, dotPlanar, normalizePlanar } from "../exterior-tour/math";
import { getNodeHeading } from "../exterior-tour/nodes";
import type { DirectionalNavMap, ExteriorTourGraph, ExteriorTourNode, NavigationDirection } from "../exterior-tour/types";

const NO_PAIRS: ReadonlyArray<readonly [string, string]> = [];
const NO_YAWS: ReadonlyArray<readonly [string, string, number]> = [];
const vectorFromAngle = (angle: number) => ({ x: Math.cos(angle), y: Math.sin(angle), z: 0 });

export function getNavigationPairKey(first: string, second: string) {
  return [first, second].sort().join("::");
}

export function getNavigationYawOverride(
  overrides: ReadonlyArray<readonly [string, string, number]>, from: string, to: string,
) {
  const override = overrides.find(([a, b]) => a === from && b === to);
  return override ? degToRad(override[2]) : undefined;
}

export function getConnectedNavigationCandidates(
  graph: ExteriorTourGraph, active: ExteriorTourNode, blocked: ReadonlySet<string>,
  additional: ReadonlyArray<readonly [string, string]> = NO_PAIRS,
) {
  const ids = new Set(active.neighbors.map((neighbor) => neighbor.id));
  for (const [first, second] of additional) {
    if (first === active.id) ids.add(second);
    else if (second === active.id) ids.add(first);
  }
  // A coincident camera has no walking direction. Normalizing its zero delta
  // with the requested axis would otherwise make it win all four buttons.
  return graph.nodes.filter((node) => ids.has(node.id)
    && distancePlanar(active.rawPosition, node.rawPosition) > 0.001
    && !blocked.has(getNavigationPairKey(active.id, node.id)));
}

export function getViewRelativeNavigationTargets(
  graph: ExteriorTourGraph, active: ExteriorTourNode | undefined, yaw: number,
  connectedOnly = false, blocked: ReadonlySet<string> = new Set(),
  additional: ReadonlyArray<readonly [string, string]> = NO_PAIRS,
  overrides: ReadonlyArray<readonly [string, string, number]> = NO_YAWS,
): DirectionalNavMap {
  const forward = active ? getNodeHeading(active) + yaw : 0;
  const angles: Record<NavigationDirection, number> = {
    forward, left: forward - Math.PI / 2, right: forward + Math.PI / 2, backward: forward + Math.PI,
  };
  const candidates = !active ? [] : connectedOnly
    ? getConnectedNavigationCandidates(graph, active, blocked, additional)
    : graph.nodes.filter((node) => node.id !== active.id && distancePlanar(active.rawPosition, node.rawPosition) > 0.001);
  return Object.fromEntries((Object.keys(angles) as NavigationDirection[]).map((direction) => {
    const desired = vectorFromAngle(angles[direction]);
    const ranked = active ? candidates.flatMap((candidate) => {
      const override = getNavigationYawOverride(overrides, active.id, candidate.id);
      const delta = { x: candidate.rawPosition.x - active.rawPosition.x, y: candidate.rawPosition.y - active.rawPosition.y, z: 0 };
      const vector = override === undefined ? normalizePlanar(delta, desired)
        : vectorFromAngle(getNodeHeading(active) + override);
      const alignment = dotPlanar(vector, desired);
      // Do not relabel an exactly sideways step as forward/back just because it
      // is close. Looking toward that step enables the corresponding direction.
      if (alignment <= 0.05) return [];
      const distance = distancePlanar(active.rawPosition, candidate.rawPosition);
      const bias = 1 - clamp(distance / Math.max(active.nearestDistance * 4.75, 1), 0, 1);
      return [{ direction, node: candidate, score: alignment * 0.82 + bias * 0.18 }];
    }).sort((a, b) => b.score - a.score) : [];
    const best = ranked[0];
    return [direction, best && best.score >= 0.1 ? best : { direction, node: null, score: best?.score ?? -Infinity }];
  })) as DirectionalNavMap;
}
