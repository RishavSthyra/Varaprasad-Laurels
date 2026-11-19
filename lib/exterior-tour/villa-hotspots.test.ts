import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import config from "../../data/exterior-villa-hotspots.json";
import catalog from "../../data/villas.json";
import nodes from "../../data/Varaprasad_Exterior_Pano_Data_v1.json";
import review from "../../docs/exterior-villa-visibility-review.json";
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
  assert.equal(url.pathname, "/villa-walkthrough");
  assert.equal(url.searchParams.get("villa"), "12");
  assert.equal(url.searchParams.get("facing"), "West");
  assert.equal(url.searchParams.has("node"), false, "Legacy apartment node IDs must not leak into the new villa tour");
  assert(!new URL(getVillaInteriorHref({ ...pointer, interior: { ...pointer.interior, nodeId: null } }), "https://example.test").searchParams.has("node"));
});

test("all 77 catalogued villas have garage pointers, including supplementary views; Villa 21 stays excluded", () => {
  const pointers = config.panos.flatMap((pano) => pano.pointers);
  const expected = catalog.villas.map((villa) => villa.villaNumber).sort((a, b) => a - b);
  assert.equal(expected.length, 77);
  assert.equal(pointers.length, review.coverage.pointerCount);
  assert.equal(config.panos.length, review.coverage.panoCount);
  assert.equal(new Set(config.panos.map((pano) => pano.panoNumber)).size, config.panos.length);
  assert.deepEqual([...new Set(pointers.map((pointer) => pointer.villaNumber))].sort((a, b) => a - b), expected);
  assert(!pointers.some((pointer) => pointer.villaNumber === 21));
  assert.equal(new Set(pointers.map((pointer) => pointer.id)).size, pointers.length);
  for (const pano of config.panos) {
    const node = nodes[pano.panoNumber - 1];
    assert(node, `Missing source panorama ${pano.panoNumber}`);
    assert.equal(getExteriorPanoNumber(node.id), pano.panoNumber);
    assert.deepEqual(getVillaPointers(node.id), pano.pointers);
    assert.equal(new Set(pano.pointers.map((pointer) => pointer.villaNumber)).size, pano.pointers.length);
  }
  assert.equal(nodes.filter((node) => getVillaPointers(node.id).length > 0).length, config.panos.length);
});

test("pano 19 includes both visible garages and pano 20 retains its original entrance", () => {
  assert.deepEqual(getVillaPointers("Exterior_PANO_Spline_F0018").map((pointer) => pointer.villaNumber).sort((a, b) => a - b), [28, 38]);
  assert(getVillaPointers("Exterior_PANO_Spline_F0019").some((pointer) => pointer.villaNumber === 28));
  assert.equal(config.panos.filter((pano) => pano.pointers.length > 1).length, review.coverage.multiVillaPanoCount);
});

test("every pre-existing pointer keeps its exact position, appearance and destination", () => {
  assert.equal(review.preservedPointers.length, 78);
  for (const preserved of review.preservedPointers) {
    const pointer = config.panos.find((pano) => pano.panoNumber === preserved.panoNumber)?.pointers.find((item) => item.id === preserved.id);
    assert(pointer, `Missing original ${preserved.id}`);
    assert.equal(createHash("sha256").update(JSON.stringify(pointer)).digest("hex"), preserved.sha256, `Changed original ${preserved.id}`);
  }
});

test("only visually approved garage/pano pairs are added; rejected views stay unmarked", () => {
  const approved = review.reviews.filter((item) => item.status === "add");
  assert.equal(approved.length, review.coverage.addedPointerCount);
  assert.equal(review.reviewedCandidateCount, review.reviews.length);
  assert.equal(review.reviewedPreviewPanos.length, review.reviewedPreviewCount);
  const preservedIds = new Set(review.preservedPointers.map((pointer) => pointer.id));
  const added = config.panos.flatMap((pano) => pano.pointers.filter((pointer) => !preservedIds.has(pointer.id)).map((pointer) => `${pano.panoNumber}:${pointer.villaNumber}`));
  assert.deepEqual(added.sort(), approved.map((item) => `${item.panoNumber}:${item.villaNumber}`).sort());
  for (const item of review.reviews) {
    const pointer = config.panos.find((pano) => pano.panoNumber === item.panoNumber)?.pointers.find((candidate) => candidate.villaNumber === item.villaNumber);
    if (item.status === "reject") assert(!pointer, `Rejected garage ${item.villaNumber} in pano ${item.panoNumber}`);
    if (item.status === "add") {
      assert(pointer);
      assert.equal(pointer.position.yawDegrees, item.yawDegrees);
      assert.equal(pointer.position.pitchDegrees, item.pitchDegrees);
    }
  }
});

test("player pano 97 has Villa 78's garage pointer without removing its pano 69 entrance", () => {
  const pointer = getVillaPointers("Exterior_PANO_Spline_F0096")[0];
  const original = getVillaPointers("Exterior_PANO_Spline_F0068")[0];
  assert.equal(pointer.villaNumber, 78);
  assert.equal(pointer.facing, "East");
  assert.equal(original.villaNumber, 78);
  assert.notEqual(pointer.id, original.id);
  assert.deepEqual(pointer.interior, original.interior);
  assert.equal(pointer.position.yawDegrees, 322.6519);
  assert.equal(pointer.position.pitchDegrees, -12.918);
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
  assert(!villaHotspotsSchema.safeParse({ ...config, panos: [{ panoNumber: 193, pointers: [pointer, { ...pointer, id: "same-villa-another-id" }] }] }).success);
});
