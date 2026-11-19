"use client";

import { VILLA_MASTERPLAN_MODEL_URL } from "./villa-masterplan-model";
import { VILLA_MASTERPLAN_VIDEO_URL } from "./villa-masterplan-video";
import { getOpeningBufferProgress, MASTERPLAN_BACKGROUND_TARGETS, MASTERPLAN_OPENING_SECONDS, shouldWarmMasterplan } from "./masterplan-warmup-policy";

// Retain decoded frames/buffered ranges across routes, without two decoders.
const videos = new Map<string, HTMLVideoElement>();
let modelWarmed = false;
let openingWarmup: (() => void) | undefined;

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
    video.src = src;
    videos.set(src, video);
  }
  return video;
}

export function warmVillaMasterPlanAssets(urgent = false) {
  if (typeof window === "undefined") return;
  if (!urgent && !canWarmVillaMasterPlan()) return;
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

/** Step up background buffering after the homepage is usable. Keep the shared
 * media element intact when navigating; don't pause or reset the stage's video. */
export function scheduleVillaMasterPlanBuffering() {
  let timer = 0;
  let index = 0;
  let stop: (() => void) | undefined;
  const next = () => {
    if (!canWarmVillaMasterPlan() || index >= MASTERPLAN_BACKGROUND_TARGETS.length) return;
    const video = getVillaMasterPlanVideo();
    if (video.isConnected) return;
    stop?.();
    stop = warmVideoThrough(video, MASTERPLAN_BACKGROUND_TARGETS[index++]);
    timer = window.setTimeout(next, 2_500);
  };
  const resume = () => {
    if (!canWarmVillaMasterPlan()) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(next, 500);
  };
  document.addEventListener("visibilitychange", resume);
  timer = window.setTimeout(next, 1_500);
  return () => {
    document.removeEventListener("visibilitychange", resume);
    window.clearTimeout(timer);
    stop?.();
  };
}
