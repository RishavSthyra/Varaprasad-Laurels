import assert from "node:assert/strict";
import test from "node:test";
import { animateVillaOrbitReverse } from "./villa-orbit-reverse";
import { getVillaOrbitTravel } from "./villa-masterplan-video";

function harness(start: number, frameCallbacks = true) {
  let now = 0, id = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const presentations = new Map<number, VideoFrameRequestCallback>();
  const seeks: { time: number; at: number }[] = [];
  const clock = {
    now: () => now,
    request: (callback: FrameRequestCallback) => { frames.set(++id, callback); return id; },
    cancel: (handle: number) => { frames.delete(handle); },
  };
  class Video extends EventTarget {
    seeking = false;
    time = start;
    get currentTime() { return this.time; }
    set currentTime(value: number) {
      assert(!this.seeking, "Never interrupt an in-flight decode");
      this.time = value;
      this.seeking = true;
      seeks.push({ time: value, at: now });
    }
    requestVideoFrameCallback = frameCallbacks ? (callback: VideoFrameRequestCallback) => {
      presentations.set(++id, callback); return id;
    } : undefined;
    cancelVideoFrameCallback = (handle: number) => { presentations.delete(handle); };
    decode(present = true) {
      this.seeking = false;
      this.dispatchEvent(new Event("seeked"));
      if (present) {
        for (const [handle, callback] of [...presentations]) {
          presentations.delete(handle);
          callback(now, { mediaTime: this.time } as VideoFrameCallbackMetadata);
        }
      }
    }
  }
  const video = new Video();
  const tick = (elapsed = 1000 / 60) => {
    now += elapsed;
    for (const [handle, callback] of [...frames]) {
      if (!frames.delete(handle)) continue;
      callback(now);
    }
  };
  const run = (done: () => boolean, decodeDelay = 0, present = true) => {
    for (let tickCount = 0; tickCount < 3000 && !done(); tickCount++) {
      tick();
      if (video.seeking && now - seeks.at(-1)!.at >= decodeDelay) video.decode(present);
    }
    assert(done(), "Reverse playback must finish at the exact stop");
  };
  return { video, clock, seeks, tick, run, frames, presentations };
}

test("reverse visits adjacent frames and eases into the exact stop before completing", () => {
  const h = harness(161 / 30);
  let completed = 0;
  animateVillaOrbitReverse({ video: h.video, start: 161 / 30, target: 80 / 30, travel: -81 / 30,
    period: 309 / 30, fps: 30, clock: h.clock, onComplete: () => { completed++; } });
  h.run(() => completed > 0);
  assert.equal(completed, 1);
  assert.equal(h.seeks.length, 81);
  assert.equal(h.video.currentTime, 80 / 30);
  assert.equal(h.video.seeking, false);
  const intervals = h.seeks.slice(1).map((seek, i) => seek.at - h.seeks[i].at);
  assert(intervals.at(-1)! > intervals[0]!, "Final frames should slow down, not stop at full speed");
  assert.equal(h.frames.size, 0);
  assert.equal(h.presentations.size, 0);
});

test("a stalled decoder never skips frames or jumps straight to the landing", () => {
  const h = harness(161 / 30);
  let completed = 0;
  animateVillaOrbitReverse({ video: h.video, start: 161 / 30, target: 80 / 30, travel: -81 / 30,
    period: 309 / 30, fps: 30, clock: h.clock, onComplete: () => { completed++; } });
  h.tick();
  assert.equal(h.seeks.length, 1);
  h.tick(5000);
  assert.equal(h.seeks.length, 1, "Elapsed wall time cannot advance an undecoded reverse frame");
  assert.equal(completed, 0);
  h.video.decode();
  h.run(() => completed > 0, 80);
  assert.equal(h.seeks.length, 81);
  let previous = 161 / 30;
  for (const seek of h.seeks) {
    assert(Math.abs(previous - seek.time - 1 / 30) < 1e-7);
    previous = seek.time;
  }
});

test("all four reverse landings, including the loop seam, stay frame-bounded", () => {
  const stops = [0, 81 / 30, 161 / 30, 235 / 30];
  stops.forEach((start, i) => {
    const target = stops[(i + stops.length - 1) % stops.length];
    const period = 309 / 30;
    const travel = getVillaOrbitTravel(start, target, period, -1);
    const h = harness(start);
    let done = false;
    animateVillaOrbitReverse({ video: h.video, start, target, travel, period, fps: 30,
      clock: h.clock, onComplete: () => { done = true; } });
    h.run(() => done);
    let previous = start;
    for (const seek of h.seeks) {
      const delta = getVillaOrbitTravel(previous, seek.time, period, -1);
      assert(delta <= 0 && delta >= -1 / 30 - 1e-7);
      previous = seek.time;
    }
    assert.equal(h.video.currentTime, target);
  });
});

test("seeked paint fallback finishes fractional landings without a frame callback", () => {
  for (const frameCallbacks of [true, false]) {
    const h = harness(2.721, frameCallbacks);
    let done = false;
    animateVillaOrbitReverse({ video: h.video, start: 2.721, target: 2.7, travel: -0.021,
      period: 10.3, fps: 30, clock: h.clock, onComplete: () => { done = true; } });
    h.run(() => done, 0, false);
    assert.equal(h.video.currentTime, 2.7);
    assert.equal(h.seeks.length, 1);
    assert.equal(h.presentations.size, 0);
  }
});

test("a new gesture cancels pending reverse decoding and its completion callback", () => {
  const h = harness(5);
  let completed = 0;
  const cancel = animateVillaOrbitReverse({ video: h.video, start: 5, target: 0, travel: -5,
    period: 10.3, fps: 30, clock: h.clock, onComplete: () => { completed++; } });
  h.tick();
  cancel();
  h.video.decode();
  h.tick(1000);
  assert.equal(h.seeks.length, 1);
  assert.equal(completed, 0);
  assert.equal(h.frames.size, 0);
  assert.equal(h.presentations.size, 0);
});
