import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import { isSiteNavItemActive, isSiteNavigationVisible, siteNavItems, siteNavLabels } from "./site-navigation";

test("Project Overview is hidden from navigation without deleting the page", async () => {
  assert(!isSiteNavigationVisible("/project-overview"));
  assert(!siteNavItems.some((item) => item.href === "/project-overview"));
  assert(isSiteNavigationVisible("/master-plan"));
  assert((await fs.stat("app/project-overview/page.tsx")).isFile());
  const topBar = await fs.readFile("components/UpperLayoutCTA.tsx", "utf8");
  const radial = await fs.readFile("components/ui/RadialGlassMenu.tsx", "utf8");
  const hero = await fs.readFile("components/sections/HeroSection.tsx", "utf8");
  assert(topBar.includes("isSiteNavigationVisible(button.link)"));
  assert(radial.includes("isSiteNavigationVisible(item.href)"));
  assert(!hero.includes('router.push("/project-overview")'));
  assert(hero.includes('router.push("/master-plan")'));
});

test("desktop/mobile sidebar labels share the accurate top-bar names", async () => {
  assert.deepEqual(siteNavItems.map((item) => item.label), ["Home", "Map", "Amenities", "Master Plan", "Walkthrough"]);
  for (const item of siteNavItems) assert.equal(item.label, siteNavLabels[item.href]);
  const topBar = await fs.readFile("components/UpperLayoutCTA.tsx", "utf8");
  for (const href of ["/", "/master-plan", "/amenities", "/area-map", "/exterior-walkthrough"]) {
    assert(topBar.includes(`name: siteNavLabels["${href}"]`));
  }
  for (const file of ["components/DesktopSiteRail.tsx", "components/MobileSiteNav.tsx"]) {
    assert((await fs.readFile(file, "utf8")).includes("siteNavItems.map"));
  }
  const walkthrough = siteNavItems.find((item) => item.href === "/exterior-walkthrough")!;
  assert(isSiteNavItemActive("/exterior-tour", walkthrough));
  assert(!isSiteNavItemActive("/area-map", walkthrough));
});
