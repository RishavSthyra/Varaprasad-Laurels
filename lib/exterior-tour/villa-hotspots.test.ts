import assert from "node:assert/strict";
import test from "node:test";
import config from "../../data/exterior-villa-hotspots.json";
import catalog from "../../data/villas.json";
import nodes from "../../data/Varaprasad_Exterior_Pano_Data_v1.json";
import { getExteriorPanoNumber, getVillaInteriorHref, getVillaPointers, villaHotspotsSchema, villaPointerSchema } from "./villa-hotspots";

test("the editable JSON validates and uses the visible player counter", () => {
  assert(villaHotspotsSchema.safeParse(config).success);
  assert.equal(getExteriorPanoNumber("Exterior_PANO_Spline_F0000"), 1);
  assert.equal(getExteriorPanoNumber("Exterior_PANO_Spline_F0192"), 193);
  assert.equal(getExteriorPanoNumber("Exterior_PANO_Spline_F0193"), 194);
  assert.equal(getExteriorPanoNumber("unrelated"), null);
  assert.deepEqual(getVillaPointers("unrelated"), []);
});

test("the CAD-corrected villa and facing reach the interior route and entry node", () => {
  const pointer = getVillaPointers("Exterior_PANO_Spline_F0192")[0];
  const url = new URL(getVillaInteriorHref(pointer), "https://example.test");
  assert.equal(url.pathname, "/interior-kitchen-foyer");
  assert.equal(url.searchParams.get("villa"), "12");
  assert.equal(url.searchParams.get("facing"), "West");
  assert.equal(url.searchParams.get("node"), pointer.interior.nodeId);
  assert.equal(url.searchParams.has("node"), true);
  assert(!new URL(getVillaInteriorHref({ ...pointer, interior: { ...pointer.interior, nodeId: null } }), "https://example.test").searchParams.has("node"));
});

test("all 77 catalogued villas have exactly one distinct garage pano; Villa 21 stays excluded", () => {
  const pointers = config.panos.flatMap((pano) => pano.pointers);
  const expected = catalog.villas.map((villa) => villa.villaNumber).sort((a, b) => a - b);
  assert.equal(expected.length, 77);
  assert.equal(pointers.length, 77);
  assert.equal(config.panos.length, 77);
  assert.equal(new Set(config.panos.map((pano) => pano.panoNumber)).size, 77);
  assert.deepEqual(pointers.map((pointer) => pointer.villaNumber).sort((a, b) => a - b), expected);
  assert(!pointers.some((pointer) => pointer.villaNumber === 21));
  assert.equal(new Set(pointers.map((pointer) => pointer.id)).size, 77);
  for (const pano of config.panos) {
    const node = nodes[pano.panoNumber - 1];
    assert(node, `Missing source panorama ${pano.panoNumber}`);
    assert.equal(getExteriorPanoNumber(node.id), pano.panoNumber);
    assert.deepEqual(getVillaPointers(node.id), pano.pointers);
  }
  assert.equal(nodes.filter((node) => getVillaPointers(node.id).length > 0).length, 77);
});

test("every entrance uses its CAD facing and remains inside the panorama sphere", () => {
  for (const pointer of config.panos.flatMap((pano) => pano.pointers)) {
    const villa = catalog.villas.find((villa) => villa.villaNumber === pointer.villaNumber)!;
    const type = catalog.types.find((type) => type.id === villa.typeId)!;
    assert.equal(pointer.facing, type.facing, `Wrong facing for Villa ${pointer.villaNumber}`);
    assert(pointer.position.distanceMetres + pointer.heightMetres + pointer.bounceHeightMetres < 10);
    assert.equal(pointer.color, "#ffffff");
  }
});

test("configuration supports 77 entrances and multiple pointers per pano", () => {
  const pointer = config.panos[0].pointers[0];
  const panos = Array.from({ length: 77 }, (_, i) => ({ panoNumber: i + 1, pointers: [{ ...pointer, id: `villa-${i + 1}`, villaNumber: i + 1 }] }));
  panos[0].pointers.push({ ...pointer, id: "second-entrance", villaNumber: 78 });
  assert(villaHotspotsSchema.safeParse({ numbering: "player-counter", panos }).success);
});

test("invalid routes, facing, duplicate IDs and pano numbers are rejected", () => {
  const pointer = config.panos[0].pointers[0];
  assert(!villaPointerSchema.safeParse({ ...pointer, facing: "North" }).success);
  assert(!villaPointerSchema.safeParse({ ...pointer, interior: { ...pointer.interior, path: "javascript:alert(1)" } }).success);
  assert(!villaPointerSchema.safeParse({ ...pointer, position: { ...pointer.position, distanceMetres: 100 } }).success);
  assert(!villaHotspotsSchema.safeParse({ ...config, panos: [config.panos[0], config.panos[0]] }).success);
  assert(!villaHotspotsSchema.safeParse({ ...config, panos: [{ panoNumber: 193, pointers: [pointer, pointer] }] }).success);
});
