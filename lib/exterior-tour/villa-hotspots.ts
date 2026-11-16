import { z } from "zod";
import config from "../../data/exterior-villa-hotspots.json";

const degrees = z.number().finite();
export const villaPointerSchema = z.object({
  id: z.string().min(1),
  villaNumber: z.number().int().positive(),
  facing: z.enum(["East", "West"]),
  position: z.object({
    yawDegrees: degrees,
    pitchDegrees: degrees.min(-89).max(0),
    distanceMetres: z.number().positive().max(15),
  }),
  rotation: z.object({ yawDegrees: degrees, pitchDegrees: degrees, rollDegrees: degrees }),
  heightMetres: z.number().positive().max(3),
  bounceHeightMetres: z.number().min(0).max(1),
  bouncePeriodSeconds: z.number().positive(),
  rotationPeriodSeconds: z.number().positive(),
  color: z.string().regex(/^#[\da-f]{6}$/i),
  interior: z.object({
    // Only existing internal tour routes are accepted; never execute a JSON URL.
    path: z.literal("/interior-kitchen-foyer"),
    nodeId: z.string().regex(/^[a-zA-Z0-9_-]+$/).nullable(),
  }),
});
export const villaHotspotsSchema = z.object({
  numbering: z.literal("player-counter"),
  panos: z.array(z.object({
    panoNumber: z.number().int().min(1).max(251),
    pointers: z.array(villaPointerSchema),
  })).superRefine((panos, ctx) => {
    const numbers = new Set<number>();
    const ids = new Set<string>();
    for (const pano of panos) {
      if (numbers.has(pano.panoNumber)) ctx.addIssue({ code: "custom", message: "Use one pano entry with multiple pointers, not duplicate pano numbers." });
      numbers.add(pano.panoNumber);
      for (const pointer of pano.pointers) {
        if (ids.has(pointer.id)) ctx.addIssue({ code: "custom", message: `Duplicate pointer id: ${pointer.id}` });
        ids.add(pointer.id);
      }
    }
  }),
});
export type VillaPointer = z.infer<typeof villaPointerSchema>;
const parsedConfig = villaHotspotsSchema.safeParse(config);
if (!parsedConfig.success) console.error("Invalid exterior-villa-hotspots.json:", parsedConfig.error.issues);
const panos = parsedConfig.success ? parsedConfig.data.panos : [];
const EMPTY_POINTERS: readonly VillaPointer[] = [];

/** The player is one-based: 193/251 is raw frame F0192 / EP.00192. */
export function getExteriorPanoNumber(nodeId: string): number | null {
  const match = /^Exterior_PANO_Spline_F(\d+)$/.exec(nodeId);
  return match ? Number(match[1]) + 1 : null;
}

export function getVillaPointers(nodeId: string): readonly VillaPointer[] {
  return panos.find((pano) => pano.panoNumber === getExteriorPanoNumber(nodeId))?.pointers ?? EMPTY_POINTERS;
}

export function getVillaInteriorHref(pointer: VillaPointer): string {
  const params = new URLSearchParams({ villa: String(pointer.villaNumber), facing: pointer.facing });
  if (pointer.interior.nodeId) params.set("node", pointer.interior.nodeId);
  return `${pointer.interior.path}?${params}`;
}
