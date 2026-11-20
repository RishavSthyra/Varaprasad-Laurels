/* eslint-disable @typescript-eslint/no-require-imports -- Browser regression runner. */
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.STARTUP_TEST_URL || "http://localhost:3000";
const wrap = value => ((value + 540) % 360) - 180;

(async () => {
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const root = page.locator("[data-exterior-node]");
  const ready = () => page.locator("[data-exterior-ready=true][data-exterior-transitioning=false]").waitFor({ timeout: 90000 });
  const nodeIs = async id => { await page.waitForFunction(id => document.querySelector("[data-exterior-node]")?.getAttribute("data-exterior-node") === id, id, { timeout: 90000 }); await ready(); };
  const enter = async suffix => {
    await page.goto(base + "/exterior-walkthrough" + suffix, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.addStyleTag({ content: "nextjs-portal{pointer-events:none!important}" });
    await ready();
    await page.locator("[data-exterior-walkthrough-preloader]").waitFor({ state: "detached", timeout: 20000 });
  };
  const forward = page.getByRole("button", { name: "Move forward", exact: true });
  const choose = async id => { await page.getByLabel("Debug: choose pano", { exact: true }).selectOption(id); await nodeIs(id); };
  // Use the supported horizontal-trackpad input and user-facing diagnostics,
  // not private React state or test-only camera setters.
  const face = async degrees => {
    const live = page.locator("[data-debug-pano-view]");
    await live.waitFor();
    const yaw = async () => Number(await live.getAttribute("data-yaw"));
    await page.waitForTimeout(300); // a new node's first camera poll
    await page.mouse.move(page.viewportSize().width * .55, 200);
    for (let i = 0; i < 6; i++) {
      const error = wrap(degrees - await yaw());
      if (Math.abs(error) < 1.5) return;
      // Same radians/pixel as TRACKPAD_PANO_YAW_RADIANS_PER_PIXEL.
      await page.mouse.wheel(error * Math.PI / 180 / .0032, 0);
      await page.waitForTimeout(450);
    }
    assert(Math.abs(wrap(degrees - await yaw())) < 2, "Must face the specified road angle");
  };
  try {
    await enter("");
    assert.equal(await root.getAttribute("data-exterior-node"), "Exterior_PANO_Spline_F0000");
    await page.waitForFunction(() => !document.querySelector('button[aria-label="Move forward"]').disabled);
    await forward.click(); await nodeIs("Exterior_PANO_Spline_F0249");
    console.log("PASS starting gate: Forward works along its local entrance-road continuation");
    // Direct selection/next are intentionally not constrained by arrow cones.
    await page.locator("[data-pano-debug] summary").click();
    await choose("Exterior_PANO_Spline_F0014");
    await face(-5.5);
    await page.waitForFunction(() => !document.querySelector('button[aria-label="Move forward"]').disabled);
    assert.equal(await page.getByRole("button", { name: "Move left", exact: true }).isEnabled(), true);
    assert.equal(await page.getByRole("button", { name: "Move right", exact: true }).isEnabled(), true);
    assert.equal(await root.getAttribute("data-exterior-node"), "Exterior_PANO_Spline_F0014");
    await page.screenshot({ path: ".tmp-exterior-road-15.png" });
    await forward.click(); await nodeIs("Exterior_PANO_Spline_F0060");
    console.log("PASS reported pano 15 view: Forward goes directly to confirmed player pano 61; both local turns remain available");
    await choose("Exterior_PANO_Spline_F0014");
    await face(-55);
    await page.waitForFunction(() => !document.querySelector('button[aria-label="Move forward"]').disabled);
    await forward.click(); await nodeIs("Exterior_PANO_Spline_F0015");
    console.log("PASS rotating towards the branch re-enables Forward and moves to its nearest pano");
    await enter("?pano=270");
    await forward.click(); await nodeIs("Exterior_PANO_Spline_06_F0001");
    await page.getByRole("button", { name: "Move back", exact: true }).click(); await nodeIs("Exterior_PANO_Spline_06_F0000");
    console.log("PASS remaining Camera 06: real Forward/Back movement still works");
    await page.setViewportSize({ width: 390, height: 844 });
    await enter("");
    await forward.click(); await nodeIs("Exterior_PANO_Spline_F0249");
    console.log("PASS phone viewport: starting gate Forward works");
    await page.locator("[data-pano-debug] summary").click();
    await choose("Exterior_PANO_Spline_F0014");
    await face(-5.5);
    await page.waitForFunction(() => !document.querySelector('button[aria-label="Move forward"]').disabled);
    await forward.click(); await nodeIs("Exterior_PANO_Spline_F0060");
    console.log("PASS phone viewport: pano 15 Forward goes directly to player pano 61");
    assert.deepEqual(errors, []);
    assert.equal(await page.getByText("Panorama unavailable", { exact: true }).count(), 0);
  } catch (error) {
    console.error({ errors, node: await root.getAttribute("data-exterior-node").catch(() => null) });
    await page.screenshot({ path: ".tmp-exterior-road-failure.png" }).catch(() => {});
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
