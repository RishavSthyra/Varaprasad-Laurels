/* eslint-disable @typescript-eslint/no-require-imports -- Real touch gesture verification. */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const route of ['villa-walkthrough?villa=1', 'clubhouse-walkthrough']) {
      const page = await browser.newPage({ viewport: { width:390, height:844 }, hasTouch:true });
      const errors=[];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto((process.env.STARTUP_TEST_URL || 'http://localhost:3000') + '/' + route, { waitUntil:'domcontentloaded', timeout:120000 });
        await page.addStyleTag({ content:'nextjs-portal{pointer-events:none!important}' });
        await page.waitForSelector('[data-pano-transitioning="false"][data-pano-move-speed="1.25"]', { timeout:90000 });
        const root=page.locator('[data-pano-node]');
        assert.equal(await root.getAttribute('data-pano-move-inertia'), '0.65');
        const node=await root.getAttribute('data-pano-node');
        await page.locator('[data-pano-debug] summary').click();
        await page.waitForSelector('[data-debug-pano-view]');
        // Keep camera polling, but do not let the development panel intercept
        // the swipe (long clubhouse filenames make that panel wider).
        await page.locator('[data-pano-debug]').evaluate(panel => { panel.style.pointerEvents = 'none'; });
        const live=page.locator('[data-debug-pano-view]');
        const before=Number(await live.getAttribute('data-yaw'));
        const cdp=await page.context().newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x:250,y:500}]});
        for(let step=1;step<=10;step++) {
          await cdp.send('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:[{x:250+9*step,y:500}]});
          await page.waitForTimeout(20);
        }
        await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
        await page.waitForTimeout(700);
        const after=Number(await live.getAttribute('data-yaw'));
        const delta=Math.abs(((after-before+540)%360)-180);
        assert(delta>1 && delta<70, 'A short swipe should rotate controllably, not whip around the scene: '+delta);
        assert.equal(await root.getAttribute('data-pano-node'),node);
        assert.deepEqual(errors,[]);
        console.log('PASS '+route+': lower touch speed, less inertia, actual swipe '+delta.toFixed(1)+' degrees and unchanged panorama');
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
