import assert from "node:assert/strict";
import test from "node:test";
import { maskOuterFloorPlanBackground } from "./floor-plan-background.mjs";

test("only outside-connected white is removed, never an enclosed white room or coloured garden", () => {
  const width = 9, height = 9;
  const source = Buffer.alloc(width * height * 4, 255);
  const set = (x, y, color) => source.set(color, (y * width + x) * 4);
  for (let n = 2; n <= 6; n++) {
    for (const [x, y] of [[n,2],[n,6],[2,n],[6,n]]) set(x,y,[90,90,90,255]);
  }
  set(0,4,[80,140,40,255]);
  set(1,4,[255,240,250,255]);
  const before = Buffer.from(source);
  const { pixels, removed } = maskOuterFloorPlanBackground(source, width, height);
  assert(removed > 0);
  assert.equal(pixels[3], 0);
  assert.equal(pixels[(4 * width + 4) * 4 + 3], 255, "White inside walls must stay opaque");
  assert.equal(pixels[(4 * width) * 4 + 3], 255, "Outer planted area stays intact");
  assert.equal(pixels[(4 * width + 1) * 4 + 3], 255, "Tinted details are not blank white background");
  for (let i = 0; i < pixels.length; i++) if (i % 4 !== 3) assert.equal(pixels[i], source[i]);
  assert.deepEqual(source, before, "The source is never mutated");
});

test("transparent edge pixels can lead to an outer white margin without opening an enclosed room", () => {
  const source = Buffer.alloc(5 * 5 * 4, 255);
  source.set([0,0,0,0], 0);
  const { pixels } = maskOuterFloorPlanBackground(source, 5, 5);
  for (let i = 3; i < pixels.length; i += 4) assert.equal(pixels[i], 0);
});
