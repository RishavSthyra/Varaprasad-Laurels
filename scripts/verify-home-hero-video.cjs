/* eslint-disable @typescript-eslint/no-require-imports -- Browser regression runner. */
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.STARTUP_TEST_URL || "http://localhost:3000";
const poster = "https://cdn.sthyra.com/Varaprasad_Laurels/Images/first-frames/entry.avif";
const video = "https://cdn.sthyra.com/Varaprasad_Laurels/Videos/videos/entry.mp4";
const reverse = "https://cdn.sthyra.com/Varaprasad_Laurels/Videos/entrance_reverse_av1.mp4";
const forwardPlayer = '[data-home-hero-video][data-home-direction="forward"]';
const reversePlayer = '[data-home-hero-video][data-home-direction="reverse"]';
const visiblePlayer = '[data-home-hero-video][data-video-visible="true"]';

async function cycle(page) {
  await page.waitForFunction(() => document.querySelector('[data-home-direction="reverse"]').dataset.videoVisible === "true", null, { timeout: 15000 });
  assert.equal(await page.locator(visiblePlayer).count(), 1);
  assert(await page.locator(forwardPlayer).evaluate(el => el.paused));
  await page.waitForFunction(() => document.querySelector('[data-home-direction="forward"]').dataset.videoVisible === "true", null, { timeout: 15000 });
  assert.equal(await page.locator(visiblePlayer).count(), 1);
  assert(await page.locator(reversePlayer).evaluate(el => el.paused));
}

(async () => {
  // Use Chrome's native decoder/GPU path: forcing SwiftShader disables HEVC
  // decoding for the supplied Amenities forward clip on Windows.
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const contexts = [];
  const create = async mobile => {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, hasTouch: mobile, reducedMotion: "reduce" });
    contexts.push(context);
    // Isolate priority of the requested hero assets, not optional next-route work.
    await context.addInitScript(() => Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true, effectiveType: "4g" } }));
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const requests = [];
    page.on("request", request => { if ([poster, video, reverse].includes(request.url())) requests.push(request.url()); });
    const enter = async () => {
      await page.goto(base, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.addStyleTag({ content: "nextjs-portal{pointer-events:none!important}" });
    };
    const revealed = () => page.locator("[data-luxury-villa-preloader]").waitFor({ state: "detached", timeout: 20000 });
    const playing = () => page.locator(visiblePlayer).waitFor({ timeout: 45000 });
    return { context, page, errors, requests, enter, revealed, playing };
  };
  try {
    const desktop = await create(false);
    await desktop.enter();
    await desktop.revealed();
    await desktop.playing();
    await desktop.page.locator('[data-home-media][data-home-assets-cached="true"][data-home-assets-settled="true"]').waitFor();
    const state = await desktop.page.locator(forwardPlayer).evaluate(el => ({
      src: el.src, poster: el.poster, muted: el.muted, loop: el.loop, inline: el.playsInline,
      ready: el.readyState, duration: el.duration, width: el.videoWidth, height: el.videoHeight,
    }));
    assert(state.src.startsWith("blob:") && state.poster.startsWith("blob:"));
    assert(state.muted && !state.loop && state.inline && state.ready >= 2);
    assert.equal(state.width, 3840); assert.equal(state.height, 2160);
    assert(state.duration > 5 && state.duration < 5.2);
    assert.equal(await desktop.page.locator("[data-home-media] video").count(), 2);
    assert.equal(await desktop.page.getByAltText("Laurels water feature", { exact: true }).getAttribute("src"), state.poster);
    const entries = await desktop.page.evaluate(async ({ poster, video, reverse }) => {
      const sizes = [];
      for (const [name, url] of [["laurels-home-poster-v1", poster], ["laurels-home-video-v1", video], ["laurels-home-reverse-video-v1", reverse]]) {
        const response = await (await caches.open(name)).match(url);
        sizes.push(response ? (await response.blob()).size : 0);
      }
      return sizes;
    }, { poster, video, reverse });
    assert.deepEqual(entries, [718517, 3622943, 11581331]);
    assert.equal(desktop.requests.filter(url => url === poster).length, 1);
    assert.equal(desktop.requests.filter(url => url === video).length, 1);
    assert.equal(desktop.requests.filter(url => url === reverse).length, 1);
    await cycle(desktop.page);
    await cycle(desktop.page);
    await desktop.page.screenshot({ path: ".tmp-home-video-desktop.png" });
    console.log("PASS desktop: real 4K forward/reverse/forward twice, only one playing, one fetch each, complete persistent files");
    const count = desktop.requests.length;
    await desktop.page.route(poster, route => route.abort());
    await desktop.page.route(video, route => route.abort());
    await desktop.page.route(reverse, route => route.abort());
    await desktop.page.reload({ waitUntil: "domcontentloaded" });
    await desktop.revealed(); await desktop.playing();
    await cycle(desktop.page);
    assert.equal(desktop.requests.length, count, "A hard reload must restore both assets without CDN requests");
    assert.deepEqual(desktop.errors, []);
    console.log("PASS hard reload with hero CDN blocked: poster/video restored from CacheStorage, zero additional media requests");
    await desktop.context.close();

    const phone = await create(true);
    await phone.enter(); await phone.revealed(); await phone.playing();
    await cycle(phone.page);
    await phone.page.screenshot({ path: ".tmp-home-video-phone.png" });
    assert.deepEqual(phone.errors, []);
    console.log("PASS phone: forward/reverse/forward inline playback and preserved responsive copy/navigation");
    await phone.context.close();

    const failed = await create(false);
    await failed.page.route(video, route => route.fulfill({ status: 404, body: "Not found" }));
    await failed.enter(); await failed.revealed();
    await failed.page.getByAltText("Laurels water feature", { exact: true }).evaluate(image => image.decode());
    assert.equal(await failed.page.locator('[data-home-hero-video][data-video-visible="true"]').count(), 0);
    assert.equal(await failed.page.locator('[data-home-media][aria-hidden="false"]').count(), 1);
    assert.deepEqual(failed.errors, []);
    console.log("PASS failed video: supplied poster and navigation remain visible, no stuck loader or browser exception");
    await failed.context.close();

    const failedReverse = await create(false);
    await failedReverse.page.route(reverse, route => route.fulfill({ status: 404, body: "Not found" }));
    await failedReverse.enter(); await failedReverse.revealed(); await failedReverse.playing();
    await failedReverse.page.locator(forwardPlayer).evaluate(el => { el.currentTime = el.duration - 0.2; });
    await failedReverse.page.waitForFunction(() => {
      const el = document.querySelector('[data-home-direction="forward"]');
      return el.dataset.videoVisible === "true" && !el.paused && el.currentTime < 1;
    });
    assert.equal(await failedReverse.page.locator(visiblePlayer).getAttribute("data-home-direction"), "forward");
    assert.deepEqual(failedReverse.errors, []);
    console.log("PASS failed reverse: forward playback repeats safely without a blank screen");
    await failedReverse.context.close();

    const slow = await create(false);
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await slow.page.route(video, async route => { await gate; await route.continue().catch(() => {}); });
    try {
      await slow.enter();
      await slow.revealed();
      assert.equal(await slow.page.locator('[data-home-media][data-warmup-timeout="true"]').count(), 1);
      await slow.page.getByAltText("Laurels water feature", { exact: true }).evaluate(image => image.decode());
      assert.equal(await slow.page.locator('[data-home-hero-video][data-video-visible="true"]').count(), 0);
      release();
      await slow.playing();
      assert.equal(await slow.page.locator("[data-luxury-villa-preloader]").count(), 0);
      assert.deepEqual(slow.errors, []);
      console.log("PASS slow video: bounded loader reveals poster, late cached playback replaces it without reopening loader");
    } finally { release(); }
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
