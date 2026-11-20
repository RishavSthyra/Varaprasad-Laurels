import cameras from "@/data/exterior-remaining-v2-cameras.json";
import type { ExteriorPanoNodeSource } from "./types";

// Verified v2 R2 tiles, not the older 45-image export. PanoAssetStore signs
// this key prefix through the same Worker/cache as the original road panos.
export const REMAINING_EXTERIOR_PANO_BASE = "Varaprasad_Laurels/Panos/varaprasad_exterior_panos_remaining_v2";
const LOCAL_FRAME_CAMERAS = new Set(["02", "03", "04", "07", "08"]);

export const remainingExteriorNodes: ExteriorPanoNodeSource[] = Object.entries(cameras)
  .flatMap(([camera, records]) => records
    // Frame 272 has coordinates but no render. Camera 07.00005 has a render
    // but no coordinates: don't fabricate either missing half of the pair.
    .filter(record => record.frame !== 272)
    .map(record => {
      const localFrame = Number(record.id.match(/_F(\d+)$/)![1]);
      const imageFrame = LOCAL_FRAME_CAMERAS.has(camera) ? localFrame : record.frame;
      return {
        ...record,
        pano_id: `Exterior PANO Cam ${camera}.${String(imageFrame).padStart(5, "0")}`,
        asset_base_path: REMAINING_EXTERIOR_PANO_BASE,
        navigation_order: record.frame,
        route_id: `remaining-camera-${camera}`,
      };
    }));
