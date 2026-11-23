import { z } from "zod";
import source from "@/data/villa-floor-transitions.json";
import type { InteriorEntryViews, InteriorFloorMarkers } from "./interior-tour/floor-navigation";

const angle = z.number().finite();
const view = z.object({ yaw: angle, pitch: angle.min(-85).max(85), zoom: z.number().min(0).max(100) });
const marker = z.object({
  id: z.string().min(1), direction: z.enum(["up", "down"]), label: z.string().min(1),
  targetNodeId: z.string().min(1), yaw: angle, pitch: angle.min(-85).max(85), wallYaw: angle,
  scale: z.number().min(0.5).max(2).optional(),
  presentation: z.enum(["wall", "floating"]).optional(),
});

const calibration = z.object({
  entryViews: z.record(z.string(), view),
  panos: z.record(z.string(), z.array(marker)),
}).parse(source);
const radians = (degrees: number) => degrees * Math.PI / 180;

export const VILLA_TRANSITION_ENTRY_VIEWS: InteriorEntryViews = Object.fromEntries(
  Object.entries(calibration.entryViews).map(([id, entry]) => [id, {
    yaw: radians(entry.yaw), pitch: radians(entry.pitch), zoom: entry.zoom,
  }]),
);

export const VILLA_FLOOR_MARKERS: InteriorFloorMarkers = Object.fromEntries(
  Object.entries(calibration.panos).map(([id, markers]) => [id, markers.map((item) => ({
    ...item, yaw: radians(item.yaw), pitch: radians(item.pitch),
  }))]),
);
