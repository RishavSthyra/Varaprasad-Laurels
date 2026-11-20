import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { MasterplanVideoCache as MediaAssetCache } from "./masterplan-video-cache";

for (const mime of ["image/avif", "video/mp4"]) test(`${mime}: one high-priority full download, persistent reload without network`, async () => {
  let stored: Response | undefined;
  let calls = 0;
  const store = {
    match: async () => stored?.clone(),
    put: async (_: unknown, value: Response) => { stored = value; },
    keys: async () => [new Request("https://media.test/hero")],
    delete: async () => { stored = undefined; return true; },
  };
  const create = () => new MediaAssetCache({
    url: "https://media.test/hero", bytes: 6, mime, rangeRequests: false, priority: "high",
    fetch: async (_input, init) => {
      calls++;
      assert.equal(new Headers(init?.headers).get("range"), null);
      assert.equal(init?.priority, "high");
      return new Response(new Uint8Array([0,1,2,3,4,5]), { headers: { "content-type": mime } });
    },
    storage: async () => store,
    objectURL: blob => { assert.equal(blob.type, mime); return "blob:hero"; },
  });
  const first = create();
  const pending = first.warm();
  assert.equal(first.warm(), pending);
  await pending;
  assert.equal(calls, 1);
  assert.equal(first.getStatus().objectURL, "blob:hero");
  assert.equal(stored?.status, 200);
  assert.equal((await stored!.clone().blob()).size, 6);
  assert.equal(stored?.headers.get("content-type"), mime);
  const reload = create();
  await reload.warm();
  assert.equal(reload.getStatus().source, "storage");
  assert.equal(calls, 1);
});

test("invalid or failed hero payloads never become complete cached assets", async () => {
  for (const response of [new Response("bad", { status: 404 }), new Response(new Uint8Array(3), { headers: { "content-type": "image/avif" } })]) {
    const cache = new MediaAssetCache({ url: "https://media.test/poster", bytes: 6, mime: "image/avif", rangeRequests: false,
      fetch: async () => response, storage: async () => undefined, objectURL: () => "must-not-publish" });
    await cache.warm();
    assert(cache.getStatus().error);
    assert.equal(cache.getStatus().objectURL, undefined);
  }
});

test("home cache stays separate from the masterplan and keeps only encoded blobs, not a second decoder", () => {
  const source = readFileSync("lib/home-hero-cache.ts", "utf8");
  assert(source.includes('"laurels-home-poster-v1"'));
  assert(source.includes('"laurels-home-video-v1"'));
  assert(source.includes('"laurels-home-reverse-video-v1"'));
  assert(source.includes("reverse: create(HOME_HERO_REVERSE_VIDEO_SRC, HOME_HERO_REVERSE_VIDEO_BYTES"));
  assert(source.includes("rangeRequests: false, priority: \"high\""));
  assert(!source.includes('createElement("video")'));
});
