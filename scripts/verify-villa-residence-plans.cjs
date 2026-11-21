/* eslint-disable @typescript-eslint/no-require-imports -- Local browser regression runner. */
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.STARTUP_TEST_URL || "http://localhost:3000";

(async () => {
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.goto(`${base}/master-plan`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.addStyleTag({ content: "nextjs-portal{pointer-events:none!important}" });
    await page.getByRole("button", { name: "Open filters", exact: true }).click();
    await page.getByRole("button", { name: /Open \d+ residences/ }).click();
    await page.getByPlaceholder("Search by villa number", { exact: true }).first().fill("51");
    await page.getByRole("button", { name: /Villa 51/ }).first().click();
    const experience = page.locator('[data-villa-experience="51"]');
    await experience.waitFor();
    await experience.getByRole("tab", { name: "Ground", exact: true }).waitFor();
    for (const [floor, label, width, height] of [["ground", "Ground", 1690, 1854], ["first", "First", 1904, 1825], ["second", "Second", 2133, 2234]]) {
      await experience.getByRole("tab", { name: label, exact: true }).click();
      const image = experience.getByAltText(`Villa 1 reference: ${floor} floor plan`, { exact: true });
      await image.evaluate(image => image.decode());
      const dimensions = await image.evaluate(image => ({ src: new URL(image.src).pathname, width: image.naturalWidth, height: image.naturalHeight, fit: getComputedStyle(image).objectFit }));
      assert.deepEqual(dimensions, { src: `/villa-floor-plans/villa-1/${floor}.avif`, width, height, fit: "contain" });
      assert.equal(await experience.getByText("Plan image not available yet", { exact: true }).count(), 0);
      await experience.getByRole("button", { name: `Enlarge Villa 51 ${floor} floor plan`, exact: true }).click();
      const expanded = experience.locator("[data-expanded-villa-plan]");
      await expanded.getByRole("img").evaluate(image => image.decode());
      assert.equal(await expanded.getByRole("img").evaluate(image => getComputedStyle(image).objectFit), "contain");
      await expanded.getByRole("button", { name: "Close enlarged image", exact: true }).click();
      console.log(`PASS Villa 51 ${floor}: correct full AVIF, uncropped sidebar and enlarged plan`);
    }
    await page.screenshot({ path: ".tmp-villa-residence-floor-plan.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await experience.getByRole("tab", { name: "Ground", exact: true }).click();
    await experience.getByAltText("Villa 1 reference: ground floor plan", { exact: true }).evaluate(image => image.decode());
    await page.screenshot({ path: ".tmp-villa-residence-floor-plan-phone.png" });
    assert.deepEqual(errors, []);
    console.log("PASS phone residence panel: floor switching, reference image and no browser exceptions");
  } catch (error) {
    await page.screenshot({ path: ".tmp-villa-residence-floor-plan-failure.png" }).catch(() => {});
    console.error("Browser errors:", errors);
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
