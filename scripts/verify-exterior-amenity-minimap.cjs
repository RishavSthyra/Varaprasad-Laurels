/* eslint-disable @typescript-eslint/no-require-imports -- Local browser regression runner. */
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const plan = require("../data/exterior-amenity-minimap.json");
const base = process.env.STARTUP_TEST_URL || "http://localhost:3000";

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const root = page.locator("[data-exterior-node]");
  const expanded = page.locator('[data-exterior-amenity-references="expanded"]');
  const ready = () => page.locator("[data-exterior-ready=true][data-exterior-transitioning=false]").waitFor({ timeout: 90000 });
  const openMap = async () => {
    await page.getByRole("button", { name: "Expand minimap", exact: true }).last().click();
    await expanded.waitFor();
    assert.equal(await expanded.locator("button").count(), plan.markers.length);
    const activeNode = await root.getAttribute("data-exterior-node");
    const reference = plan.markers.find(marker => marker.nodeId === activeNode);
    if (reference) {
      const dot = expanded.locator(`[data-exterior-amenity-number="${reference.number}"]`);
      assert.equal(await dot.getAttribute("aria-pressed"), "true");
      const player = page.locator('[data-exterior-player-marker="expanded"]');
      const [a, b] = await Promise.all([dot.boundingBox(), player.boundingBox()]);
      assert(Math.hypot(a.x + a.width / 2 - b.x - b.width / 2, a.y + a.height / 2 - b.y - b.height / 2) < 1.5,
        `Current-location marker must sit on active reference ${reference.number}`);
      assert.equal(await player.evaluate(el => getComputedStyle(el).backgroundColor), "rgb(47, 127, 181)");
    }
  };
  const choose = async marker => {
    await openMap();
    const button = expanded.locator(`[data-exterior-amenity-number="${marker.number}"]`);
    await button.click();
    await page.waitForFunction(id => document.querySelector("[data-exterior-node]")?.getAttribute("data-exterior-node") === id, marker.nodeId, { timeout: 90000 });
    await ready();
    await expanded.waitFor({ state: "detached" });
    assert.equal(await root.getAttribute("data-exterior-pano"), marker.panoFolder);
    const compactDot = page.locator(`[data-exterior-amenity-references="compact"] [data-exterior-amenity-number="${marker.number}"]`);
    const player = page.locator('[data-exterior-player-marker="compact"]');
    const [a, b] = await Promise.all([compactDot.boundingBox(), player.boundingBox()]);
    assert.equal(await compactDot.getAttribute("aria-pressed"), "true");
    assert(Math.hypot(a.x + a.width / 2 - b.x - b.width / 2, a.y + a.height / 2 - b.y - b.height / 2) < 1.5,
      `Compact map must centre active reference ${marker.number}`);
    await page.waitForFunction(view => {
      const el = document.querySelector("[data-debug-pano-view]");
      const yaw = +el?.getAttribute("data-yaw"), pitch = +el?.getAttribute("data-pitch"), zoom = +el?.getAttribute("data-zoom");
      const error = ((yaw - view.yaw + 540) % 360) - 180;
      return el && Math.abs(error) < 1 && Math.abs(pitch - view.pitch) < 1 && Math.abs(zoom - view.zoom) < 1;
    }, marker.arrivalView);
  };
  try {
    await page.goto(`${base}/exterior-walkthrough?pano=252`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.addStyleTag({ content: "nextjs-portal { pointer-events: none !important; }" });
    await ready();
    await page.locator("[data-exterior-walkthrough-preloader]").waitFor({ state: "detached", timeout: 20000 });
    await page.locator("[data-pano-debug] summary").click();
    assert.equal(await page.getByRole("button", { name: "Open amenities menu", exact: true }).count(), 0);
    await openMap();
    const image = page.getByAltText("Laurels exterior amenity minimap").last();
    await image.evaluate(image => image.decode());
    assert.equal(await image.evaluate(image => image.naturalWidth), 3840);
    const actual = await expanded.locator("button").evaluateAll(buttons => buttons.map(button => {
      const p = button.getBoundingClientRect(), map = button.parentElement.getBoundingClientRect();
      return { number: +button.dataset.exteriorAmenityNumber, x: (p.x + p.width / 2 - map.x) / map.width, y: (p.y + p.height / 2 - map.y) / map.height };
    }));
    for (const point of actual) {
      const [x, y] = plan.markers.find(marker => marker.number === point.number).planPoint, a = plan.registration;
      assert(Math.abs(point.x - (a.x[0] * x + a.x[1] * y + a.x[2]) / 1920) < .001);
      assert(Math.abs(point.y - (a.y[0] * x + a.y[1] * y + a.y[2]) / 1080) < .001);
    }
    const gold = expanded.locator('[data-exterior-amenity-number="7"] > span');
    await page.mouse.move(10, 10);
    assert.equal(await gold.evaluate(el => getComputedStyle(el).backgroundColor), "rgb(252, 225, 144)");
    await gold.hover();
    assert.equal(await gold.evaluate(el => getComputedStyle(el).backgroundColor), "rgb(47, 127, 181)");
    const active = expanded.locator('[data-exterior-amenity-number="11"]');
    assert.equal(await active.getAttribute("aria-pressed"), "true");
    assert.equal(await active.locator("span").evaluate(el => getComputedStyle(el).backgroundColor), "rgb(47, 127, 181)");
    assert.equal(await expanded.innerText(), "", "Points render as dots, not numbers");
    await page.screenshot({ path: ".tmp-exterior-amenities-desktop.png" });
    await page.getByRole("button", { name: "Collapse exterior minimap", exact: true }).click();
    const requestedRefs = process.env.EXTERIOR_POI_REFS?.split(",").map(Number);
    for (const marker of process.env.EXTERIOR_POI_MOBILE_ONLY ? [] : plan.markers.filter(marker => !requestedRefs || requestedRefs.includes(marker.number))) {
      await choose(marker);
      console.log(`PASS desktop ref ${marker.number} -> pano ${marker.panoNumber}: real cloud pano and exact arrival view`);
    }
    // Re-selecting the current pano must apply its view and close the map too.
    await choose(plan.markers.at(-1));
    await page.setViewportSize({ width: 390, height: 844 });
    for (const number of process.env.EXTERIOR_POI_COMPACT_ONLY ? [17] : [25, 8, 9, 17]) {
      await choose(plan.markers.find(marker => marker.number === number));
      console.log(`PASS phone ref ${number}: exact destination/view, no neighbouring-dot interception`);
    }
    await openMap();
    await page.getByRole("button", { name: "Zoom in exterior minimap", exact: true }).click();
    await page.getByRole("button", { name: "Zoom in exterior minimap", exact: true }).click();
    await page.waitForTimeout(250);
    const dot = expanded.locator('[data-exterior-amenity-number="25"] > span');
    assert((await dot.boundingBox()).width < 12);
    await page.screenshot({ path: ".tmp-exterior-amenities-phone.png" });
    await page.getByRole("button", { name: "Collapse exterior minimap", exact: true }).click();
    // The development diagnostics panel intentionally overlays the lower-left
    // of this narrow viewport. Close it before testing normal compact-map use.
    await page.locator("[data-pano-debug] summary").click();
    // A compact dot click must navigate, not expand the map or start a drag.
    const compact = page.locator('[data-exterior-amenity-references="compact"]');
    const marker = plan.markers.find(marker => marker.number === 17);
    const compactPoint = compact.locator('[data-exterior-amenity-number="17"]');
    // The current location is centred by the compact map's existing follow view.
    await compactPoint.click();
    await ready();
    assert.equal(await expanded.count(), 0);
    assert.equal(await root.getAttribute("data-exterior-node"), marker.nodeId);
    assert.deepEqual(errors, []);
    console.log("PASS phone: mapped navigation, fixed-size dots under zoom, compact direct click, no browser exceptions");
  } catch (error) {
    console.error("Browser exceptions:", errors);
    await page.screenshot({ path: ".tmp-exterior-amenities-failure.png" }).catch(() => {});
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
