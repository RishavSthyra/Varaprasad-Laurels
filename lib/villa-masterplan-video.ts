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

/** Follow the hand: dragging right advances the video, left rewinds it. */
export function getVillaOrbitDragDelta(deltaX: number, width: number, totalFrames = VILLA_MASTERPLAN_VIDEO_FRAMES) {
  return deltaX / Math.max(1, width) * totalFrames;
}

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

export function getVillaOrbitStopFrames(cameraFrames: readonly number[], pauseFrames: readonly number[] = [], totalFrames = VILLA_MASTERPLAN_VIDEO_FRAMES) {
  return [...new Set([...cameraFrames, ...pauseFrames].filter(Number.isFinite).map(frame => wrapVillaOrbitFrame(frame, totalFrames)))].sort((a, b) => a - b);
}

export function getVillaOrbitMidpointFrames(cameraFrames: readonly number[], totalFrames = VILLA_MASTERPLAN_VIDEO_FRAMES) {
  const cameras = getVillaOrbitStopFrames(cameraFrames, [], totalFrames);
  if (cameras.length < 2) return [];
  return cameras.map((frame, index) => wrapVillaOrbitFrame(
    frame + getVillaOrbitTravel(frame, cameras[(index + 1) % cameras.length], totalFrames, 1) / 2,
    totalFrames,
  ));
}

/** Snap ahead in the gesture's direction, never back to its starting stop just
 * because the drag did not cross a halfway threshold (or rounded to one frame). */
export function getVillaOrbitReleaseStop(startFrame: number, deltaFrames: number, stops: readonly number[], totalFrames = VILLA_MASTERPLAN_VIDEO_FRAMES) {
  const normalizedStops = getVillaOrbitStopFrames(stops, [], totalFrames);
  if (!normalizedStops.length) return wrapVillaOrbitFrame(startFrame, totalFrames);
  if (!Number.isFinite(deltaFrames) || Math.abs(deltaFrames) <= Number.EPSILON) return nearestVillaOrbitStop(startFrame, normalizedStops, totalFrames);
  const direction = deltaFrames > 0 ? 1 : -1;
  // Preserve sub-frame movement: rounding a tiny drag first loses its intent.
  const release = ((startFrame - 1 + deltaFrames) % totalFrames + totalFrames) % totalFrames + 1;
  const exactStop = normalizedStops.find(stop => Math.abs(getVillaOrbitTravel(release, stop, totalFrames)) <= 0.5);
  if (exactStop !== undefined && (exactStop !== wrapVillaOrbitFrame(startFrame, totalFrames) || Math.abs(deltaFrames) >= totalFrames - 0.5)) return exactStop;
  return normalizedStops.reduce((best, stop) =>
    Math.abs(getVillaOrbitTravel(release, stop, totalFrames, direction)) < Math.abs(getVillaOrbitTravel(release, best, totalFrames, direction)) ? stop : best,
  normalizedStops[0]);
}
