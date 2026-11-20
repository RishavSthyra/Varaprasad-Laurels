import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { Quaternion, Vector3 } from "three";
import manifest from "../data/villa-masterplan-model.json";
import { getMasterPlanModelTargets, getVillaNumberForModelTarget, getVillaModelRootGroups, MASTERPLAN_CLUBHOUSE_HREF, VILLA_MASTERPLAN_BACKGROUND_KEY, VILLA_MASTERPLAN_BACKGROUND_URL, VILLA_MASTERPLAN_MODEL_KEY, VILLA_MASTERPLAN_MODEL_URL } from "./villa-masterplan-model";
import { getVillasMasterPlanConfig } from "./villas-master-plan-config";
import { VILLA_MASTERPLAN_SECOND_STOP_SOURCE_FRAME } from "./villa-masterplan-video";
import { villaCatalog } from "./villas";

test("villa stage receives the original vertical FOV converted from 29.172 horizontal degrees", () => {
  const config = getVillasMasterPlanConfig();
  for (const camera of [...Object.values(config.towerACameras), ...Object.values(config.towerBCameras), ...config.hotspots.map(h => h.camera)]) {
    assert(Math.abs(camera.fov - 16.654896395479096) < 1e-10);
    const horizontalFov = 2 * Math.atan(Math.tan(camera.fov * Math.PI / 360) * config.aspectRatio) * 180 / Math.PI;
    assert(Math.abs(horizontalFov - 29.172) < 1e-10);
  }
  const stage = fs.readFileSync("components/VillasMasterPlanStage.tsx", "utf8");
  assert(stage.includes("const baseVerticalFovRadians = (cameraConfig.fov * Math.PI) / 180"));
  assert(stage.includes("aspectRatio: SOURCE_FRAME_ASPECT"), "Camera and media share an uncropped source-aspect frame");
});

test("masterplan preserves both camera poses and uses the configured second-stop frame", () => {
  const config = getVillasMasterPlanConfig();
  assert.deepEqual(config.hotspotFrames, [1, VILLA_MASTERPLAN_SECOND_STOP_SOURCE_FRAME + 1]);
  const sourceCameras = [
    { position: { x: -469245.944 / 1000, y: 205835.847 / 1000, z: 374528.689 / 1000 }, pitch: 67.133, yaw: -46.65 },
    { position: { x: 374850.68 / 1000, y: 210660.86 / 1000, z: -251392.626 / 1000 }, pitch: 67.085, yaw: 118.366 },
  ];
  config.hotspots.forEach(({ camera, key }, index) => {
    const source = sourceCameras[index];
    const pitch = source.pitch * Math.PI / 180;
    const yaw = source.yaw * Math.PI / 180;
    const expectedForward = new Vector3(-Math.sin(yaw) * Math.sin(pitch), -Math.cos(pitch), -Math.cos(yaw) * Math.sin(pitch));
    assert.deepEqual(camera.position, source.position);
    assert(camera.position.y > 200, "An overview must not regress to the 5 m close-up camera");
    const quaternion = new Quaternion(...camera.quaternion);
    assert(Math.abs(quaternion.length() - 1) < 1e-12);
    const forward = new Vector3(0, 0, -1).applyQuaternion(quaternion);
    assert(forward.distanceTo(expectedForward) < 1e-12, "Overview orientation must match the retained world-space calibration");
    assert.deepEqual(config.towerACameras[key], camera);
    assert.deepEqual(config.towerBCameras[key], camera);
  });
  assert.deepEqual(config.towerACameras, config.towerBCameras);
  assert.deepEqual(config.towerATransform, config.towerBTransform);
});

test("masterplan preload, default model and both camera views use the clubhouse GLB", () => {
  const config = getVillasMasterPlanConfig();
  assert.equal(VILLA_MASTERPLAN_MODEL_URL, "/models/villa%2002_new_glb.glb");
  assert.equal(decodeURI(VILLA_MASTERPLAN_MODEL_URL), manifest.modelPath);
  assert.equal(config.towerAModelKey, VILLA_MASTERPLAN_MODEL_KEY);
  assert.equal(config.towerBModelKey, VILLA_MASTERPLAN_MODEL_KEY);
  assert.equal(config.fallbackImageKey, VILLA_MASTERPLAN_BACKGROUND_KEY);
  assert.equal(VILLA_MASTERPLAN_BACKGROUND_URL, "/1.00000.avif");
  assert(fs.statSync(`public${VILLA_MASTERPLAN_BACKGROUND_URL}`).size > 0);
  assert(fs.existsSync("public/master_west.avif"), "Previous image remains untouched on disk");
});

test("previous GLB remains intact and supported with its own villa-only root mapping", () => {
  const bytes = fs.readFileSync("public/models/villa 01.glb");
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  const roots = gltf.scenes[gltf.scene ?? 0].nodes;
  assert.equal(roots.length, 8591);
  const targets = getMasterPlanModelTargets(roots.length);
  assert.equal(targets.length, 77);
  assert(targets.every(target => target.kind === "villa" && target.id !== "villa-21"));
  const assigned = new Set<number>();
  for (const target of targets) for (const [a, b] of target.rootRanges) for (let i = a; i <= b; i++) {
    assert(!assigned.has(i), `Previous export root ${i} has overlapping targets`);
    assert(i >= 0 && i < roots.length);
    assigned.add(i);
  }
  assert(fs.existsSync(`public${manifest.modelPath}`), "Newer clubhouse export is retained for later");
});

test("copied GLB is intact, self-contained, and matches its export-specific mapping", () => {
  const bytes = fs.readFileSync(`public${manifest.modelPath}`);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), manifest.sha256);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  assert.equal(gltf.scenes[gltf.scene ?? 0].nodes.length, manifest.rootCount);
  assert(!(gltf.images ?? []).some((image: { uri?: string }) => image.uri));
  assert(!(gltf.buffers ?? []).some((buffer: { uri?: string }) => buffer.uri));
  assert(fs.existsSync("public/models/villa 01.glb"), "Previous model remains untouched");
});

test("all 77 selectable CAD villa numbers have non-overlapping click geometry; plot 21 and helpers stay excluded", () => {
  const groups = getVillaModelRootGroups(7270);
  assert.deepEqual(groups.map((group) => group.villaNumber).sort((a, b) => a - b),
    villaCatalog.map((villa) => villa.villaNumber).sort((a, b) => a - b));
  const assigned = new Set<number>();
  for (const group of groups) for (const [start, end] of group.rootRanges) {
    assert(start >= 0 && end < manifest.rootCount && start <= end);
    for (let root = start; root <= end; root++) {
      assert(!assigned.has(root), `Root ${root} belongs to multiple villas`);
      assigned.add(root);
    }
  }
  assert.equal(assigned.size, 7255);
  for (const root of [7031, 7037, 7262, 7269]) assert(!assigned.has(root), "Non-villa helpers/clubhouse are not clickable villas");
  assert.equal(groups.find((group) => group.villaNumber === 2)?.rootRanges.length, 2, "Relocated components remain part of their actual villa");
  assert.equal(getVillaModelRootGroups(8591).length, 78, "Original asset remains supported");
  assert.throws(() => getVillaModelRootGroups(7271), /Unmapped villa model/);
});

test("manifest regenerates from exact transform matches and reviewed CAD footprints, not old array indices", () => {
  const generated = JSON.parse(execFileSync(process.execPath, ["scripts/audit-villa-masterplan-model.mjs", "--manifest"], { encoding: "utf8" }));
  assert.deepEqual(generated, manifest);
});

test("clubhouse is a separate hover target with all eight parts, never a villa or filter match", () => {
  const targets = getMasterPlanModelTargets(7270);
  assert.equal(targets.length, 78);
  const clubhouse = targets.find((target) => target.id === "clubhouse")!;
  assert.equal(clubhouse.kind, "amenity");
  assert.equal(clubhouse.label, "Clubhouse");
  assert.deepEqual(clubhouse.rootRanges, [[7262, 7269]]);
  assert.equal(getVillaNumberForModelTarget(clubhouse.id), null);
  assert.equal(getVillaNumberForModelTarget("villa-21"), null);
  assert.equal(getVillaNumberForModelTarget("villa-51"), 51);
  for (const target of targets.filter((item) => item.kind === "villa")) {
    assert(target.rootRanges.every(([a, b]) => b < 7262 || a > 7269));
  }
  assert(!getMasterPlanModelTargets(8591).some((target) => target.id === "clubhouse"));
  const bytes = fs.readFileSync(`public${manifest.modelPath}`);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  const roots = gltf.scenes[gltf.scene ?? 0].nodes;
  assert.deepEqual(Array.from({ length: 8 }, (_, i) => gltf.nodes[gltf.nodes[roots[7262 + i]].children[0]].name), manifest.amenities[0].rootNames);
});

test("clubhouse clicks open the interior route without selecting or preloading a villa", () => {
  assert.equal(MASTERPLAN_CLUBHOUSE_HREF, "/clubhouse-walkthrough");
  assert.equal(getVillaNumberForModelTarget("clubhouse"), null);
  const stage = fs.readFileSync("components/VillasMasterPlanStage.tsx", "utf8");
  assert(stage.includes("router.push(MASTERPLAN_CLUBHOUSE_HREF)"));
  assert(stage.includes("router.prefetch(MASTERPLAN_CLUBHOUSE_HREF)"));
  assert(stage.includes('aria-label="Enter clubhouse walkthrough"'));
  assert(stage.includes("if (!id || event.delta > 5) return"), "Dragging must not activate the clubhouse");
  assert(stage.includes("performance.now() < suppressClickUntil.current"));
  assert(!stage.includes("if (getVillaNumberForModelTarget(id) !== null) onSelect(id)"));
});
