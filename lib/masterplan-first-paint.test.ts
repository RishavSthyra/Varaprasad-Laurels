import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";
import sharp from "sharp";
import preview from "@/data/masterplan-preview.json";

test("first-paint derivatives retain the full source aspect and are smaller than the original", async () => {
  const original = statSync("public/1.00000.avif").size;
  for (const [url, width] of [[preview.mobile, 960], [preview.desktop, 1920]] as const) {
    const info = await sharp(`public${url}`).metadata();
    assert.equal(info.width, width);
    assert(Math.abs(info.width! / info.height! - 16 / 9) < 0.005);
    assert(statSync(`public${url}`).size < original * 0.6);
  }
  assert(preview.blurDataURL.startsWith("data:image/jpeg;base64,"));
  assert(preview.blurDataURL.length < 3000, "Inline first-paint image stays tiny");
});

test("phone panos are less sensitive, with less drift, without changing desktop motion", () => {
  const viewer = readFileSync("components/tour/InteriorPanoWalkthrough.tsx", "utf8");
  assert(viewer.includes("isMobileTouchViewport ? 1.25 : 2"));
  assert(viewer.includes("isMobileTouchViewport ? 0.65 : 0.92"));
});

test("shared navigation starts from matching server/client markup instead of window-based state initializers", () => {
  const nav = readFileSync("components/UpperLayoutCTA.tsx", "utf8");
  assert(nav.includes("[shouldDockAtBottom, setShouldDockAtBottom] = useState(false)"));
  assert(!nav.includes("useState(() => shouldHideMasterPlanCompactDesktopRail"));
  assert(nav.includes("compactViewportMedia.addEventListener"));
});
