import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { CLUBHOUSE_FLOOR_PLANS } from "./clubhouse-floor-plans";
import { CLUBHOUSE_NODES, CLUBHOUSE_PANO_FOLDERS, CLUBHOUSE_SECTIONS } from "./clubhouse-tour";
import { getFloorPlanArrivalView, getFloorPlanDestination } from "./interior-tour/floor-plans";

test("upper-floor POIs preserve all exact user-supplied cameras, filenames, folders and arrival degrees", () => {
  const expected: [number, string, string, number, number, number][] = [
  [26, "Second_Floor_Pano_2_F0001", "Second Floor Pano 2.00001", -65.1, -4.54, 10],
  [
    17,
    "First_Floor_Pano_1_F0004",
    "First Floor Pano 1.00004",
    45.01,
    -0.37,
    0
  ],
  [
    18,
    "First_Floor_Pano_2_F0002",
    "First Floor Pano 2.00002",
    6.2,
    -6.93,
    10
  ],
  [
    19,
    "First_Floor_Pano_4_F0001",
    "First Floor Pano 4.00001",
    39.31,
    0.82,
    0
  ],
  [
    23,
    "First_Floor_Pano_3_F0002",
    "First Floor Pano 3.00002",
    7.68,
    2.44,
    10
  ],
  [
    24,
    "First_Floor_Pano_1_F0001",
    "First Floor Pano 1.00001",
    38.19,
    -2.26,
    0
  ],
  [
    25,
    "Second_Floor_Pano_3_F0001",
    "Second Floor Pano 3.00001",
    -92.92,
    -0.01,
    10
  ],
  [
    27,
    "Second_Floor_Pano_1_F0005",
    "Second Floor Pano 1.00005",
    -92.44,
    -4.73,
    0
  ],
  [
    28,
    "Second_Floor_Pano_4_F0002",
    "Second Floor Pano 4.00002",
    32.87,
    2.47,
    0
  ],
  [
    29,
    "Second_Floor_Pano_4_F0001",
    "Second Floor Pano 4.00001",
    63.79,
    -4.49,
    10
  ],
  [
    31,
    "Second_Floor_Pano_4_F0000",
    "Second Floor Pano 4.00000",
    -6.98,
    -1.77,
    10
  ],
  [
    36,
    "Second_Floor_Pano_1_F0001",
    "Second Floor Pano 1.00001",
    6.6,
    -4.73,
    10
  ],
  [
    37,
    "Third_Floor_Pano_4_F0000",
    "Thid Floor Pano 4.00000",
    -169.22,
    -4.46,
    10
  ],
  [
    39,
    "Third_Floor_Pano_5_F0001",
    "Third Floor Pano 5.00001",
    71.41,
    -2.31,
    10
  ],
  [
    49,
    "Third_Floor_Pano_4_F0001",
    "Thid Floor Pano 4.00001",
    34.43,
    -0.06,
    10
  ],
  [
    51,
    "Third_Floor_Pano_5_F0003",
    "Third Floor Pano 5.00003",
    -0.09,
    -3.96,
    10
  ],
  [
    53,
    "Third_Floor_Pano_3_F0001",
    "Third Floor Pano 3.00001",
    7.96,
    2.86,
    10
  ],
  [
    54,
    "Third_Floor_Pano_3_F0003",
    "Third Floor Pano 3.00003",
    -98.23,
    -3.02,
    10
  ],
  [
    55,
    "Third_Floor_Pano_1_F0007",
    "Third Floor Pano 1.00007",
    -59.96,
    -1.59,
    10
  ],
  [
    58,
    "Third_Floor_Pano_1_F0004",
    "Third Floor Pano 1.00004",
    -6.69,
    -5.51,
    10
  ],
  [
    61,
    "Third_Floor_Pano_1_F0001",
    "Third Floor Pano 1.00001",
    6.81,
    -2.13,
    10
  ],
  [
    62,
    "Forth_Floor_Pano_1_F0003",
    "Forth Floor Pano 1.00003",
    141.03,
    1.52,
    10
  ],
  [
    63,
    "Forth_Floor_Pano_1_F0001",
    "Forth Floor Pano 1.00001",
    -30.13,
    0.37,
    10
  ]
];
  const markers = Object.values(CLUBHOUSE_FLOOR_PLANS).flatMap(plan => plan.markers);
  for (const [number, nodeId, folder, yaw, pitch, zoom] of expected) {
    const marker = markers.find(marker => marker.number === number)!;
    assert(marker, `Reference ${number} remains present`);
    assert.equal(marker.nodeId, nodeId);
    assert.equal(marker.panoFilename, folder + ".png");
    assert.equal(marker.panoFolder, folder);
    assert.equal(CLUBHOUSE_PANO_FOLDERS[nodeId], folder);
    assert.equal(CLUBHOUSE_NODES.find(node => node.id === nodeId)?.image_filename, folder + ".png");
    assert.deepEqual(marker.arrivalView, { yaw, pitch, zoom });
    assert.deepEqual(getFloorPlanArrivalView(marker), { yaw: yaw * Math.PI / 180, pitch: pitch * Math.PI / 180, zoom });
  }
  assert.deepEqual(markers.filter(marker => !marker.nodeId).map(marker => marker.number), [47, 56]);
  assert.equal(markers.filter(marker => marker.nodeId).length, 32);
});

test("all plan presentations use yellow-gold POIs and standard blue hover/active states", () => {
  const component = fs.readFileSync("components/tour/InteriorNumberedFloorPlan.tsx", "utf8");
  assert(component.includes("bg-[#fce190] text-[#00142b]"));
  assert(component.includes("bg-[#2f7fb5] text-white"));
  assert(component.includes("group-hover:bg-[#2f7fb5]"));
  assert(component.includes("group-focus-visible:bg-[#2f7fb5]"));
  assert(!component.includes("group-hover:bg-[#153860]"));
  assert(!component.includes("#4169e1"));
});

test("all five clubhouse levels have original-aspect AVIF cutouts and small AVIF thumbnails", async () => {
  assert.deepEqual(Object.keys(CLUBHOUSE_FLOOR_PLANS), CLUBHOUSE_SECTIONS.map(section => section.id));
  for (const plan of Object.values(CLUBHOUSE_FLOOR_PLANS)) {
    const fullPath = path.join("public", plan.image);
    const full = await sharp(fullPath).metadata();
    const thumbnail = await sharp(path.join("public", plan.thumbnail)).metadata();
    assert.equal(full.compression, "av1");
    assert.equal(full.hasAlpha, true);
    assert.equal(full.width, plan.width);
    assert.equal(full.height, plan.height);
    assert(Math.abs(thumbnail.width! / thumbnail.height! - plan.width / plan.height) < 0.004);
    assert(Math.max(thumbnail.width!, thumbnail.height!) <= 640);
    assert(fs.statSync(fullPath).size < 1_500_000, `${plan.id}: bound high-quality cutout size`);
    assert(fs.statSync(path.join("public", plan.thumbnail)).size < 100_000, "Minimaps stay on small thumbnails");
  }
});

test("only the first-floor minimap rotates into landscape without altering source data or the expanded plan", () => {
  const first = CLUBHOUSE_FLOOR_PLANS.first;
  assert.equal(first.minimapRotation, 90);
  assert(first.width < first.height, "Original portrait dimensions must stay unchanged");
  for (const plan of Object.values(CLUBHOUSE_FLOOR_PLANS).filter(plan => plan.id !== "first")) assert.equal(plan.minimapRotation, 0);
  const component = fs.readFileSync("components/tour/InteriorNumberedFloorPlan.tsx", "utf8");
  assert(component.includes('data-minimap-image-layer'));
  assert(component.includes('rotateMinimap ? 1 / aspect : aspect'));
  assert(component.includes('style={{ aspectRatio: minimapAspect }}'));
  assert(component.includes('aspectRatio: aspect }}'));
});

test("34 stable references retain only the approved POIs and two still-unassigned rooms", () => {
  assert.deepEqual(Object.values(CLUBHOUSE_FLOOR_PLANS).map(plan => plan.markers.length), [9, 5, 7, 11, 2]);
  const numbers = Object.values(CLUBHOUSE_FLOOR_PLANS).flatMap(plan => plan.markers.map(marker => marker.number));
  assert.deepEqual(numbers, Array.from({ length: 65 }, (_, index) => index + 1).filter(number => ![2, 8, 10, 12, 13, 14, 15, 20, 21, 22, 30, 32, 33, 34, 35, 38, 40, 41, 42, 43, 44, 45, 46, 48, 50, 52, 57, 59, 60, 64, 65].includes(number)));
  for (const plan of Object.values(CLUBHOUSE_FLOOR_PLANS)) {
    const section = CLUBHOUSE_SECTIONS.find(section => section.id === plan.id)!;
    for (const marker of plan.markers) {
      assert(marker.left > 0 && marker.left < 100 && marker.top > 0 && marker.top < 100);
      assert(marker.label.length > 0);
      assert(!marker.label.toLowerCase().includes("double height"), "Voids are not navigable rooms");
      if (marker.nodeId) assert(section.nodeIds.includes(marker.nodeId), "Assignments must stay on the correct floor");
    }
  }
});

test("first-floor reference 23 keeps its requested position below the now-removed reference 20", () => {
  const moved = CLUBHOUSE_FLOOR_PLANS.first.markers.find(marker => marker.number === 23)!;
  assert.equal(moved.left, 13);
  assert.equal(moved.top, 44);
  assert.equal(moved.nodeId, "First_Floor_Pano_3_F0002");
});

test("ground POIs use the user's exact camera IDs, filenames and folders with reviewed level arrival views", () => {
  const expected = { 1: "Ground_Floor_Pano_1_F0001", 3: "Ground_Floor_Pano_2_F0000", 4: "Ground_Floor_Pano_3_F0001",
    5: "Ground_Floor_Pano_5_F0001", 6: "Ground_Floor_Pano_5_F0005", 7: "Ground_Floor_Pano_5_F0006",
    9: "Ground_Floor_Pano_4_F0002", 11: "Ground_Floor_Pano_2_F0004", 16: "Ground_Floor_Pano_1_F0007" };
  assert.deepEqual(Object.fromEntries(CLUBHOUSE_FLOOR_PLANS.ground.markers.map(marker => [marker.number, marker.nodeId])), expected);
  for (const marker of CLUBHOUSE_FLOOR_PLANS.ground.markers) {
    assert.equal(marker.panoFilename, CLUBHOUSE_NODES.find(node => node.id === marker.nodeId)?.image_filename);
    assert.equal(marker.panoFolder, CLUBHOUSE_PANO_FOLDERS[marker.nodeId!]);
    const view = getFloorPlanArrivalView(marker)!;
    assert(view && Math.abs(view.pitch) <= 10 * Math.PI / 180);
    assert.equal(view.yaw, marker.arrivalView!.yaw * Math.PI / 180);
    assert(view.zoom! <= 10);
  }
});

test("only explicit same-floor assignments navigate; pending or wrong-floor mappings cannot teleport", () => {
  const room = CLUBHOUSE_FLOOR_PLANS.ground.markers[0];
  const ground = CLUBHOUSE_SECTIONS[0], first = CLUBHOUSE_SECTIONS[1];
  assert.equal(getFloorPlanDestination({ ...room, nodeId: null }, ground.nodeIds), null);
  assert.equal(getFloorPlanDestination({ ...room, nodeId: first.initialNodeId }, ground.nodeIds), null);
  assert.equal(getFloorPlanDestination({ ...room, nodeId: ground.initialNodeId }, ground.nodeIds), ground.initialNodeId);
});

test("minimap POIs navigate directly and expansion has a separate overlaid button, without a padded text card", () => {
  const component = fs.readFileSync("components/tour/InteriorNumberedFloorPlan.tsx", "utf8");
  const minimap = component.slice(component.indexOf('<div data-floor-plan-minimap'), component.indexOf('{open && createPortal'));
  assert(minimap.includes('data-minimap-room-number={marker.number}'));
  assert(minimap.includes('onClick={() => chooseRoom(marker.number)}'));
  assert(!minimap.includes('disabled={disabled}'), "POI clicks remain available for latest-intent queuing while loading");
  assert(!minimap.includes('role="status"'), "Keep the minimap free of messages");
  assert(minimap.includes('aria-haspopup="dialog"'));
  assert(minimap.includes('absolute right-1 top-1'));
  assert(minimap.includes('bg-transparent p-0 text-[#2f7fb5] shadow-none'));
  assert(minimap.includes('relative w-full overflow-hidden'));
  assert(minimap.includes('className="h-3.5 w-3.5"'));
  assert(!minimap.includes('Tap to enlarge'));
  assert(!minimap.includes('bg-[#f4f0e8]'));
  assert(!minimap.includes('150 * aspect'));
});

test("all five clubhouse floors use dot POIs, and camera views apply only on POI clicks", () => {
  const wrapper = fs.readFileSync("components/tour/ClubhousePanoWalkthrough.tsx", "utf8");
  const viewer = fs.readFileSync("components/tour/InteriorPanoWalkthrough.tsx", "utf8");
  const debug = fs.readFileSync("components/tour/PanoDebugPanel.tsx", "utf8");
  const plan = fs.readFileSync("components/tour/InteriorNumberedFloorPlan.tsx", "utf8");
  assert(wrapper.includes("numberedFloorPlans={CLUBHOUSE_FLOOR_PLANS}"));
  assert(!wrapper.includes("showPanoDebug"));
  assert(viewer.includes('INTERIOR_PANO_DEV_TOOL_ENABLED = process.env.NODE_ENV === "development"'));
  assert(viewer.includes("INTERIOR_PANO_DEV_TOOL_ENABLED && showPanoDebug"));
  assert(viewer.includes("imageFilename={activeNode.imageFilename}"));
  assert(debug.includes("navigator.clipboard.writeText"));
  assert(plan.includes("onNavigate(destination, getFloorPlanArrivalView(marker))"));
  for (const floor of Object.values(CLUBHOUSE_FLOOR_PLANS)) assert.equal(floor.markerStyle, "dot");
  assert(plan.includes("{useDots ? null : marker.number}"));
  assert(plan.includes('SHOW_POI_REFERENCES = process.env.NODE_ENV === "development"'));
  assert(viewer.includes("poiArrivalView ?? getInteriorArrivalView"));
  assert(viewer.includes("if (targetId === activeNodeIdRef.current)"));
  assert(!wrapper.includes("panoEntryViews="), "POI orientation must not globally reset same-floor walking");
});
