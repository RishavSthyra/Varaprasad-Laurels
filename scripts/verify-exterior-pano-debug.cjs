/* eslint-disable @typescript-eslint/no-require-imports -- Local browser verification. */
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const originals = require("../data/Varaprasad_Exterior_Pano_Data_v1.json");
const remaining = Object.values(require("../data/exterior-remaining-v2-cameras.json")).flat();
const base = process.env.STARTUP_TEST_URL || "http://localhost:3000";

(async () => {
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, permissions: ["clipboard-read", "clipboard-write"], reducedMotion: "reduce" });
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.goto(base + "/exterior-walkthrough?pano=252", { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.addStyleTag({ content: "nextjs-portal { pointer-events:none!important }" });
    const ready = () => page.waitForSelector("[data-exterior-ready=true][data-exterior-transitioning=false]", { timeout: 90000 });
    await ready();
    await page.locator("[data-exterior-walkthrough-preloader]").waitFor({ state: "detached", timeout: 20000 });
    const panel = page.locator("[data-pano-debug]");
    assert.equal(await panel.count(), 1);
    assert.equal(await panel.getAttribute("open"), null);
    await panel.locator("summary").click();
    await page.locator("[data-debug-pano-view]").waitFor();
    const selector = page.getByLabel("Debug: choose pano", { exact: true });
    assert.equal(await selector.locator("option").count(), 285);
    for (const id of [remaining.find(n => n.id.includes("_02_")).id, originals[5].id]) {
      await selector.selectOption(id);
      await page.waitForFunction(id => document.querySelector("[data-exterior-node]")?.getAttribute("data-exterior-node") === id, id, { timeout: 90000 });
      await ready();
      await page.getByRole("button", { name: "Copy pano details", exact: true }).click();
      const text = await page.evaluate(() => navigator.clipboard.readText());
      const source = [...originals, ...remaining].find(n => n.id === id);
      assert(text.includes("Node: " + id));
      assert(text.includes("Pano: " + source.image_filename));
      assert(text.includes("Folder: " + await page.locator("[data-exterior-node]").getAttribute("data-exterior-pano")));
      assert(text.includes("Exported position (cm): " + JSON.stringify({ x: source.x, y: source.y, z: source.z })));
      const view = JSON.parse(text.split("Arrival view (degrees): ")[1]);
      assert([view.yaw, view.pitch, view.zoom].every(Number.isFinite));
    }
    console.log("PASS exterior: 285 pano choices, correct original/v2 filenames, folders, coordinates and fresh copied view");
    await page.setViewportSize({ width: 390, height: 844 });
    const box = await panel.boundingBox();
    assert(box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 844);
    await panel.locator("summary").click();
    assert.equal(await panel.getAttribute("open"), null);
    console.log("PASS mobile: collapsible debug panel stays inside the viewport");
    for (const route of ["villa-walkthrough?villa=1", "clubhouse-walkthrough"]) {
      await page.goto(base + "/" + route, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForSelector('[data-pano-node][data-pano-transitioning="false"]', { timeout: 90000 });
      assert.equal(await page.locator("[data-pano-debug]").count(), 0);
      assert.equal(await page.getByLabel("Debug: choose pano", { exact: true }).count(), 0);
      console.log("PASS " + route + ": no pano-info debug panel");
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
