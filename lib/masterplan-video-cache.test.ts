import assert from "node:assert/strict";
import test from "node:test";
import { MasterplanVideoCache } from "./masterplan-video-cache";

const url = "https://media.test/orbit.mp4?v=verified";
function harness(options: { denyStorage?: boolean; cached?: Response; badSize?: boolean; failOnce?: boolean; changedEtag?: boolean } = {}) {
  let entry = options.cached;
  let writes = 0;
  const calls: string[] = [];
  const store = {
    match: async () => entry?.clone(),
    put: async (_: unknown, response: Response) => { writes++; entry = response; },
    keys: async () => [new Request(url)],
    delete: async () => { entry = undefined; return true; },
  };
  const blobs: Blob[] = [];
  const cache = new MasterplanVideoCache({
    url, bytes: 6, chunkBytes: 2,
    fetch: async (_input, init) => {
      const range = new Headers(init?.headers).get("range")!;
      calls.push(range);
      if (options.failOnce && calls.length === 2) throw new Error("Connection lost");
      const start = Number(range.match(/\d+/)![0]);
      return new Response(new Uint8Array(options.badSize ? 1 : [start, start + 1]), {
        status: 206, headers: { "content-type": "video/mp4", etag: options.changedEtag && calls.length > 1 ? "new" : "old" },
      });
    },
    storage: async () => { if (options.denyStorage) throw new Error("Storage denied"); return store; },
    objectURL: blob => { blobs.push(blob); return "blob:complete"; },
  });
  return { cache, calls, blobs, writes: () => writes, entry: () => entry };
}

test("all ranges are cached once, assembled in order and persisted only on completion", async () => {
  const h = harness();
  const first = h.cache.warm();
  assert.equal(h.cache.warm(), first, "Concurrent callers share the same download");
  await first;
  assert.deepEqual(h.calls, ["bytes=0-1", "bytes=2-3", "bytes=4-5"]);
  assert.deepEqual([...new Uint8Array(await h.blobs[0].arrayBuffer())], [0, 1, 2, 3, 4, 5]);
  assert.equal(h.writes(), 1);
  assert.equal(h.cache.getStatus().bytes, 6);
  assert.equal(h.cache.getStatus().objectURL, "blob:complete");
  await h.cache.warm();
  assert.equal(h.calls.length, 3);
});

test("warm cache restores without any network requests, even with speculation disabled", async () => {
  const h = harness({ cached: new Response(new Uint8Array(6), { headers: { "content-type": "video/mp4" } }) });
  await h.cache.warm(() => false);
  assert.equal(h.cache.getStatus().source, "storage");
  assert.equal(h.calls.length, 0);
});

test("pausing stops at a chunk boundary, then resumes without downloading previous chunks", async () => {
  const h = harness();
  await h.cache.warm(() => h.cache.getStatus().bytes < 2);
  assert.equal(h.cache.getStatus().bytes, 2);
  assert.equal(h.cache.getStatus().objectURL, undefined);
  assert.equal(h.writes(), 0);
  await h.cache.warm();
  assert.deepEqual(h.calls, ["bytes=0-1", "bytes=2-3", "bytes=4-5"]);
});

test("failed requests retry from the last complete chunk, with no poisoned cache entry", async () => {
  const h = harness({ failOnce: true });
  await h.cache.warm();
  assert.equal(h.cache.getStatus().bytes, 2);
  assert(h.cache.getStatus().error);
  assert.equal(h.writes(), 0);
  await h.cache.warm();
  assert.equal(h.cache.getStatus().error, undefined);
  assert.equal(h.cache.getStatus().objectURL, "blob:complete");
  assert.deepEqual(h.calls, ["bytes=0-1", "bytes=2-3", "bytes=2-3", "bytes=4-5"]);
});

test("quota/private-mode denial falls back to a complete memory copy", async () => {
  const h = harness({ denyStorage: true });
  await h.cache.warm();
  assert.equal(h.cache.getStatus().objectURL, "blob:complete");
  assert.equal(h.writes(), 0);
});

test("truncated data and a changed file cannot be published as a complete cache", async () => {
  for (const options of [{ badSize: true }, { changedEtag: true }]) {
    const h = harness(options);
    await h.cache.warm();
    assert(h.cache.getStatus().error);
    assert.equal(h.cache.getStatus().objectURL, undefined);
    assert.equal(h.writes(), 0);
  }
});

test("an incomplete stored entry is discarded and rebuilt", async () => {
  const h = harness({ cached: new Response(new Uint8Array(3), { headers: { "content-type": "video/mp4" } }) });
  await h.cache.warm();
  assert.equal(h.cache.getStatus().source, "network");
  assert.equal(h.calls.length, 3);
});
