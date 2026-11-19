// Read-only source inspection. Diagnostic sheets go to a fresh temp directory;
// none of the panorama assets are changed or recompressed.
import { readFile, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const nodes = JSON.parse(await readFile("data/Clubhouse_Pano_Data.json", "utf8"));
const output = await mkdtemp(path.join(os.tmpdir(), "clubhouse-stair-review-"));
const groups = ["Ground", "First", "Second", "Third", "Forth"];
for (const floor of groups) {
  const items = nodes.filter((node) => node.id.startsWith(`${floor}_`));
  const columns = 4, width = 560, height = 304;
  const composites = await Promise.all(items.map(async (node, index) => {
    const folder = node.image_filename.replace(/\.[^.]+$/, "");
    const preview = await sharp(path.join("public/varaprasad_clubhouse_panos", folder, "preview.jpg"))
      .resize(width, 280).png().toBuffer();
    const label = Buffer.from(`<svg width="${width}" height="24"><rect width="100%" height="100%" fill="#111"/><text x="8" y="17" fill="white" font-size="14" font-family="Arial">${node.id}</text></svg>`);
    const tile = await sharp({ create: { width, height, channels: 3, background: "#111" } })
      .composite([{ input: label, top: 0, left: 0 }, { input: preview, top: 24, left: 0 }]).png().toBuffer();
    return { input: tile, left: (index % columns) * width, top: Math.floor(index / columns) * height };
  }));
  const target = path.join(output, `${floor}.png`);
  await sharp({ create: { width: columns * width, height: Math.ceil(items.length / columns) * height, channels: 3, background: "#111" } })
    .composite(composites).png().toFile(target);
  console.log(target);
}
