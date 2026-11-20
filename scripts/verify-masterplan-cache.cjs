/* eslint-disable @typescript-eslint/no-require-imports -- Browser regression runner. */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.STARTUP_TEST_URL || 'http://localhost:3000';
const videoPattern = '**/masterplan_scrub_gop3_60mb.mp4*';

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  let releaseLast;
  const lastChunkGate = new Promise(resolve => { releaseLast = resolve; });
  await page.route(videoPattern, async route => {
    if (route.request().headers().range === 'bytes=54525952-58057109') await lastChunkGate;
    await route.continue();
  });
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    window.__videos = [];
    const create = document.createElement.bind(document);
    document.createElement = (tag, ...args) => {
      const element = create(tag, ...args);
      if (tag === 'video') window.__videos.push(element);
      return element;
    };
  });
  const hover = () => page.waitForFunction(() => document.querySelector('[data-masterplan-hover-enabled=true]'), {}, { timeout: 45000 });
  let progress;
  try {
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('[data-luxury-villa-preloader]').waitFor({ state: 'detached', timeout: 20000 });
    await page.getByRole('button', { name: 'Explore Master Plan', exact: true }).click();
    await page.waitForURL('**/master-plan');
    await hover();
    console.log('PASS native opening is usable before the complete cache finishes');
    progress = setInterval(async () => {
      try { console.log('Cache progress', await page.locator('video[data-masterplan-video]').evaluate(v => ({ bytes: v.dataset.cachedBytes, complete: v.dataset.fullVideoCache, local: v.src.startsWith('blob:') }))); } catch { /* Navigation/close. */ }
    }, 10000);
    // Finish caching while resting at the second calibrated stop, not just at
    // frame zero, so the handoff must preserve a nonzero camera time.
    await page.waitForFunction(() => Number(document.querySelector('video[data-masterplan-video]')?.dataset.cachedBytes) >= 54525952, {}, { timeout: 180000 });
    await page.getByRole('button', { name: 'Next master plan hotspot', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-masterplan-target-frame]')?.getAttribute('data-masterplan-target-frame') !== '1');
    await hover();
    const preservedFrame = await page.locator('[data-masterplan-target-frame]').getAttribute('data-masterplan-target-frame');
    releaseLast();
    await page.waitForFunction(() => {
      const v = document.querySelector('video[data-masterplan-video]');
      return v?.dataset.fullVideoCache === 'ready' && v.src.startsWith('blob:') && v.readyState >= 2 && !v.seeking;
    }, {}, { timeout: 180000 });
    clearInterval(progress);
    await hover();
    assert.equal(await page.locator('[data-masterplan-frame]').getAttribute('data-masterplan-frame'), preservedFrame);
    const complete = await page.locator('video[data-masterplan-video]').evaluate(v => ({ bytes: Number(v.dataset.cachedBytes), duration: v.duration, source: v.src.startsWith('blob:'), videos: window.__videos.filter(v => v.hasAttribute('data-masterplan-video')).length, frozen: v.parentElement.querySelectorAll('canvas').length }));
    assert.equal(complete.bytes, 58057110);
    assert.equal(complete.duration, 10.3);
    assert(complete.source);
    assert.equal(complete.videos, 1, 'No second hidden video decoder');
    assert.equal(complete.frozen, 0, 'The transient still must be removed after the exact stop decodes');
    console.log('PASS full 58,057,110-byte MP4 adopted at a settled stop', complete);
    // With the CDN unavailable, both arrow paths and drag must still decode.
    await page.route(videoPattern, route => route.abort());
    for (const direction of ['Next', 'Next', 'Previous', 'Previous']) {
      await page.waitForTimeout(350);
      const before = await page.locator('[data-masterplan-target-frame]').getAttribute('data-masterplan-target-frame');
      await page.getByRole('button', { name: `${direction} master plan hotspot`, exact: true }).click();
      await page.waitForFunction(previous => document.querySelector('[data-masterplan-target-frame]')?.getAttribute('data-masterplan-target-frame') !== previous, before);
      await hover();
      console.log(`PASS cached ${direction} from frame ${before} with CDN blocked`);
    }
    await page.mouse.move(700, 650); await page.mouse.down();
    await page.mouse.move(950, 650, { steps: 12 });
    assert.equal(await page.locator('[data-masterplan-dragging]').getAttribute('data-masterplan-dragging'), 'true');
    await page.mouse.up(); await hover();
    console.log('PASS cached drag/scrub with CDN blocked');
    await page.waitForFunction(async () => {
      const cache = await caches.open('laurels-masterplan-video-v1');
      return (await cache.keys()).length === 1;
    });
    let videoRequests = 0;
    page.on('request', request => { if (request.url().includes('masterplan_scrub_gop3_60mb.mp4')) videoRequests++; });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await hover();
    assert(await page.locator('video[data-masterplan-video]').evaluate(v => v.src.startsWith('blob:')));
    assert.equal(videoRequests, 0, 'Reload must use the stored video without contacting the CDN');
    assert.deepEqual(errors, []);
    console.log('PASS reload restores persistent cache with zero video network requests');
  } finally {
    releaseLast();
    clearInterval(progress);
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
