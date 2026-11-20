import { generateNumberedFloorPlans } from "./lib/generate-numbered-floor-plans.mjs";

await generateNumberedFloorPlans({
  dataFile: "data/clubhouse-floor-plans.json",
  sourceDirectory: "public/Club House Render",
  outputDirectory: "public/clubhouse-floor-plans",
});
