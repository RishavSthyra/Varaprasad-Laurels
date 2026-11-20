import plan from "../../data/exterior-amenity-minimap.json";

export type PlanPoint = readonly number[];

/** Plan-page pixels -> fractions of the full, uncropped ortho image. */
export function projectLandscapePlanPoint(point: PlanPoint) {
  const [x, y] = point;
  const matrix = plan.registration;
  return {
    leftPercent: (matrix.x[0] * x + matrix.x[1] * y + matrix.x[2]) / matrix.outputSize[0],
    topPercent: (matrix.y[0] * x + matrix.y[1] * y + matrix.y[2]) / matrix.outputSize[1],
  };
}

/** The PDF's actual estate perimeter, not the surrounding trees / layout roads. */
export function isInsideLandscapeSite(point: PlanPoint) {
  const [x, y] = point;
  const boundary = plan.siteBoundary;
  let inside = false;
  for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
    const [xi, yi] = boundary[i];
    const [xj, yj] = boundary[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Positions retain their original landscape-plan registration. Destinations
// and arrival angles are exclusively the user's confirmed pano mappings.
export const EXTERIOR_AMENITY_REFERENCES = plan.markers.map((marker) => ({
  ...marker,
  ...projectLandscapePlanPoint(marker.planPoint),
}));

export type ExteriorAmenityReference = (typeof EXTERIOR_AMENITY_REFERENCES)[number];
