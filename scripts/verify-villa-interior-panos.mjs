// Read-only local asset audit. Optional review sheets go to a fresh temp folder.
// Never regenerate, resize, overwrite or delete the source panorama assets.
import { readFile, readdir, stat, mkdtemp } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";

const nodes = JSON.parse(await readFile("data/Varaprasad_Interior_Pano_Data_v1.json", "utf8"));
const navigation = JSON.parse(await readFile("data/villa-interior-navigation.json", "utf8"));
const root = path.resolve("public/varaprasad_villa_1_interior");
const dimensions = new Set();
let tiles = 0;
const folders = new Set();
for (const node of nodes) {
  const folder = node.image_filename.replace(/\.[^.]+$/, "");
  if (folders.has(folder)) throw new Error(`Duplicate pano folder: ${folder}`);
  folders.add(folder);
  const meta = JSON.parse(await readFile(path.join(root, folder, "meta.json"), "utf8"));
  dimensions.add(`${meta.width}x${meta.height}:${meta.cols}x${meta.rows}:${meta.tileWidth}x${meta.tileHeight}`);
  if (!(await stat(path.join(root, folder, meta.preview))).size) throw new Error(`Empty preview: ${folder}`);
  const image = await sharp(path.join(root, folder, meta.preview)).metadata();
  if (!image.width || !image.height) throw new Error(`Invalid preview: ${folder}`);
  for (let row = 0; row < meta.rows; row++) for (let col = 0; col < meta.cols; col++) {
    const file = meta.tileUrl.replace("{col}", col).replace("{row}", row);
    if (!(await stat(path.join(root, folder, file))).size) throw new Error(`Empty tile: ${folder}/${file}`);
    tiles++;
  }
}
const diskFolders = (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory());
console.log(JSON.stringify({ nodes: nodes.length, folders: folders.size, diskFolders: diskFolders.length,
  previews: folders.size, metadata: folders.size, tiles, dimensions: [...dimensions],
  floors: Object.fromEntries(["GF", "FF", "SF"].map((prefix) => [prefix, nodes.filter((node) => node.id.startsWith(`${prefix}_`)).length])),
}, null, 2));

// Audit the manually reviewed aliases too. If a repeated take is re-rendered,
// fail loudly so its alias can be removed after checking the new coordinates.
const repeated = [];
for (const [id, canonical] of Object.entries(navigation.duplicateRenders)) {
  const buffers = await Promise.all([id, canonical].map(async (key) => {
    const node = nodes.find((item) => item.id === key);
    if (!node) throw new Error(`Unknown repeated-render reference: ${key}`);
    return sharp(path.join(root, node.image_filename.replace(/\.[^.]+$/, ""), "preview.jpg"))
      .resize(256, 128).removeAlpha().raw().toBuffer();
  }));
  const difference = buffers[0].reduce((sum, value, index) => sum + Math.abs(value - buffers[1][index]), 0) / buffers[0].length;
  if (difference > 1) throw new Error(`${id} no longer repeats ${canonical}; review and update villa-interior-navigation.json`);
  repeated.push({ id, canonical, meanPixelDifference: Number(difference.toFixed(3)) });
}
console.log(JSON.stringify({ uniqueWalkingStops: nodes.length - repeated.length, repeatedRenders: repeated }, null, 2));

if (process.argv.includes("--contact-sheets")) {
  const output = await mkdtemp(path.join(os.tmpdir(), "villa-interior-review-"));
  for (const floor of ["GF", "FF", "SF"]) {
    const items = nodes.filter((node) => node.id.startsWith(`${floor}_`));
    const width = 400, height = 224, columns = 4;
    const composites = await Promise.all(items.map(async (node, index) => {
      const folder = node.image_filename.replace(/\.[^.]+$/, "");
      const preview = await sharp(path.join(root, folder, "preview.jpg")).resize(width, 200).png().toBuffer();
      const label = Buffer.from(`<svg width="400" height="24"><rect width="100%" height="100%" fill="#111"/><text x="8" y="17" fill="white" font-size="14">${node.id}</text></svg>`);
      const tile = await sharp({ create: { width, height, channels: 3, background: "#111" } })
        .composite([{ input: label, top: 0, left: 0 }, { input: preview, top: 24, left: 0 }]).png().toBuffer();
      return { input: tile, left: index % columns * width, top: Math.floor(index / columns) * height };
    }));
    const target = path.join(output, `${floor}.png`);
    await sharp({ create: { width: columns * width, height: Math.ceil(items.length / columns) * height, channels: 3, background: "#111" } })
      .composite(composites).png().toFile(target);
    console.log(target);
  }
}
