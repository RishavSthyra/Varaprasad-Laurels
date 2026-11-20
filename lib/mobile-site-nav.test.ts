import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("masterplan phone/tablet navigation stays above filters and out of their bottom action bar", () => {
  const nav = readFileSync("components/MobileSiteNav.tsx", "utf8");
  const css = readFileSync("components/MobileSiteNav.module.css", "utf8");
  assert(nav.includes('isMasterPlanRoute ? styles.masterPlan : "xl:hidden"'));
  assert(css.includes("(max-width: 1023px), (max-width: 1366px) and (pointer: coarse)"));
  assert(css.includes(".masterPlan { display: none; }"));
  assert(css.includes("top: max(env(safe-area-inset-top), 0.75rem)"));
  assert(nav.includes('isMasterPlanRoute ? "z-[120]" : "z-[70]"'));
  assert(nav.includes('isMasterPlanRoute ? "z-[150]" : "z-[70]"'));
  assert(nav.includes("styles.masterPlanTrigger"));
});
