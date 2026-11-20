/* eslint-disable @typescript-eslint/no-require-imports -- Touch-tablet browser regression. */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { assertCompactPanel } = require('./lib/verify-interior-minimap.cjs');
const villa = require('../data/villa-floor-plans.json');
const clubhouse = require('../data/clubhouse-floor-plans.json');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const [route, plan] of [['villa-walkthrough?villa=20&floor=second', villa[2]], ['clubhouse-walkthrough?floor=first', clubhouse[1]]]) {
      const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, hasTouch: true });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto((process.env.STARTUP_TEST_URL || 'http://localhost:3000') + '/' + route, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.addStyleTag({ content: 'nextjs-portal { pointer-events: none !important; }' });
        await page.waitForSelector('[data-pano-transitioning="false"]', { timeout: 90000 });
        await page.locator('[data-floor-plan-minimap] img').evaluate(image => image.decode());
        assert(await page.evaluate(() => matchMedia('(pointer: coarse)').matches));
        const canvas = await page.locator('.psv-canvas-container canvas').first().elementHandle();
        await assertCompactPanel(page, plan);
        await page.screenshot({ path: '.tmp-touch-tablet-' + (route.startsWith('villa') ? 'villa' : 'clubhouse') + '.png' });
        assert(await canvas.evaluate(element => element.isConnected));
        assert.deepEqual(errors, []);
        console.log('PASS touch tablet ' + route + ': compact X, full slide-out, matching controls, restore and unchanged panorama');
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
