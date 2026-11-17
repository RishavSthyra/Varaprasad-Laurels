import { PanoAssetStore } from "@/lib/exterior-tour/pano";
import { getVillaPano, getVillaPanoBaseUrl } from "./villa-residence";

// Metadata/authorization are shared; never preload all 76 panoramas or tiles.
export const villaPanoAssets = new PanoAssetStore(getVillaPanoBaseUrl());

export function warmVillaPano(villaNumber: number) {
  const pano = getVillaPano(villaNumber);
  if (!pano) return;
  void villaPanoAssets.getPanorama(pano.folder).catch(() => undefined);
  // A normal image warmup reuses the browser cache with PSV's native image
  // loader. Only the preview of the villa under the pointer is fetched.
  void villaPanoAssets.preloadPreview(pano.folder, "preview.jpg", "low").catch(() => undefined);
}
