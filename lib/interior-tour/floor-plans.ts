import type { InteriorEntryView } from "./floor-navigation";

export type NumberedFloorPlanMarker = {
  number: number;
  label: string;
  /** Percentage of the uncropped plan image, not a world coordinate. */
  left: number;
  top: number;
  /** Explicitly assigned camera ID. Never infer a pano from room numbering. */
  nodeId: string | null;
  panoFilename?: string;
  panoFolder?: string;
  /** Editable POI arrival angles are degrees, never exported world yaw. */
  arrivalView?: { yaw: number; pitch: number; zoom?: number };
};

export type NumberedFloorPlan = {
  id: string;
  label: string;
  image: string;
  /** Presentation is independent of mapping; clubhouse and villa plans use dots. */
  markerStyle?: "dot" | "number";
  /** Thumbnail-only clockwise rotation. Source coordinates and expanded plan stay unchanged. */
  minimapRotation?: 0 | 90;
  thumbnail: string;
  width: number;
  height: number;
  markers: readonly NumberedFloorPlanMarker[];
};

export function getFloorPlanDestination(marker: NumberedFloorPlanMarker, floorNodeIds: readonly string[]) {
  return marker.nodeId && floorNodeIds.includes(marker.nodeId) ? marker.nodeId : null;
}
export function getFloorPlanArrivalView(marker: NumberedFloorPlanMarker): InteriorEntryView | undefined {
  const view = marker.arrivalView;
  return view ? { yaw: view.yaw * Math.PI / 180, pitch: view.pitch * Math.PI / 180, zoom: view.zoom } : undefined;
}
