import model from "@/data/villa-masterplan-model.json";
import legacy from "@/data/villa-masterplan-legacy-groups.json";

// Use the clubhouse export with its matching root manifest; retain the old GLB.
export const VILLA_MASTERPLAN_MODEL_PATH = model.modelPath;
export const VILLA_MASTERPLAN_MODEL_URL = encodeURI(VILLA_MASTERPLAN_MODEL_PATH);
export const VILLA_MASTERPLAN_MODEL_KEY = `local:${VILLA_MASTERPLAN_MODEL_PATH.slice(1)}`;
export const VILLA_MASTERPLAN_BACKGROUND_URL = "/1.00000.avif";
export const VILLA_MASTERPLAN_BACKGROUND_KEY = `local:${VILLA_MASTERPLAN_BACKGROUND_URL.slice(1)}`;
export const MASTERPLAN_CLUBHOUSE_HREF = "/clubhouse-walkthrough";
export type VillaModelRootGroup = { villaNumber: number; rootRanges: readonly (readonly [number, number])[] };
const MODEL_ROOT_GROUPS: readonly VillaModelRootGroup[] = model.groups.map((group) => ({
  villaNumber: group.villaNumber,
  rootRanges: group.rootRanges.map(([start, end]) => [start, end] as const),
}));
export type MasterPlanModelTarget = {
  id: string; label: string; kind: "villa" | "amenity";
  rootRanges: readonly (readonly [number, number])[];
};

export function getMasterPlanModelTargets(rootCount: number): readonly MasterPlanModelTarget[] {
  const villas: MasterPlanModelTarget[] = getVillaModelRootGroups(rootCount)
    .filter((group) => group.villaNumber !== 21)
    .map((group) => ({ id: `villa-${group.villaNumber}`, label: `Villa ${group.villaNumber}`, kind: "villa", rootRanges: group.rootRanges }));
  if (rootCount !== model.rootCount) return villas;
  return [...villas, ...model.amenities.map((amenity): MasterPlanModelTarget => ({
    id: amenity.id, label: amenity.label, kind: "amenity",
    rootRanges: amenity.rootRanges.map(([start, end]) => [start, end] as const),
  }))];
}

/** Amenities may hover, but must never trigger villa selection or prefetching. */
export function getVillaNumberForModelTarget(id: string): number | null {
  const match = /^villa-([1-9]\d*)$/.exec(id);
  return match && Number(match[1]) <= 78 && Number(match[1]) !== 21 ? Number(match[1]) : null;
}

/** Root ranges are export-specific, not interchangeable when objects change. */
export function getVillaModelRootGroups(rootCount: number): readonly VillaModelRootGroup[] {
  if (rootCount === model.rootCount) return MODEL_ROOT_GROUPS;
  // Keep the prior export supported without deleting or overwriting its asset.
  if (rootCount === 8591) {
    let start = 0;
    const groups: VillaModelRootGroup[] = legacy.rootEnds.map((end, index) => {
      const group: VillaModelRootGroup = { villaNumber: legacy.villaNumbers[index], rootRanges: [[start, end]] };
      start = end + 1;
      return group;
    });
    groups.push({ villaNumber: legacy.villaNumbers.at(-1)!, rootRanges: [[legacy.finalRange[0], legacy.finalRange[1]]] });
    return groups;
  }
  throw new Error(`Unmapped villa model export (${rootCount} roots). Review its villa mapping before enabling clicks.`);
}
