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
