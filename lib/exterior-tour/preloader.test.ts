import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("exterior loader matches homepage branding without lifting panels or session dismissal", () => {
  const home = fs.readFileSync("components/ui/LuxuryVillaPreloader.tsx", "utf8");
  const exterior = fs.readFileSync("components/ui/ExteriorWalkthroughPreloader.tsx", "utf8");
  for (const shared of ["/vp_cons_images_Cropped.webp", "bg-[#00142b]", "h-[clamp(9rem,23vh,13.5rem)]", "text-[clamp(5rem,10vw,11rem)]"]) {
    assert(home.includes(shared)); assert(exterior.includes(shared));
  }
  assert(exterior.includes("data-preloader-vectors"));
  assert(exterior.includes("useReducedMotion"));
  assert(exterior.includes("createPortal(overlay, document.body)"), "Global navigation must not cover the loading overlay");
  assert(exterior.includes('exit={{ opacity: 0 }}'));
  for (const forbidden of ["sessionStorage", "PANEL_COUNT", "panelsRef", "yPercent", "stagger", "setInterval"]) assert(!exterior.includes(forbidden));
});

test("route fallback and real pano loading share one preloader and actual progress remains authoritative", () => {
  const route = fs.readFileSync("app/exterior-walkthrough/loading.tsx", "utf8");
  const page = fs.readFileSync("app/exterior-walkthrough/page.tsx", "utf8");
  const tour = fs.readFileSync("components/tour/ExteriorPanoWalkthrough.tsx", "utf8");
  assert(route.includes("<ExteriorWalkthroughPreloader progress={4}"));
  assert(tour.includes("!hasCompletedInitialPano ? ("));
  assert(tour.includes("progress={exteriorPreloaderProgress}"));
  assert(!tour.includes("TulaBrandPreloader"));
  assert(page.includes('href="/vp_cons_images_Cropped.webp"'));
});
