import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import {
  CLUBHOUSE_CONFIG, CLUBHOUSE_NAVIGATION_PAIRS, CLUBHOUSE_NODES, CLUBHOUSE_NODE_LABELS, CLUBHOUSE_PANO_BASE_PATH,
  CLUBHOUSE_PANO_FOLDERS, CLUBHOUSE_SECTIONS, getClubhouseEntry,
} from "./clubhouse-tour";
import { buildInteriorTourGraph } from "./interior-tour/sections";
import { buildExteriorTourGraph, imageFilenameToPanoId } from "./exterior-tour/nodes";
import { PanoAssetStore } from "./exterior-tour/pano";
import { isAnyWalkthroughPath } from "./site-navigation";

test("all 105 clubhouse renders map by exact filename, including supplied spelling variants", () => {
  assert.equal(CLUBHOUSE_NODES.length, 105);
  assert.equal(new Set(CLUBHOUSE_NODES.map((node) => node.id)).size, 105);
  assert.equal(new Set(Object.values(CLUBHOUSE_PANO_FOLDERS)).size, 105);
  for (const node of CLUBHOUSE_NODES) {
    assert.equal(CLUBHOUSE_PANO_FOLDERS[node.id], imageFilenameToPanoId(node.image_filename));
    assert(CLUBHOUSE_NODE_LABELS[node.id]);
  }
  assert.equal(CLUBHOUSE_PANO_FOLDERS.Third_Floor_Pano_4_F0000, "Thid Floor Pano 4.00000");
  assert.equal(CLUBHOUSE_PANO_FOLDERS.Forth_Floor_Pano_1_F0000, "Forth Floor Pano 1.00000");
});

test("all five floors partition the supplied nodes exactly once without guessing from height alone", () => {
  assert.deepEqual(CLUBHOUSE_SECTIONS.map((section) => [section.id, section.nodeIds.length]), [
    ["ground", 26], ["first", 20], ["second", 19], ["third", 35], ["fourth", 5],
  ]);
  const ids = CLUBHOUSE_SECTIONS.flatMap((section) => [...section.nodeIds]);
  assert.equal(ids.length, new Set(ids).size);
  assert.deepEqual(new Set(ids), new Set(CLUBHOUSE_NODES.map((node) => node.id)));
  for (const section of CLUBHOUSE_SECTIONS) assert(section.nodeIds.includes(section.initialNodeId));
});

test("spatial arrows never connect overlapping XY coordinates on different clubhouse floors", () => {
  const graph = buildInteriorTourGraph(CLUBHOUSE_NODES, CLUBHOUSE_SECTIONS);
  assert.equal(graph.nodes.length, 105);
  const floorsById = new Map(CLUBHOUSE_SECTIONS.flatMap((section) => section.nodeIds.map((id) => [id, section.id] as const)));
  for (const node of graph.nodes) {
    assert(node.neighbors.length > 0 || CLUBHOUSE_NAVIGATION_PAIRS.some((pair) => pair.includes(node.id)), `${node.id}: no navigation connection`);
    for (const neighbor of node.neighbors) assert.equal(floorsById.get(neighbor.id), floorsById.get(node.id));
  }
  for (const [from, to] of CLUBHOUSE_NAVIGATION_PAIRS) {
    assert.equal(floorsById.get(from), floorsById.get(to));
    assert.equal(from.replace(/_F\d+$/, ""), to.replace(/_F\d+$/, ""));
  }
});

test("legacy interior graphs remain unchanged without section configuration", () => {
  const nodes = CLUBHOUSE_NODES.slice(0, 8);
  assert.deepEqual(buildInteriorTourGraph(nodes), buildExteriorTourGraph(nodes));
});

test("route accepts verified node or floor entry only and defaults safely to ground", () => {
  assert.equal(getClubhouseEntry(), "Ground_Floor_Pano_1_F0001");
  for (const section of CLUBHOUSE_SECTIONS) assert.equal(getClubhouseEntry(section.id), section.initialNodeId);
  assert.equal(getClubhouseEntry("first", "Third_Floor_Pano_4_F0000"), "Third_Floor_Pano_4_F0000");
  assert.equal(getClubhouseEntry("first", "../../invalid"), "First_Floor_Pano_1_F0001");
  assert.equal(getClubhouseEntry("invalid"), getClubhouseEntry());
  assert(isAnyWalkthroughPath("/clubhouse-walkthrough"));
});

test("clubhouse uses verified processed Cloudflare assets, with no local, raw or old-apartment fallback", () => {
  assert.equal(CLUBHOUSE_PANO_BASE_PATH, "Varaprasad_Laurels/Panos/varaprasad_clubhouse_panos/");
  assert(!CLUBHOUSE_PANO_BASE_PATH.startsWith("/"));
  assert(!CLUBHOUSE_PANO_BASE_PATH.includes("cloudflarestorage.com"));
  assert(!CLUBHOUSE_PANO_BASE_PATH.includes("Clubhouse Panos 12k"));
  assert.equal(CLUBHOUSE_CONFIG.furnishedPanoBasePath, CLUBHOUSE_PANO_BASE_PATH);
  assert.equal(CLUBHOUSE_CONFIG.bareShellPanoBasePath, CLUBHOUSE_PANO_BASE_PATH);
  assert.equal(CLUBHOUSE_CONFIG.furnishedNodes, CLUBHOUSE_NODES);
  assert.equal(CLUBHOUSE_CONFIG.bareShellNodes, CLUBHOUSE_NODES);
  assert.equal(CLUBHOUSE_CONFIG.balconyNodes, undefined);
});

test("clubhouse resolves signed full-quality tiles on demand without scanning 105 metadata files", async (t) => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  const signingBatches: string[][] = [];
  const assetUrl = (key: string) => `https://assets.example/${key.split("/").map(encodeURIComponent).join("/")}?sig=test`;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push(url);
    if (url === "/api/sign-asset") {
      assert.equal(init?.method, "POST");
      const { keys } = JSON.parse(String(init?.body)) as { keys: string[] };
      assert(keys.every((key) => key.startsWith(CLUBHOUSE_PANO_BASE_PATH)));
      signingBatches.push(keys);
      return Response.json({ urls: Object.fromEntries(keys.map((key) => [key, assetUrl(key)])) });
    }
    assert(url.startsWith("https://assets.example/"));
    assert(new URL(url).pathname.endsWith("/meta.json"));
    return Response.json({ width: 12288, height: 6144, cols: 16, rows: 8,
      tileWidth: 768, tileHeight: 768, preview: "preview.jpg", tileUrl: "tiles/tile_{col}_{row}.jpg" });
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const store = new PanoAssetStore(CLUBHOUSE_PANO_BASE_PATH);
  const folder = CLUBHOUSE_PANO_FOLDERS[getClubhouseEntry()];
  const resolved = await store.getPanorama(folder);
  assert.equal(requests.filter((url) => url !== "/api/sign-asset").length, 1);
  assert.equal(signingBatches.length, 2);
  assert.equal(new Set(signingBatches.flat()).size, 130, "One metadata, preview and 128 tile keys");
  assert.equal(resolved.meta.width, 12288);
  assert.notEqual(typeof resolved.panorama, "string");
  if (typeof resolved.panorama !== "string") {
    assert.equal(resolved.panorama.cols * resolved.panorama.rows, 128);
    assert.equal(resolved.panorama.tileUrl(15, 7), assetUrl(`${CLUBHOUSE_PANO_BASE_PATH}${folder}/tiles/tile_15_7.jpg`));
  }
  assert.equal(await store.getPanorama(folder), resolved);
  assert.equal(requests.length, 3, "Return visits reuse metadata, authorization and resolved assets");
});

const root = path.resolve("public/varaprasad_clubhouse_panos");
test("105 local previews, metadata files and all 13440 original 12K tiles are present", {
  skip: !fs.existsSync(root) && "Local generated panoramas are intentionally not stored in Git",
}, () => {
  assert.equal(fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length, 105);
  for (const node of CLUBHOUSE_NODES) {
    const folder = path.join(root, CLUBHOUSE_PANO_FOLDERS[node.id]);
    const meta = JSON.parse(fs.readFileSync(path.join(folder, "meta.json"), "utf8"));
    assert.equal(meta.width, 12288);
    assert.equal(meta.height, 6144);
    assert.equal(meta.cols * meta.rows, 128);
    assert.equal(meta.tileWidth, 768);
    assert.equal(meta.tileHeight, 768);
    assert(fs.statSync(path.join(folder, meta.preview)).size > 0);
    for (let row = 0; row < meta.rows; row++) {
      for (let col = 0; col < meta.cols; col++) {
        const tile = meta.tileUrl.replace("{col}", col).replace("{row}", row);
        assert(fs.statSync(path.join(folder, tile)).size > 0, `${node.id}: ${tile}`);
      }
    }
  }
});
