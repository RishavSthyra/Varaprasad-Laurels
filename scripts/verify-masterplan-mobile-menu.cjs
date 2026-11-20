/* eslint-disable @typescript-eslint/no-require-imports -- Browser regression runner. */
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.STARTUP_TEST_URL || "http://localhost:3000";

(async () => {
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: "reduce" });
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  // Navigation must work before the scrub video becomes ready. Keep the real
  // GLB available: aborting the model intentionally throws through R3F.
  await page.route(/\.mp4(?:\?|$)/, route => route.abort());
  try {
    await page.goto(base + "/master-plan", { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.addStyleTag({ content: "nextjs-portal { pointer-events:none!important }" });
    for (const [width, height] of [[375, 667], [390, 844], [844, 390], [768, 1024], [1024, 768], [1366, 1024]]) {
      await page.setViewportSize({ width, height });
      const filters = page.getByRole("region", { name: "Villa filters", exact: true });
      await filters.waitFor();
      const trigger = page.getByRole("button", { name: "Open navigation menu", exact: true });
      await trigger.waitFor();
      const rect = await trigger.boundingBox();
      assert(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= width && rect.y + rect.height <= height);
      assert(rect.y < 30 && rect.width <= 44, "Compact trigger is in the top-left, clear of bottom filters");
      assert(await trigger.evaluate(el => {
        const r = el.getBoundingClientRect();
        return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest("button") === el;
      }), "Hamburger is not covered by the masterplan/filter layer");
      await trigger.click();
      const nav = page.getByRole("navigation", { name: "Mobile site navigation", exact: true });
      await nav.waitFor();
      const close = page.getByRole("button", { name: "Close navigation menu", exact: true });
      assert(await close.evaluate(el => {
        const r = el.getBoundingClientRect();
        return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest("button") === el;
      }), "Open menu is above persistent filters");
      await close.click();
      await nav.waitFor({ state: "detached" });
      await trigger.click();
      await nav.waitFor();
      await page.keyboard.press("Escape");
      await nav.waitFor({ state: "detached" });
      await filters.waitFor();
      if (width === 390 || width === 1366) await page.screenshot({ path: `.tmp-masterplan-menu-${width}.png` });
      console.log(`PASS ${width}x${height} touch: visible/clickable hamburger, menu above filters, close/Escape and filters preserved`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: "Open navigation menu", exact: true }).waitFor({ state: "hidden" });
    assert.deepEqual(errors, []);
    console.log("PASS desktop: no extra mobile hamburger; no browser exceptions");
  } catch (error) {
    console.error("Browser exceptions:", errors);
    await page.screenshot({ path: ".tmp-masterplan-menu-failure.png" }).catch(() => {});
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
