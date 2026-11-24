import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import originals from "../../data/Varaprasad_Exterior_Pano_Data_v1.json";
import { remainingExteriorNodes } from "./remaining";
import { buildExteriorTourGraph } from "./nodes";
import {
  EXTERIOR_ASSET_INITIAL_NODE_ID,
  EXTERIOR_ASSET_INITIAL_PANO_FOLDER,
  EXTERIOR_ASSET_INITIAL_PREVIEW_KEY,
  EXTERIOR_ASSET_INITIAL_VIEW,
} from "./assets";

test("default exterior entry is pano 3, with the matching Cloudflare preview and exact arrival view", () => {
  const graph = buildExteriorTourGraph([...originals, ...remainingExteriorNodes]);
  const node = graph.byId[EXTERIOR_ASSET_INITIAL_NODE_ID];
  assert.equal(graph.nodes.length, 285);
  assert.equal(node.order + 1, 3);
  assert.equal(node.id, "Exterior_PANO_Spline_F0002");
  assert.equal(node.imageFilename, "LS_Exterior_PANO_Spline_F0002.jpeg");
  assert.equal(node.panoId, "EP.00002");
  assert.equal(node.panoId, EXTERIOR_ASSET_INITIAL_PANO_FOLDER);
  assert.equal(EXTERIOR_ASSET_INITIAL_PREVIEW_KEY, "Varaprasad_Laurels/Panos/varaprasad_exterior_panos/EP.00002/preview.jpg");
  assert.deepEqual(node.rawPosition, { x: -1240.214, y: 2894.722, z: 165 });
  assert.deepEqual(EXTERIOR_ASSET_INITIAL_VIEW, { yaw: 59.96, pitch: 0.85, zoom: 0 });
});

test("initial arrival is absolute and entry-only, while other pano deep links retain their view handling", () => {
  const route = readFileSync("app/exterior-walkthrough/page.tsx", "utf8");
  const viewer = readFileSync("components/tour/ExteriorPanoWalkthrough.tsx", "utf8");
  assert(route.includes("initialView={preferredInitialNodeId === EXTERIOR_ASSET_INITIAL_NODE_ID"));
  assert(route.includes("? EXTERIOR_ASSET_INITIAL_VIEW : undefined}"));
  assert(route.includes("requestedNode?.id ??"));
  assert(route.includes("previewPointer.position.yawDegrees - requestedNode.yaw"));
  assert(viewer.includes("initialResolved.nodeId === initialRequestedNodeId ? initialView : undefined"));
  assert(viewer.includes("entryView ? 0 : initialYawOffsetDegrees"));
  assert(viewer.includes("entryView?.pitch ?? initialAmenity?.startingPano.viewPitch ?? initialNode?.pitch ?? 0"));
  assert(viewer.includes("entryView?.zoom ?? initialAmenity?.startingPano.viewZoom ?? DEFAULT_ZOOM"));
});
