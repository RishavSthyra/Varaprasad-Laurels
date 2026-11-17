import assert from "node:assert/strict";
import test from "node:test";
import { waitForWarmup, warmNavigationCandidates } from "./warmup";

test("likely next preview and focus finish before any secondary preview", async () => {
  const signal = new AbortController().signal;
  const calls: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const work = warmNavigationCandidates(["front", "back", "left"], signal,
    async (id, receivedSignal) => {
      assert.equal(receivedSignal, signal);
      calls.push(`preview:${id}`);
    },
    async (id) => { calls.push(`focus:${id}`); await gate; });
  await Promise.resolve();
  assert.deepEqual(calls, ["preview:front", "focus:front"]);
  release();
  await work;
  assert.deepEqual(calls, ["preview:front", "focus:front", "preview:back", "preview:left"]);
});

test("cancellation prevents queued previews and focus from starting", async () => {
  const controller = new AbortController();
  const calls: string[] = [];
  const work = warmNavigationCandidates(["front", "back"], controller.signal,
    async (id) => { calls.push(id); controller.abort(); },
    async () => { assert.fail("Cancelled focus must never start"); });
  await assert.rejects(work, { name: "AbortError" });
  assert.deepEqual(calls, ["front"]);
});

test("one missing preview does not prevent a valid secondary exit warming", async () => {
  const calls: string[] = [];
  await warmNavigationCandidates(["missing", "back"], new AbortController().signal,
    async (id) => { calls.push(id); if (id === "missing") throw new Error("404"); },
    async () => { assert.fail("Missing primary cannot have focus tiles"); });
  assert.deepEqual(calls, ["missing", "back"]);
});

test("quiet-period timers cancel promptly and reject already-cancelled runs", async () => {
  const controller = new AbortController();
  const wait = waitForWarmup(10000, controller.signal);
  const rejected = assert.rejects(wait, { name: "AbortError" });
  controller.abort();
  await rejected;
  assert.throws(() => waitForWarmup(0, controller.signal), { name: "AbortError" });
  await waitForWarmup(0, new AbortController().signal);
});
