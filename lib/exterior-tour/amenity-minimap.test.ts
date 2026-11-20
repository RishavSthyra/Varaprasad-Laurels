import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import plan from "../../data/exterior-amenity-minimap.json";
import originals from "../../data/Varaprasad_Exterior_Pano_Data_v1.json";
import { remainingExteriorNodes } from "./remaining";
import { buildExteriorTourGraph } from "./nodes";
import { EXTERIOR_MINIMAP_IMAGE_LAYOUT, EXTERIOR_MINIMAP_IMAGE_URL } from "../../data/exteriorMinimap";
import { EXTERIOR_AMENITY_REFERENCES, isInsideLandscapeSite, projectLandscapePlanPoint } from "./amenity-minimap";

// User-supplied reference -> exact pano/camera/arrival view.
// The user's latest correction assigns ref 25 to pano 142; pano 269 is a separate point.
const expected = [
  [1,4,"Exterior_PANO_Spline_F0003","EP.00003",10.63,3.68,0],
  [2,208,"Exterior_PANO_Spline_F0207","EP.00207",176.91,-2.31,0],
  [3,205,"Exterior_PANO_Spline_F0204","EP.00204",165.47,0.82,0],
  [7,196,"Exterior_PANO_Spline_F0195","EP.00195",19.85,1.51,0],
  [8,282,"Exterior_PANO_Spline_07_F0004","Exterior PANO Cam 07.00004",14.09,-0.34,0],
  [9,284,"Exterior_PANO_Spline_08_F0001","Exterior PANO Cam 08.00001",-140.52,-1.38,0],
  [11,252,"Exterior_PANO_Spline_02_F0000","Exterior PANO Cam 02.00000",-72.26,3.14,0],
  [12,35,"Exterior_PANO_Spline_F0034","EP.00034",18.78,-0.8,0],
  [13,40,"Exterior_PANO_Spline_F0039","EP.00039",36.83,1.85,0],
  [15,257,"Exterior_PANO_Spline_03_F0000","Exterior PANO Cam 03.00000",37.14,0.97,0],
  [16,266,"Exterior_PANO_Spline_05_F0002","Exterior PANO Cam 05.00265",-3.95,2.1,0],
  [17,271,"Exterior_PANO_Spline_06_F0001","Exterior PANO Cam 06.00270",179.18,-4.17,0],
  [19,274,"Exterior_PANO_Spline_06_F0005","Exterior PANO Cam 06.00274",-95.57,-6.34,0],
  [20,275,"Exterior_PANO_Spline_06_F0006","Exterior PANO Cam 06.00275",38.48,4.3,0],
  [22,149,"Exterior_PANO_Spline_F0148","EP.00148",-4.99,0.05,0],
  [25,142,"Exterior_PANO_Spline_F0141","EP.00141",60,2.74,0],
  [30,100,"Exterior_PANO_Spline_F0099","EP.00099",-145.75,-2.93,0],
  [36,81,"Exterior_PANO_Spline_F0080","EP.00080",-0.92,1.98,0],
  [40,11,"Exterior_PANO_Spline_F0010","EP.00010",-4.59,3.28,0]
];
const originalPositions: Record<string, number[]> = {"1":[702,602],"2":[808,549],"3":[815,485],"7":[749,582],"8":[630,562],"9":[658,565],"11":[527,860],"12":[450,1001],"13":[400,1030],"15":[253,889],"16":[299,501],"17":[356,365],"19":[346,305],"20":[336,267],"22":[515,280],"25":[436,240],"30":[266,597],"36":[287,931],"40":[551,604]};
const graph = buildExteriorTourGraph([...originals, ...remainingExteriorNodes]);

test("only the 19 supplied and confirmed points remain, with exact arrival views", () => {
  assert.equal(EXTERIOR_AMENITY_REFERENCES.length, 19);
  assert.deepEqual(plan.markers.map(m => [m.number, m.panoNumber, m.nodeId, m.panoFolder, m.arrivalView.yaw, m.arrivalView.pitch, m.arrivalView.zoom]), expected);
  assert.equal(new Set(plan.markers.map(m => m.number)).size, 19);
  assert(!plan.markers.some(m => m.number === 24));
  assert.equal(plan.markers.find(m => m.number === 25)?.panoNumber, 142);
  assert(!plan.markers.some(m => m.panoNumber === 269), "Separate pano 269 point is deferred at the user's request");
});

test("every POI names a real original/v2 cloud pano; exported positions are untouched", () => {
  for (const marker of plan.markers) {
    const node = graph.byId[marker.nodeId];
    assert(node, `Ref ${marker.number} must resolve in the exterior graph`);
    assert.equal(node.order + 1, marker.panoNumber);
    assert.equal(node.panoId, marker.panoFolder);
    assert.equal(node.imageFilename, marker.panoFilename);
    assert.deepEqual(node.rawPosition, marker.exportedPosition);
    assert.deepEqual(marker.planPoint, originalPositions[String(marker.number)]);
    assert([marker.arrivalView.yaw, marker.arrivalView.pitch, marker.arrivalView.zoom].every(Number.isFinite));
  }
});

test("all marker centres remain in the estate and full ortho with the existing registration", () => {
  assert.equal(plan.imageUrl, EXTERIOR_MINIMAP_IMAGE_URL);
  assert.deepEqual(plan.imageSize, [EXTERIOR_MINIMAP_IMAGE_LAYOUT.width, EXTERIOR_MINIMAP_IMAGE_LAYOUT.height]);
  assert.deepEqual(plan.source.pages, [9, 10]);
  for (const marker of EXTERIOR_AMENITY_REFERENCES) {
    assert(isInsideLandscapeSite(marker.planPoint), `Ref ${marker.number} must stay in the estate`);
    assert(marker.leftPercent > 0 && marker.leftPercent < 1);
    assert(marker.topPercent > 0 && marker.topPercent < 1);
  }
  for (const point of [[200,300], [1200,500], [750,750], [500,150]]) assert(!isInsideLandscapeSite(point));
  let squaredError = 0;
  for (const anchor of plan.registration.anchors) {
    const p = projectLandscapePlanPoint(anchor.plan);
    const distance = Math.hypot(p.leftPercent * 1920 - anchor.ortho[0], p.topPercent * 1080 - anchor.ortho[1]);
    assert(distance < 10);
    squaredError += distance ** 2;
  }
  assert(Math.sqrt(squaredError / plan.registration.anchors.length) < 5);
});

test("compact/expanded dots use exact arrival views without resurrecting old amenity menus", () => {
  const viewer = readFileSync("components/tour/ExteriorPanoWalkthrough.tsx", "utf8");
  const route = readFileSync("app/exterior-walkthrough/page.tsx", "utf8");
  const points = readFileSync("components/tour/ExteriorAmenityMinimapPoints.tsx", "utf8");
  const css = readFileSync("components/tour/ExteriorAmenityMinimapPoints.module.css", "utf8");
  assert(route.includes("showAmenities={false}"));
  assert(route.includes("amenities={[]}"));
  for (const mapping of ["viewYawDegrees: marker.arrivalView.yaw", "viewPitchDegrees: marker.arrivalView.pitch", "viewZoom: marker.arrivalView.zoom"]) assert(viewer.includes(mapping));
  assert(viewer.includes('aria-label="Exterior minimap"'));
  assert(points.includes("onNavigate(marker)"));
  assert(points.includes("onPointerDown={event => event.stopPropagation()}"));
  assert(points.includes("aria-pressed={marker.nodeId === activeNodeId}"));
  assert(!/>\s*\{marker\.number\}\s*</.test(points), "Rendered markers are dots, not numbers");
  assert(css.includes("#fce190") && css.includes("#2f7fb5") && css.includes('[aria-pressed="true"]'));
  assert(!points.includes("router.push"));
});
