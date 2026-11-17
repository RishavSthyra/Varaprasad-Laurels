import assert from "node:assert/strict";
import test from "node:test";
import {
  asTiledPanorama,
  buildTileDescriptors,
  PanoAssetStore,
  selectPriorityTiles,
} from "./pano";
import { exteriorImageFilenameToPanoId } from "./nodes";
import type { PanoMeta } from "./types";

const meta: PanoMeta = {
  width: 4096,
  height: 2048,
  cols: 4,
  rows: 2,
  tiles: [{ col: 1, row: 0, file: "custom-name.webp" }],
};

test("panorama loading shares requests, batches signing, and retries failures", async (t) => {
  const originalFetch = globalThis.fetch;
  const metadataRequests: string[] = [];
  const signingBatches: string[][] = [];
  let failMetadataOnce = false;
  let failSigningOnce = false;

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith("/api/sign-asset")) {
      const keys: string[] = init?.method === "POST"
        ? JSON.parse(String(init.body)).keys
        : [new URL(url, "http://localhost").searchParams.get("key")!];
      if (init?.method === "POST") {
        signingBatches.push(keys);
        if (failSigningOnce) {
          failSigningOnce = false;
          return Response.json({ error: "Temporary signing failure" }, { status: 503 });
        }
      }
      const urls = Object.fromEntries(keys.map((key) => [key, `https://assets.example/${key}`]));
      return Response.json(init?.method === "POST" ? { urls } : { url: urls[keys[0]] });
    }
    assert(url.endsWith("/meta.json"), `Unexpected asset download: ${url}`);
    metadataRequests.push(url);
    if (failMetadataOnce) {
      failMetadataOnce = false;
      return new Response("Unavailable", { status: 503 });
    }
    return Response.json(meta);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  await t.test("reuses availability metadata and one in-flight panorama request", async () => {
    const store = new PanoAssetStore("pano-test/shared/");
    await Promise.all([store.getMeta("room"), store.getMeta("room")]);
    assert.equal(metadataRequests.length, 1);

    const first = store.getPanorama("room");
    const second = store.getPanorama("room");
    assert.equal(first, second);
    const resolved = await first;
    assert.equal(await store.getPanorama("room"), resolved);
    assert.equal(metadataRequests.length, 1);
    assert.equal(signingBatches.length, 1);
    assert.equal(signingBatches[0].length, 9);
    assert(signingBatches[0].includes("pano-test/shared/room/preview.jpg"));
    assert(signingBatches[0].includes("pano-test/shared/room/tiles/custom-name.webp"));
    assert.notEqual(typeof resolved.panorama, "string");
    if (typeof resolved.panorama !== "string") {
      assert.equal(resolved.panorama.baseUrl, resolved.previewUrl);
      assert.equal(resolved.panorama.tileUrl(1, 0), "https://assets.example/pano-test/shared/room/tiles/custom-name.webp");
    }
  });

  await t.test("preview-only prefetch does not request tile authorization", async () => {
    const store = new PanoAssetStore("pano-test/preview/");
    const before = signingBatches.length;
    const resolved = await store.getPanorama("room", false);
    assert.equal(resolved.panorama, resolved.previewUrl);
    assert.deepEqual(signingBatches.slice(before), [[
      "pano-test/preview/room/meta.json",
      "pano-test/preview/room/preview.jpg",
    ]]);
  });

  await t.test("local public panoramas bypass URL signing", async () => {
    const store = new PanoAssetStore("/varaprasad_exterior_panos");
    const before = signingBatches.length;
    const resolved = await store.getPanorama("EP.00000", false);

    assert.equal(
      resolved.previewUrl,
      "/varaprasad_exterior_panos/EP.00000/preview.jpg",
    );
    assert.equal(signingBatches.length, before);
  });

  await t.test("metadata errors do not poison the panorama cache", async () => {
    const store = new PanoAssetStore("pano-test/retry-meta/");
    failMetadataOnce = true;
    await assert.rejects(store.getPanorama("room"), /Failed to load pano meta/);
    const resolved = await store.getPanorama("room");
    assert.equal(resolved.meta.cols, 4);
    assert.equal(metadataRequests.filter((url) => url.includes("retry-meta")).length, 2);
  });

  await t.test("failed URL batches can be retried", async () => {
    const store = new PanoAssetStore("pano-test/retry-signing/");
    failSigningOnce = true;
    await assert.rejects(store.getPanorama("room"), /Temporary signing failure/);
    const resolved = await store.getPanorama("room");
    assert(resolved.previewUrl.includes("retry-signing"));
  });

  await t.test("preview downloads before metadata finishes and shares authorization", async () => {
    const baseFetch = globalThis.fetch;
    let releaseMetadata!: () => void;
    const metadataGate = new Promise<void>((resolve) => { releaseMetadata = resolve; });
    let imageStarted!: () => void;
    const imageGate = new Promise<void>((resolve) => { imageStarted = resolve; });
    globalThis.fetch = async (input, init) => {
      if (String(input).includes("parallel/room/meta.json")) await metadataGate;
      return baseFetch(input, init);
    };
    const store = new PanoAssetStore("pano-test/parallel/", async (url) => {
      imageStarted();
      return url;
    });
    const before = signingBatches.length;
    const preview = store.preloadPanoramaPreview("room");
    const panorama = store.getPanorama("room");
    try {
      await imageGate;
      assert.equal(signingBatches.length - before, 1);
      assert.deepEqual(signingBatches[before], [
        "pano-test/parallel/room/meta.json",
        "pano-test/parallel/room/preview.jpg",
      ]);
    } finally {
      releaseMetadata();
      globalThis.fetch = baseFetch;
    }
    assert((await preview).endsWith("/preview.jpg"));
    assert.equal((await panorama).meta.cols, 4);
    assert.equal(metadataRequests.filter((url) => url.includes("parallel/")).length, 1);
  });

  await t.test("custom previews work even when speculative preview.jpg is absent", async () => {
    const baseFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => String(input).endsWith("custom/room/meta.json")
      ? Response.json({ ...meta, preview: "small.webp" })
      : baseFetch(input, init);
    const store = new PanoAssetStore("pano-test/custom/", async (url) => {
      if (url.endsWith("preview.jpg")) throw new Error("Missing default preview");
      return url;
    });
    try {
      assert((await store.preloadPanoramaPreview("room")).endsWith("small.webp"));
    } finally {
      globalThis.fetch = baseFetch;
    }
  });

  await t.test("working previews survive unavailable metadata", async () => {
    const store = new PanoAssetStore("pano-test/preview-fallback/", async (url) => url);
    failMetadataOnce = true;
    assert((await store.preloadPanoramaPreview("room")).endsWith("preview.jpg"));
    assert.equal((await store.getMeta("room")).cols, 4);
  });

  await t.test("image warmups deduplicate in-flight work but allow cache eviction and retries", async () => {
    let calls = 0;
    let release!: (url: string) => void;
    const store = new PanoAssetStore("/local", () => {
      calls += 1;
      if (calls === 1) return new Promise<string>((resolve) => { release = resolve; });
      if (calls === 2) return Promise.reject(new Error("Temporary download failure"));
      return Promise.resolve("/image.jpg");
    });
    const first = store.preloadImage("/image.jpg");
    assert.equal(store.preloadImage("/image.jpg"), first);
    assert.equal(calls, 1);
    release("/image.jpg");
    await first;
    await assert.rejects(store.preloadImage("/image.jpg"), /Temporary download failure/);
    await store.preloadImage("/image.jpg");
    assert.equal(calls, 3);
  });
});

test("tile descriptors use the real filenames from metadata", () => {
  const descriptors = buildTileDescriptors("room", meta, "panos/");
  assert.equal(descriptors.find((tile) => tile.col === 1 && tile.row === 0)?.url, "panos/room/tiles/custom-name.webp");
  assert.equal(descriptors.find((tile) => tile.col === 0 && tile.row === 0)?.url, "panos/room/tiles/tile_0_0.jpg");
});

test("preview fallbacks retain compatibility with the tiled adapter", () => {
  const fallback = asTiledPanorama("/preview.jpg");
  assert.equal(fallback.baseUrl, "/preview.jpg");
  assert.equal(fallback.tileUrl(0, 0), null);
  assert.equal(asTiledPanorama(fallback), fallback);
});

test("Varaprasad exterior frames map to EP panorama folders", () => {
  assert.equal(
    exteriorImageFilenameToPanoId("LS_Exterior_PANO_Spline_F0027.jpeg"),
    "EP.00027",
  );
  assert.equal(
    exteriorImageFilenameToPanoId("LS_PANO_Spline_F0027.jpeg"),
    "PANO.00027",
  );
});

test("priority prefetch follows the view, including the panorama seam", () => {
  const front = selectPriorityTiles("room", meta, "panos/", { yaw: 0, pitch: 0, zoom: 10 }, 1);
  const rear = selectPriorityTiles("room", meta, "panos/", { yaw: Math.PI, pitch: 0, zoom: 10 }, 1);
  assert.equal(front[0].col, 2);
  assert.equal(rear[0].col, 0);
  assert.equal(front[0].row, 1);
});

test("exterior warmup is frustum-aware, zoom-aware, and excludes the rear hemisphere", () => {
  const detailMeta = { width: 16384, height: 8192, cols: 32, rows: 16 };
  const viewport = { aspect: 16 / 9, minFov: 36, maxFov: 74 };
  const wide = selectPriorityTiles("room", detailMeta, "/panos",
    { yaw: 0, pitch: 0, zoom: 0 }, 512, viewport);
  const zoomed = selectPriorityTiles("room", detailMeta, "/panos",
    { yaw: 0, pitch: 0, zoom: 100 }, 512, viewport);
  assert(zoomed.length < wide.length);
  assert(wide.every((tile) => tile.col > 0 && tile.col < 31));
  const seam = selectPriorityTiles("room", detailMeta, "/panos",
    { yaw: Math.PI, pitch: 0, zoom: 100 }, 512, viewport);
  assert(seam.some((tile) => tile.col === 0));
  assert(seam.some((tile) => tile.col === 31));
  const portrait = selectPriorityTiles("room", detailMeta, "/panos",
    { yaw: 0, pitch: 0, zoom: 0 }, 512, { ...viewport, aspect: 9 / 16 });
  assert(portrait.length < wide.length);
});

test("conservative spherical bounds cover visible samples at seams and steep pitches", () => {
  const detailMeta = { width: 16384, height: 8192, cols: 32, rows: 16 };
  const viewport = { aspect: 16 / 9, minFov: 36, maxFov: 74 };
  for (const yaw of [0, Math.PI - 0.01, -Math.PI + 0.01]) {
    for (const pitch of [-1.3, 0, 1.3]) {
      for (const zoom of [0, 100]) {
        const selected = new Set(selectPriorityTiles("room", detailMeta, "/panos",
          { yaw, pitch, zoom }, 512, viewport).map((tile) => tile.key));
        const vFov = (74 - 38 * zoom / 100) * Math.PI / 180;
        for (let x = -10; x <= 10; x += 1) {
          for (let y = -6; y <= 6; y += 1) {
            const right = x / 10 * Math.tan(vFov / 2) * viewport.aspect;
            const up = y / 6 * Math.tan(vFov / 2);
            const horizontal = Math.cos(pitch) - up * Math.sin(pitch);
            const worldX = horizontal * Math.sin(yaw) + right * Math.cos(yaw);
            const worldZ = horizontal * Math.cos(yaw) - right * Math.sin(yaw);
            const worldY = Math.sin(pitch) + up * Math.cos(pitch);
            const sampleYaw = Math.atan2(worldX, worldZ);
            const samplePitch = Math.atan2(worldY, Math.hypot(worldX, worldZ));
            const col = Math.min(31, Math.floor((sampleYaw / (2 * Math.PI) + 0.5) * 32));
            const row = Math.min(15, Math.floor((0.5 - samplePitch / Math.PI) * 16));
            assert(selected.has(`${col}:${row}`), `Missing ${col}:${row} at ${yaw}/${pitch}/${zoom}`);
          }
        }
      }
    }
  }
});

test("a cancelled preview subscription is forwarded and never poisons later navigation", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => Response.json(meta);
  const seenSignals: Array<AbortSignal | undefined> = [];
  const store = new PanoAssetStore("/local", async (url, _priority, _key, signal) => {
    seenSignals.push(signal);
    signal?.throwIfAborted();
    return url;
  });
  const controller = new AbortController();
  await store.preloadPanoramaPreview("room", "low", controller.signal);
  assert.equal(seenSignals[0], controller.signal);
  controller.abort();
  await assert.rejects(store.preloadPanoramaPreview("room", "low", controller.signal),
    { name: "AbortError" });
  assert((await store.preloadPanoramaPreview("room", "high")).endsWith("preview.jpg"));
  assert.equal(seenSignals.at(-1), undefined);
});
