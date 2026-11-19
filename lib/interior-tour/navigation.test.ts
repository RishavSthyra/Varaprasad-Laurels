import assert from "node:assert/strict";
import test from "node:test";
import { distancePlanar, wrapAngleRad } from "../exterior-tour/math";
import { buildExteriorTourGraph, getNodeHeading, preserveViewYawBetweenNodes } from "../exterior-tour/nodes";
import {
  VILLA_INTERIOR_NODES, VILLA_INTERIOR_SOURCE_NODES, VILLA_INTERIOR_SECTIONS,
  VILLA_INTERIOR_NAVIGATION_PAIRS, VILLA_INTERIOR_DUPLICATE_RENDERS,
} from "../villa-interior-tour";
import { buildInteriorTourGraph } from "./sections";
import { getConnectedNavigationCandidates, getViewRelativeNavigationTargets } from "./navigation";

const graph = buildInteriorTourGraph(VILLA_INTERIOR_NODES, VILLA_INTERIOR_SECTIONS);
const blocked = new Set<string>();
const targets = (id: string, yaw: number) => getViewRelativeNavigationTargets(
  graph, graph.byId[id], yaw, true, blocked, VILLA_INTERIOR_NAVIGATION_PAIRS,
);

test("villa coordinates and camera yaw are reflected together without mutating the source export", () => {
  for (const node of VILLA_INTERIOR_NODES) {
    const raw = VILLA_INTERIOR_SOURCE_NODES.find((item) => item.id === node.id)!;
    assert.equal(node.x, raw.x);
    assert.equal(node.y, -raw.y);
    assert.equal(node.z, raw.z);
    assert.equal(node.yaw, -raw.yaw);
    assert.equal(node.forward_vector?.y, -raw.forward_vector!.y);
  }
  // The original bad take held the five-frame CAM5 render for seven frames.
  assert.equal(VILLA_INTERIOR_DUPLICATE_RENDERS.GF_CAM0_F0006, "GF_CAM5_F0004");
  assert.equal(VILLA_INTERIOR_DUPLICATE_RENDERS.FF_CAM1_F0006, "FF_CAM1_F0000");
});

test("first-floor forward navigation leaves the landing rather than toggling coincident cameras", () => {
  assert.equal(targets("FF_CAM1_F0000", 0).forward.node?.id, "FF_CAM1_F0001");
  assert(!graph.byId.FF_CAM1_F0006);
  const from = graph.byId.FF_CAM1_F0000;
  const to = graph.byId.FF_CAM1_F0001;
  // Aim directly down this camera path, then reverse with the preserved camera.
  const yaw = Math.atan2(to.rawPosition.y - from.rawPosition.y, to.rawPosition.x - from.rawPosition.x) - getNodeHeading(from);
  assert.equal(targets(from.id, yaw).forward.node?.id, to.id);
  const arrival = preserveViewYawBetweenNodes(from, to, yaw);
  assert.equal(targets(to.id, arrival).backward.node?.id, from.id);
});

test("a 90-degree source camera turn retains the rendered heading instead of flipping 180 degrees", () => {
  for (const [a, b] of [["GF_CAM5_F0001", "GF_CAM5_F0002"], ["GF_CAM3_F0002", "GF_CAM3_F0003"], ["FF_CAM1_F0000", "FF_CAM1_F0001"]]) {
    const from = graph.byId[a], to = graph.byId[b];
    const rawFrom = VILLA_INTERIOR_SOURCE_NODES.find((node) => node.id === a)!;
    const rawTo = VILLA_INTERIOR_SOURCE_NODES.find((node) => node.id === b)!;
    for (const yaw of [-2.5, -1, 0, 1.5, 3]) {
      const arrival = preserveViewYawBetweenNodes(from, to, yaw);
      const expected = wrapAngleRad(yaw + (rawTo.yaw - rawFrom.yaw) * Math.PI / 180);
      assert(Math.abs(wrapAngleRad(arrival - expected)) < 0.002);
    }
  }
});

test("verified paths stay within their floor and every arrow target represents actual displacement", () => {
  let checks = 0;
  for (const section of VILLA_INTERIOR_SECTIONS) {
    const visited = new Set<string>(), queue = [section.initialNodeId];
    while (queue.length) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      queue.push(...getConnectedNavigationCandidates(graph, graph.byId[id], blocked, VILLA_INTERIOR_NAVIGATION_PAIRS).map((node) => node.id));
    }
    if (section.id === "ground") {
      // The actual GF_CAM0 bedroom take is absent (its files repeat CAM5).
      // Keep the separate wardrobe path reachable via the view selector rather
      // than inventing a spatial jump through the missing bedroom/walls.
      assert.deepEqual(section.nodeIds.filter((id) => !visited.has(id)).sort(),
        VILLA_INTERIOR_NODES.filter((node) => node.id.startsWith("GF_CAM1_")).map((node) => node.id).sort());
    } else assert.equal(visited.size, section.nodeIds.length, `${section.id}: disconnected camera path`);
    for (const id of section.nodeIds) for (let angle = -180; angle < 180; angle += 15) {
      const nav = targets(id, angle * Math.PI / 180);
      for (const target of Object.values(nav)) if (target.node) {
        assert(section.nodeIds.includes(target.node.id));
        assert(distancePlanar(graph.byId[id].rawPosition, target.node.rawPosition) > 0.001);
        assert(!VILLA_INTERIOR_DUPLICATE_RENDERS[target.node.id]);
        checks++;
      }
      if (nav.forward.node && nav.backward.node) assert.notEqual(nav.forward.node.id, nav.backward.node.id);
    }
  }
  assert(checks > 4000);
});

test("coincident neighbours cannot win every direction by normalizing a zero-length vector", () => {
  const raw = VILLA_INTERIOR_NODES[0];
  const duplicate = { ...raw, id: "duplicate" };
  const ahead = { ...raw, id: "ahead", x: raw.x + 100 };
  const local = buildExteriorTourGraph([raw, duplicate, ahead]);
  const nav = getViewRelativeNavigationTargets(local, local.byId[raw.id], -getNodeHeading(local.byId[raw.id]), true,
    blocked, [[raw.id, "duplicate"], [raw.id, "ahead"]]);
  assert.equal(nav.forward.node?.id, "ahead");
  assert.equal(nav.backward.node, null);
  assert.equal(nav.left.node, null);
  assert.equal(nav.right.node, null);
});
