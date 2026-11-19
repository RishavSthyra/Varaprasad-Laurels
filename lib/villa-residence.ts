import panoConfig from "@/data/villa-panos.json";
import residenceConfig from "@/data/villa-residence-config.json";
import { villaCatalog, type VillaCatalogEntry } from "@/lib/villas";

export type VillaPanoEntry = (typeof panoConfig.panos)[number];
export type VillaFloor = "ground" | "first" | "second" | "terrace";
export const VILLA_FLOORS: { id: VillaFloor; label: string }[] = [
  { id: "ground", label: "Ground" }, { id: "first", label: "First" },
  { id: "second", label: "Second" }, { id: "terrace", label: "Terrace" },
];

export function getVillaRecord(villaNumber: number) {
  return villaCatalog.find((villa) => villa.villaNumber === villaNumber) ?? null;
}

export function getVillaNumberFromId(id: string) {
  const match = /^villa-(\d+)$/.exec(id);
  return match ? Number(match[1]) : null;
}

export function getVillaPano(villaNumber: number): VillaPanoEntry | null {
  if (villaNumber === 21 || residenceConfig.unavailablePanoVillaNumbers.includes(villaNumber)) return null;
  return panoConfig.panos.find((pano) => pano.villaNumber === villaNumber) ?? null;
}

/** Leading slash = local public assets. A future signed R2 base can be used by
 * the same PanoAssetStore without changing folder identities or villa numbers.
 */
export function getVillaPanoBaseUrl() { return panoConfig.assetBaseUrl; }

/** Lift the opening view towards the facade without restricting manual looking. */
export function getVillaPanoInitialPitch(pano: VillaPanoEntry) {
  return (pano.pitchDegrees + panoConfig.initialPitchOffsetDegrees) * Math.PI / 180;
}

export function getVillaPanoAssetUrl(pano: VillaPanoEntry, file: string) {
  return `${panoConfig.assetBaseUrl.replace(/\/+$/, "")}/${encodeURIComponent(pano.folder)}/${file}`;
}

export function getVillaFloorRooms(villa: VillaCatalogEntry, floor: VillaFloor) {
  const rooms = villa.details.rooms as Partial<Record<VillaFloor, { name: string; dimensionsFt: string }[]>>;
  return rooms[floor] ?? [];
}

export function getVillaFloorArea(villa: VillaCatalogEntry, floor: VillaFloor) {
  const areas = villa.details.floorAreasSqFt as Partial<Record<VillaFloor, number>>;
  return areas[floor] ?? null;
}

export function getVillaFloorPlan(villa: VillaCatalogEntry, floor: VillaFloor) {
  const plans = residenceConfig.floorPlans as Record<string, Partial<Record<VillaFloor, string>>>;
  return plans[villa.typeId]?.[floor] ?? null;
}

export function getVillaWalkthroughHref(villa: VillaCatalogEntry) {
  const tours = residenceConfig.interiorTours as Record<string, { path: string; nodeId?: string }>;
  const tour = tours[villa.typeId];
  // Never silently route a new villa to an unrelated legacy apartment tour.
  if (!tour || !/^\/(?!\/)[a-zA-Z0-9/_-]+$/.test(tour.path)) return null;
  const query = new URLSearchParams({ villa: String(villa.villaNumber), facing: villa.details.facing });
  if (tour.nodeId) query.set("node", tour.nodeId);
  return `${tour.path}?${query}`;
}
