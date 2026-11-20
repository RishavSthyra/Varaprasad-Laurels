/* eslint-disable @typescript-eslint/no-require-imports -- Browser regression runner. */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const plans = require('../data/clubhouse-floor-plans.json');
const { assertCompactPanel, assertSimpleExpanded } = require('./lib/verify-interior-minimap.cjs');
const base = process.env.STARTUP_TEST_URL || 'http://localhost:3000';
const gold = 'rgb(252, 225, 144)', blue = 'rgb(47, 127, 181)';

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const plan of plans.filter(plan => !process.env.CLUBHOUSE_FLOORS || process.env.CLUBHOUSE_FLOORS.split(',').includes(plan.id))) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
      page.setDefaultTimeout(60000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const ready = () => page.waitForSelector('[data-pano-transitioning="false"]', { timeout: 90000 });
      const open = async () => {
        await page.getByRole('button', { name: `Open ${plan.label.toLowerCase()} plan`, exact: true }).click();
        return page.getByRole('dialog', { name: `${plan.label} plan`, exact: true });
      };
      const color = marker => marker.locator('span').evaluate(element => getComputedStyle(element).backgroundColor);
      try {
        await page.goto(`${base}/clubhouse-walkthrough?floor=${plan.id}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.addStyleTag({ content: 'nextjs-portal { pointer-events: none !important; }' });
        await ready();
        const canvas = await page.locator('.psv-canvas-container canvas').first().elementHandle();
        await page.locator('[data-pano-debug] summary').click();
        const minimap = page.locator('[data-floor-plan-minimap]');
        await minimap.locator('img').evaluate(image => image.decode());
        const frame = await minimap.boundingBox(), image = await minimap.locator('img').boundingBox();
        assert(Math.abs(frame.width - image.width) < 1 && Math.abs(frame.height - image.height) < 1, 'Image fills the minimap without card padding');
        const rotated = plan.minimapRotation === 90;
        const aspect = rotated ? plan.height / plan.width : plan.width / plan.height;
        assert(Math.abs(frame.width / frame.height - aspect) < 0.003, 'Full uncropped plan aspect with thumbnail-only rotation');
        for (const marker of plan.markers) {
          const button = await minimap.locator(`[data-minimap-room-number="${marker.number}"]`).boundingBox();
          const left = rotated ? 100 - marker.top : marker.left, top = rotated ? marker.left : marker.top;
          assert(Math.abs(button.x + button.width / 2 - frame.x - frame.width * left / 100) < 1, 'POI X follows the rotated image');
          assert(Math.abs(button.y + button.height / 2 - frame.y - frame.height * top / 100) < 1, 'POI Y follows the rotated image');
        }
        const expand = await minimap.getByRole('button', { name: `Open ${plan.label.toLowerCase()} plan`, exact: true }).boundingBox();
        assert(expand.x >= frame.x && expand.y >= frame.y && expand.x + expand.width <= frame.x + frame.width, 'Expand button overlays the map');
        assert.equal(await minimap.locator('button button').count(), 0, 'POIs are independent buttons, not nested in expand');
        const expandStyles = await minimap.locator('button[aria-haspopup="dialog"]').evaluate(element => {
          const button = getComputedStyle(element), icon = element.querySelector('svg').getBoundingClientRect();
          return { background: button.backgroundColor, color: button.color, width: icon.width, height: icon.height };
        });
        assert.deepEqual(expandStyles, { background: 'rgba(0, 0, 0, 0)', color: blue, width: 14, height: 14 });
        assert.equal(frame.width, 256, 'Minimap uses its original full desktop width');
        await page.mouse.click(frame.x + frame.width / 2, frame.y + frame.height - 2);
        assert.equal(await page.getByRole('dialog').count(), 0, 'Map background does not expand');
        let dialog = await open();
        await assertSimpleExpanded(dialog);
        assert.deepEqual(await dialog.locator('[data-room-number]').evaluateAll(elements => elements.map(element => Number(element.dataset.roomNumber))), plan.markers.map(marker => marker.number));
        const style = plan.markerStyle === 'dot' ? 'dot' : 'number';
        assert.equal(await dialog.locator(`[data-marker-style="${style}"]`).count(), plan.markers.length);
        if (style === 'dot') {
          assert.deepEqual(await dialog.locator('[data-room-number]').allTextContents(), Array(plan.markers.length).fill(''));
          assert.deepEqual(await minimap.locator('[data-minimap-room-number]').allTextContents(), Array(plan.markers.length).fill(''));
        }
        const inactive = dialog.locator('[data-room-number][aria-pressed="false"]').first();
        await page.mouse.move(1, 1);
        assert.equal(await color(inactive), gold, `${plan.id}: default gold`);
        await inactive.hover();
        assert.equal(await color(inactive), blue, `${plan.id}: hovered blue`);
        await page.mouse.move(1, 1);
        assert.equal(await color(inactive), gold, `${plan.id}: hover clears`);
        await dialog.getByRole('button', { name: 'Close floor plan', exact: true }).click();
        for (const marker of plan.markers.filter(marker => marker.nodeId && (!process.env.CLUBHOUSE_POIS || process.env.CLUBHOUSE_POIS.split(',').includes(String(marker.number))))) {
          await minimap.locator(`[data-minimap-room-number="${marker.number}"]`).click();
          assert.equal(await page.getByRole('dialog').count(), 0, 'Minimap POI navigates directly, never expands');
          await ready();
          await page.waitForFunction(({ id, view }) => {
            if (document.querySelector('[data-pano-node]')?.getAttribute('data-pano-node') !== id) return false;
            const live = document.querySelector('[data-debug-pano-view]');
            if (!live) return false;
            const yawError = Math.abs(((Number(live.dataset.yaw) - view.yaw + 540) % 360) - 180);
            return yawError < 0.8 && Math.abs(Number(live.dataset.pitch) - view.pitch) < 0.8 && Math.abs(Number(live.dataset.zoom) - view.zoom) < 0.8;
          }, { id: marker.nodeId, view: marker.arrivalView }, { timeout: 15000 });
          assert.equal(await page.locator('[data-debug-pano-filename]').textContent(), marker.panoFilename);
          dialog = await open();
          await page.mouse.move(1, 1);
          const active = dialog.locator(`[data-room-number="${marker.number}"]`);
          assert.equal(await active.getAttribute('aria-pressed'), 'true');
          assert.equal(await color(active), blue, `${plan.id} ${marker.number}: active blue`);
          await dialog.getByRole('button', { name: 'Close floor plan', exact: true }).click();
          assert.equal(await color(minimap.locator(`[data-minimap-room-number="${marker.number}"]`)), blue);
          console.log(`PASS ${plan.label} #${marker.number}: direct minimap jump, exact camera/view and active blue`);
        }
        for (const marker of plan.markers.filter(marker => !marker.nodeId)) {
          const before = await page.locator('[data-pano-node]').getAttribute('data-pano-node');
          dialog = await open();
          await dialog.locator(`[data-room-number="${marker.number}"]`).click();
          assert.equal(await dialog.getByRole('status').count(), 0);
          assert.equal(await page.locator('[data-pano-node]').getAttribute('data-pano-node'), before);
          assert.equal(await dialog.locator(`[data-room-number="${marker.number}"]`).getAttribute('aria-pressed'), 'false');
          await dialog.getByRole('button', { name: 'Close floor plan', exact: true }).click();
        }
        assert(await canvas.evaluate(element => element.isConnected), 'All POI jumps reuse the existing viewer');
        await page.locator('[data-pano-debug] summary').click();
        await page.setViewportSize({ width: 390, height: 844 });
        await assertCompactPanel(page, plan);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.screenshot({ path: `.tmp-clubhouse-${plan.id}-mapped-mobile.png` });
        const mobileMarker = plan.markers.find(marker => marker.nodeId);
        await minimap.locator(`[data-minimap-room-number="${mobileMarker.number}"]`).click();
        await ready();
        assert.equal(await page.getByRole('dialog').count(), 0, 'Mobile minimap POI does not expand');
        assert.equal(await page.locator('[data-pano-node]').getAttribute('data-pano-node'), mobileMarker.nodeId);
        await page.screenshot({ path: `.tmp-clubhouse-${plan.id}-minimap-mobile.png` });
        assert.deepEqual(errors, []);
        console.log(`PASS ${plan.label}: marker format, default/hover colors, pending rooms and 390px mobile layout`);
      } catch (error) {
        console.error(`${plan.label} browser exceptions:`, errors);
        if (!page.isClosed()) await page.screenshot({ path: `.tmp-clubhouse-${plan.id}-mapping-failure.png` }).catch(() => {});
        throw error;
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
