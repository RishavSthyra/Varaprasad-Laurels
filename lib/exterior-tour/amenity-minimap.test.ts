import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import plan from "../../data/exterior-amenity-minimap.json";
import { EXTERIOR_MINIMAP_IMAGE_LAYOUT, EXTERIOR_MINIMAP_IMAGE_URL } from "../../data/exteriorMinimap";
import { EXTERIOR_AMENITY_REFERENCES, isInsideLandscapeSite, projectLandscapePlanPoint } from "./amenity-minimap";

test("numbered references cover the PDF legend, with unique refs for repeated features", () => {
  assert.equal(EXTERIOR_AMENITY_REFERENCES.length, 40);
  assert.deepEqual(plan.markers.map((m) => m.number), Array.from({ length: 40 }, (_, i) => i + 1));
  assert.deepEqual([...new Set(plan.markers.map((m) => m.legendNumber))].sort((a, b) => a - b), Array.from({ length: 23 }, (_, i) => i + 1));
  assert.deepEqual(plan.source.pages, [9, 10]);
  assert(plan.markers.every((m) => m.nodeId === null), "No guessed pano destinations");
  assert(!plan.markers.some((m) => /private garden/i.test(m.name)));
});

test("all marker centres are inside the estate perimeter and the full ortho image", () => {
  assert.equal(plan.imageUrl, EXTERIOR_MINIMAP_IMAGE_URL);
  assert.deepEqual(plan.imageSize, [EXTERIOR_MINIMAP_IMAGE_LAYOUT.width, EXTERIOR_MINIMAP_IMAGE_LAYOUT.height]);
  for (const marker of EXTERIOR_AMENITY_REFERENCES) {
    assert(isInsideLandscapeSite(marker.planPoint), `Ref ${marker.number} must stay inside the actual estate`);
    assert(marker.leftPercent > 0 && marker.leftPercent < 1);
    assert(marker.topPercent > 0 && marker.topPercent < 1);
  }
  // Outside scenery shown in the PDF must not be considered part of the site.
  for (const point of [[200,300], [1200,500], [750,750], [500,150]]) assert(!isInsideLandscapeSite(point));
});

test("documented plan registration stays near its road control points", () => {
  let squaredError = 0;
  for (const anchor of plan.registration.anchors) {
    const p = projectLandscapePlanPoint(anchor.plan);
    const distance = Math.hypot(p.leftPercent * 1920 - anchor.ortho[0], p.topPercent * 1080 - anchor.ortho[1]);
    assert(distance < 10, `${anchor.name}: ${distance.toFixed(2)} ortho pixels`);
    squaredError += distance ** 2;
  }
  assert(Math.sqrt(squaredError / plan.registration.anchors.length) < 5);
});

test("reference overlay shares image transforms without reviving old amenities navigation", () => {
  const viewer = readFileSync("components/tour/ExteriorPanoWalkthrough.tsx", "utf8");
  const route = readFileSync("app/exterior-walkthrough/page.tsx", "utf8");
  const points = readFileSync("components/tour/ExteriorAmenityMinimapPoints.tsx", "utf8");
  assert(viewer.includes("<ExteriorAmenityMinimapPoints compact={isCompact} zoom={minimapZoom} />"));
  assert(route.includes("showAmenities={false}"));
  assert(route.includes("amenities={[]}"));
  assert(points.includes('data-pano-assigned="false"'));
  assert(!points.includes("jumpToAmenity"));
  assert(!points.includes("router.push"));
});
