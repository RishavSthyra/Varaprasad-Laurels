import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { getVillasMasterPlanConfig } from "./villas-master-plan-config";
import { getNearestMasterPlanHotspot } from "./master-plan-hotspots";
import { getVillaMasterPlanVideoTime, getVillaOrbitTravel, wrapVillaOrbitFrame, nearestVillaOrbitStop, VILLA_MASTERPLAN_VIDEO_KEY, VILLA_MASTERPLAN_VIDEO_URL } from "./villa-masterplan-video";

test("villa orbit uses the verified Cloudflare GOP3 encode without depending on a local video", () => {
  const config = getVillasMasterPlanConfig();
  assert.equal(config.scrubVideoKey, VILLA_MASTERPLAN_VIDEO_KEY);
  assert.equal(config.interactionVideoKey, VILLA_MASTERPLAN_VIDEO_KEY);
  assert.equal(config.fps, 30);
  assert.equal(config.totalFrames, 309);
  const videoUrl = new URL(VILLA_MASTERPLAN_VIDEO_URL);
  assert.equal(videoUrl.origin + videoUrl.pathname, "https://cdn.sthyra.com/Varaprasad_Laurels/Videos/masterplan_scrub_gop3_60mb.mp4");
  assert.equal(videoUrl.searchParams.get("v"), "cors-20261119");
  assert(!VILLA_MASTERPLAN_VIDEO_KEY.startsWith("local:"));
  assert.equal(config.fallbackImageKey, "local:1.00000.avif");
});

test("render frame 159 maps exactly to 5.3 seconds, not one frame earlier", () => {
  assert.equal(getVillaMasterPlanVideoTime(1), 0);
  assert.equal(getVillaMasterPlanVideoTime(160), 159 / 30);
  assert.equal(getVillaMasterPlanVideoTime(0), 0);
  assert.equal(getVillaMasterPlanVideoTime(400), 308 / 30);
});

test("both stops resolve against the 309-frame villa timeline, not a legacy 360-frame orbit", () => {
  const frames = [1, 160];
  const keys = ["A1", "A2"] as const;
  assert.equal(getNearestMasterPlanHotspot(1, false, frames, keys, 309), "A1");
  assert.equal(getNearestMasterPlanHotspot(160, false, frames, keys, 309), "A2");
  assert.equal(getNearestMasterPlanHotspot(308, false, frames, keys, 309), "A1");
});

test("poster remains preloaded and calibrated hover is gated on a decoded stop", () => {
  const stage = fs.readFileSync("components/VillasMasterPlanStage.tsx", "utf8");
  const video = fs.readFileSync("components/VillaMasterPlanVideo.tsx", "utf8");
  const page = fs.readFileSync("app/master-plan/page.tsx", "utf8");
  assert(stage.includes("settledFrame === currentFrame"));
  assert(stage.includes('visibility: showHoverLayer ? "visible" : "hidden"'));
  assert(stage.includes("hotspot.frame === frame"));
  assert(video.includes('video.preload = "auto"'));
  assert(video.includes("video.poster = poster"));
  assert(video.includes('["loadeddata", "canplay", "seeked"]'));
  assert(video.includes("video.readyState >= 2"), "Cached video must not wait for a loadeddata event that fired before hydration");
  assert(page.includes("href={preview.mobile}"));
  assert(page.includes("href={preview.desktop}"));
});

test("arrows traverse opposite halves at both stops, including the end/start seam", () => {
  assert.equal(getVillaOrbitTravel(1, 160, 309, 1), 159);
  assert.equal(getVillaOrbitTravel(1, 160, 309, -1), -150);
  assert.equal(getVillaOrbitTravel(160, 1, 309, 1), 150);
  assert.equal(getVillaOrbitTravel(160, 1, 309, -1), -159);
  assert.equal(getVillaOrbitTravel(10, 0, 10.3, 1), 0.3000000000000007);
  assert.equal(getVillaOrbitTravel(0.1, 0, 10.3, -1) < 0, true);
  assert.equal(getVillaOrbitTravel(160, 160, 309, -1), 0);
});

test("drag frames wrap in either direction and release to a calibrated camera only", () => {
  assert.equal(wrapVillaOrbitFrame(-618), 309);
  assert.equal(wrapVillaOrbitFrame(619), 1);
  assert.equal(wrapVillaOrbitFrame(310), 1);
  assert.equal(nearestVillaOrbitStop(308, [1, 160]), 1);
  assert.equal(nearestVillaOrbitStop(130, [1, 160]), 160);
  assert.equal(nearestVillaOrbitStop(35, [1, 160]), 1);
  const stage = fs.readFileSync("components/VillasMasterPlanStage.tsx", "utf8");
  assert(stage.includes("onPointerMoveCapture={moveDrag}"));
  assert(stage.includes("onPointerCancelCapture={finishDrag}"));
  assert(stage.includes("setPointerCapture(event.pointerId)"));
  assert(stage.includes("nearestVillaOrbitStop(drag.next, stopFrames, totalFrames)"));
  assert(stage.includes("motion={orbitMotion}"));
  assert(stage.includes("scrubbing={isDragging}"));
});

test("warmup reuses one media element and the stage GLTF cache after the homepage reveal", () => {
  const preload = fs.readFileSync("lib/villa-masterplan-preload.ts", "utf8");
  const hero = fs.readFileSync("components/sections/HeroSection.tsx", "utf8");
  const video = fs.readFileSync("components/VillaMasterPlanVideo.tsx", "utf8");
  const policy = fs.readFileSync("lib/masterplan-warmup-policy.ts", "utf8");
  const modelWarmup = fs.readFileSync("components/VillaMasterPlanModelWarmup.tsx", "utf8");
  assert(preload.includes("useGLTF.preload(VILLA_MASTERPLAN_MODEL_URL)"));
  assert(preload.includes("videos.get(src)"));
  assert(policy.includes("connection?.saveData"));
  assert(modelWarmup.includes("useGLTF(VILLA_MASTERPLAN_MODEL_URL)"));
  assert(hero.includes("if (!imageReady || !revealContent) return"));
  assert(hero.includes("warmVillaMasterPlanAssets()"));
  assert(video.includes("getVillaMasterPlanVideo(src)"));
  assert(!hero.includes("idleWarmVideoRef"), "No duplicate hidden masterplan decoder");
});

test("desktop filters start closed, arrows preserve their direction, and card AVIF files exist", () => {
  const layout = fs.readFileSync("components/MasterPlanLayout.tsx", "utf8");
  assert(layout.includes("[isMobileSheetOpen, setIsMobileSheetOpen] = useState(false)"));
  assert(layout.includes("[isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(false)"));
  assert(layout.includes("onPrevious={() => goToHotspot(-1)}"));
  assert(layout.includes("onNext={() => goToHotspot(1)}"));
  assert(layout.includes("setOrbitMotion(previous => ({ direction"));
  assert(fs.statSync("public/villa center image2.avif").size > 0);
  assert(fs.statSync("public/villa corner image.avif").size > 0);
});
