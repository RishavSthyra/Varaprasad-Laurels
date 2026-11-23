import type { InteriorTourSection } from "./sections";

/** Viewer positions are radians; editable calibration files use degrees. */
export type InteriorEntryView = { yaw: number; pitch: number; zoom?: number };
export type InteriorFloorMarker = {
  id: string;
  direction: "up" | "down";
  label: string;
  targetNodeId: string;
  yaw: number;
  pitch: number;
  wallYaw: number;
  scale?: number;
  presentation?: "wall" | "floating";
};
export type InteriorFloorMarkers = Readonly<Record<string, readonly InteriorFloorMarker[]>>;
export type InteriorEntryViews = Readonly<Record<string, InteriorEntryView>>;

/** Fixed world-space planes for both floating signs and wall-mounted signs.
 * No live camera position is involved: looking around must never reorient them.
 */
export function getFloorMarkerProjection(marker: InteriorFloorMarker) {
  const scale = marker.scale ?? 1;
  const baseSize = marker.presentation === "floating" ? { width: 160, height: 144 } : { width: 216, height: 154 };
  return {
    position: { yaw: marker.yaw, pitch: marker.pitch },
    size: { width: baseSize.width * scale, height: baseSize.height * scale },
    rotation: { yaw: `${marker.wallYaw}deg`, pitch: "0deg", roll: "0deg" },
    hoverScale: false as const,
  };
}

// Same-floor walking must retain its live camera direction, not snap back to an
// entry calibration every time the visitor passes the landing.
export function getFloorArrivalView(
  sourceId: string | undefined,
  targetId: string,
  sections: readonly InteriorTourSection[] | undefined,
  entries: InteriorEntryViews | undefined,
): InteriorEntryView | undefined {
  if (!sections || !entries) return undefined;
  const source = sections.find((section) => section.nodeIds.includes(sourceId ?? ""));
  const target = sections.find((section) => section.nodeIds.includes(targetId));
  return target && source?.id !== target.id ? entries[targetId] : undefined;
}

/** Separate render sets (e.g. a villa-specific balcony entered from the shared
 * interior) cannot inherit the shared render's yaw. Apply their native entry
 * view on every arrival, without changing ordinary same-floor walking. */
export function getInteriorArrivalView(
  sourceId: string | undefined,
  targetId: string,
  sections: readonly InteriorTourSection[] | undefined,
  floorEntries: InteriorEntryViews | undefined,
  panoEntries?: InteriorEntryViews,
): InteriorEntryView | undefined {
  return panoEntries?.[targetId] ?? getFloorArrivalView(sourceId, targetId, sections, floorEntries);
}
