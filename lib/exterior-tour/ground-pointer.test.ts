import assert from "node:assert/strict";
import test from "node:test";
import { BoxGeometry, Mesh, MeshBasicMaterial, Vector3 } from "three";
import { createGroundPointer, getGroundPointerMotion } from "./ground-pointer";
import { getVillaPointers } from "./villa-hotspots";

test("pointers use the player counter, including the CAD-corrected demo villa", () => {
  assert.equal(getVillaPointers("Exterior_PANO_Spline_F0192")[0].villaNumber, 12);
  assert(getVillaPointers("Exterior_PANO_Spline_F0193").some((pointer) => pointer.villaNumber === 12));
  assert.equal(getVillaPointers("Exterior_PANO_Spline_F0191")[0].villaNumber, 14);
});

test("two visible garages get independent pointer meshes and cleanup", () => {
  const configs = getVillaPointers("Exterior_PANO_Spline_F0018");
  assert.equal(configs.length, 2);
  const source = new BoxGeometry(2, 10, 3);
  const first = createGroundPointer(source, configs[0]);
  const second = createGroundPointer(source, configs[1]);
  assert.notEqual(first.group.name, second.group.name);
  assert(first.group.position.distanceTo(second.group.position) > 1);
  const firstArrow = first.group.getObjectByName("bouncing-arrow") as Mesh;
  const secondArrow = second.group.getObjectByName("bouncing-arrow") as Mesh;
  assert.notEqual(firstArrow.geometry, secondArrow.geometry);
  assert.notEqual(firstArrow.material, secondArrow.material);
  const before = secondArrow.position.y;
  first.update(0.9);
  assert.equal(secondArrow.position.y, before);
  let secondDisposed = false;
  secondArrow.geometry.addEventListener("dispose", () => { secondDisposed = true; });
  first.dispose();
  assert(!secondDisposed);
  second.dispose();
  assert(secondDisposed);
  source.dispose();
});

test("bounce and rotation are smooth, periodic, and disabled for reduced motion", () => {
  const first = getGroundPointerMotion(0);
  const lifted = getGroundPointerMotion(0.9);
  const settled = getGroundPointerMotion(1.8);
  assert.equal(first.lift, 0);
  assert.equal(lifted.lift, 0.07);
  assert(Math.abs(settled.lift) < 1e-10);
  assert(lifted.shadowScale < first.shadowScale);
  assert(lifted.shadowOpacity < first.shadowOpacity);
  assert(getGroundPointerMotion(1).rotation > first.rotation);
  assert.deepEqual(getGroundPointerMotion(10, true), getGroundPointerMotion(0, true));
});

test("normalization preserves the source model and disposes only marker resources", () => {
  const source = new BoxGeometry(2, 10, 3);
  let sourceDisposed = false;
  source.addEventListener("dispose", () => { sourceDisposed = true; });
  const config = getVillaPointers("Exterior_PANO_Spline_F0192")[0];
  const pointer = createGroundPointer(source, config);
  assert(Math.abs(pointer.group.position.length() - config.position.distanceMetres) < 1e-6);
  assert(pointer.group.position.y < 0);
  const arrow = pointer.group.getObjectByName("bouncing-arrow") as Mesh;
  assert(pointer.group.renderOrder > 1);
  assert.equal(arrow.parent!.renderOrder, pointer.group.renderOrder);
  const material = arrow.material as MeshBasicMaterial;
  assert(material.transparent, "Arrow must sort after the panorama adapter's transparent tile layer");
  assert.equal(material.opacity, 1, "Render-queue transparency must not make the white arrow translucent");
  arrow.geometry.computeBoundingBox();
  const size = arrow.geometry.boundingBox!.getSize(new Vector3());
  assert(Math.abs(size.y - config.heightMetres) < 1e-6);
  assert.notEqual(arrow.geometry, source);
  pointer.update(0.9);
  assert(arrow.position.y > config.heightMetres * 0.16);
  let disposed = false;
  arrow.geometry.addEventListener("dispose", () => { disposed = true; });
  pointer.dispose();
  assert(disposed);
  assert(!sourceDisposed);
  source.dispose();
});
