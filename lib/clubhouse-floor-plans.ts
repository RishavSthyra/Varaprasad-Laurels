import plans from "@/data/clubhouse-floor-plans.json";
import type { NumberedFloorPlan } from "@/lib/interior-tour/floor-plans";

export const CLUBHOUSE_FLOOR_PLANS: Readonly<Record<string, NumberedFloorPlan>> = Object.fromEntries(
  plans.map(plan => [plan.id, {
    ...plan,
    markerStyle: plan.markerStyle === "dot" ? "dot" : "number",
    minimapRotation: plan.minimapRotation === 90 ? 90 : 0,
  }]),
);
