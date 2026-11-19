import { z } from "zod";
import source from "@/data/clubhouse-floor-transitions.json";
import type { InteriorEntryViews, InteriorFloorMarkers } from "./interior-tour/floor-navigation";

const angle = z.number().finite();
const view = z.object({ yaw: angle, pitch: angle.min(-85).max(85), zoom: z.number().min(0).max(100) });
const marker = z.object({
  id: z.string().min(1), direction: z.enum(["up", "down"]), label: z.string().min(1),
  targetNodeId: z.string().min(1), yaw: angle, pitch: angle.min(-85).max(85), wallYaw: angle,
  presentation: z.enum(["wall", "floating"]).optional(),
});
export const CLUBHOUSE_FLOOR_CALIBRATION = z.object({
  entryViews: z.record(z.string(), view), panos: z.record(z.string(), z.array(marker)),
}).parse(source);
const radians = (degrees: number) => degrees * Math.PI / 180;
export const CLUBHOUSE_ENTRY_VIEWS: InteriorEntryViews = Object.fromEntries(
  Object.entries(CLUBHOUSE_FLOOR_CALIBRATION.entryViews).map(([id, entry]) => [id,
    { yaw: radians(entry.yaw), pitch: radians(entry.pitch), zoom: entry.zoom }]),
);
export const CLUBHOUSE_FLOOR_MARKERS: InteriorFloorMarkers = Object.fromEntries(
  Object.entries(CLUBHOUSE_FLOOR_CALIBRATION.panos).map(([id, markers]) => [id,
    markers.map((item) => ({ ...item, yaw: radians(item.yaw), pitch: radians(item.pitch) }))]),
);
