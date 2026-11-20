/* eslint-disable @typescript-eslint/no-require-imports -- Browser regression runner. */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const plans = require('../data/clubhouse-floor-plans.json');
const { assertCompactPanel } = require('./lib/verify-interior-minimap.cjs');
const base = process.env.STARTUP_TEST_URL || 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const ready = () => page.waitForSelector('[data-pano-transitioning="false"]', { timeout: 90000 });
  async function assertView(marker) {
    await page.waitForFunction(({ id, view }) => {
      if (document.querySelector('[data-pano-node]')?.getAttribute('data-pano-node') !== id) return false;
      const live = document.querySelector('[data-debug-pano-view]');
      if (!live) return false;
      const yawError = Math.abs(((Number(live.dataset.yaw) - view.yaw + 540) % 360) - 180);
      return yawError < 0.8 && Math.abs(Number(live.dataset.pitch) - view.pitch) < 0.8 && Math.abs(Number(live.dataset.zoom) - view.zoom) < 0.8;
    }, { id: marker.nodeId, view: marker.arrivalView }, { timeout: 15000 });
  }
  try {
    await page.goto(`${base}/clubhouse-walkthrough`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.addStyleTag({ content: 'nextjs-portal { pointer-events: none !important; }' });
    await ready();
    const canvas = await page.locator('.psv-canvas-container canvas').first().elementHandle();
    await page.locator('[data-pano-debug] summary').click();
    // Deliberately look away before selecting the already-current entrance POI.
    await page.mouse.move(700, 360); await page.mouse.down(); await page.mouse.move(1050, 580, { steps: 12 }); await page.mouse.up();
    for (const marker of plans[0].markers.filter(marker => !process.env.CLUBHOUSE_POIS || process.env.CLUBHOUSE_POIS.split(',').includes(String(marker.number)))) {
      await page.getByRole('button', { name: 'Open ground floor plan', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Ground floor plan', exact: true });
      assert.equal(await dialog.locator('[data-marker-style="dot"]').count(), 9);
      assert.equal(await dialog.locator('[data-marker-style="number"]').count(), 0);
      assert.deepEqual(await dialog.locator('[data-room-number]').allTextContents(), Array(9).fill(''));
      for (const removed of [2, 8, 10, 12, 13, 14, 15]) assert.equal(await dialog.locator(`[data-room-number="${removed}"]`).count(), 0);
      await dialog.locator(`[data-room-number="${marker.number}"]`).click();
      await dialog.waitFor({ state: 'detached' });
      await ready(); await assertView(marker);
      assert.equal(await page.locator('[data-debug-pano-filename]').textContent(), marker.panoFilename);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `.tmp-clubhouse-poi-${marker.number}.png` });
      console.log(`PASS ground POI ${marker.number}: exact camera/filename and reviewed yaw, pitch, zoom`);
    }
    assert(await canvas.evaluate(element => element.isConnected), 'POI jumps reuse the existing panorama canvas');
    for (const plan of plans.slice(1)) {
      await page.getByRole('combobox', { name: 'Choose floor', exact: true }).click();
      await page.getByRole('option', { name: plan.label, exact: true }).click();
      await ready();
      await page.getByRole('button', { name: `Open ${plan.label.toLowerCase()} plan`, exact: true }).click();
      const dialog = page.getByRole('dialog', { name: `${plan.label} plan`, exact: true });
      assert.equal(await dialog.locator('[data-marker-style="number"]').count(), 0);
      assert.deepEqual(await dialog.locator('[data-marker-style="dot"]').allTextContents(), Array(plan.markers.length).fill(''));
      if (plan.id === 'first') await page.screenshot({ path: '.tmp-clubhouse-first-dots.png' });
      await dialog.getByRole('button', { name: 'Close floor plan', exact: true }).click();
      console.log(`PASS ${plan.label}: all ${plan.markers.length} locations use dot POIs`);
    }
    await page.getByRole('combobox', { name: 'Choose floor', exact: true }).click();
    await page.getByRole('option', { name: 'Ground floor', exact: true }).click();
    await ready();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-pano-debug] summary').click();
    await assertCompactPanel(page, plans[0]);
    assert.equal(await page.locator('[data-floor-plan-minimap] [data-marker-style="dot"]').count(), 9);
    await page.screenshot({ path: '.tmp-clubhouse-ground-dots-mobile.png' });
    await page.locator('[data-minimap-room-number="5"]').click(); await ready();
    await page.locator('[data-pano-debug] summary').click();
    await assertView(plans[0].markers.find(marker => marker.number === 5));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    console.log('PASS mobile ground dot navigation, camera framing and no browser exceptions');
  } catch (error) {
    console.error('Browser exceptions:', errors);
    if (!page.isClosed()) await page.screenshot({ path: '.tmp-clubhouse-pois-failure.png' }).catch(() => {});
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
