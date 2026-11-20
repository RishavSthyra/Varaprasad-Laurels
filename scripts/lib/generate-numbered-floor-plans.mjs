import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export async function generateNumberedFloorPlans({ dataFile, sourceDirectory, outputDirectory }) {
  const root = process.cwd();
  const plans = JSON.parse(await fs.readFile(path.join(root, dataFile), "utf8"));
  const output = path.join(root, outputDirectory);
  await fs.mkdir(output, { recursive: true });
  sharp.concurrency(2);
  let before = 0, after = 0;
  for (const plan of plans) {
    const input = path.join(root, sourceDirectory, plan.sourceFile);
    const metadata = await sharp(input).metadata();
    if (metadata.width !== plan.width || metadata.height !== plan.height) throw new Error(`${plan.id}: source dimensions changed`);
    const full = await sharp(input).avif({ quality: 65, effort: 8, chromaSubsampling: "4:4:4" })
      .toFile(path.join(output, `${plan.id}.avif`));
    const small = await sharp(input).resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
      .avif({ quality: 55, effort: 8, chromaSubsampling: "4:4:4" }).toFile(path.join(output, `${plan.id}-small.avif`));
    const original = (await fs.stat(input)).size;
    before += original; after += full.size + small.size;
    console.log(`${plan.label}: ${metadata.width}x${metadata.height}, full ${full.size} bytes, thumbnail ${small.size} bytes (source ${original})`);
  }
  console.log(`Total including thumbnails: ${after} bytes; ${(100 * (1 - after / before)).toFixed(1)}% smaller. Originals retained.`);
}
