import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { FLOOR_PLAN_CUTOUT_SOURCES } from "./lib/floor-plan-cutout-sources.mjs";

// Convert the user's finished cutouts only; do not mask, crop, rotate or rewrite
// their PNGs. Full-resolution 4:4:4 AVIF preserves fine text; small AVIFs keep
// minimap/sidebar downloads light. No data file or POI geometry is modified here.
sharp.concurrency(2);
for (const source of FLOOR_PLAN_CUTOUT_SOURCES) {
  const plans = JSON.parse(await fs.readFile(`data/${source.group}-floor-plans.json`, "utf8"));
  const plan = plans.find(plan => plan.id === source.id);
  const metadata = await sharp(source.input).metadata();
  if (!plan || metadata.width !== plan.width || metadata.height !== plan.height || !metadata.hasAlpha) {
    throw new Error(`${source.file}: must retain the calibrated canvas and transparency`);
  }
  await sharp(source.input).avif({ quality: 80, effort: 8, chromaSubsampling: "4:4:4" })
    .toFile(path.join("public", source.image));
  await sharp(source.input).resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
    .avif({ quality: 60, effort: 8, chromaSubsampling: "4:4:4" })
    .toFile(path.join("public", source.thumbnail));
  const original = await fs.stat(source.input);
  const full = await fs.stat(path.join("public", source.image));
  const thumbnail = await fs.stat(path.join("public", source.thumbnail));
  console.log(`${source.group}/${source.id}: PNG ${original.size} -> AVIF ${full.size} bytes; preview ${thumbnail.size} bytes; original canvas retained`);
}
