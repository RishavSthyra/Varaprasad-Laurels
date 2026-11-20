import assert from "node:assert/strict";
import test from "node:test";
import { getOpeningBufferProgress, shouldWarmMasterplan, HOME_WARMUP_MAX_WAIT_MS } from "./masterplan-warmup-policy";

const media = (ranges: [number, number][], readyState = 2, duration = 10.3) => ({
  readyState, duration, buffered: {
    length: ranges.length,
    start: (index: number) => ranges[index][0],
    end: (index: number) => ranges[index][1],
  },
});

test("opening readiness means a decoded continuous opening, not the entire video", () => {
  assert.equal(getOpeningBufferProgress(media([])), 0);
  assert.equal(getOpeningBufferProgress(media([[0, 0.75]])), 0.5);
  assert.equal(getOpeningBufferProgress(media([[0, 1.5]])), 1);
  assert.equal(getOpeningBufferProgress(media([[5, 10.3]])), 0);
  assert.equal(getOpeningBufferProgress(media([[0, 0.75], [5, 10.3]])), 0.5);
  assert.equal(getOpeningBufferProgress(media([[0, 0.75], [0.75, 1.5]])), 1);
  assert.equal(getOpeningBufferProgress(media([[0, 10.3]], 1)), 0.9);
  assert.equal(getOpeningBufferProgress(media([[0, 0.5]], 2, 0.5)), 1);
});

test("foreground warmup has a hard deadline independent of full-file caching", () => {
  assert.equal(HOME_WARMUP_MAX_WAIT_MS, 3500);
});

test("speculation respects Save-Data, slow networks and background tabs", () => {
  assert(shouldWarmMasterplan());
  assert(shouldWarmMasterplan({ effectiveType: "4g" }));
  assert(!shouldWarmMasterplan({ saveData: true }));
  assert(!shouldWarmMasterplan({ effectiveType: "slow-2g" }));
  assert(!shouldWarmMasterplan({ effectiveType: "2g" }));
  assert(!shouldWarmMasterplan(undefined, true));
});
