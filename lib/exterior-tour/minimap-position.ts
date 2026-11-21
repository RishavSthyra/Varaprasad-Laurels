import { EXTERIOR_AMENITY_REFERENCES } from "./amenity-minimap";
import type { ExteriorTourNode, ExteriorVector } from "./types";

type Point = { leftPercent: number; topPercent: number };
const anchors = EXTERIOR_AMENITY_REFERENCES.map(marker => ({
  // Match the export's own centimetre axes. Do not reflect Y or edit cameras.
  x: marker.exportedPosition.x / 100,
  y: marker.exportedPosition.y / 100,
  left: marker.leftPercent,
  top: marker.topPercent,
}));

function solve(matrix: number[][], target: number[]) {
  const rows = matrix.map((row, index) => [...row, target[index]]);
  for (let column = 0; column < 3; column++) {
    let pivot = column;
    for (let row = column + 1; row < 3; row++) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    if (Math.abs(divisor) < 1e-12) throw new Error("Exterior minimap anchors must span both world axes");
    rows[column] = rows[column].map(value => value / divisor);
    for (let row = 0; row < 3; row++) {
      if (row === column) continue;
      const factor = rows[row][column];
      rows[row] = rows[row].map((value, index) => value - factor * rows[column][index]);
    }
  }
  return rows.map(row => row[3]);
}

// Derive registration once from the 19 user-confirmed world/image pairs.
// No guessed per-pano offsets and no dependence on unrelated legacy locations.
const matrix = Array.from({ length: 3 }, (_, i) => Array.from({ length: 3 }, (_, j) =>
  anchors.reduce((sum, anchor) => sum + [anchor.x, anchor.y, 1][i] * [anchor.x, anchor.y, 1][j], 0)));
const fit = (key: "left" | "top") => solve(matrix, Array.from({ length: 3 }, (_, i) =>
  anchors.reduce((sum, anchor) => sum + [anchor.x, anchor.y, 1][i] * anchor[key], 0)));
export const EXTERIOR_WORLD_MINIMAP_REGISTRATION = { left: fit("left"), top: fit("top") };
const affine = (x: number, y: number): Point => {
  const { left, top } = EXTERIOR_WORLD_MINIMAP_REGISTRATION;
  return { leftPercent: left[0] * x + left[1] * y + left[2], topPercent: top[0] * x + top[1] * y + top[2] };
};

/** The registered POI centres are feature locations, not surveyed camera spots.
 * Interpolate their residuals smoothly over the affine registration so every
 * confirmed pano lands on its own dot and walking off it does not jump back to
 * an unrelated projection. O(19), evaluated only when the active node changes.
 * Leave results unclamped so tests/audits can detect out-of-image positions.
 */
export function projectExteriorPanoPosition(position: Pick<ExteriorVector, "x" | "y">): Point {
  const x = position.x / 100, y = position.y / 100;
  const base = affine(x, y);
  let total = 0, leftResidual = 0, topResidual = 0;
  for (const anchor of anchors) {
    const distanceSquared = (x - anchor.x) ** 2 + (y - anchor.y) ** 2;
    if (distanceSquared < 1e-12) return { leftPercent: anchor.left, topPercent: anchor.top };
    const weight = 1 / distanceSquared;
    const projected = affine(anchor.x, anchor.y);
    total += weight;
    leftResidual += weight * (anchor.left - projected.leftPercent);
    topResidual += weight * (anchor.top - projected.topPercent);
  }
  return { leftPercent: base.leftPercent + leftResidual / total, topPercent: base.topPercent + topResidual / total };
}

export function getExteriorPlayerMinimapPoint(node: ExteriorTourNode | null): Point {
  return node ? projectExteriorPanoPosition(node.rawPosition) : { leftPercent: 0.5, topPercent: 0.5 };
}
