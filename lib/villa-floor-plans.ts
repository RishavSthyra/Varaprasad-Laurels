import plans from "@/data/villa-floor-plans.json";
import type { NumberedFloorPlan } from "@/lib/interior-tour/floor-plans";

/** Shared Villa 1 plans with explicit user-supplied POI camera assignments. */
export const VILLA_FLOOR_PLANS: Readonly<Record<string, NumberedFloorPlan>> = Object.fromEntries(
  plans.map(plan => [plan.id, { ...plan, markerStyle: plan.markerStyle === "dot" ? "dot" : "number" }]),
);
