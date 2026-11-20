import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import originalNodes from "@/data/Varaprasad_Exterior_Pano_Data_v1.json";
import cameras from "@/data/exterior-remaining-v2-cameras.json";
import { remainingExteriorNodes, REMAINING_EXTERIOR_PANO_BASE } from "./remaining";
import { buildExteriorTourGraph, getSequentialNodeIds, preserveViewYawBetweenNodes, getNodeHeading } from "./nodes";
import { PanoAssetStore, selectPriorityTiles } from "./pano";
import { getVillaPointers } from "./villa-hotspots";
import type { PanoMeta } from "./types";

const graph = buildExteriorTourGraph([...originalNodes, ...remainingExteriorNodes]);
const localRoot = path.resolve("public/varaprasad_exterior_panos_remaining_v2");

test("34 matched v2 panos extend the tour without changing the original 251 counters/assets", () => {
  assert.equal(remainingExteriorNodes.length, 34);
  assert.equal(graph.nodes.length, 285);
  assert.deepEqual(graph.order.slice(0, 251), buildExteriorTourGraph(originalNodes).order);
  assert.equal(graph.nodes[0].panoId, "EP.00000");
  assert.equal(graph.nodes[250].panoId, "EP.00250");
  assert.equal(graph.nodes[251].panoId, "Exterior PANO Cam 02.00000");
  assert.equal(new Set(graph.nodes.map(n => n.id)).size, 285);
  assert.equal(new Set(graph.nodes.map(n => n.panoId)).size, 285);
});

test("new coordinates and orientations stay exactly as exported; only asset mapping is added", () => {
  const records = Object.values(cameras).flat();
  for (const node of remainingExteriorNodes) {
    const { pano_id, asset_base_path, navigation_order, route_id, ...pose } = node;
    assert.deepEqual(pose, records.find(r => r.id === node.id));
    assert(pano_id && route_id);
    assert.equal(asset_base_path, REMAINING_EXTERIOR_PANO_BASE);
    assert.equal(navigation_order, node.frame);
    assert.equal(getVillaPointers(node.id).length, 0, "New path-local IDs must not reuse a road villa pointer");
  }
});

test("mixed local/global render counters are mapped explicitly; unmatched frame/image stay excluded", () => {
  const counts = Object.fromEntries(Object.keys(cameras).map(cam => [cam, remainingExteriorNodes.filter(n => n.route_id === `remaining-camera-${cam}`).length]));
  assert.deepEqual(counts, { "02": 5, "03": 3, "04": 4, "05": 6, "06": 8, "07": 5, "08": 3 });
  assert.equal(remainingExteriorNodes.find(n => n.frame === 263)?.pano_id, "Exterior PANO Cam 05.00263");
  assert.equal(remainingExteriorNodes.find(n => n.frame === 273)?.pano_id, "Exterior PANO Cam 06.00273");
  assert.equal(remainingExteriorNodes.find(n => n.frame === 278)?.pano_id, "Exterior PANO Cam 07.00000");
  assert(!remainingExteriorNodes.some(n => n.frame === 272));
  assert(!remainingExteriorNodes.some(n => n.pano_id === "Exterior PANO Cam 07.00005"));
});

test("every added stop is reachable through coordinate branches and the existing sequential road controls", () => {
  const seen = new Set<string>();
  const pending = [graph.order[0]];
  while (pending.length) {
    const id = pending.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    pending.push(...graph.byId[id].neighbors.map(n => n.id));
    const sequential = getSequentialNodeIds(graph, id);
    for (const target of [sequential.previousId, sequential.nextId]) if (target) pending.push(target);
  }
  assert.deepEqual(graph.nodes.filter(n => !seen.has(n.id)).map(n => n.id), []);
  for (const source of remainingExteriorNodes) {
    const node = graph.byId[source.id];
    assert(node.neighbors.length > 0);
    for (const neighbor of node.neighbors) {
      const target = graph.byId[neighbor.id];
      const yaw = preserveViewYawBetweenNodes(node, target, 0.3);
      const difference = getNodeHeading(node) + 0.3 - getNodeHeading(target) - yaw;
      assert(Math.abs(Math.sin(difference)) < 1e-9, "Movement must preserve the world-facing direction");
    }
  }
});

test("sequential controls do not teleport between independent camera runs", () => {
  for (const camera of Object.keys(cameras)) {
    const nodes = remainingExteriorNodes.filter(n => n.route_id === `remaining-camera-${camera}`);
    assert.equal(getSequentialNodeIds(graph, nodes[0].id).previousId, null);
    assert.equal(getSequentialNodeIds(graph, nodes.at(-1)!.id).nextId, null);
  }
  assert.equal(getSequentialNodeIds(graph, originalNodes.at(-1)!.id).nextId, null);
});

test("optional local backup contains every included preview and 540px tile", {
  skip: !fs.existsSync(localRoot) && "Local generated assets are optional after the verified Cloudflare migration",
}, () => {
  for (const node of remainingExteriorNodes) {
    const dir = path.join(localRoot, node.pano_id!);
    const meta = JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8")) as PanoMeta;
    assert.equal(meta.width, 8640); assert.equal(meta.height, 4320);
    assert.equal(meta.cols, 16); assert.equal(meta.rows, 8);
    assert.equal(meta.tileWidth, 540); assert.equal(meta.tileHeight, 540);
    assert(fs.statSync(path.join(dir, meta.preview!)).size > 0);
    for (let row = 0; row < meta.rows; row++) for (let col = 0; col < meta.cols; col++) {
      assert(fs.statSync(path.join(dir, meta.tileUrl!.replace("{col}", String(col)).replace("{row}", String(row)))).size > 0);
    }
  }
});

test("metadata, preview, tiles and warmup all use signed v2 cloud assets without a local dependency", async () => {
  const before = globalThis.fetch;
  const id = remainingExteriorNodes[0].pano_id!;
  const requested: string[] = [];
  const meta: PanoMeta = { width: 8640, height: 4320, cols: 16, rows: 8, tileWidth: 540, tileHeight: 540,
    preview: "preview.jpg", tileFormat: "jpg", tileUrl: "tiles/tile_{col}_{row}.jpg" };
  const signedKeys: string[] = [];
  const assetUrl = (key: string) => `https://assets.example/${key.split("/").map(encodeURIComponent).join("/")}?sig=test`;
  globalThis.fetch = async (input, init) => {
    const url = String(input); requested.push(url);
    if (url === "/api/sign-asset") {
      const { keys } = JSON.parse(String(init?.body)) as { keys: string[] };
      signedKeys.push(...keys);
      return Response.json({ urls: Object.fromEntries(keys.map(key => [key, assetUrl(key)])) });
    }
    assert.equal(url, assetUrl(`${REMAINING_EXTERIOR_PANO_BASE}/${id}/meta.json`));
    return Response.json(meta);
  };
  try {
    assert.equal(REMAINING_EXTERIOR_PANO_BASE, "Varaprasad_Laurels/Panos/varaprasad_exterior_panos_remaining_v2");
    const store = new PanoAssetStore("Varaprasad_Laurels/Panos/varaprasad_exterior_panos", async src => src, { [id]: REMAINING_EXTERIOR_PANO_BASE });
    const resolved = await store.getPanorama(id);
    assert(requested.includes(assetUrl(`${REMAINING_EXTERIOR_PANO_BASE}/${id}/meta.json`)));
    assert.equal(new Set(signedKeys).size, 130, "Metadata, preview and all 128 tiles are signed");
    assert(signedKeys.every(key => key.startsWith(`${REMAINING_EXTERIOR_PANO_BASE}/`)));
    assert.equal(resolved.previewUrl, assetUrl(`${REMAINING_EXTERIOR_PANO_BASE}/${id}/preview.jpg`));
    assert(typeof resolved.panorama !== "string");
    assert.equal(resolved.panorama.tileUrl(0, 0), assetUrl(`${REMAINING_EXTERIOR_PANO_BASE}/${id}/tiles/tile_0_0.jpg`));
    assert.equal(await store.preloadPanoramaPreview(id), resolved.previewUrl);
    const warmup = selectPriorityTiles(id, meta, store.getBaseUrl(id), { yaw: 0, pitch: 0, zoom: 0 }, 4);
    assert(warmup.every(t => t.url.startsWith(REMAINING_EXTERIOR_PANO_BASE)));
    assert((await store.resolveSignedTiles(warmup)).every(t => t.url.startsWith("https://assets.example/")));
    assert(!requested.some(url => url.startsWith("/varaprasad_exterior_panos_remaining_v2/")));
    assert.equal(store.getBaseUrl("EP.00000"), "Varaprasad_Laurels/Panos/varaprasad_exterior_panos");
  } finally { globalThis.fetch = before; }
});

test("exterior route hides POIs and both amenities menus, but keeps the minimap/current location", () => {
  const page = fs.readFileSync("app/exterior-walkthrough/page.tsx", "utf8");
  const viewer = fs.readFileSync("components/tour/ExteriorPanoWalkthrough.tsx", "utf8");
  assert(page.includes("showAmenities={false}"));
  assert(page.includes("amenities={[]}"));
  assert(page.includes("requestedNode.route_id ? -requestedNode.yaw : 0"), "New direct entries start at camera-local yaw zero, without doubling world yaw");
  assert(!page.includes("canonicalExteriorAmenities"));
  assert(viewer.includes("if (!showAmenities) return []"));
  assert(viewer.includes("{showAmenities ? <>"));
  assert(viewer.includes("<ExteriorMinimapPanel"));
  assert(viewer.includes("activeMinimapPoint={activeMinimapPoint}"));
});
