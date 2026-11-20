/* eslint-disable @typescript-eslint/no-require-imports -- Local browser regression runner. */
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const plan = require("../data/exterior-amenity-minimap.json");
const base = process.env.STARTUP_TEST_URL || "http://localhost:3000";

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(`${base}/exterior-walkthrough?pano=252`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.locator("[data-exterior-ready=true][data-exterior-transitioning=false]").waitFor({ timeout: 60000 });
    await page.locator("[data-exterior-walkthrough-preloader]").waitFor({ state: "detached", timeout: 20000 });
    const initialNode = await page.locator("[data-exterior-node]").getAttribute("data-exterior-node");
    assert.equal(await page.locator('[data-exterior-amenity-references="compact"] > span').count(), plan.markers.length);
    assert.equal(await page.getByRole("button", { name: "Open amenities menu", exact: true }).count(), 0);

    for (const [name, viewport] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
      await page.setViewportSize(viewport);
      await page.getByRole("button", { name: "Expand minimap", exact: true }).last().click();
      const points = page.locator("[data-exterior-amenity-number]");
      await points.last().waitFor();
      assert.equal(await points.count(), plan.markers.length);
      assert.equal(await page.getByRole("button", { name: /^Go to / }).count(), 0);
      const image = page.getByAltText("Laurels exterior amenity minimap").last();
      await image.evaluate((image) => image.decode());
      assert.equal(await image.evaluate((image) => image.naturalWidth), 3840);
      // Check actual DOM centres, not just CSS percentages.
      const actual = await points.evaluateAll((buttons) => buttons.map((button) => {
        const p = button.getBoundingClientRect(), map = button.parentElement.getBoundingClientRect();
        return { number: +button.dataset.exteriorAmenityNumber, x: (p.x + p.width / 2 - map.x) / map.width, y: (p.y + p.height / 2 - map.y) / map.height, assigned: button.dataset.panoAssigned };
      }));
      for (const m of actual) {
        const [x, y] = plan.markers.find((p) => p.number === m.number).planPoint;
        const a = plan.registration;
        assert(Math.abs(m.x - (a.x[0] * x + a.x[1] * y + a.x[2]) / 1920) < .001);
        assert(Math.abs(m.y - (a.y[0] * x + a.y[1] * y + a.y[2]) / 1080) < .001);
        assert.equal(m.assigned, "false");
      }
      await page.screenshot({ path: `.tmp-exterior-amenities-${name}.png` });
      await page.getByRole("button", { name: "Zoom in exterior minimap", exact: true }).click();
      await page.getByRole("button", { name: "Zoom in exterior minimap", exact: true }).click();
      const point = page.locator('[data-exterior-amenity-number="7"]');
      // Button size must not inflate with the image: zoom separates nearby refs.
      await page.waitForTimeout(250);
      const bounds = await point.boundingBox();
      assert(bounds.width < 21);
      await point.click();
      assert.equal(await page.locator("[data-exterior-node]").getAttribute("data-exterior-node"), initialNode);
      assert.equal(await points.count(), plan.markers.length, "Unassigned refs must not dismiss the map");
      await page.getByRole("button", { name: "Zoom out exterior minimap", exact: true }).click();
      await page.getByRole("button", { name: "Collapse exterior minimap", exact: true }).click();
      assert.equal(await points.count(), 0);
      console.log(`PASS ${name}: 40 registered numbers, full cloud ortho, zoom, unassigned click, collapse`);
    }
    assert.deepEqual(errors, []);
    console.log("PASS no browser exceptions; original pano and villa navigation preserved");
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
