import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("pano-info panel is development-only and enabled for exterior, not either interior", () => {
  const exterior = readFileSync("components/tour/ExteriorPanoWalkthrough.tsx", "utf8");
  const panel = readFileSync("components/tour/PanoDebugPanel.tsx", "utf8");
  for (const component of ["VillaInteriorPanoWalkthrough", "ClubhousePanoWalkthrough"]) {
    assert(!readFileSync(`components/tour/${component}.tsx`, "utf8").includes("showPanoDebug"));
  }
  assert(exterior.includes('process.env.NODE_ENV === "development" ? <PanoDebugPanel'));
  assert(exterior.includes("folder={activeNode.panoId}"));
  assert(exterior.includes("imageFilename={activeNode.imageFilename}"));
  assert(exterior.includes("position={activeNode.rawPosition}"));
  assert(exterior.includes('browseLabel="Browse exterior panos"'));
  assert(exterior.includes("onNavigate={id => void jumpToNode(id)}"));
  assert(panel.includes("if (!open) return"));
  assert(panel.includes("return () => window.clearInterval(timer)"));
  assert(panel.includes("const current = getView()"), "Copy must read the live camera, not a stale polling snapshot");
  assert(panel.includes("disabled={transitioning}"));
});
