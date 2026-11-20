import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import original from "../../data/Varaprasad_Exterior_Pano_Data_v1.json";
import confirmedRoadConnections from "../../data/exterior-road-connections.json";
import { remainingExteriorNodes } from "./remaining";
import { buildExteriorTourGraph, preserveViewYawBetweenNodes } from "./nodes";
import { getViewDirectionalCandidates, getViewForwardVector } from "./view-navigation";
import { getLegacyViewDirectionalCandidates } from "./fixtures/view-navigation-before-tightening";
import type { NavigationDirection } from "./types";

const graph = buildExteriorTourGraph([...original, ...remainingExteriorNodes]);
const radians = (degrees: number) => degrees * Math.PI / 180;
const directions: NavigationDirection[] = ["forward", "backward", "left", "right"];
const sourceId = "Exterior_PANO_Spline_F0014";
const targetId = "Exterior_PANO_Spline_F0060";

test("player pano 15 goes directly to player 61, and Back returns to 15 without changing heading", () => {
  const from = graph.byId[sourceId], to = graph.byId[targetId];
  assert.equal(from.order + 1, 15);
  assert.equal(to.order + 1, 61);
  assert.equal(to.panoId, "EP.00060");
  const yaw = radians(-5.5);
  assert.equal(getViewDirectionalCandidates(graph, sourceId, "forward", yaw)[0]?.node.id, targetId);
  const arrivalYaw = preserveViewYawBetweenNodes(from, to, yaw);
  assert.equal(getViewDirectionalCandidates(graph, targetId, "backward", arrivalYaw)[0]?.node.id, sourceId);
  assert.equal(getViewDirectionalCandidates(graph, targetId, "forward", arrivalYaw + Math.PI)[0]?.node.id, sourceId);
});

test("the sole exception is 15 <-> 61 along the confirmed road, not an unconditional jump or side-turn override", () => {
  assert.equal(confirmedRoadConnections.length, 2);
  assert.deepEqual(confirmedRoadConnections.map(c => [c.fromNodeId, c.toNodeId]), [[sourceId, targetId], [targetId, sourceId]]);
  for (const direction of directions) {
    const yaw = radians(-55);
    assert.deepEqual(
      getViewDirectionalCandidates(graph, sourceId, direction, yaw),
      getLegacyViewDirectionalCandidates(graph, sourceId, direction, yaw),
    );
  }
  for (const direction of ["left", "right"] as const) for (const yaw of [0, Math.PI / 2, Math.PI]) {
    assert.deepEqual(
      getViewDirectionalCandidates(graph, sourceId, direction, yaw),
      getLegacyViewDirectionalCandidates(graph, sourceId, direction, yaw),
    );
  }
});

test("all 285 panos retain the exact original rankings at 24 view angles, except the confirmed link", () => {
  assert.equal(graph.nodes.length, 285);
  const poses = graph.nodes.map(n => JSON.stringify({ position: n.rawPosition, yaw: n.yaw, pitch: n.pitch, forward: n.forward }));
  let compared = 0, overrides = 0;
  for (const node of graph.nodes) for (let degrees = -180; degrees < 180; degrees += 15) for (const direction of directions) {
    const yaw = radians(degrees);
    const actual = getViewDirectionalCandidates(graph, node.id, direction, yaw);
    const forward = getViewForwardVector(node, yaw);
    const axisSign = direction === "backward" ? -1 : 1;
    const explicit = (direction === "forward" || direction === "backward") && confirmedRoadConnections.find(link => {
      if (link.fromNodeId !== node.id) return false;
      const to = graph.byId[link.toNodeId];
      const dx = to.rawPosition.x - node.rawPosition.x, dy = to.rawPosition.y - node.rawPosition.y;
      return axisSign * (dx * forward.x + dy * forward.y) / Math.hypot(dx, dy) >= Math.cos(Math.PI / 6);
    });
    if (explicit) {
      assert.equal(actual[0]?.node.id, explicit.toNodeId);
      overrides++;
    } else {
      assert.deepEqual(actual, getLegacyViewDirectionalCandidates(graph, node.id, direction, yaw), `${node.id} ${degrees} ${direction}`);
      compared++;
    }
  }
  assert(compared > 27000);
  assert(overrides > 0);
  assert.deepEqual(graph.nodes.map(n => JSON.stringify({ position: n.rawPosition, yaw: n.yaw, pitch: n.pitch, forward: n.forward })), poses);
});

test("reported player pano 5 and the starting gate retain the original Forward options", () => {
  for (const [id, yaw] of [["Exterior_PANO_Spline_F0004", 0], ["Exterior_PANO_Spline_F0000", radians(82)]] as const) {
    const expected = getLegacyViewDirectionalCandidates(graph, id, "forward", yaw);
    assert(expected.length > 0, `${id} has an original Forward option`);
    assert.deepEqual(getViewDirectionalCandidates(graph, id, "forward", yaw), expected);
  }
});

test("explicit sequential mode and remaining Camera 06 behave as before", () => {
  for (const node of graph.nodes) for (const direction of directions) {
    assert.deepEqual(
      getViewDirectionalCandidates(graph, node.id, direction, 0, true),
      getLegacyViewDirectionalCandidates(graph, node.id, direction, 0, true),
    );
  }
  const source = "Exterior_PANO_Spline_06_F0000", next = "Exterior_PANO_Spline_06_F0001";
  assert.equal(getViewDirectionalCandidates(graph, source, "forward", 0)[0]?.node.id, next);
  assert.equal(getViewDirectionalCandidates(graph, next, "backward", 0)[0]?.node.id, source);
});

test("arrow buttons are no longer disabled by the restrictive direction-availability checks", () => {
  const component = readFileSync(new URL("../../components/tour/ExteriorPanoWalkthrough.tsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert(!component.includes("directionAvailability"));
  for (const direction of directions) {
    assert(component.includes(`onClick={() => void navigateTo("${direction}")}\n            disabled={isTransitioning}`));
  }
});
