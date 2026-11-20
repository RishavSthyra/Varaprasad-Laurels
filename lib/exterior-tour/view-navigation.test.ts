import assert from "node:assert/strict";
import test from "node:test";
import original from "../../data/Varaprasad_Exterior_Pano_Data_v1.json";
import confirmedRoadConnections from "../../data/exterior-road-connections.json";
import { remainingExteriorNodes } from "./remaining";
import { buildExteriorTourGraph } from "./nodes";
import { getLocalRoadCandidates, getViewDirectionalCandidates, STRAIGHT_NAVIGATION_CONE_DEGREES } from "./view-navigation";
import type { ExteriorPanoNodeSource, NavigationDirection } from "./types";

const graph = buildExteriorTourGraph([...original, ...remainingExteriorNodes]);
const radians = (degrees: number) => degrees * Math.PI / 180;
const directions: NavigationDirection[] = ["forward", "backward", "left", "right"];
function fixture(id: string, x: number, y: number, frame: number, route: string): ExteriorPanoNodeSource {
  return { id, x, y, z: 165, frame, navigation_order: frame, route_id: route, image_filename: id + ".jpg", pitch: 0, yaw: 0, roll: 0 };
}

test("the starting gate's default 82-degree view keeps its real forward entrance-road sample", () => {
  // Existing route initializes local yaw as camera -90 + offset 172 = 82.
  const choices = getViewDirectionalCandidates(graph, "Exterior_PANO_Spline_F0000", "forward", radians(82));
  assert.equal(choices[0]?.node.id, "Exterior_PANO_Spline_F0249");
  assert(choices[0].distance < 700, "The gate join is a local 6.5m road step, not a distant fallback");
});

test("reported pano 15 / yaw -5.5 uses the confirmed straight-road connection to player pano 61", () => {
  const id = "Exterior_PANO_Spline_F0014";
  const destinationId = "Exterior_PANO_Spline_F0060";
  assert.equal(graph.byId[id].order + 1, 15);
  assert.equal(graph.byId[destinationId].order + 1, 61);
  assert.equal(graph.byId[destinationId].panoId, "EP.00060");
  const forward = getViewDirectionalCandidates(graph, id, "forward", radians(-5.5));
  assert.equal(forward[0]?.node.id, destinationId);
  assert(forward[0].distance > 4600 && forward[0].distance < 4700);
  assert(!forward.some(c => c.node.id === "Exterior_PANO_Spline_F0168"), "The diagonal branch is not Forward");
  assert(!forward.some(c => c.node.id === "Exterior_PANO_Spline_F0061"), "Player 61 is F0060, not F0061");
  const nearby = getLocalRoadCandidates(graph, graph.byId[id]);
  assert(nearby.some(n => n.id === "Exterior_PANO_Spline_F0015"));
  assert(nearby.some(n => n.id === "Exterior_PANO_Spline_F0168"));
  assert(!nearby.some(n => n.id === destinationId), "Explicit links do not widen the normal local search");
  assert.equal(getViewDirectionalCandidates(graph, id, "left", radians(-5.5))[0]?.node.id, "Exterior_PANO_Spline_F0015");
  assert(getViewDirectionalCandidates(graph, id, "right", radians(-5.5)).length > 0);
  assert(getViewDirectionalCandidates(graph, id, "backward", radians(-5.5)).length > 0);
  assert.equal(getViewDirectionalCandidates(graph, id, "forward", radians(-55))[0]?.node.id, "Exterior_PANO_Spline_F0015");
  assert(!getViewDirectionalCandidates(graph, id, "forward", radians(174.5)).some(c => c.node.id === destinationId));
  assert(!getViewDirectionalCandidates(graph, id, "left", radians(84.5)).some(c => c.node.id === destinationId), "Long confirmed links do not replace local side turns");
  assert.equal(getViewDirectionalCandidates(graph, id, "backward", radians(174.5))[0]?.node.id, destinationId);
});

test("all local road candidates are compared: a straight camera omitted by old neighbor pruning still wins", () => {
  const g = buildExteriorTourGraph([
    fixture("source", 0, 0, 0, "road-a"), fixture("straight", 800, 0, 1, "road-a"), fixture("straight-end", 1600, 0, 2, "road-a"),
    fixture("junction", 0, 0, 3, "road-b"), fixture("turn", 600, 450, 4, "road-b"), fixture("turn-end", 1200, 900, 5, "road-b"),
  ]);
  g.byId.source.neighbors = [{ id: "turn", distance: 750, direction: { x: .8, y: .6, z: 0 }, alignment: .8 }];
  const options = getViewDirectionalCandidates(g, "source", "forward", 0);
  assert.equal(options[0]?.node.id, "straight");
  assert(!options.some(c => c.node.id === "turn"), "36.9-degree turn is not Forward");
  // Facing around must use the live view, not the source camera's authored yaw.
  assert.equal(getViewDirectionalCandidates(g, "straight", "forward", Math.PI)[0]?.node.id, "source");
});

test("nearby but separate parallel roads do not create a straight-through-villas shortcut", () => {
  const g = buildExteriorTourGraph([
    fixture("a0", 0, 0, 0, "a"), fixture("a1", 800, 0, 1, "a"), fixture("a2", 1600, 0, 2, "a"),
    fixture("b0", 0, 1200, 3, "b"), fixture("b1", 800, 1200, 4, "b"), fixture("b2", 1600, 1200, 5, "b"),
  ]);
  assert(!getLocalRoadCandidates(g, g.byId.a1).some(n => n.routeId === "b"));
  assert.deepEqual(getViewDirectionalCandidates(g, "a1", "forward", Math.PI / 2), []);
});

test("arrows retain real straight movement and reverse movement on remaining Camera 06", () => {
  const source = "Exterior_PANO_Spline_06_F0000", next = "Exterior_PANO_Spline_06_F0001";
  assert.equal(getViewDirectionalCandidates(graph, source, "forward", 0)[0]?.node.id, next);
  assert.equal(getViewDirectionalCandidates(graph, next, "backward", 0)[0]?.node.id, source);
});

test("every arrow result obeys its cone/local budget; cached checks do not mutate exported poses", () => {
  const poses = graph.nodes.map(n => JSON.stringify({ position: n.rawPosition, yaw: n.yaw, pitch: n.pitch, forward: n.forward }));
  for (const node of graph.nodes) {
    assert.equal(getLocalRoadCandidates(graph, node), getLocalRoadCandidates(graph, node), "Reuse the path check while the viewer rotates");
    for (const yaw of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) for (const direction of directions) {
      for (const target of getViewDirectionalCandidates(graph, node.id, direction, yaw)) {
        assert(target.node.id !== node.id);
        const angleLimit = direction === "forward" || direction === "backward" ? STRAIGHT_NAVIGATION_CONE_DEGREES : 60;
        assert(target.alignment >= Math.cos(radians(angleLimit)) - 1e-9);
        const confirmed = confirmedRoadConnections.some(link => link.fromNodeId === node.id && link.toNodeId === target.node.id);
        assert(confirmed || target.distance <= graph.medianNearestDistance * 3.2 + 1);
        if (confirmed) assert(direction === "forward" || direction === "backward");
      }
    }
  }
  assert.deepEqual(graph.nodes.map(n => JSON.stringify({ position: n.rawPosition, yaw: n.yaw, pitch: n.pitch, forward: n.forward })), poses);
});
