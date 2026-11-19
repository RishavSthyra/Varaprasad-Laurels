// Read-only comparison with the prior CAD-mapped export; never edits a GLB.
import fs from "node:fs";
import crypto from "node:crypto";
import { Box3, Matrix4, Quaternion, Vector3 } from "three";

const legacy = JSON.parse(fs.readFileSync("data/villa-masterplan-legacy-groups.json", "utf8"));
function load(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error(`Invalid GLB: ${file}`);
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  if ((json.buffers ?? []).some((buffer) => buffer.uri) || (json.images ?? []).some((image) => image.uri)) throw new Error("Model has external dependencies");
  return { json, roots: json.scenes[json.scene ?? 0].nodes, sha256: crypto.createHash("sha256").update(bytes).digest("hex") };
}
const old = load("public/models/villa 01.glb");
const model = load("public/models/villa 02_new_glb.glb");
function oldVilla(index) {
  const group = legacy.rootEnds.findIndex((end) => index <= end);
  if (group >= 0) return legacy.villaNumbers[group];
  return index >= legacy.finalRange[0] && index <= legacy.finalRange[1] ? legacy.villaNumbers.at(-1) : null;
}
function rootKey(asset, id) {
  const node = asset.json.nodes[id];
  return JSON.stringify({ matrix: node.matrix, names: (node.children ?? []).map((child) => asset.json.nodes[child].name) });
}
function bounds(asset, root) {
  const box = new Box3();
  function visit(id, parent) {
    const node = asset.json.nodes[id];
    const local = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(
      new Vector3(...(node.translation ?? [0, 0, 0])), new Quaternion(...(node.rotation ?? [0, 0, 0, 1])), new Vector3(...(node.scale ?? [1, 1, 1])),
    );
    const matrix = parent.clone().multiply(local);
    for (const primitive of asset.json.meshes?.[node.mesh]?.primitives ?? []) {
      const accessor = asset.json.accessors[primitive.attributes.POSITION];
      if (!accessor.min || !accessor.max) throw new Error("Missing position bounds");
      box.union(new Box3(new Vector3(...accessor.min), new Vector3(...accessor.max)).applyMatrix4(matrix));
    }
    for (const child of node.children ?? []) visit(child, matrix);
  }
  visit(root, new Matrix4());
  return box;
}
const oldGroups = new Map();
const keys = new Map();
old.roots.forEach((root, index) => {
  const villa = oldVilla(index);
  keys.set(rootKey(old, root), villa);
  if (villa) {
    const box = oldGroups.get(villa) ?? new Box3();
    box.union(bounds(old, root));
    oldGroups.set(villa, box);
  }
});
const assignments = model.roots.map((root) => keys.get(rootKey(model, root)));
const reviewed = [];
for (let index = 0; index < assignments.length; index++) {
  if (assignments[index] !== undefined) continue;
  const box = bounds(model, model.roots[index]);
  const center = box.getCenter(new Vector3());
  const ranked = [...oldGroups].map(([villa, reference]) => {
    const c = reference.getCenter(new Vector3());
    const dx = Math.max(reference.min.x - center.x, 0, center.x - reference.max.x);
    const dz = Math.max(reference.min.z - center.z, 0, center.z - reference.max.z);
    return { villa, boundaryDistance: Math.hypot(dx, dz), centerDistance: Math.hypot(center.x - c.x, center.z - c.z) };
  }).sort((a, b) => a.boundaryDistance - b.boundaryDistance || a.centerDistance - b.centerDistance);
  const best = ranked[0];
  const names = (model.json.nodes[model.roots[index]].children ?? []).map((id) => model.json.nodes[id].name);
  if (names.some((name) => /^(?:landscape|dummy0[1-3])$/i.test(name ?? "")) || best.boundaryDistance > 1) {
    assignments[index] = null;
    reviewed.push({ root: index, villa: null, names, center: center.toArray(), size: box.getSize(new Vector3()).toArray(), boundaryDistance: best.boundaryDistance });
    continue;
  }
  assignments[index] = best.villa;
  reviewed.push({ root: index, villa: best.villa, center: center.toArray(), boundaryDistance: best.boundaryDistance });
}
const groups = [...new Set(assignments.filter((villa) => villa !== null))].map((villaNumber) => {
  const rootRanges = [];
  assignments.forEach((villa, index) => {
    if (villa !== villaNumber) return;
    const last = rootRanges.at(-1);
    if (last && last[1] === index - 1) last[1] = index;
    else rootRanges.push([index, index]);
  });
  return { villaNumber, rootRanges };
});
// Reviewed clubhouse shell/roof/sports-court objects in this exact export.
// Never infer an amenity from every object outside the villa footprints.
const amenities = [{ id: "clubhouse", label: "Clubhouse", rootRanges: [[7262, 7269]],
  rootNames: ["Group189", "Object422", "Group52", "Object13371", "Object13370", "Line1725", "Net", "Box2138774975"] }];
amenities[0].rootNames.forEach((expected, index) => {
  const root = model.json.nodes[model.roots[7262 + index]];
  if (model.json.nodes[root.children?.[0]]?.name !== expected) throw new Error("Clubhouse export changed; review its hover ranges");
});
const manifest = { modelPath: "/models/villa 02_new_glb.glb", sha256: model.sha256, rootCount: model.roots.length, amenities, groups };
if (process.argv.includes("--manifest")) console.log(JSON.stringify(manifest, null, 2));
else console.log(JSON.stringify({ model: manifest.modelPath, roots: manifest.rootCount, villas: groups.length,
  exactMatches: assignments.length - reviewed.length, spatiallyReviewed: reviewed.length,
  amenities: amenities.map(({ id, rootRanges }) => ({ id, rootRanges })),
  excludedHelpers: assignments.filter((villa) => villa === null).length - 8,
  groups: groups.map((group) => ({ ...group, roots: group.rootRanges.reduce((sum, [a, b]) => sum + b - a + 1, 0) })),
  boundaryAssignments: reviewed.filter((entry) => entry.boundaryDistance > 0),
}, null, 2));
