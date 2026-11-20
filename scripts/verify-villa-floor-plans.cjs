/* eslint-disable @typescript-eslint/no-require-imports -- Browser verification. */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const plans = require('../data/villa-floor-plans.json');
const { assertCompactPanel, assertSimpleExpanded } = require('./lib/verify-interior-minimap.cjs');
const base = process.env.STARTUP_TEST_URL || 'http://localhost:3000';
const gold = 'rgb(252, 225, 144)', blue = 'rgb(47, 127, 181)';

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const plan of plans.filter(plan => !process.env.VILLA_FLOORS || process.env.VILLA_FLOORS.split(',').includes(plan.id))) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'], reducedMotion: 'reduce' });
      page.setDefaultTimeout(45000);
      const errors = [], badPlans = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.url().includes('/villa-floor-plans/') && response.status() >= 400) badPlans.push(response.status()); });
      const ready = () => page.waitForSelector('[data-pano-transitioning="false"]', { timeout: 90000 });
      const minimap = page.locator('[data-floor-plan-minimap]');
      const color = marker => marker.locator('span').evaluate(element => getComputedStyle(element).backgroundColor);
      const open = async () => {
        await minimap.getByRole('button', { name: 'Open ' + plan.label.toLowerCase() + ' plan', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: plan.label + ' plan', exact: true });
        await dialog.locator('img').evaluate(image => image.decode());
        return dialog;
      };
      const assertView = async marker => {
        await page.waitForFunction(({ id, view }) => {
          if (document.querySelector('[data-pano-node]')?.getAttribute('data-pano-node') !== id) return false;
          const live = document.querySelector('[data-debug-pano-view]');
          if (!live) return false;
          const yawError = Math.abs(((Number(live.dataset.yaw) - view.yaw + 540) % 360) - 180);
          return yawError < 0.2 && Math.abs(Number(live.dataset.pitch) - view.pitch) < 0.2 && Math.abs(Number(live.dataset.zoom) - view.zoom) < 0.12;
        }, { id: marker.nodeId, view: marker.arrivalView }, { timeout: 15000 });
        assert.equal(await page.locator('[data-debug-pano-filename]').textContent(), marker.panoFilename);
      };
      const assertHitTargets = async () => {
        const hits = await minimap.locator('[data-minimap-room-number]').evaluateAll(elements => elements.map(element => {
          const rect = element.getBoundingClientRect(), hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
          return { number: element.dataset.minimapRoomNumber, actual: hit?.closest('[data-minimap-room-number]')?.getAttribute('data-minimap-room-number') };
        }));
        for (const hit of hits) assert.equal(hit.actual, hit.number, 'Every minimap POI center must be individually clickable');
      };
      const chooseMini = async marker => {
        await minimap.locator('[data-minimap-room-number="' + marker.number + '"]').click();
        assert.equal(await page.getByRole('dialog').count(), 0, 'POI navigation never expands the minimap');
        await ready(); await assertView(marker);
        assert.equal(await color(minimap.locator('[data-minimap-room-number="' + marker.number + '"]')), blue);
      };
      try {
        await page.goto(base + '/villa-walkthrough?villa=' + (process.env.VILLA_NUMBER || '1') + '&floor=' + plan.id,
          { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.addStyleTag({ content: 'nextjs-portal { pointer-events: none !important; }' });
        await ready();
        const canvas = await page.locator('.psv-canvas-container canvas').first().elementHandle();
        await page.locator('[data-pano-debug] summary').click();
        await minimap.locator('img').evaluate(image => image.decode());
        const assertTopAlignment = async () => {
          const mapBox = await minimap.boundingBox();
          const backBox = await page.getByRole('link', { name: 'Back to masterplan', exact: true }).boundingBox();
          assert(Math.abs(mapBox.y - backBox.y) < 1, 'Laptop/tablet minimap aligns with the back button');
        };
        await assertTopAlignment();
        await page.setViewportSize({ width: 900, height: 900 });
        await assertTopAlignment();
        await assertCompactPanel(page, plan);
        await page.setViewportSize({ width: 1440, height: 1000 });
        assert.equal(await minimap.locator('[data-minimap-room-number]').count(), plan.markers.length);
        assert.deepEqual(await minimap.locator('[data-minimap-room-number]').allTextContents(), Array(plan.markers.length).fill(''));
        await assertHitTargets();
        let dialog = await open();
        await dialog.locator('img').evaluate(image => image.decode());
        assert.deepEqual(await dialog.locator('[data-room-number]').evaluateAll(elements => elements.map(element => Number(element.dataset.roomNumber))),
          plan.markers.map(marker => marker.number));
        assert.deepEqual(await dialog.locator('[data-room-number]').allTextContents(), Array(plan.markers.length).fill(''));
        const frame = await dialog.locator('[data-numbered-plan-image]').boundingBox();
        assert(Math.abs(frame.width / frame.height - plan.width / plan.height) < 0.003);
        for (const marker of plan.markers) {
          const rect = await dialog.locator('[data-room-number="' + marker.number + '"]').boundingBox();
          assert(Math.abs(rect.x + rect.width / 2 - frame.x - frame.width * marker.left / 100) < 1);
          assert(Math.abs(rect.y + rect.height / 2 - frame.y - frame.height * marker.top / 100) < 1);
        }
        const inactive = dialog.locator('[data-room-number][aria-pressed="false"]').first();
        await page.mouse.move(1, 1); assert.equal(await color(inactive), gold);
        await inactive.hover(); assert.equal(await color(inactive), blue);
        await page.mouse.move(1, 1); assert.equal(await color(inactive), gold);
        await assertSimpleExpanded(dialog);
        await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
        assert(await minimap.getByRole('button', { name: 'Open ' + plan.label.toLowerCase() + ' plan', exact: true }).evaluate(element => document.activeElement === element));
        for (const marker of plan.markers.filter(marker => marker.nodeId && (!process.env.VILLA_POIS || process.env.VILLA_POIS.split(',').includes(String(marker.number))))) {
          await chooseMini(marker);
          console.log('PASS ' + plan.label + ' #' + marker.number + ': exact pano, saved yaw/pitch/zoom and direct dot navigation');
        }
        if (plan.id === 'ground' && !process.env.VILLA_POIS) {
          await chooseMini(plan.markers.find(marker => marker.number === 6));
          await chooseMini(plan.markers.find(marker => marker.number === 18));
          console.log('PASS shared pano 6 -> 18: same-node POI click restores the distinct requested arrival view');
        }
        // Two more clicks during an unfinished transition must not be silently
        // ignored or launch overlapping plugin transitions: the latest wins.
        const targets = plan.markers.filter(marker => marker.nodeId);
        const start = targets[0], loading = targets.find(marker => marker.nodeId !== start.nodeId), latest = targets.at(-1);
        await chooseMini(start);
        await minimap.locator('[data-minimap-room-number="' + loading.number + '"]').click();
        await page.waitForSelector('[data-pano-transitioning="true"]');
        assert.equal(await minimap.getByRole('status').count(), 0, 'Loading never puts messages over the map');
        await minimap.evaluate((element, numbers) => {
          for (const number of numbers) element.querySelector('[data-minimap-room-number="' + number + '"]').click();
        }, [start.number, latest.number]);
        await ready(); await assertView(latest);
        if (plan.id === 'ground') {
          const from = plan.markers.find(marker => marker.number === 6), to = plan.markers.find(marker => marker.number === 18);
          await chooseMini(from);
          await minimap.locator('[data-minimap-room-number="18"]').click();
          await page.waitForSelector('[data-pano-transitioning="true"]');
          await minimap.locator('[data-minimap-room-number="6"]').click();
          await ready(); await assertView(from);
          assert(to.nodeId === from.nodeId);
        }
        console.log('PASS ' + plan.label + ': latest busy-click intent is retained, camera restores complete and minimap is top-aligned');
        for (const marker of plan.markers.filter(marker => !marker.nodeId)) {
          const before = await page.locator('[data-pano-node]').getAttribute('data-pano-node');
          await minimap.locator('[data-minimap-room-number="' + marker.number + '"]').click();
          assert.equal(await minimap.getByRole('status').count(), 0);
          assert.equal(await minimap.locator('[data-minimap-room-number="' + marker.number + '"]').getAttribute('aria-pressed'), 'false');
          assert.equal(await page.getByRole('dialog').count(), 0);
          dialog = await open();
          await dialog.locator('[data-room-number="' + marker.number + '"]').click();
          assert.equal(await dialog.getByRole('status').count(), 0);
          assert.equal(await page.locator('[data-pano-node]').getAttribute('data-pano-node'), before);
          await dialog.getByRole('button', { name: 'Close floor plan', exact: true }).click();
        }
        dialog = await open();
        await page.screenshot({ path: '.tmp-villa-' + plan.id + '-mapped-dots.png' });
        const linked = plan.markers.find(marker => marker.nodeId);
        await dialog.locator('[data-room-number="' + linked.number + '"]').click();
        await dialog.waitFor({ state: 'detached' }); await ready(); await assertView(linked);
        assert(await canvas.evaluate(element => element.isConnected), 'All jumps reuse the same panorama renderer');
        await page.getByRole('button', { name: 'Copy pano details', exact: true }).click();
        assert((await page.evaluate(() => navigator.clipboard.readText())).includes(linked.panoFilename));
        await page.locator('[data-pano-debug] summary').click();
        await page.setViewportSize({ width: 390, height: 844 });
        await assertCompactPanel(page, plan);
        await assertHitTargets();
        if (plan.id !== 'ground') await page.getByRole('button', { name: 'View balcony', exact: true }).waitFor();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.screenshot({ path: '.tmp-villa-' + plan.id + '-mapped-mobile.png' });
        await page.setViewportSize({ width: 320, height: 700 });
        await assertCompactPanel(page, plan);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('[data-pano-debug] summary').click();
        await chooseMini(linked);
        assert.deepEqual(errors, []); assert.deepEqual(badPlans, []);
        console.log('PASS ' + plan.label + ': simple expanded map, quiet pending points, colors, AVIFs, clipboard, phone/tablet hide/restore and compact hit targets');
      } catch (error) {
        console.error(plan.label + ' browser exceptions:', errors);
        if (!page.isClosed()) await page.screenshot({ path: '.tmp-villa-plan-failure.png' }).catch(() => {});
        throw error;
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
