// Bypass responses cached before production CORS was enabled. Warmup and the
// stage share this stable revision, retaining one media element and buffer.
export const VILLA_MASTERPLAN_VIDEO_URL = "https://cdn.sthyra.com/Varaprasad_Laurels/Videos/masterplan_scrub_gop3_60mb.mp4?v=cors-20261119";
export const VILLA_MASTERPLAN_VIDEO_KEY = VILLA_MASTERPLAN_VIDEO_URL;
export const VILLA_MASTERPLAN_VIDEO_FPS = 30;
export const VILLA_MASTERPLAN_VIDEO_FRAMES = 309;

// Exported/rendered frame numbers are zero-based. The existing layout uses
// one-based frames, so Max/render frame 159 is layout frame 160 (5.3 seconds).
export const VILLA_MASTERPLAN_SECOND_STOP_SOURCE_FRAME = 161;

export function getVillaMasterPlanVideoTime(frame: number, fps = VILLA_MASTERPLAN_VIDEO_FPS, totalFrames = VILLA_MASTERPLAN_VIDEO_FRAMES) {
  return Math.max(0, Math.min(totalFrames - 1, Math.round(frame) - 1)) / fps;
}

export type VillaOrbitMotion = { direction: 1 | -1; id: number };

export function wrapVillaOrbitFrame(frame: number, totalFrames = VILLA_MASTERPLAN_VIDEO_FRAMES) {
  return ((Math.round(frame) - 1) % totalFrames + totalFrames) % totalFrames + 1;
}

/** Unwrapped travel is essential: the two arrows traverse opposite halves. */
export function getVillaOrbitTravel(start: number, target: number, period: number, direction?: 1 | -1) {
  const forward = ((target - start) % period + period) % period;
  const backward = forward === 0 ? 0 : forward - period;
  return direction === 1 ? forward : direction === -1 ? backward : forward <= -backward ? forward : backward;
}

export function nearestVillaOrbitStop(frame: number, stops: readonly number[], totalFrames = VILLA_MASTERPLAN_VIDEO_FRAMES) {
  return stops.reduce((best, stop) =>
    Math.abs(getVillaOrbitTravel(frame, stop, totalFrames)) < Math.abs(getVillaOrbitTravel(frame, best, totalFrames)) ? stop : best,
  stops[0] ?? 1);
}
