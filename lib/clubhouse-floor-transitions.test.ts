import assert from "node:assert/strict";
import test from "node:test";
import { CLUBHOUSE_ENTRY_VIEWS, CLUBHOUSE_FLOOR_MARKERS } from "./clubhouse-floor-transitions";
import { CLUBHOUSE_NODES, CLUBHOUSE_SECTIONS } from "./clubhouse-tour";
import { getFloorArrivalView, getFloorMarkerProjection } from "./interior-tour/floor-navigation";

test("every inspected floor-access marker connects valid adjacent floors in the correct direction", () => {
  const nodeIds = new Set(CLUBHOUSE_NODES.map((node) => node.id));
  const floorIndex = (id: string) => CLUBHOUSE_SECTIONS.findIndex((floor) => floor.nodeIds.includes(id));
  const markerIds = new Set<string>();
  for (const [sourceId, markers] of Object.entries(CLUBHOUSE_FLOOR_MARKERS)) {
    assert(nodeIds.has(sourceId));
    for (const marker of markers) {
      assert(!markerIds.has(marker.id));
      markerIds.add(marker.id);
      assert(nodeIds.has(marker.targetNodeId));
      assert.equal(floorIndex(marker.targetNodeId) - floorIndex(sourceId), marker.direction === "up" ? 1 : -1);
      assert(CLUBHOUSE_ENTRY_VIEWS[marker.targetNodeId], "Every arrival must have a calibrated view");
      assert(Number.isFinite(marker.yaw) && Number.isFinite(marker.pitch) && Number.isFinite(marker.wallYaw));
    }
  }
  assert.equal(markerIds.size, 9);
  for (let index = 0; index < CLUBHOUSE_SECTIONS.length; index++) {
    const floor = CLUBHOUSE_SECTIONS[index];
    const directions = new Set(floor.nodeIds.flatMap((id) => (CLUBHOUSE_FLOOR_MARKERS[id] ?? []).map((marker) => marker.direction)));
    assert.deepEqual(directions, new Set(index === 0 ? ["up"] : index === 4 ? ["down"] : ["up", "down"]));
  }
});

test("all floor entries have finite calibrated views and ground faces the supplied reception reference", () => {
  for (const floor of CLUBHOUSE_SECTIONS) {
    const view = CLUBHOUSE_ENTRY_VIEWS[floor.initialNodeId];
    assert(view && Number.isFinite(view.yaw) && Math.abs(view.pitch) < Math.PI / 2);
    assert.equal(view.zoom, floor.id === "ground" ? 0 : 10);
  }
  assert.equal(CLUBHOUSE_ENTRY_VIEWS.Ground_Floor_Pano_1_F0001.yaw, -68 * Math.PI / 180);
  assert.equal(CLUBHOUSE_ENTRY_VIEWS.Ground_Floor_Pano_1_F0001.pitch, 8 * Math.PI / 180);
});

test("cross-floor arrivals use calibration but same-floor walking and legacy tours preserve their camera", () => {
  const first = "First_Floor_Pano_1_F0001";
  const ground = "Ground_Floor_Pano_1_F0007";
  assert.equal(getFloorArrivalView(ground, first, CLUBHOUSE_SECTIONS, CLUBHOUSE_ENTRY_VIEWS), CLUBHOUSE_ENTRY_VIEWS[first]);
  assert.equal(getFloorArrivalView(first, ground, CLUBHOUSE_SECTIONS, CLUBHOUSE_ENTRY_VIEWS), CLUBHOUSE_ENTRY_VIEWS[ground]);
  assert.equal(getFloorArrivalView("First_Floor_Pano_1_F0002", first, CLUBHOUSE_SECTIONS, CLUBHOUSE_ENTRY_VIEWS), undefined);
  assert.equal(getFloorArrivalView(ground, first, undefined, undefined), undefined);
});

test("front-wall relocations and side-wall plane rotations cannot regress to the squeezed calibration", () => {
  const markers = Object.values(CLUBHOUSE_FLOOR_MARKERS).flat();
  const frontWallIds = new Set(["ground-approach-up", "ground-stairs-up", "second-down", "third-down"]);
  for (const marker of markers) {
    if (marker.presentation === "floating") continue;
    // elementLayer rotates locally after lookAt: position yaw + local wallYaw
    // must describe the same vertical wall plane, modulo its 180-degree normal.
    const plane = ((marker.yaw * 180 / Math.PI + marker.wallYaw) % 180 + 180) % 180;
    const expected = frontWallIds.has(marker.id) ? 0 : 90;
    const error = Math.min(Math.abs(plane - expected), Math.abs(plane - expected - 180));
    assert(error < .2, `${marker.id}: incorrect wall-plane rotation`);
  }
  const ground = markers.find((marker) => marker.id === "ground-stairs-up")!;
  assert(Math.abs(ground.yaw) < 5 * Math.PI / 180, "Ground stairs marker belongs on the front wall");
});

test("floating labels follow the stair openings while the first floor is unchanged", () => {
  for (const id of ["Second_Floor_Pano_1_F0001", "Third_Floor_Pano_1_F0001"]) {
    const pair = CLUBHOUSE_FLOOR_MARKERS[id];
    assert.equal(pair.length, 2);
    assert(pair.every((marker) => marker.presentation === "floating"));
    for (const marker of pair) {
      assert(Math.abs(marker.yaw * 180 / Math.PI + marker.wallYaw - 180) < .01, "Floating signs share a fixed front-facing world plane");
    }
    if (id.startsWith("Second_")) {
      assert(pair[0].pitch > pair[1].pitch, "Up label sits over the rising steps, down label lower over the gap");
      assert(pair[1].yaw < Math.PI, "Down label is inside the opening, not on the right side wall");
    } else assert.equal(pair[0].pitch, pair[1].pitch);
    assert(pair[0].yaw < pair[1].yaw);
    assert(pair.every((marker) => Math.abs(marker.yaw - Math.PI) < 15 * Math.PI / 180));
  }
  const first = CLUBHOUSE_FLOOR_MARKERS.First_Floor_Pano_1_F0001;
  assert.deepEqual(first.map((marker) => [marker.presentation, marker.yaw, marker.pitch, marker.wallYaw]), [
    [undefined, 145.5 * Math.PI / 180, 4.42 * Math.PI / 180, -55.5],
    [undefined, 207.27 * Math.PI / 180, 0, 62.73],
  ]);
  const terrace = CLUBHOUSE_FLOOR_MARKERS.Forth_Floor_Pano_1_F0000[0];
  assert.equal(terrace.presentation, "floating");
  assert.equal(terrace.yaw, 0);
  assert.equal(terrace.wallYaw, 0);
});

test("stair projections are fixed world transforms, not camera-facing screen labels", () => {
  for (const marker of Object.values(CLUBHOUSE_FLOOR_MARKERS).flat()) {
    const projection = getFloorMarkerProjection(marker);
    assert.deepEqual(projection.position, { yaw: marker.yaw, pitch: marker.pitch });
    assert.equal(projection.rotation.yaw, `${marker.wallYaw}deg`);
    assert.equal(projection.hoverScale, false);
    assert.deepEqual(getFloorMarkerProjection(marker), projection);
    if (marker.presentation === "floating") assert.deepEqual(projection.size, { width: 160, height: 144 });
  }
});
