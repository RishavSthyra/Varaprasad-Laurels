import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { VILLA_FLOOR_PLANS } from "./villa-floor-plans";
import { VILLA_INTERIOR_SECTIONS, VILLA_INTERIOR_NODES, VILLA_INTERIOR_FOLDERS } from "./villa-interior-tour";
import { getFloorPlanArrivalView, getFloorPlanDestination } from "./interior-tour/floor-plans";

test("all 25 mapped villa POIs preserve the exact supplied camera, filename, folder and arrival degrees", () => {
  const expected: [number, string, string, number, number, number][] = [
    [1,"GF_CAM5_F0000","GF_CAM5.00000",-46.42,-0.3,10],
    [5,"GF_CAM4_F0002","GF_CAM4.00002",123.13,2.27,10],
    [4,"GF_CAM4_F0004","GF_CAM4.00004",-1.78,-1.5,10],
    [2,"GF_CAM3_F0002","GF_CAM3.00002",-22.95,2.9,10],
    [14,"GF_CAM2_F0002","GF_CAM2.00002",-93.76,-6.08,10],
    [6,"GF_CAM2_F0003","GF_CAM2.00003",38.94,5.45,10],
    [7,"GF_CAM2_F0007","GF_CAM2.00007",-172.2,-2.04,10],
    [8,"GF_CAM2_F0007","GF_CAM2.00007",-172.2,-2.04,10],
    [18,"GF_CAM2_F0003","GF_CAM2.00003",120.85,6.27,10],
    [31,"FF_CAM7_F0002","FF_CAM7.00002",-2.3,0.84,0],
    [32,"FF_CAM5_F0002","FF_CAM5.00002",-9.59,4.24,0],
    [34,"FF_CAM3_F0002","FF_CAM3.00002",64.75,4.49,0],
    [35,"FF_CAM6_F0001","FF_CAM6.00001",-4.85,3.51,0],
    [36,"FF_CAM3_F0006","FF_CAM3.00006",-2.35,-3.94,0],
    [27,"FF_CAM2_F0003","FF_CAM2.00003",-36.1,-3.08,0],
    [28,"FF_CAM2_F0006","FF_CAM2.00006",104.56,-3.76,0],
    [26,"FF_CAM4_F0002","FF_CAM4.00002",-2.58,0.87,0],
    [22,"FF_CAM1_F0002","FF_CAM1.00002",64.25,-1.95,0],
    [24,"FF_CAM1_F0005","FF_CAM1.00005",-39.9,-7.44,0],
    [44,"SF_CAM1_F0000","SF_CAM1.00000",-4.67,-3.61,0.05],
    [48,"SF_CAM3_F0002","SF_CAM3.00002",-2.74,-1.45,0],
    [41,"SF_CAM2_F0002","SF_CAM2.00002",88.56,-2.05,0],
    [47,"SF_CAM6_F0001","SF_CAM6.00001",52.63,-6.48,0],
    [46,"SF_CAM0_F0000","SF_CAM0.00000",-2.61,-0.99,10],
    [45,"SF_CAM6_F0004","SF_CAM6.00004",-5.02,-5.47,0],
  ];
  const markers = Object.values(VILLA_FLOOR_PLANS).flatMap(plan => plan.markers);
  for (const [number, nodeId, folder, yaw, pitch, zoom] of expected) {
    const marker = markers.find(marker => marker.number === number)!;
    assert.equal(marker.nodeId, nodeId);
    assert.equal(marker.panoFilename, folder + ".png");
    assert.equal(marker.panoFolder, folder);
    assert.equal(VILLA_INTERIOR_FOLDERS[nodeId], folder);
    assert.equal(VILLA_INTERIOR_NODES.find(node => node.id === nodeId)?.image_filename, folder + ".png");
    assert.deepEqual(marker.arrivalView, { yaw, pitch, zoom });
    assert.deepEqual(getFloorPlanArrivalView(marker), { yaw: yaw * Math.PI / 180, pitch: pitch * Math.PI / 180, zoom });
  }
  assert.equal(markers.filter(marker => marker.nodeId).length, 25);
  assert.deepEqual(markers.filter(marker => !marker.nodeId).map(marker => marker.number), [15, 16, 17, 23]);
});

test("shared panorama destinations retain per-POI views, including zero and fractional zoom", () => {
  const marker = (number: number) => Object.values(VILLA_FLOOR_PLANS).flatMap(plan => plan.markers).find(marker => marker.number === number)!;
  assert.equal(marker(6).nodeId, marker(18).nodeId);
  assert.notDeepEqual(getFloorPlanArrivalView(marker(6)), getFloorPlanArrivalView(marker(18)));
  assert.deepEqual(getFloorPlanArrivalView(marker(7)), getFloorPlanArrivalView(marker(8)));
  assert.equal(getFloorPlanArrivalView(marker(22))!.zoom, 0);
  assert.equal(getFloorPlanArrivalView(marker(44))!.zoom, 0.05);
  assert.equal(marker(15).nodeId, null, "Do not invent a destination for the missing ground-floor bedroom take");
  const viewer = fs.readFileSync("components/tour/InteriorPanoWalkthrough.tsx", "utf8");
  const restore = viewer.slice(viewer.indexOf("if (targetId === activeNodeIdRef.current)"), viewer.indexOf("warmupRunRef.current += 1", viewer.indexOf("if (targetId === activeNodeIdRef.current)")));
  assert(restore.includes("setIsTransitioning(true)"), "Same-pano camera animations must participate in the navigation lock too");
  assert(restore.includes("setIsTransitioning(false)"));
});

test("floor-plan clicks queue the latest intent instead of disabling POIs during loading", () => {
  const viewer = fs.readFileSync("components/tour/InteriorPanoWalkthrough.tsx", "utf8");
  const plan = fs.readFileSync("components/tour/InteriorNumberedFloorPlan.tsx", "utf8");
  assert(viewer.includes("setPendingFloorPlanNavigation({ targetId, view })"));
  assert(viewer.includes("pendingFloorPlanNavigation.targetId, pendingFloorPlanNavigation.view"));
  assert(viewer.includes("!pendingFloorPlanNavigation || isTransitioning || navigationInFlightRef.current"));
  assert(!plan.includes("if (disabled) return"));
  assert(!plan.includes("disabled={disabled}"));
  assert(!plan.includes('role="status"'), "Do not put loading or unassigned-room messages on the minimap");
});

test("compact minimaps hide the entire controls column and desktop enlargement has no panel chrome", () => {
  const plan = fs.readFileSync("components/tour/InteriorNumberedFloorPlan.tsx", "utf8");
  const css = fs.readFileSync("components/tour/InteriorFloorControls.module.css", "utf8");
  const villa = fs.readFileSync("components/tour/VillaInteriorPanoWalkthrough.tsx", "utf8");
  assert(plan.includes('aria-label="Hide minimap"'));
  assert(!plan.includes("<header") && !plan.includes("<aside") && !plan.includes("<ol"));
  assert(css.includes("(pointer: coarse)"));
  assert(css.includes("translateX(calc(100% + 2rem))"));
  assert(css.includes("prefers-reduced-motion"));
  assert(css.includes("clamp(10rem, 44vw, 11rem)"));
  assert(villa.includes('aria-label="Back to masterplan"'));
  assert(villa.includes('className="hidden sm:inline"'));
});

test("all three villa floors have original-resolution AVIF cutouts and small AVIF thumbnails", async () => {
  assert.deepEqual(Object.keys(VILLA_FLOOR_PLANS), VILLA_INTERIOR_SECTIONS.map(section => section.id));
  for (const plan of Object.values(VILLA_FLOOR_PLANS)) {
    const imagePath = path.join("public", plan.image);
    const full = await sharp(imagePath).metadata();
    const small = await sharp(path.join("public", plan.thumbnail)).metadata();
    assert.equal(full.compression, "av1");
    assert.equal(full.hasAlpha, true);
    assert.equal(small.compression, "av1");
    assert.equal(full.width, plan.width);
    assert.equal(full.height, plan.height);
    assert(Math.max(small.width!, small.height!) <= 640);
    assert(Math.abs(small.width! / small.height! - plan.width / plan.height) < 0.004);
    assert(fs.statSync(imagePath).size < 1_500_000);
    assert(fs.statSync(path.join("public", plan.thumbnail)).size < 100_000);
  }
});

test("29 Villa 1 dot POIs retain stable references and remove only the user-listed points", () => {
  assert.deepEqual(Object.values(VILLA_FLOOR_PLANS).map(plan => plan.markers.length), [12, 11, 6]);
  const numbers = Object.values(VILLA_FLOOR_PLANS).flatMap(plan => plan.markers.map(marker => marker.number));
  assert.deepEqual(numbers, Array.from({ length: 48 }, (_, index) => index + 1).filter(number => ![3, 19, 21, 10, 11, 12, 13, 20, 9, 33, 29, 30, 25, 43, 42, 38, 39, 40, 37].includes(number)));
  for (const plan of Object.values(VILLA_FLOOR_PLANS)) {
    assert.equal(plan.markerStyle, "dot");
    assert(!plan.minimapRotation, "Preserve the supplied Villa 1 render orientation");
    assert(plan.image.startsWith("/villa-floor-plans/villa-1/"), "Use separate Villa 1 URLs to avoid cached Villa 2 plans");
    for (const marker of plan.markers) {
      assert(marker.left > 0 && marker.left < 100 && marker.top > 0 && marker.top < 100);
      assert(marker.label && !/double height|void|^lift$/i.test(marker.label));
      const ids = VILLA_INTERIOR_SECTIONS.find(section => section.id === plan.id)!.nodeIds;
      assert.equal(getFloorPlanDestination(marker, ids), marker.nodeId);
      if (marker.nodeId) assert(ids.includes(marker.nodeId), "POI destinations stay on their correct floor");
      else assert.equal(getFloorPlanArrivalView(marker), undefined);
    }
  }
});

test("villa generation reads only the corrected Villa 1 originals", () => {
  const generator = fs.readFileSync("scripts/generate-villa-floor-plans.mjs", "utf8");
  assert(generator.includes('sourceDirectory: "public/Villa 1 Renders"'));
  assert(!generator.includes("Villa 2 Renders"));
});

test("shared villa viewer uses the reusable plans without showing the pano debug panel", () => {
  const wrapper = fs.readFileSync("components/tour/VillaInteriorPanoWalkthrough.tsx", "utf8");
  const viewer = fs.readFileSync("components/tour/InteriorPanoWalkthrough.tsx", "utf8");
  assert(wrapper.includes("numberedFloorPlans={VILLA_FLOOR_PLANS}"));
  assert(!wrapper.includes("showPanoDebug"));
  assert(!wrapper.includes("minimapUnavailable"));
  assert(wrapper.includes("balconyDestinations={VILLA_BALCONY_DESTINATIONS}"));
  assert(viewer.includes('INTERIOR_PANO_DEV_TOOL_ENABLED = process.env.NODE_ENV === "development"'));
  assert(viewer.includes("showPanoDebug = false"));
});
