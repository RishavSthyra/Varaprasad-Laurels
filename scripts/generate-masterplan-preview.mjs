import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

// Derived previews only. The original masterplan and camera data stay untouched.
await mkdir("public/masterplan-preview", { recursive: true });
for (const width of [960, 1920]) {
  const result = await sharp("public/1.00000.avif").resize({ width, withoutEnlargement: true })
    .avif({ quality: 62, effort: 7, chromaSubsampling: "4:4:4" })
    .toFile(`public/masterplan-preview/${width}.avif`);
  console.log(`${width}px preview: ${result.size} bytes`);
}
const blur = await sharp("public/1.00000.avif").resize({ width: 32 }).jpeg({ quality: 55 }).toBuffer();
await writeFile("data/masterplan-preview.json", JSON.stringify({
  mobile: "/masterplan-preview/960.avif", desktop: "/masterplan-preview/1920.avif",
  blurDataURL: `data:image/jpeg;base64,${blur.toString("base64")}`,
}, null, 2) + "\n");
