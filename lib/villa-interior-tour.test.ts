import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import {
  VILLA_INTERIOR_BASE_PATH, VILLA_INTERIOR_CONFIG, VILLA_INTERIOR_ENTRY_VIEWS,
  VILLA_INTERIOR_FOLDERS, VILLA_INTERIOR_NAVIGATION_PAIRS, VILLA_INTERIOR_NODES,
  VILLA_INTERIOR_SECTIONS, getVillaInteriorEntry,
  VILLA_INTERIOR_SOURCE_NODES, VILLA_INTERIOR_DUPLICATE_RENDERS,
  getVillaInteriorTour, VILLA_BALCONY_BASE_PATH, VILLA_BALCONY_NODE_FLOORS,
  VILLA_BALCONY_DESTINATIONS,
  VILLA_BALCONY_ENTRY_VIEWS,
} from "./villa-interior-tour";
import { buildInteriorTourGraph } from "./interior-tour/sections";
import { PanoAssetStore } from "./exterior-tour/pano";
import { villaCatalog } from "./villas";
import { getVillaWalkthroughHref } from "./villa-residence";
import { isAnyWalkthroughPath } from "./site-navigation";
import { getInteriorArrivalView } from "./interior-tour/floor-navigation";

test("all balcony arrivals use native framing, not the unrelated interior heading", () => {
  assert.deepEqual(Object.keys(VILLA_BALCONY_ENTRY_VIEWS).sort(), Object.keys(VILLA_BALCONY_NODE_FLOORS).sort());
  for (const id of Object.keys(VILLA_BALCONY_NODE_FLOORS)) {
    const arrival = getInteriorArrivalView("FF_CAM2_F0006", id, VILLA_INTERIOR_SECTIONS, VILLA_INTERIOR_ENTRY_VIEWS, VILLA_BALCONY_ENTRY_VIEWS);
    assert.deepEqual(arrival, { yaw: 0, pitch: 0, zoom: 10 });
    assert.equal(getInteriorArrivalView(undefined, id, VILLA_INTERIOR_SECTIONS, VILLA_INTERIOR_ENTRY_VIEWS, VILLA_BALCONY_ENTRY_VIEWS), arrival);
  }
  assert.equal(getInteriorArrivalView("FF_CAM2_F0005", "FF_CAM2_F0006", VILLA_INTERIOR_SECTIONS, VILLA_INTERIOR_ENTRY_VIEWS, VILLA_BALCONY_ENTRY_VIEWS), undefined,
    "Ordinary same-floor movement must keep its live camera direction");
  assert.equal(getInteriorArrivalView("FF_CAM2_F0006", "SF_CAM1_F0000", VILLA_INTERIOR_SECTIONS, VILLA_INTERIOR_ENTRY_VIEWS, VILLA_BALCONY_ENTRY_VIEWS), VILLA_INTERIOR_ENTRY_VIEWS.SF_CAM1_F0000);
  const renderer = fs.readFileSync("components/tour/InteriorPanoWalkthrough.tsx", "utf8");
  assert(renderer.includes("panoEntryViews?.[startNodeId] ?? entryViews?.[startNodeId]"));
  assert.equal((renderer.match(/getInteriorArrivalView\(/g) ?? []).length, 3, "Buttons, 3D arrows and tile warmup use the same arrival policy");
});

test("all 108 assets are retained, with 100 unique walking stops partitioned by actual floor", () => {
  assert.equal(VILLA_INTERIOR_SOURCE_NODES.length, 108);
  assert.equal(VILLA_INTERIOR_NODES.length, 100);
  assert.equal(new Set(VILLA_INTERIOR_NODES.map((node) => node.id)).size, 100);
  assert.equal(new Set(Object.values(VILLA_INTERIOR_FOLDERS)).size, 108);
  assert.deepEqual(VILLA_INTERIOR_SECTIONS.map((floor) => [floor.id, floor.nodeIds.length]), [
    ["ground", 36], ["first", 40], ["second", 24],
  ]);
  const graph = buildInteriorTourGraph(VILLA_INTERIOR_NODES, VILLA_INTERIOR_SECTIONS);
  const floorById = new Map(VILLA_INTERIOR_SECTIONS.flatMap((floor) => floor.nodeIds.map((id) => [id, floor.id] as const)));
  for (const node of graph.nodes) {
    assert.equal(VILLA_INTERIOR_FOLDERS[node.id], node.imageFilename.replace(/\.[^.]+$/, ""));
    assert(node.neighbors.length || VILLA_INTERIOR_NAVIGATION_PAIRS.some((pair) => pair.includes(node.id)));
    for (const neighbor of node.neighbors) assert.equal(floorById.get(neighbor.id), floorById.get(node.id));
  }
  for (const [from, to] of VILLA_INTERIOR_NAVIGATION_PAIRS) {
    assert.equal(floorById.get(from), floorById.get(to));
    assert.equal(from.replace(/_F\d+$/, ""), to.replace(/_F\d+$/, ""));
  }
});

test("villa entry links use the new tour for every catalogued villa; floor entries never fall back to old apartment IDs", () => {
  assert(isAnyWalkthroughPath("/villa-walkthrough"));
  for (const villa of villaCatalog) {
    const url = new URL(getVillaWalkthroughHref(villa)!, "https://example.test");
    assert.equal(url.pathname, "/villa-walkthrough");
    assert.equal(url.searchParams.get("villa"), String(villa.villaNumber));
  }
  assert.equal(getVillaInteriorEntry(), "GF_CAM5_F0000");
  assert.equal(getVillaInteriorEntry("second"), "SF_CAM1_F0000");
  assert.equal(getVillaInteriorEntry("first", "GF_CAM3_F0006"), "GF_CAM3_F0006");
  assert.equal(getVillaInteriorEntry("first", "../../invalid"), "FF_CAM1_F0000");
  assert.equal(getVillaInteriorEntry("first", "FF_CAM1_F0006"), "FF_CAM1_F0000");
  assert.equal(getVillaInteriorEntry("ground", "GF_CAM0_F0003"), "GF_CAM5_F0003");
  for (const [duplicate, canonical] of Object.entries(VILLA_INTERIOR_DUPLICATE_RENDERS)) {
    assert(VILLA_INTERIOR_FOLDERS[duplicate], "Repeated image remains on disk and indexed");
    assert(VILLA_INTERIOR_NODES.some((node) => node.id === canonical));
    assert(!VILLA_INTERIOR_NODES.some((node) => node.id === duplicate));
  }
  for (const section of VILLA_INTERIOR_SECTIONS) {
    assert(section.nodeIds.includes(section.initialNodeId));
    assert(VILLA_INTERIOR_ENTRY_VIEWS[section.initialNodeId]);
  }
  assert.equal(VILLA_INTERIOR_CONFIG.furnishedPanoBasePath, VILLA_INTERIOR_BASE_PATH);
  assert.equal(VILLA_INTERIOR_CONFIG.bareShellPanoBasePath, VILLA_INTERIOR_BASE_PATH);
  assert.equal(VILLA_INTERIOR_CONFIG.balconyNodes, undefined);
});

test("villa interior loads signed full-quality cloud tiles on demand without scanning all 108 metadata files", async (t) => {
  const previous = globalThis.fetch;
  const requests: string[] = [];
  const signingBatches: string[][] = [];
  const assetUrl = (key: string) => `https://assets.example/${key.split("/").map(encodeURIComponent).join("/")}?sig=test`;
  assert.equal(VILLA_INTERIOR_BASE_PATH, "Varaprasad_Laurels/Panos/varaprasad_villa_1_interior/");
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push(url);
    if (url === "/api/sign-asset") {
      assert.equal(init?.method, "POST");
      const { keys } = JSON.parse(String(init?.body)) as { keys: string[] };
      assert(keys.every(key => key.startsWith(`${VILLA_INTERIOR_BASE_PATH}GF_CAM0.00000/`)));
      signingBatches.push(keys);
      return Response.json({ urls: Object.fromEntries(keys.map(key => [key, assetUrl(key)])) });
    }
    assert.equal(url, assetUrl(`${VILLA_INTERIOR_BASE_PATH}GF_CAM0.00000/meta.json`));
    return Response.json({ width: 8640, height: 4320, cols: 16, rows: 8, tileWidth: 540, tileHeight: 540,
      preview: "preview.jpg", tileUrl: "tiles/tile_{col}_{row}.jpg" });
  };
  t.after(() => { globalThis.fetch = previous; });
  const store = new PanoAssetStore(VILLA_INTERIOR_BASE_PATH);
  const first = store.getPanorama("GF_CAM0.00000");
  assert.equal(first, store.getPanorama("GF_CAM0.00000"));
  const assets = await first;
  assert.equal(requests.filter(url => url !== "/api/sign-asset").length, 1);
  assert.equal(signingBatches.length, 2);
  assert.equal(new Set(signingBatches.flat()).size, 130, "Only active-pano metadata, preview and 128 tile keys are signed");
  assert.equal(assets.previewUrl, assetUrl(`${VILLA_INTERIOR_BASE_PATH}GF_CAM0.00000/preview.jpg`));
  assert.equal(assets.meta.width, 8640);
  assert.notEqual(typeof assets.panorama, "string");
  if (typeof assets.panorama !== "string") {
    assert.equal(assets.panorama.cols * assets.panorama.rows, 128);
    assert.equal(assets.panorama.tileUrl(15, 7), assetUrl(`${VILLA_INTERIOR_BASE_PATH}GF_CAM0.00000/tiles/tile_15_7.jpg`));
  }
  assert.equal(await store.getPanorama("GF_CAM0.00000"), assets);
  assert.equal(requests.length, 3, "Return visits reuse metadata and signed asset URLs");
});

const root = path.resolve("public/varaprasad_villa_1_interior");

test("balcony buttons exist only on first and second floors with same-floor interior returns", () => {
  assert.deepEqual(Object.keys(VILLA_BALCONY_DESTINATIONS), ["first", "second"]);
  for (const [floorId, destination] of Object.entries(VILLA_BALCONY_DESTINATIONS)) {
    const floor = VILLA_INTERIOR_SECTIONS.find(section => section.id === floorId)!;
    assert(floor.nodeIds.includes(destination.nodeId));
    assert(floor.nodeIds.includes(destination.returnNodeId));
    assert(VILLA_BALCONY_NODE_FLOORS[destination.nodeId]);
    assert(!VILLA_BALCONY_NODE_FLOORS[destination.returnNodeId]);
  }
});

test("selected villa supplies only its own balconies, with 01 on second floor and 02 on first", () => {
  const originalFolders = { ...VILLA_INTERIOR_FOLDERS };
  for (let villaNumber = 1; villaNumber <= 78; villaNumber++) {
    if (villaNumber === 21) continue;
    const tour = getVillaInteriorTour(villaNumber);
    assert.equal(tour.config.furnishedPanoBasePath, VILLA_INTERIOR_BASE_PATH);
    assert.equal(tour.config.balconyPanoBasePath, VILLA_BALCONY_BASE_PATH);
    assert.deepEqual(tour.config.balconyNodes?.map(node => node.id).sort(), Object.keys(VILLA_BALCONY_NODE_FLOORS).sort());
    const villa = String(villaNumber).padStart(2, "0");
    assert.equal(tour.folders.FF_CAM2_F0007, `Villa ${villa} Balcony 02`);
    assert.equal(tour.folders.FF_CAM2_F0008, `Villa ${villa} Balcony 02`);
    assert.equal(tour.folders.SF_CAM1_F0003, `Villa ${villa} Balcony 01`);
    const nodes = [...tour.config.furnishedNodes, ...tour.config.balconyNodes!];
    assert.equal(nodes.length, 100);
    for (const node of VILLA_INTERIOR_NODES) {
      assert.deepEqual(nodes.find(candidate => candidate.id === node.id), node, "Source pose/navigation must not change");
      if (!VILLA_BALCONY_NODE_FLOORS[node.id]) assert.equal(tour.folders[node.id], VILLA_INTERIOR_FOLDERS[node.id]);
    }
    for (const id of ["SF_CAM2_F0001", "SF_CAM2_F0002", "SF_CAM2_F0003", "SF_CAM2_F0004"]) {
      assert(tour.config.furnishedNodes.some(node => node.id === id), "Cinema is not a balcony");
    }
  }
  assert.deepEqual(VILLA_INTERIOR_FOLDERS, originalFolders, "Do not mutate shared folders for subsequent visitors");
  for (const invalid of [0, 21, 79, 1.5, NaN]) assert.throws(() => getVillaInteriorTour(invalid));
});

test("all 154 villa balcony sets retain complete original 8.6K tiles and previews", {
  skip: !fs.existsSync(path.resolve("public/varaprasad_villa_balconyPanos")) && "Large local balcony assets are intentionally ignored by Git",
}, () => {
  const balconyRoot = path.resolve("public/varaprasad_villa_balconyPanos");
  const expected = new Set<string>();
  for (let villa = 1; villa <= 78; villa++) {
    if (villa === 21) continue;
    const tour = getVillaInteriorTour(villa);
    for (const id of ["FF_CAM2_F0007", "SF_CAM1_F0003"]) expected.add(tour.folders[id]);
  }
  assert.equal(expected.size, 154);
  assert.deepEqual(fs.readdirSync(balconyRoot).filter(name => fs.statSync(path.join(balconyRoot, name)).isDirectory()).sort(), [...expected].sort());
  for (const folder of expected) {
    const base = path.join(balconyRoot, folder);
    const meta = JSON.parse(fs.readFileSync(path.join(base, "meta.json"), "utf8"));
    assert.deepEqual([meta.width, meta.height, meta.cols, meta.rows, meta.tileWidth, meta.tileHeight], [8640, 4320, 16, 8, 540, 540]);
    assert(fs.statSync(path.join(base, meta.preview)).size > 0);
    for (let row = 0; row < meta.rows; row++) for (let col = 0; col < meta.cols; col++) {
      assert(fs.statSync(path.join(base, meta.tileUrl.replace("{col}", col).replace("{row}", row))).size > 0);
    }
  }
});

test("villa 20 balcony loads its own signed cloud tiles on demand and caches return visits", async (t) => {
  const previous = globalThis.fetch;
  const requests: string[] = [];
  const signingBatches: string[][] = [];
  const assetUrl = (key: string) => `https://assets.example/${key.split("/").map(encodeURIComponent).join("/")}?sig=test`;
  const tour = getVillaInteriorTour(20);
  assert.equal(VILLA_BALCONY_BASE_PATH, "Varaprasad_Laurels/Panos/varaprasad_villa_balconyPanos/");
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push(url);
    if (url === "/api/sign-asset") {
      assert.equal(init?.method, "POST");
      const { keys } = JSON.parse(String(init?.body)) as { keys: string[] };
      assert(keys.every(key => key.startsWith(`${VILLA_BALCONY_BASE_PATH}Villa 20 Balcony 02/`)));
      signingBatches.push(keys);
      return Response.json({ urls: Object.fromEntries(keys.map(key => [key, assetUrl(key)])) });
    }
    assert.equal(url, assetUrl(`${VILLA_BALCONY_BASE_PATH}Villa 20 Balcony 02/meta.json`));
    return Response.json({ width: 8640, height: 4320, cols: 16, rows: 8, tileWidth: 540, tileHeight: 540,
      preview: "preview.jpg", tileUrl: "tiles/tile_{col}_{row}.jpg" });
  };
  t.after(() => { globalThis.fetch = previous; });
  const store = new PanoAssetStore(tour.config.balconyPanoBasePath);
  const assets = await store.getPanorama(tour.folders.FF_CAM2_F0007);
  assert.equal(requests.filter(url => url !== "/api/sign-asset").length, 1);
  assert.equal(signingBatches.length, 2);
  assert.equal(new Set(signingBatches.flat()).size, 130, "Metadata, preview and 128 tiles only for the active balcony");
  assert.equal(assets.previewUrl, assetUrl(`${VILLA_BALCONY_BASE_PATH}Villa 20 Balcony 02/preview.jpg`));
  assert.equal(assets.meta.width, 8640);
  assert.notEqual(typeof assets.panorama, "string");
  if (typeof assets.panorama !== "string") {
    assert.equal(assets.panorama.cols * assets.panorama.rows, 128);
    assert.equal(assets.panorama.tileUrl(15, 7), assetUrl(`${VILLA_BALCONY_BASE_PATH}Villa 20 Balcony 02/tiles/tile_15_7.jpg`));
  }
  assert.equal(await store.getPanorama(tour.folders.FF_CAM2_F0008), assets);
  assert.equal(requests.length, 3, "Return visits and the second first-floor stop reuse the same signed set");
});
test("villa interior omits the shared-preview badge but retains back and balcony controls", () => {
  const component = fs.readFileSync("components/tour/VillaInteriorPanoWalkthrough.tsx", "utf8");
  assert(!component.includes("Shared interior preview"));
  assert(component.includes("Back to masterplan"));
  assert(component.includes("balconyDestinations={VILLA_BALCONY_DESTINATIONS}"));
  assert(component.includes("data-villa-interior={villaNumber}"));
});

test("all 108 local metadata/previews and 13824 original tiles exist", {
  skip: !fs.existsSync(root) && "Large local image assets are intentionally ignored by Git",
}, () => {
  for (const folder of Object.values(VILLA_INTERIOR_FOLDERS)) {
    const base = path.join(root, folder);
    const meta = JSON.parse(fs.readFileSync(path.join(base, "meta.json"), "utf8"));
    assert.deepEqual([meta.width, meta.height, meta.cols, meta.rows, meta.tileWidth, meta.tileHeight], [8640, 4320, 16, 8, 540, 540]);
    assert(fs.statSync(path.join(base, meta.preview)).size > 0);
    for (let row = 0; row < meta.rows; row++) for (let col = 0; col < meta.cols; col++) {
      assert(fs.statSync(path.join(base, meta.tileUrl.replace("{col}", col).replace("{row}", row))).size > 0);
    }
  }
});
