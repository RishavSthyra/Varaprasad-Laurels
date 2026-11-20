/* eslint-disable @typescript-eslint/no-require-imports -- SSR first-paint checks. */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.STARTUP_TEST_URL || 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const [width, height, touch] of [[375, 667, true], [1180, 820, true], [1440, 900, false]]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: touch });
      // Allow React's inline streamed-HTML reveal, but block every app chunk so
      // no hydration/matchMedia effect can "fix" the first layout for this test.
      await page.route('**/_next/static/chunks/**', route => route.abort());
      try {
        await page.goto(base + '/master-plan', { waitUntil: 'domcontentloaded', timeout: 120000 });
        const compact = touch || width < 1024;
        await page.locator('[data-masterplan-mobile-sheet]').waitFor({ state: compact ? 'visible' : 'attached' });
        const image = page.locator('[data-masterplan-preview] img:visible').first();
        await image.evaluate(img => img.decode());
        const sheet = page.locator('[data-masterplan-mobile-controls]');
        assert.equal(await sheet.isVisible(), compact, 'Correct filters are present before hydration');
        const info = await image.evaluate(img => {
          const box = element => { const r = element.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height, right:r.right, bottom:r.bottom }; };
          return { image:box(img), stage:box(img.closest('[data-masterplan-stage-placeholder]')), src:img.currentSrc, background:img.style.backgroundImage };
        });
        assert(Math.abs(info.image.width / info.image.height - 16 / 9) < 0.01);
        if (compact) {
          assert(info.src.endsWith('/960.avif'));
          assert(info.image.width <= info.stage.width + 1 && info.image.height <= info.stage.height + 1, 'First frame is contained, never cropped');
          assert(Math.abs(info.stage.height - height * 0.36) < 1);
          assert(Math.abs((await page.locator('[data-masterplan-mobile-sheet]').boundingBox()).height - height * 0.64) < 1);
        } else {
          assert(info.src.endsWith('/1920.avif'));
          assert(info.image.width >= width - 1 && info.image.height >= height - 1, 'Desktop preview covers the full screen');
        }
        assert(info.background.includes('data:image'), 'A tiny inline preview is available even before the image download');
        await page.screenshot({ path: '.tmp-masterplan-first-paint-' + width + '.png' });
        console.log('PASS before-hydration first paint ' + width + 'x' + height + ': correct framing, filter visibility and preloaded preview');
      } finally { await page.close(); }
    }
    const page = await browser.newPage({ viewport: { width: 375, height: 667 }, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/masterplan_scrub_gop3_60mb.mp4*', route => route.abort());
    await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.addStyleTag({ content: 'nextjs-portal{pointer-events:none!important}' });
    await page.getByRole('button', { name: /Explore master plan/i }).click({ timeout: 60000 });
    await page.locator('[data-masterplan-mobile-sheet]').waitFor();
    await page.locator('[data-masterplan-render-frame]').waitFor();
    const frame = await page.locator('[data-masterplan-render-frame]').boundingBox();
    assert(frame.width <= 375 + 1 && frame.height <= 667 * 0.36 + 1);
    assert.equal(await page.locator('[data-masterplan-mobile-sheet]').isVisible(), true);
    assert.deepEqual(errors, []);
    console.log('PASS client navigation from home: same compact layout and preview, without waiting for video');
    await page.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
