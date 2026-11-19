import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";

test("masterplan replaces top utility CTA with one compact top arrow pair", async () => {
  const layout = await fs.readFile("components/MasterPlanLayout.tsx", "utf8");
  const chrome = await fs.readFile("components/RouteChrome.tsx", "utf8");
  const mobileNav = await fs.readFile("components/MobileSiteNav.tsx", "utf8");
  assert.equal((layout.match(/<MasterPlanHotspotControls\s/g) ?? []).length, 1);
  assert(layout.includes("top-[max(1rem,env(safe-area-inset-top))]"));
  assert(layout.includes("compact={shouldUseCompactLayout}"));
  assert(layout.includes('"h-8 w-8"'));
  assert(layout.includes('aria-label="Previous master plan hotspot"'));
  assert(layout.includes('aria-label="Next master plan hotspot"'));
  assert.match(chrome, /showCta=\{[\s\S]*?!isMasterPlanRoute/);
  assert(mobileNav.includes("{!isMasterPlanRoute ? <div"), "Mobile menu also omits masterplan call/brochure/quote actions");
});
