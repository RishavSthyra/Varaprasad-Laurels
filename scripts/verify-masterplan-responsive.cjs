/* eslint-disable @typescript-eslint/no-require-imports -- Browser regression runner. */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.STARTUP_TEST_URL || 'http://localhost:3000';
const videoPattern = '**/masterplan_scrub_gop3_60mb.mp4*';
const sizes = [[320, 568], [390, 844], [844, 390], [768, 1024], [1024, 768], [1366, 1024], [1440, 900], [1920, 1080], [2560, 1080]];

async function assertContained(page) {
  await page.waitForFunction(() => [...document.querySelectorAll('[data-masterplan-render-frame]')].some(e => e.getBoundingClientRect().width > 0));
  // R3F measures its parent through ResizeObserver after the sheet changes the
  // available stage height. Wait for that normal layout handoff, not one tick.
  await page.waitForFunction(() => [...document.querySelectorAll('[data-masterplan-render-frame]')].filter(e => e.getBoundingClientRect().width > 0).every(frame => {
    const canvas = frame.querySelector('canvas');
    if (!canvas) return true;
    const a = frame.getBoundingClientRect(), b = canvas.getBoundingClientRect();
    return Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;
  }), {}, { timeout: 10000 });
  const bounds = await page.locator('[data-masterplan-render-frame]:visible').evaluate(frame => {
    const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
    const image = frame.querySelector('img'), video = frame.querySelector('video'), canvas = frame.querySelector('canvas');
    return { frame: rect(frame), stage: rect(frame.parentElement), image: rect(image), mode: frame.dataset.masterplanMediaFit, fit: getComputedStyle(image).objectFit,
      videoFit: video && getComputedStyle(video).objectFit, canvas: canvas && rect(canvas), overflow: document.documentElement.scrollWidth > innerWidth };
  });
  const { frame, stage } = bounds;
  assert(Math.abs(frame.width / frame.height - 16 / 9) < 0.002, JSON.stringify(bounds));
  if (bounds.mode === 'contain') {
    assert(frame.x >= stage.x - 1 && frame.y >= stage.y - 1 && frame.right <= stage.right + 1 && frame.bottom <= stage.bottom + 1);
  } else {
    assert(frame.x <= stage.x + 1 && frame.y <= stage.y + 1 && frame.right >= stage.right - 1 && frame.bottom >= stage.bottom - 1);
    assert(Math.abs(stage.width - await page.evaluate(() => innerWidth)) < 1);
    assert(Math.abs(stage.height - await page.evaluate(() => innerHeight)) < 1);
  }
  assert.equal(bounds.fit, 'contain');
  if (bounds.videoFit) assert.equal(bounds.videoFit, 'contain');
  assert(!bounds.overflow, 'No horizontal page overflow');
  for (const item of [bounds.image, bounds.canvas].filter(Boolean)) {
    assert(Math.abs(item.width - frame.width) < 1 && Math.abs(item.height - frame.height) < 1, JSON.stringify(bounds));
  }
  return bounds;
}

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(videoPattern, route => route.abort()); // Preview must work without video readiness.
  try {
    await page.goto(`${base}/master-plan`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    // Development's issue badge can cover bottom controls after an intentional
    // media abort. It isn't shipped; real browser exceptions are still checked.
    await page.addStyleTag({ content: 'nextjs-portal { pointer-events: none !important; }' });
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(400);
      await assertContained(page);
      if (width <= 1366) {
        const sheet = page.getByRole('region', { name: 'Villa filters', exact: true });
        await sheet.waitFor({ state: 'visible' });
        assert.equal(await sheet.getByRole('button', { name: 'Close filters', exact: true }).count(), 0);
        await assertContained(page);
        const rect = await sheet.boundingBox();
        assert(rect.x >= -1 && rect.x + rect.width <= width + 1 && rect.y >= 0 && rect.y + rect.height <= height + 1);
        await sheet.getByLabel('Villa type', { exact: true }).selectOption({ index: 1 });
        await page.waitForFunction(() => {
          const button = document.querySelector('[data-open-residences]');
          return button && !button.textContent.includes('77');
        });
        await sheet.getByRole('button', { name: 'Clear filters', exact: true }).click();
        await sheet.getByRole('button', { name: 'Open residences · 77', exact: true }).click();
        const results = page.getByRole('region', { name: 'Matching villas', exact: true });
        await results.locator('[data-residence-results-direction="bottom"]').waitFor({ state: 'visible' });
        await results.getByPlaceholder('Search by villa number').fill('12');
        await results.getByRole('button', { name: 'Explore Villa 12', exact: true }).waitFor({ state: 'visible' });
        await results.getByRole('button', { name: 'Close residence results', exact: true }).click();
        await sheet.getByRole('button', { name: 'Clear filters', exact: true }).click();
        if (width === 390) await page.screenshot({ path: '.tmp-masterplan-mobile-filters.png' });
        await sheet.getByRole('button', { name: 'Open residences · 77', exact: true }).click();
        await page.keyboard.press('Escape');
        await sheet.waitFor({ state: 'visible' });
        await assertContained(page);
        if (width === 390) await page.screenshot({ path: '.tmp-masterplan-mobile-full-frame.png' });
      } else {
        assert(await page.locator('[data-masterplan-mobile-controls]').isHidden());
        await page.getByRole('button', { name: 'Open filters', exact: true }).waitFor({ state: 'visible' });
      }
      console.log(`PASS ${width}x${height}: ${width <= 1366 ? 'uncropped media, persistent filters, bottom results, reset and return' : 'full-screen desktop media and controls'}`);
    }
    const laptop = await browser.newPage({ viewport: { width: 1024, height: 768 }, hasTouch: false });
    laptop.on('pageerror', e => errors.push(e.message));
    await laptop.route(videoPattern, route => route.abort());
    await laptop.goto(`${base}/master-plan`, { waitUntil: 'domcontentloaded' });
    await laptop.locator('[data-masterplan-media-fit="cover"]:visible').waitFor();
    await assertContained(laptop);
    assert(await laptop.locator('[data-masterplan-mobile-controls]').isHidden());
    await laptop.getByRole('button', { name: 'Open filters', exact: true }).click();
    await laptop.getByRole('button', { name: 'Close filters', exact: true }).waitFor({ state: 'visible' });
    await laptop.screenshot({ path: '.tmp-masterplan-laptop-fullscreen.png' });
    await laptop.close();
    console.log('PASS 1024px non-touch laptop uses full-screen media and desktop filters');
    assert.deepEqual(errors, []);
    await page.unroute(videoPattern);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('[data-masterplan-hover-enabled=true]'), {}, { timeout: 90000 });
    await assertContained(page);
    await page.getByRole('button', { name: 'Next master plan hotspot', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-masterplan-frame]')?.getAttribute('data-masterplan-frame') !== '1' && document.querySelector('[data-masterplan-hover-enabled=true]'), {}, { timeout: 90000 });
    await assertContained(page);
    const frame = await page.locator('[data-masterplan-render-frame]:visible').boundingBox();
    await page.mouse.move(frame.x + frame.width * 0.35, frame.y + frame.height * 0.65);
    await page.mouse.down(); await page.mouse.move(frame.x + frame.width * 0.7, frame.y + frame.height * 0.65, { steps: 10 });
    assert.equal(await page.locator('[data-masterplan-dragging=true]').count(), 1);
    await page.mouse.up();
    await page.waitForFunction(() => document.querySelector('[data-masterplan-hover-enabled=true]'), {}, { timeout: 45000 });
    assert.deepEqual(errors, []);
    console.log('PASS real mobile GOP3 playback, calibrated stop/hover and drag inside the contained frame');
  } catch (error) {
    console.error('Browser exceptions:', errors);
    await page.screenshot({ path: '.tmp-masterplan-responsive-failure.png' });
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
