/* eslint-disable @typescript-eslint/no-require-imports -- Browser regression runner. */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.STARTUP_TEST_URL || 'http://localhost:3000';
const cases = [
  [252, '02', '00000'], [257, '03', '00000'], [260, '04', '00000'],
  [264, '05', '00263'], [270, '06', '00269'], [278, '07', '00000'], [283, '08', '00000'],
];

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(60000); // Cold remote image decoding can outlast the local-file test's 30s limit.
  const errors = [], missing = [], cloudRequests = new Set(), localRequests = new Set();
  const appOrigin = new URL(base).origin;
  // Simulate deletion without touching the local files: any local fallback
  // would fail this run even while the backup remains on disk.
  await page.route(url => url.origin === appOrigin && url.pathname.startsWith('/varaprasad_exterior_panos_remaining_v2/'), route => route.abort());
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin === appOrigin && url.pathname.startsWith('/varaprasad_exterior_panos_remaining_v2/')) localRequests.add(decodeURIComponent(url.pathname));
  });
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.origin !== appOrigin && url.pathname.includes('/varaprasad_exterior_panos_remaining_v2/')) {
      cloudRequests.add(decodeURIComponent(url.pathname));
      if (response.status() >= 400) missing.push(decodeURIComponent(url.pathname));
    }
  });
  const ready = () => page.waitForFunction(() => document.querySelector('[data-exterior-ready=true][data-exterior-transitioning=false]'), {}, { timeout: 45000 });
  try {
    for (const [counter, camera, imageFrame] of cases.filter(([, camera]) => !process.env.EXTERIOR_CAMERAS || process.env.EXTERIOR_CAMERAS.split(',').includes(camera))) {
      await page.goto(`${base}/exterior-walkthrough?pano=${counter}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await ready();
      await page.locator('[data-exterior-walkthrough-preloader]').waitFor({ state: 'detached', timeout: 15000 });
      const viewer = page.locator('[data-exterior-node]');
      assert.equal(await viewer.getAttribute('data-exterior-node-count'), '285');
      assert.equal(await viewer.getAttribute('data-exterior-pano'), `Exterior PANO Cam ${camera}.${imageFrame}`);
      assert.equal(await page.getByRole('button', { name: 'Open amenities menu', exact: true }).count(), 0);
      assert.equal(await page.getByText('Walkthrough Stops', { exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Expand minimap', exact: true }).last().click();
      assert.equal(await page.getByRole('button', { name: /^Go to / }).count(), 0);
      const map = page.getByAltText('Laurels exterior amenity minimap').last();
      assert(await map.evaluate(image => image.complete && image.naturalWidth === 3840));
      if (camera === '02') await page.screenshot({ path: '.tmp-exterior-v2-minimap.png' });
      // Stay inside the rounded viewer's hit area, outside the central map.
      await page.getByRole('button', { name: 'Close expanded exterior minimap', exact: true }).click({ position: { x: 70, y: 70 } });
      if (camera === '02') await page.screenshot({ path: '.tmp-exterior-v2-desktop.png' });
      const first = await viewer.getAttribute('data-exterior-node');
      await page.getByRole('button', { name: 'Next pano', exact: true }).click();
      await page.waitForFunction(id => document.querySelector('[data-exterior-node]')?.getAttribute('data-exterior-node') !== id, first);
      await ready();
      const next = await viewer.getAttribute('data-exterior-node');
      assert(next.includes(`_${camera}_`), 'Next must stay in this camera run');
      await page.getByRole('button', { name: 'Go back to previous pano', exact: true }).click();
      await page.waitForFunction(id => document.querySelector('[data-exterior-node]')?.getAttribute('data-exterior-node') === id, first);
      await ready();
      if (camera === '06') {
        await page.getByRole('button', { name: 'Move forward', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[data-exterior-node]')?.getAttribute('data-exterior-node') === 'Exterior_PANO_Spline_06_F0001');
        await ready();
        await page.getByRole('button', { name: 'Move back', exact: true }).click();
        await page.waitForFunction(id => document.querySelector('[data-exterior-node]')?.getAttribute('data-exterior-node') === id, first);
        await ready();
        console.log('PASS Camera 06 directional forward/back follows the exported world heading');
      }
      console.log(`PASS Camera ${camera}: signed Cloudflare tiled panorama, next/back, no POIs or amenities menu`);
    }
    // Small-screen menu and expanded map use the same disabled POI feature.
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.getByRole('button', { name: 'Open amenities menu', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Expand minimap', exact: true }).last().click();
    assert.equal(await page.getByRole('button', { name: /^Go to / }).count(), 0);
    assert.equal(await page.getByText('Walkthrough Stops', { exact: true }).count(), 0);
    await page.screenshot({ path: '.tmp-exterior-v2-mobile.png' });
    assert(![...cloudRequests].some(url => /Cam 06\.00272|Cam 07\.00005/.test(url)));
    assert([...cloudRequests].some(url => url.includes('/tiles/')), 'Full detail cloud tiles must load, not just previews');
    assert.equal(localRequests.size, 0, 'No dependency on optional local generated assets');
    assert.deepEqual(missing, []);
    assert.deepEqual(errors, []);
    console.log(`PASS mobile minimap; ${cloudRequests.size} cloud asset URLs, zero local pano requests, missing files or browser exceptions`);
  } catch (error) {
    console.error(JSON.stringify({ errors, missing, localRequests: [...localRequests], state: await page.locator('[data-exterior-node]').evaluate(element => ({
      pano: element.getAttribute('data-exterior-pano'), ready: element.getAttribute('data-exterior-ready'), transitioning: element.getAttribute('data-exterior-transitioning'),
    })).catch(() => null) }));
    if (!page.isClosed()) await page.screenshot({ path: '.tmp-exterior-v2-cloud-failure.png' }).catch(() => {});
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
