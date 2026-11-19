"use client";

import { VILLA_MASTERPLAN_MODEL_URL } from "./villa-masterplan-model";
import { VILLA_MASTERPLAN_VIDEO_URL } from "./villa-masterplan-video";

// Retain decoded frames/buffered ranges across routes, without two decoders.
const videos = new Map<string, HTMLVideoElement>();
let modelWarmed = false;

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
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (!urgent && (document.hidden || connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? ""))) return;
  const video = getVillaMasterPlanVideo();
  if (urgent) video.preload = "auto";
  if (!modelWarmed) {
    modelWarmed = true;
    // Same loader/cache/key as the stage; runs only after hero readiness/intent.
    void import("@react-three/drei/core/Gltf").then(({ useGLTF }) => {
      useGLTF.preload(VILLA_MASTERPLAN_MODEL_URL);
    }).catch(() => { modelWarmed = false; });
  }
}
