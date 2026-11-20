/* eslint-disable @typescript-eslint/no-require-imports -- Browser verification. */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const plans = require('../data/clubhouse-floor-plans.json');
const { assertCompactPanel, assertSimpleExpanded } = require('./lib/verify-interior-minimap.cjs');
const base = process.env.STARTUP_TEST_URL || 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const errors = [], badPlans = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.url().includes('/clubhouse-floor-plans/') && r.status() >= 400) badPlans.push(r.status()); });
  try {
    await page.goto(`${base}/clubhouse-walkthrough`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.addStyleTag({ content: 'nextjs-portal { pointer-events: none !important; }' });
    await page.waitForSelector('[data-pano-transitioning="false"]', { timeout: 90000 });
    await page.locator('[data-pano-debug] summary').click();
    await page.getByLabel('Debug: choose pano').waitFor();
    for (const plan of plans) {
      if (plan.id !== 'ground') {
        await page.getByRole('combobox', { name: 'Choose floor', exact: true }).click();
        await page.getByRole('option', { name: plan.label, exact: true }).click();
        await page.waitForSelector('[data-pano-transitioning="false"]', { timeout: 90000 });
      }
      const trigger = page.getByRole('button', { name: `Open ${plan.label.toLowerCase()} plan`, exact: true });
      await page.locator('[data-floor-plan-minimap] img').evaluate(image => image.decode());
      const node = await page.locator('[data-pano-node]').getAttribute('data-pano-node');
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: `${plan.label} plan`, exact: true });
      await dialog.locator('img').evaluate(image => image.decode());
      assert.equal(await dialog.locator('[data-room-number]').count(), plan.markers.length);
      const frame = await dialog.locator('[data-numbered-plan-image]').boundingBox();
      assert(Math.abs(frame.width / frame.height - plan.width / plan.height) < 0.003);
      for (const marker of plan.markers) {
        const button = dialog.locator(`[data-room-number="${marker.number}"]`);
        const actual = await button.boundingBox();
        assert(Math.abs(actual.x + actual.width / 2 - frame.x - frame.width * marker.left / 100) < 1);
        assert(Math.abs(actual.y + actual.height / 2 - frame.y - frame.height * marker.top / 100) < 1);
      }
      const pending = plan.markers.find(marker => !marker.nodeId);
      if (pending) {
        await dialog.locator(`[data-room-number="${pending.number}"]`).click();
        assert.equal(await dialog.getByRole('status').count(), 0);
        assert.equal(await page.locator('[data-pano-node]').getAttribute('data-pano-node'), node, 'Unassigned marker must not navigate');
      }
      if (plan.id === 'third' || plan.id === 'first') await page.screenshot({ path: `.tmp-clubhouse-plan-${plan.id}.png` });
      await assertSimpleExpanded(dialog);
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached' });
      assert(await trigger.evaluate(element => document.activeElement === element), 'Focus returns to plan trigger');
      console.log(`PASS ${plan.label}: AVIF decode, ${plan.markers.length} room positions, quiet pending points, minimal map and focus`);
    }
    const selector = page.getByLabel('Debug: choose pano');
    await selector.selectOption({ index: 1 });
    await page.waitForSelector('[data-pano-transitioning="false"]', { timeout: 90000 });
    const selectedFilename = await selector.locator('option:checked').textContent();
    assert.equal(await page.locator('[data-debug-pano-filename]').textContent(), selectedFilename);
    await page.getByRole('button', { name: 'Copy pano details', exact: true }).click();
    assert((await page.evaluate(() => navigator.clipboard.readText())).includes(selectedFilename));
    console.log('PASS development pano selector, current filename and clipboard');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-pano-debug] summary').click();
    await assertCompactPanel(page, plans.at(-1));
    const box = await page.locator('[data-floor-plan-minimap]').boundingBox();
    assert(box.width <= 390 && box.height <= 844);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: '.tmp-clubhouse-plan-mobile.png' });
    console.log('PASS mobile compact map, hide/restore and no container chrome');
    assert.deepEqual(badPlans, []);
    assert.deepEqual(errors, []);
  } catch (error) {
    console.error('Browser exceptions:', errors);
    await page.screenshot({ path: '.tmp-clubhouse-plan-failure.png' });
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
