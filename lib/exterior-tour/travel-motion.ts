import { clamp, dotPlanar, normalizePlanar, perpendicularRight, subVec3 } from "./math";
import type { Vec3 } from "./math";

export const PANO_TRAVEL_DEPART_MS = 220;
export const PANO_TRAVEL_ARRIVE_MS = 240;
export const PANO_TRAVEL_EASING = "cubic-bezier(0.42, 0, 0.58, 1)";

// Project travel onto the current view, rather than the panorama's authored
// heading. This keeps lateral movement correct after the user turns around.
export function getPanoTravelPose(from: Vec3, to: Vec3, viewForward: Vec3) {
  const delta = subVec3(to, from);
  if (Math.hypot(delta.x, delta.y) < 1e-6) {
    return { x: 0, y: 0, scale: 1, transform: "none" };
  }
  const travel = normalizePlanar(delta);
  const forward = clamp(dotPlanar(travel, normalizePlanar(viewForward)), -1, 1);
  const right = clamp(dotPlanar(travel, perpendicularRight(viewForward)), -1, 1);
  const x = right === 0 ? 0 : -right * 0.55;
  const y = forward * 0.15;
  // A small movement cue, not a zoom pulse. Large 6.5–11% changes followed by
  // a fast ease-out made the incoming panorama visibly snap back in size.
  const scale = 1.016 + Math.max(0, forward) * 0.009;
  // The scaled border exceeds the translation on each side: no uncovered
  // black canvas edges, even on narrow mobile viewports.
  return { x, y, scale, transform: `translate3d(${x}%, ${y}%, 0) scale(${scale})` };
}
