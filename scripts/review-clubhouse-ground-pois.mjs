// Read-only visual review: fetch exact cloud previews into a fresh temp folder.
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHmac } from "node:crypto";
import sharp from "sharp";
import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"], quiet: true });
const nodes = JSON.parse(await readFile("data/Clubhouse_Pano_Data.json", "utf8"));
const entries = [[1, "Ground_Floor_Pano_1_F0001"], [3, "Ground_Floor_Pano_2_F0000"], [11, "Ground_Floor_Pano_2_F0004"],
  [4, "Ground_Floor_Pano_3_F0001"], [9, "Ground_Floor_Pano_4_F0002"], [5, "Ground_Floor_Pano_5_F0001"],
  [6, "Ground_Floor_Pano_5_F0005"], [7, "Ground_Floor_Pano_5_F0006"], [16, "Ground_Floor_Pano_1_F0007"]];
const output = await mkdtemp(path.join(os.tmpdir(), "clubhouse-poi-review-"));
const worker = (process.env.ASSET_WORKER_DOMAIN || "https://curly-leaf-d240.aasish.workers.dev").replace(/\/+$/, "");
if (!process.env.ASSET_SECRET) throw new Error("Asset signing is not configured");
const composites = [];
for (const [index, [number, id]] of entries.entries()) {
  const node = nodes.find(node => node.id === id);
  if (!node) throw new Error(`Unknown camera ${id}`);
  const folder = node.image_filename.replace(/\.[^.]+$/, "");
  const key = `Varaprasad_Laurels/Panos/varaprasad_clubhouse_panos/${folder}/preview.jpg`;
  const sig = createHmac("sha256", process.env.ASSET_SECRET).update(key).digest("hex");
  const response = await fetch(`${worker}/${key.split("/").map(encodeURIComponent).join("/")}?sig=${sig}`, {
    headers: { Origin: "http://localhost:3000", Referer: "http://localhost:3000/clubhouse-walkthrough" }, signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Preview ${id}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const file = path.join(output, `${number}.jpg`);
  await writeFile(file, bytes);
  const preview = await sharp(bytes).resize(1000, 500).toBuffer();
  const label = Buffer.from(`<svg width="1000" height="35"><rect width="100%" height="100%" fill="#111"/><text x="10" y="25" fill="white" font-size="22">#${number}: ${id} (yaw ${node.yaw})</text></svg>`);
  composites.push({ input: label, left: index % 3 * 1000, top: Math.floor(index / 3) * 535 },
    { input: preview, left: index % 3 * 1000, top: Math.floor(index / 3) * 535 + 35 });
  console.log(`${number}: ${file}`);
}
const sheet = path.join(output, "all-ground-pois.png");
await sharp({ create: { width: 3000, height: 1605, channels: 3, background: "#111" } }).composite(composites).png().toFile(sheet);
console.log(`SHEET ${sheet}`);
