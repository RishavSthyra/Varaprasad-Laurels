import { generateNumberedFloorPlans } from "./lib/generate-numbered-floor-plans.mjs";

await generateNumberedFloorPlans({
  dataFile: "data/villa-floor-plans.json",
  sourceDirectory: "public/Villa 1 Renders",
  outputDirectory: "public/villa-floor-plans/villa-1",
});
