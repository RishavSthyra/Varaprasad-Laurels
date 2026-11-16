import assert from "node:assert/strict";
import test from "node:test";
import { getPanoTravelPose, PANO_TRAVEL_DEPART_MS, PANO_TRAVEL_ARRIVE_MS } from "./travel-motion";

const origin = { x: 0, y: 0, z: 165 };
const forward = { x: 1, y: 0, z: 0 };

test("forward travel pushes in and lateral travel follows the viewing direction", () => {
  const ahead = getPanoTravelPose(origin, { x: 10, y: 0, z: 165 }, forward);
  assert.equal(ahead.x, 0);
  assert(Math.abs(ahead.scale - 1.025) < 1e-10);
  const right = getPanoTravelPose(origin, { x: 0, y: -10, z: 165 }, forward);
  const left = getPanoTravelPose(origin, { x: 0, y: 10, z: 165 }, forward);
  assert(right.x < 0);
  assert(left.x > 0);
  const turned = getPanoTravelPose(origin, { x: 0, y: -10, z: 165 }, { x: -1, y: 0, z: 0 });
  assert(turned.x > 0);
});

test("backward travel is gentler and stationary jumps do not move", () => {
  const backward = getPanoTravelPose(origin, { x: -10, y: 0, z: 165 }, forward);
  assert.equal(backward.scale, 1.016);
  assert(backward.y < 0);
  assert.equal(getPanoTravelPose(origin, origin, forward).transform, "none");
});

test("transforms cover the viewport at every direction and coordinate scale", () => {
  for (let degrees = 0; degrees < 360; degrees += 5) {
    const angle = degrees * Math.PI / 180;
    const to = { x: Math.cos(angle) * 100000, y: Math.sin(angle) * 100000, z: 165 };
    const pose = getPanoTravelPose(origin, to, forward);
    const borderPercent = (pose.scale - 1) * 50;
    assert(Math.abs(pose.x) < borderPercent);
    assert(Math.abs(pose.y) < borderPercent);
    assert(pose.scale <= 1.025);
  }
});

test("motion remains subtle and allows a gentle acceleration and settle", () => {
  assert(PANO_TRAVEL_DEPART_MS >= 200);
  assert(PANO_TRAVEL_ARRIVE_MS >= 200);
  for (const to of [{ x: 10, y: 0, z: 165 }, { x: 0, y: -10, z: 165 }]) {
    const pose = getPanoTravelPose(origin, to, forward);
    assert(pose.scale - 1 < 0.03);
    assert(Math.abs(pose.x) <= 0.55);
  }
});
