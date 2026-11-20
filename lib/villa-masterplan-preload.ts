"use client";

import { VILLA_MASTERPLAN_MODEL_URL } from "./villa-masterplan-model";
import { VILLA_MASTERPLAN_VIDEO_URL } from "./villa-masterplan-video";
import { getOpeningBufferProgress, MASTERPLAN_OPENING_SECONDS, shouldWarmMasterplan } from "./masterplan-warmup-policy";
import { getMasterplanVideoCache } from "./masterplan-video-cache";
import preview from "@/data/masterplan-preview.json";

// Retain the player and encoded ranges across routes, without two decoders.
const videos = new Map<string, HTMLVideoElement>();
let modelWarmed = false;
let openingWarmup: (() => void) | undefined;
const previewWarmups = new Map<string, HTMLImageElement>();

export function canWarmVillaMasterPlan() {
  if (typeof window === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return shouldWarmMasterplan(connection, document.hidden);
}

export function getVillaMasterPlanVideo(src = VILLA_MASTERPLAN_VIDEO_URL) {
  let video = videos.get(src);
  if (!video) {
    video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.disablePictureInPicture = true;
    video.setAttribute("aria-label", "Laurels masterplan orbit");
    video.setAttribute("data-masterplan-video", "");
    videos.set(src, video);
    if (src === VILLA_MASTERPLAN_VIDEO_URL) {
      const player = video;
      const cache = getMasterplanVideoCache();
      const update = () => {
        const status = cache.getStatus();
        player.dataset.fullVideoCache = status.objectURL ? "ready" : "loading";
        player.dataset.cachedBytes = String(status.bytes);
        // An unmounted player can adopt the full file immediately. The stage
        // waits for a settled camera before changing an already mounted source.
        if (!player.isConnected && status.objectURL && player.src !== status.objectURL) {
          player.src = status.objectURL;
          player.preload = "auto";
        }
      };
      cache.subscribe(update);
      update();
      // Check disk before assigning the CDN URL: a return visit should not
      // issue a speculative media request for a file already stored locally.
      void cache.warm(() => false).finally(() => {
        if (!player.getAttribute("src")) player.src = cache.getStatus().objectURL ?? src;
      });
    } else video.src = src;
  }
  return video;
}

export function warmVillaMasterPlanAssets(urgent = false) {
  if (typeof window === "undefined") return;
  if (!urgent && !canWarmVillaMasterPlan()) return;
  // Runs behind the same hero-readiness / Save-Data gates as existing warmup.
  // A home -> masterplan visit can reuse a decoded preview, not only GLB/video.
  const compact = window.matchMedia("(max-width: 1023px), (max-width: 1366px) and (pointer: coarse)").matches;
  const previewUrl = compact ? preview.mobile : preview.desktop;
  if (!previewWarmups.has(previewUrl)) {
    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = urgent ? "high" : "low";
    image.src = previewUrl;
    previewWarmups.set(previewUrl, image);
    void image.decode().catch(() => { previewWarmups.delete(previewUrl); });
  }
  const video = getVillaMasterPlanVideo();
  if (urgent) {
    openingWarmup?.();
    openingWarmup = undefined;
    video.preload = "auto";
    if (video.networkState === 0 || video.error) video.load();
  } else if (!openingWarmup && !video.isConnected && getOpeningBufferProgress(video) < 1) {
    openingWarmup = warmVideoThrough(video, MASTERPLAN_OPENING_SECONDS);
  }
  if (!modelWarmed) {
    modelWarmed = true;
    // Same loader/cache/key as the stage; runs only after hero readiness/intent.
    void import("@react-three/drei/core/Gltf").then(({ useGLTF }) => {
      useGLTF.preload(VILLA_MASTERPLAN_MODEL_URL);
    }).catch(() => { modelWarmed = false; });
  }
}

/** Reuse the actual player element, never a second fetch/blob or video decoder.
 * preload is a browser hint, not an exact byte quota; a browser may buffer ahead. */
function warmVideoThrough(video: HTMLVideoElement, seconds: number) {
  let frame = 0;
  const cleanup = () => {
    cancelAnimationFrame(frame);
    for (const event of ["progress", "loadeddata", "canplay", "error"]) video.removeEventListener(event, check);
    document.removeEventListener("visibilitychange", check);
  };
  const check = () => {
    if (video.isConnected) { cleanup(); return; } // The stage now owns playback.
    if (!canWarmVillaMasterPlan() || video.error || getOpeningBufferProgress(video, seconds) >= 1) {
      video.preload = "metadata";
      cleanup();
    }
  };
  for (const event of ["progress", "loadeddata", "canplay", "error"]) video.addEventListener(event, check);
  document.addEventListener("visibilitychange", check);
  video.preload = "auto";
  if (video.networkState === 0) video.load();
  frame = requestAnimationFrame(check);
  return cleanup;
}

export function observeVillaMasterPlanOpening(onProgress: (progress: number, settled: boolean) => void) {
  const video = getVillaMasterPlanVideo();
  const check = () => {
    const progress = getOpeningBufferProgress(video);
    onProgress(progress, progress >= 1 || Boolean(video.error));
  };
  for (const event of ["loadedmetadata", "loadeddata", "progress", "canplay", "error"]) video.addEventListener(event, check);
  const frame = requestAnimationFrame(check);
  return () => {
    cancelAnimationFrame(frame);
    for (const event of ["loadedmetadata", "loadeddata", "progress", "canplay", "error"]) video.removeEventListener(event, check);
  };
}

let completeDownloadStarted = false;
let resumeCompleteDownload: (() => void) | undefined;
/** Complete encoded-file cache, not another best-effort media preload hint.
 * Continue across client navigation; pause between 4 MiB chunks in hidden tabs.
 * Explicit masterplan entry overrides Save-Data, background speculation does not. */
export function warmCompleteVillaMasterPlanVideo() {
  if (completeDownloadStarted) { resumeCompleteDownload?.(); return; }
  completeDownloadStarted = true;
  const cache = getMasterplanVideoCache();
  let timer = 0;
  let failures = 0;
  let running = false;
  const allowed = () => !document.hidden && (canWarmVillaMasterPlan() || Boolean(videos.get(VILLA_MASTERPLAN_VIDEO_URL)?.isConnected));
  const run = async () => {
    if (running) return;
    window.clearTimeout(timer);
    if (!allowed()) return;
    running = true;
    await cache.warm(allowed);
    running = false;
    if (cache.getStatus().objectURL) { cleanup(); return; }
    if (cache.getStatus().error) failures++;
    if (allowed() && failures < 3) timer = window.setTimeout(run, 5_000);
    else if (failures >= 3) cleanup();
  };
  const resume = () => { if (allowed()) { failures = 0; void run(); } };
  const cleanup = () => {
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", resume);
    completeDownloadStarted = false;
    resumeCompleteDownload = undefined;
  };
  resumeCompleteDownload = () => { void run(); };
  document.addEventListener("visibilitychange", resume);
  void run();
}

/** The short homepage loader only warms the opening. Fetch the remainder after
 * reveal, without extending that loader's deadline or blocking navigation. */
export function scheduleVillaMasterPlanBuffering() {
  const timer = window.setTimeout(warmCompleteVillaMasterPlanVideo, 1_500);
  return () => {
    window.clearTimeout(timer);
  };
}
