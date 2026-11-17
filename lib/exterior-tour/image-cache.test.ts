import assert from "node:assert/strict";
import test from "node:test";
import { createPanoImageLoader } from "./image-cache";

test("warmups populate the viewer blob cache and refetch only after eviction", async (t) => {
  const originalFetch = globalThis.fetch;
  const items = new Map<string, Blob>();
  let requests = 0;
  let purges = 0;
  globalThis.fetch = async (_input, init) => {
    requests += 1;
    assert.equal(init?.cache, "force-cache");
    assert.equal(init?.credentials, "omit");
    assert.equal(init?.priority, "high");
    return new Response(new Blob(["test-image"], { type: "image/jpeg" }));
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const load = createPanoImageLoader({
    get: (url, key) => items.get(`${key}|${url}`),
    add: (url, key, blob) => { items.set(`${key}|${url}`, blob); },
    purge: () => { purges += 1; },
  });
  await load("/tile.jpg", "high", "/preview.jpg");
  assert(items.get("/preview.jpg|/tile.jpg") instanceof Blob);
  await load("/tile.jpg", "high", "/preview.jpg");
  assert.equal(requests, 1);
  items.clear();
  await load("/tile.jpg", "high", "/preview.jpg");
  assert.equal(requests, 2);
  assert.equal(purges, 2);
});

test("failed and empty images never enter the viewer cache", async (t) => {
  const originalFetch = globalThis.fetch;
  let additions = 0;
  const load = createPanoImageLoader({
    get: () => undefined,
    add: () => { additions += 1; },
    purge: () => {},
  });
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response("Missing", { status: 404 });
  await assert.rejects(load("/missing.jpg", "low"), /HTTP 404/);
  globalThis.fetch = async () => new Response(new Blob([]));
  await assert.rejects(load("/empty.jpg", "low"), /Empty panorama image/);
  assert.equal(additions, 0);
});

test("cancelling the last subscriber aborts the fetch and allows an immediate retry", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let requests = 0;
  let aborted = 0;
  let additions = 0;
  globalThis.fetch = async (_url, init) => {
    requests += 1;
    if (requests > 1) return new Response("retry-image");
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        aborted += 1;
        reject(init.signal?.reason);
      }, { once: true });
    });
  };
  const load = createPanoImageLoader({
    get: () => undefined, add: () => { additions += 1; }, purge: () => {},
  });
  const controller = new AbortController();
  const request = load("/tile.jpg", "low", "/preview.jpg", controller.signal);
  const rejected = assert.rejects(request, { name: "AbortError" });
  controller.abort();
  await load("/tile.jpg", "high", "/preview.jpg");
  await rejected;
  assert.equal(aborted, 1);
  assert.equal(requests, 2);
  assert.equal(additions, 1);
});

test("cancelling speculation does not cancel a shared foreground subscriber", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let requests = 0;
  let release!: (response: Response) => void;
  let networkSignal: AbortSignal | null | undefined;
  globalThis.fetch = async (_url, init) => {
    requests += 1;
    networkSignal = init?.signal;
    return new Promise<Response>((resolve) => { release = resolve; });
  };
  const load = createPanoImageLoader({
    get: () => undefined, add: () => {}, purge: () => {},
  });
  const controller = new AbortController();
  const speculative = load("/preview.jpg", "low", undefined, controller.signal);
  const rejected = assert.rejects(speculative, { name: "AbortError" });
  const foreground = load("/preview.jpg", "high");
  controller.abort();
  assert.equal(networkSignal?.aborted, false);
  release(new Response("image"));
  assert.equal(await foreground, "/preview.jpg");
  await rejected;
  assert.equal(requests, 1);
});

test("aborted requests never populate the cache even if the network ignores abort", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let release!: (response: Response) => void;
  let additions = 0;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return new Promise<Response>((resolve) => { release = resolve; });
  };
  const load = createPanoImageLoader({
    get: () => undefined, add: () => { additions += 1; }, purge: () => {},
  });
  const controller = new AbortController();
  const alreadyCancelled = new AbortController();
  alreadyCancelled.abort();
  await assert.rejects(load("/tile.jpg", "low", undefined, alreadyCancelled.signal),
    { name: "AbortError" });
  assert.equal(requests, 0);
  const request = load("/tile.jpg", "low", undefined, controller.signal);
  const rejected = assert.rejects(request, { name: "AbortError" });
  controller.abort();
  release(new Response("stale-image"));
  await rejected;
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(additions, 0);
});
