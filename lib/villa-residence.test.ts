import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import panoConfig from "../data/villa-panos.json";
import { villaCatalog } from "./villas";
import {
  getVillaFloorArea, getVillaFloorPlan, isSharedVillaFloorPlan, getVillaFloorRooms, getVillaNumberFromId,
  getVillaPano, getVillaPanoAssetUrl, getVillaPanoBaseUrl, getVillaPanoInitialPitch, getVillaRecord, getVillaWalkthroughHref,
} from "./villa-residence";

test("explicit villa numbers map to the exact cloud folder, never the camera or frame number", () => {
  assert.equal(panoConfig.panos.length, 76);
  assert.equal(new Set(panoConfig.panos.map((pano) => pano.villaNumber)).size, 76);
  for (const pano of panoConfig.panos) {
    const match = /^Villa (\d+) - Cam \d+ - Frame \d+$/.exec(pano.folder);
    assert(match);
    assert.equal(Number(match[1]), pano.villaNumber);
  }
  const one = getVillaPano(1)!;
  assert.equal(one.folder, "Villa 001 - Cam 20 - Frame 00000");
  assert.equal(getVillaPano(20)?.folder, "Villa 020 - Cam 10 - Frame 00000");
  assert.equal(getVillaPano(78)?.folder, "Villa 078 - Cam 05 - Frame 00000");
  assert.equal(getVillaPanoAssetUrl(one, "preview.jpg"),
    "Varaprasad_Laurels/Panos/varaprasad_villa_panos/Villa%20001%20-%20Cam%2020%20-%20Frame%2000000/preview.jpg");
});

test("villa panoramas use the processed Cloudflare prefix, not local assets or raw PNGs", () => {
  assert.equal(getVillaPanoBaseUrl(), "Varaprasad_Laurels/Panos/varaprasad_villa_panos");
  for (const pano of panoConfig.panos) {
    const key = getVillaPanoAssetUrl(pano, "meta.json");
    assert(!key.startsWith("/"), "Relative keys must go through the existing asset signer");
    assert(!key.includes("cloudflarestorage.com"), "The private S3 API is not a browser asset origin");
    assert(!key.includes("/Varaprasad_Villa_Panos/"), "Never load the raw PNG originals in the viewer");
  }
});

test("villa openings tilt six degrees up while preserving individual pitch calibration", () => {
  for (const pano of panoConfig.panos) {
    assert.equal(getVillaPanoInitialPitch(pano), (pano.pitchDegrees + 6) * Math.PI / 180);
  }
  assert.equal(getVillaPanoInitialPitch({ ...panoConfig.panos[0], pitchDegrees: 3 }), 9 * Math.PI / 180);
});

test("Villa 7 is unavailable and Villa 21 remains excluded; neither substitutes a neighbour", () => {
  assert.equal(getVillaPano(7), null);
  assert.equal(getVillaPano(21), null);
  assert.equal(getVillaPano(0), null);
  assert.equal(getVillaPano(79), null);
  assert.equal(getVillaNumberFromId("villa-08"), 8);
  assert.equal(getVillaNumberFromId("Tower_A_00_08"), null);
  for (const villa of villaCatalog) {
    if (villa.villaNumber !== 7) assert(getVillaPano(villa.villaNumber));
  }
});

test("villa details, per-floor areas and dimensions come from each villa's actual CAD type", () => {
  for (const villa of villaCatalog) {
    assert.equal(getVillaRecord(villa.villaNumber), villa);
    assert.equal(getVillaFloorArea(villa, "ground"), villa.details.floorAreasSqFt.ground);
    assert.deepEqual(getVillaFloorRooms(villa, "ground"), villa.details.rooms.ground);
    assert(getVillaFloorRooms(villa, "ground").every((room) => room.name && room.dimensionsFt));
  }
  const east = getVillaRecord(1)!;
  const west = getVillaRecord(2)!;
  assert.notDeepEqual(getVillaFloorRooms(east, "ground"), getVillaFloorRooms(west, "ground"));
  assert.equal(east.details.facing, "East");
  assert.equal(west.details.facing, "West");
});

test("all villa types share the new villa preview without using old apartment assets or plans", () => {
  for (const villa of villaCatalog) {
    for (const floor of ["ground", "first", "second"] as const) {
      assert.equal(getVillaFloorPlan(villa, floor), `/villa-floor-plans/villa-1/${floor}.avif`);
      assert(isSharedVillaFloorPlan(villa, floor));
      assert(fs.statSync(path.join("public", getVillaFloorPlan(villa, floor)!)).size > 0);
    }
    assert.equal(getVillaFloorPlan(villa, "terrace"), null, "Do not invent an unsupplied terrace plan");
    const url = new URL(getVillaWalkthroughHref(villa)!, "https://example.test");
    assert.equal(url.pathname, "/villa-walkthrough");
    assert.equal(url.searchParams.get("villa"), String(villa.villaNumber));
    assert.equal(url.searchParams.get("facing"), villa.details.facing);
  }
});

test("residence sidebar and expanded floor plans use the existing uncropped shared reference drawings", () => {
  const source = fs.readFileSync("components/VillaResidenceExperience.tsx", "utf8");
  const css = fs.readFileSync("components/VillaResidenceExperience.module.css", "utf8");
  assert(source.includes("Villa 1 reference plan"));
  assert(source.includes("alt={planAlt}"));
  assert(source.includes('detailTab === "villa" ? villa.image : floorPlan'));
  assert(css.includes("object-fit: contain"));
});

const root = path.resolve("public/varaprasad_villa_panos");
test("all indexed local panoramas have their preview, metadata and 128 original tiles", {
  skip: !fs.existsSync(root) && "Local panorama assets are intentionally not tracked in Git",
}, () => {
  for (const pano of panoConfig.panos) {
    const folder = path.join(root, pano.folder);
    assert(fs.existsSync(path.join(folder, "preview.jpg")), `${pano.folder}: missing preview`);
    const meta = JSON.parse(fs.readFileSync(path.join(folder, "meta.json"), "utf8"));
    assert.equal(meta.width, 12288);
    assert.equal(meta.height, 6144);
    assert.equal(meta.cols * meta.rows, 128);
    const files = new Set(fs.readdirSync(path.join(folder, "tiles")));
    for (let row = 0; row < meta.rows; row += 1) {
      for (let col = 0; col < meta.cols; col += 1) assert(files.has(`tile_${col}_${row}.jpg`), `${pano.folder}: missing ${col}:${row}`);
    }
  }
});
