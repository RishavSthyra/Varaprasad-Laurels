const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/HP/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');
const launch = { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };
const base = 'http://localhost:3000';
const ready = page => page.waitForFunction(() => document.querySelector('[data-masterplan-hover-enabled]')?.dataset.masterplanHoverEnabled === 'true', null, { timeout: 90000 });
const stop = (page, frame) => page.waitForFunction(frame => document.querySelector('[data-masterplan-frame]')?.dataset.masterplanFrame === String(frame) && document.querySelector('[data-masterplan-hover-enabled]')?.dataset.masterplanHoverEnabled === 'true', frame, { timeout: 20000 });
(async () => {
  const browser = await chromium.launch(launch);
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [], failed = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) failed.push({ path: new URL(r.url()).pathname, status: r.status() }); });
    await page.goto(base + '/master-plan', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await ready(page);
    assert.equal(await page.getByRole('heading', { name: 'Find a villa', exact: true }).isVisible(), false);
    assert.equal(await page.locator('video[data-masterplan-video]').count(), 1);
    let hover = '';
    for (let y = 200; y <= 750 && !hover; y += 100) for (let x = 250; x <= 1250 && !hover; x += 100) {
      await page.mouse.move(x, y); await page.waitForTimeout(40);
      hover = (await page.locator('[data-masterplan-frame]').innerText()).match(/Villa \d+/i)?.[0] || '';
    }
    assert(hover, 'Actual GLB raycast must produce a villa label');
    console.log(JSON.stringify({ initialHover: hover, filtersClosed: true, videoElements: 1 }));
    for (const [name, frame, check] of [
      ['Next', 160, t => t > 0 && t < 5.3], ['Next', 1, t => t > 5.3],
      ['Previous', 160, t => t > 5.3], ['Previous', 1, t => t > 0 && t < 5.3],
    ]) {
      await page.getByRole('button', { name: name + ' master plan hotspot', exact: true }).click();
      await page.waitForTimeout(1000);
      const time = await page.locator('video[data-masterplan-video]').evaluate(v => v.currentTime);
      assert(check(time), `${name} path wrong at ${time}`);
      await stop(page, frame);
      console.log(JSON.stringify({ arrow: name, frame, intermediateTime: time, settledTime: await page.locator('video[data-masterplan-video]').evaluate(v => v.currentTime) }));
    }
    await page.mouse.move(1200, 500); await page.mouse.down();
    await page.mouse.move(650, 500, { steps: 20 }); await page.waitForTimeout(500);
    assert.equal(await page.locator('[data-masterplan-dragging]').getAttribute('data-masterplan-dragging'), 'true');
    const draggedTime = await page.locator('video[data-masterplan-video]').evaluate(v => v.currentTime);
    assert(draggedTime > 2 && draggedTime < 5.3);
    await page.mouse.up(); await stop(page, 160);
    assert.equal(await page.locator('[data-villa-residence]').count(), 0, 'Dragging must not select a villa');
    console.log(JSON.stringify({ dragTime: draggedTime, dragReleaseFrame: 160 }));
    // Collection cards must decode the real local images, not alt text.
    const imageResults = await page.evaluate(async () => Promise.all(['/villa%20center%20image2.avif', '/villa%20corner%20image.avif'].map(src => new Promise(resolve => {
      const image = new Image(); image.onload = () => resolve({ src, width: image.naturalWidth }); image.onerror = () => resolve({ src, width: 0 }); image.src = src;
    }))));
    assert(imageResults.every(image => image.width === 3840));
    console.log(JSON.stringify({ images: imageResults, errors, failed }));
    assert.equal(errors.length, 0); assert.equal(failed.length, 0);

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await mobile.goto(base + '/master-plan', { waitUntil: 'domcontentloaded', timeout: 120000 }); await ready(mobile);
    const box = await mobile.locator('[data-masterplan-frame]').boundingBox();
    assert(box.height > 800, 'Closed filters leave a full-height mobile stage');
    const cdp = await mobile.context().newCDPSession(mobile);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 340, y: 420 }] });
    for (let x = 320; x >= 190; x -= 10) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: 420 }] }); await mobile.waitForTimeout(30); }
    await mobile.waitForTimeout(300);
    assert.equal(await mobile.locator('[data-masterplan-dragging]').getAttribute('data-masterplan-dragging'), 'true');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await stop(mobile, 160);
    console.log(JSON.stringify({ mobileTouchScrub: true, stageHeight: box.height }));

    const slow = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    let release; const gate = new Promise(resolve => { release = resolve; });
    await slow.route('**/masterplan_scrub_gop3_60mb.mp4', async route => { await gate; await route.continue(); });
    await slow.goto(base + '/master-plan', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await slow.waitForFunction(() => { const image = document.querySelector('[data-masterplan-frame] img'); return image?.complete && image.naturalWidth > 0; });
    assert.equal(await slow.locator('[data-masterplan-hover-enabled]').getAttribute('data-masterplan-hover-enabled'), 'false');
    release(); await ready(slow);
    console.log(JSON.stringify({ delayedVideoPosterAndHandoff: true }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
