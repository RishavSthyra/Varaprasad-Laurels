import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("compact villa filters have their own visible controls and reuse the real villa filter dock", () => {
  const layout = readFileSync("components/MasterPlanLayout.tsx", "utf8");
  assert(layout.includes("isVillaInventory && !shouldShowTopViewFullscreen && !isFlatPanelOpen"));
  assert(layout.includes("viewportStyles.mobileControls"));
  assert(layout.includes("responsiveLayout={isVillaInventory}"));
  assert(layout.includes("data-masterplan-mobile-controls"));
  assert(!layout.includes('aria-label="Open villa filters"'));
  assert(layout.includes('data-scroll-area="mobile-sheet"'));
  assert(layout.includes("mobile compact villaMode"));
  assert(layout.includes("onVillaPlotAreaChange={setVillaPlotAreaFilter}"));
  assert(layout.includes("onVillaPositionChange={setVillaPositionFilter}"));
  assert(layout.includes('data-residence-results-direction={mobile ? "bottom" : "side"}'));
  assert(layout.includes('y: reduceMotion || !mobile ? 0 : "100%"'));
  assert(layout.includes('Open residences · {sortedApartments.length}'));
  assert(layout.includes('!selectedApartment ? "h-[36svh]" : "h-full"'));
  assert(layout.includes('isVillaInventory ? "(max-width: 1023px)" : "(max-width: 1279px)"'));
  assert(layout.includes('touchViewportMedia.matches && coarsePointerMedia.matches'));
  assert(layout.includes("if (event.key === \"Escape\")"));
});

test("preview, video, cache still and GLB share desktop-cover or compact-contain source-aspect bounds", () => {
  const stage = readFileSync("components/VillasMasterPlanStage.tsx", "utf8");
  const video = readFileSync("components/VillaMasterPlanVideo.tsx", "utf8");
  assert(stage.includes("const SOURCE_FRAME_ASPECT = 16 / 9"));
  assert(stage.includes('containerType: "size"'));
  assert(stage.includes("data-masterplan-render-frame"));
  assert(stage.includes('${containMedia ? "min" : "max"}(100cqw, calc(100cqh * ${SOURCE_FRAME_ASPECT}))'));
  assert(stage.includes('data-masterplan-media-fit={containMedia ? "contain" : "cover"}'));
  assert(stage.includes('containMedia = false'));
  assert(stage.includes("aspectRatio: SOURCE_FRAME_ASPECT"));
  const preview = readFileSync("components/MasterPlanPreview.tsx", "utf8");
  assert(stage.includes("<MasterPlanPreview />"));
  assert(preview.includes('className="select-none object-contain"'));
  assert(!stage.includes("object-cover"));
  assert(!video.includes("object-cover"));
  assert(video.includes("video.className = \"h-full w-full select-none object-contain"));
  assert(video.includes("canvas.className = \"pointer-events-none absolute inset-0 h-full w-full object-contain"));
  assert(stage.indexOf("data-masterplan-render-frame") < stage.indexOf("<VillaMasterPlanVideo"));
  assert(stage.indexOf("data-masterplan-render-frame") < stage.indexOf("<Canvas"));
});

test("server HTML selects the compact geometry before hydration and heavy 3D code is split from the preview", () => {
  const css = readFileSync("components/MasterPlanViewport.module.css", "utf8");
  const layout = readFileSync("components/MasterPlanLayout.tsx", "utf8");
  const preview = readFileSync("components/MasterPlanPreview.tsx", "utf8");
  assert(css.includes("(pointer: coarse)"));
  assert(css.includes("height: 36svh"));
  assert(css.includes("width: min(100cqw"));
  assert(css.includes(".desktopControls { display: none; }"));
  assert(layout.includes('dynamic(() => import("./VillasMasterPlanStage")'));
  assert(layout.includes("loading: MasterPlanStagePlaceholder"));
  assert(preview.includes('placeholder="blur"'));
  assert(preview.includes('fetchPriority="high"'));
});
