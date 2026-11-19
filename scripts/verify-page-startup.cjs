// Browser regression checks against a running Next server (no repository writes).
// Set PLAYWRIGHT_MODULE if Playwright is installed outside this project.
/* eslint-disable @typescript-eslint/no-require-imports -- Node-only CommonJS browser runner. */
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.STARTUP_TEST_URL || 'http://localhost:3000';

async function checkSignedUrlHook(browser) {
  const bundle = await build({
    stdin: {
      contents: `
        import React, { StrictMode, useEffect, useState } from 'react';
        import { createRoot } from 'react-dom/client';
        import { useSignedAssetUrls } from './src/lib/use-signed-assets';
        function Harness() {
          const [keys, setKeys] = useState(['startup-a']);
          const [tick, setTick] = useState(0);
          window.changeKeys = setKeys;
          useEffect(() => {
            const timer = setInterval(() => setTick(n => n + 1), 25);
            return () => clearInterval(timer);
          }, []);
          const urls = useSignedAssetUrls([...keys]);
          return <pre>{JSON.stringify({ urls, tick })}</pre>;
        }
        createRoot(document.getElementById('root')).render(<StrictMode><Harness /></StrictMode>);
      `,
      resolveDir: process.cwd(), loader: 'tsx',
    },
    bundle: true, write: false, platform: 'browser', format: 'iife',
    define: { 'process.env.NODE_ENV': '"development"' },
  });
  const page = await browser.newPage();
  const requests = [];
  const failures = new Set();
  try {
    await page.route('https://startup.test/**', async route => {
      if (!route.request().url().includes('/api/sign-asset')) {
        return route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' });
      }
      const { keys } = route.request().postDataJSON();
      requests.push(keys);
      await new Promise(resolve => setTimeout(resolve, keys.includes('startup-c') ? 50 : 350));
      if (keys.includes('startup-fail') && !failures.has('startup-fail')) {
        failures.add('startup-fail');
        return route.fulfill({ status: 500, json: { error: 'Simulated signing failure' } });
      }
      return route.fulfill({ json: { urls: Object.fromEntries(keys.map(key => [key, `https://media.test/${key}`])) } });
    });
    await page.goto('https://startup.test/');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const waitForKeys = keys => page.waitForFunction(expected => {
      const data = JSON.parse(document.querySelector('pre').textContent);
      return JSON.stringify(Object.keys(data.urls)) === JSON.stringify(expected);
    }, keys);
    await waitForKeys(['startup-a']);
    assert.equal(requests.length, 1, 'Fresh input arrays and Strict Mode share one pending request');
    await page.evaluate(() => window.changeKeys(['startup-b']));
    await page.waitForTimeout(50);
    await page.evaluate(() => window.changeKeys(['startup-c']));
    await waitForKeys(['startup-c']);
    await page.waitForTimeout(400);
    await waitForKeys(['startup-c']);
    await page.evaluate(() => window.changeKeys(['startup-a']));
    await waitForKeys(['startup-a']);
    assert.equal(requests.length, 3, 'Returning to a cached key needs no new request');
    await page.evaluate(() => window.changeKeys(['startup-fail']));
    await page.waitForTimeout(500);
    await waitForKeys([]);
    await page.evaluate(() => window.changeKeys([]));
    await waitForKeys([]);
    await page.evaluate(() => window.changeKeys(['startup-fail']));
    await waitForKeys(['startup-fail']);
    console.log('PASS signed URL hook: re-renders, Strict Mode, changed keys, stale responses, cache, failure/retry');
  } finally { await page.close(); }
}

async function checkHome(browser, stalled = false, mobile = false) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const errors = [];
  const obsolete = [];
  const signingRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (/brochure|forglb|res\.cloudinary\.com/.test(request.url())) obsolete.push(request.url());
    if (request.url().includes('/api/sign-asset')) signingRequests.push(request.postData() || '');
  });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  if (stalled) await page.route(/TULA\/Videos\/.*\.mp4/, async route => {
    await gate;
    await route.abort();
  });
  try {
    const start = Date.now();
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('[data-luxury-villa-preloader]').waitFor({ state: 'detached', timeout: 25000 });
    assert.equal(await page.locator('main[aria-hidden]').getAttribute('aria-hidden'), 'false');
    assert.equal(obsolete.length, 0, 'No deleted brochure, legacy GLB or Cloudinary frame preloads');
    assert(!signingRequests.some(body => /Home Page2|Home%20Page2/.test(body)), 'Hero URLs must be server seeded');
    if (!stalled) {
      await page.waitForFunction(() => [...document.querySelectorAll('video')].some(v => v.readyState >= 2 && v.currentTime > 0), {}, { timeout: 15000 });
    }
    assert.deepEqual(errors, []);
    console.log(`PASS ${mobile ? 'mobile' : 'desktop'} home ${stalled ? 'stalled-media fallback' : 'video playback'} (${Date.now() - start} ms including route/intro)`);
  } finally {
    release();
    await context.close();
  }
}

async function checkMasterplan(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto(`${base}/master-plan`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const waitForHover = () => page.waitForFunction(() => document.querySelector('[data-masterplan-hover-enabled=true]'), {}, { timeout: 25000 });
    await waitForHover();
    const video = await page.locator('video[data-masterplan-video]').evaluate(v => ({
      url: v.currentSrc, duration: v.duration, error: v.error?.message,
    }));
    assert.equal(new URL(video.url).searchParams.get('v'), 'cors-20261119');
    assert.equal(video.duration, 10.3);
    assert(!video.error);
    for (const direction of ['Next', 'Next', 'Previous', 'Previous']) {
      const before = await page.locator('[data-masterplan-target-frame]').getAttribute('data-masterplan-target-frame');
      await page.getByRole('button', { name: `${direction} master plan hotspot`, exact: true }).click();
      await page.waitForFunction(previous => document.querySelector('[data-masterplan-target-frame]')?.getAttribute('data-masterplan-target-frame') !== previous, before);
      await waitForHover();
    }
    // Exercise pointer capture/scrubbing as well as the four arrow paths.
    await page.mouse.move(700, 650);
    await page.mouse.down();
    await page.mouse.move(950, 650, { steps: 12 });
    assert.equal(await page.locator('[data-masterplan-dragging]').getAttribute('data-masterplan-dragging'), 'true');
    await page.mouse.up();
    await waitForHover();
    console.log('PASS masterplan: cloud video, decoded stop/hover, both arrows at both stops, drag/scrub');
  } finally { await page.close(); }
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    await checkSignedUrlHook(browser);
    await checkHome(browser);
    await checkHome(browser, true);
    await checkHome(browser, false, true);
    await checkMasterplan(browser);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
