import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import originals from "../../data/Varaprasad_Exterior_Pano_Data_v1.json";
import { remainingExteriorNodes } from "./remaining";
import { buildExteriorTourGraph } from "./nodes";
import { EXTERIOR_AMENITY_REFERENCES } from "./amenity-minimap";
import { getExteriorPlayerMinimapPoint, projectExteriorPanoPosition } from "./minimap-position";

const graph = buildExteriorTourGraph([...originals, ...remainingExteriorNodes]);

test("all 19 approved POI panos put the current location exactly on their registered dot", () => {
  for (const marker of EXTERIOR_AMENITY_REFERENCES) {
    assert.deepEqual(getExteriorPlayerMinimapPoint(graph.byId[marker.nodeId]), {
      leftPercent: marker.leftPercent, topPercent: marker.topPercent,
    }, `Reference ${marker.number}, pano ${marker.panoNumber}`);
  }
});

test("all 285 original/remaining camera locations map into the full ortho without clamping or changing exports", () => {
  assert.equal(graph.nodes.length, 285);
  for (const node of graph.nodes) {
    const before = { ...node.rawPosition };
    const point = getExteriorPlayerMinimapPoint(node);
    assert(Number.isFinite(point.leftPercent) && Number.isFinite(point.topPercent));
    assert(point.leftPercent >= 0 && point.leftPercent <= 1, `${node.id}: X ${point.leftPercent}`);
    assert(point.topPercent >= 0 && point.topPercent <= 1, `${node.id}: Y ${point.topPercent}`);
    assert.deepEqual(node.rawPosition, before);
  }
});

test("walking near a POI follows a continuous registration instead of snapping to the legacy projection", () => {
  for (const marker of EXTERIOR_AMENITY_REFERENCES) {
    const position = marker.exportedPosition;
    const centre = projectExteriorPanoPosition(position);
    for (const axis of ["x", "y"] as const) {
      for (const delta of [-1, 1]) {
        const point = projectExteriorPanoPosition({ ...position, [axis]: position[axis] + delta });
        const pixels = Math.hypot((point.leftPercent - centre.leftPercent) * 3840, (point.topPercent - centre.topPercent) * 2160);
        assert(pixels < 1, `One-centimetre step near reference ${marker.number}: ${pixels}px`);
      }
    }
  }
});

test("expanded/compact current location uses the same blue as an active POI", () => {
  const source = readFileSync("components/tour/ExteriorPanoWalkthrough.tsx", "utf8");
  assert(source.includes("getExteriorPlayerMinimapPoint(activeNode)"));
  assert(!source.includes("y: -activeNode.rawPosition.y"));
  assert(source.includes('data-exterior-player-marker="expanded"'));
  assert(source.includes('data-exterior-player-marker="compact"'));
  assert(source.includes("bg-[#2f7fb5]"));
});
