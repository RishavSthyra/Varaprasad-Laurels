const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/HP/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const clubhouseResponses = [];
    page.on('response', r => { if (r.url().includes('/varaprasad_clubhouse_panos/')) clubhouseResponses.push(r.status()); });
    await page.goto('http://localhost:3000/master-plan', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => document.querySelector('[data-masterplan-hover-enabled]')?.dataset.masterplanHoverEnabled === 'true', null, { timeout: 90000 });
    let point;
    for (let y = 150; y <= 320 && !point; y += 20) for (let x = 105; x <= 260 && !point; x += 20) {
      await page.mouse.move(x, y); await page.waitForTimeout(40);
      if (await page.getByRole('link', { name: 'Enter clubhouse walkthrough' }).count()) point = { x, y };
    }
    assert(point, 'Clubhouse GLB must have a hover label/link');
    assert.equal(await page.getByRole('link', { name: 'Enter clubhouse walkthrough' }).getAttribute('href'), '/clubhouse-walkthrough');
    await page.mouse.click(point.x, point.y);
    await page.waitForURL('**/clubhouse-walkthrough', { timeout: 60000 });
    await page.waitForSelector('.psv-container canvas', { timeout: 90000 });
    await page.waitForTimeout(5000);
    assert(clubhouseResponses.some(status => status === 200));
    assert(!clubhouseResponses.some(status => status >= 400));
    console.log(JSON.stringify({ clubhouseModelClick: true, cloudPanoResponses: clubhouseResponses.length, failedPanoResponses: 0 }));

    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route('**/Varaprasad_Laurels/Panos/varaprasad_exterior_panos/**', async route => { await gate; await route.continue(); });
    await page.goto('http://localhost:3000/exterior-walkthrough', { waitUntil: 'domcontentloaded', timeout: 120000 });
    const loader = page.locator('[data-exterior-walkthrough-preloader]').last();
    await loader.waitFor({ state: 'visible', timeout: 60000 });
    await loader.locator('img').first().evaluate(image => image.decode());
    await page.waitForFunction(() => [...document.querySelectorAll('[data-exterior-walkthrough-preloader]')].some(element => element.parentElement === document.body));
    assert(await page.evaluate(() => Boolean(document.elementFromPoint(innerWidth / 2, 40)?.closest('[data-exterior-walkthrough-preloader]'))), 'Loader must cover the global top navigation');
    assert.equal(await loader.locator('[data-preloader-vectors]').count(), 1);
    assert.equal(await loader.locator('img').first().getAttribute('alt'), 'Vara Prasad Constructions');
    await page.screenshot({ path: '.tmp-exterior-brand-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: '.tmp-exterior-brand-mobile.png' });
    const bounds = await loader.boundingBox();
    assert.equal(bounds.width, 390); assert.equal(bounds.height, 844);
    release();
    await loader.waitFor({ state: 'hidden', timeout: 120000 });
    assert(await page.locator('.psv-container canvas').count() > 0);
    console.log(JSON.stringify({ exteriorLoaderDesktopAndMobile: true, vectors: true, firstPanoHandoff: true }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
