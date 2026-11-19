// Read-only audit: list every R2 object and test signed browser access per set.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHmac } from "node:crypto";
import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { getVillaInteriorTour, VILLA_BALCONY_BASE_PATH } from "../lib/villa-interior-tour";

async function main() {
dotenv.config({ path: [".env.local", ".env"], quiet: true });
const prefix = "Varaprasad_Laurels/Panos/varaprasad_villa_balconyPanos/";
const worker = (process.env.ASSET_WORKER_DOMAIN || "https://curly-leaf-d240.aasish.workers.dev").replace(/\/+$/, "");
const secret = process.env.ASSET_SECRET;
if (!secret) throw new Error("ASSET_SECRET is required.");
const folders = new Set<string>();
for (let villa = 1; villa <= 78; villa++) {
  if (villa === 21) continue;
  const tour = getVillaInteriorTour(villa);
  for (const id of ["FF_CAM2_F0007", "SF_CAM1_F0003"]) folders.add(tour.folders[id]);
}
const { stdout } = await promisify(execFile)("aws", ["s3api", "list-objects-v2",
  "--bucket", "sthyra-assets", "--prefix", prefix, "--output", "json",
  "--endpoint-url", "https://2fe8b97f277d6ada48a33be5db19daa7.r2.cloudflarestorage.com"],
{ maxBuffer: 32 * 1024 * 1024, windowsHide: true });
const inventory = JSON.parse(stdout) as { Contents: { Key: string; Size: number }[] };
const objects = new Map(inventory.Contents.map(object => [object.Key, object.Size]));
const expected = new Set<string>();
const localRoot = path.resolve("public/varaprasad_villa_balconyPanos");
const compareLocal = existsSync(localRoot);
let metadata = 0, previews = 0, tiles = 0, localSizesMatched = 0, browserChecks = 0;
const failures: { asset: string; error: string }[] = [];
async function browserAsset(key: string, json = false) {
  const sig = createHmac("sha256", secret!).update(key).digest("hex");
  const url = `${worker}/${key.split("/").map(encodeURIComponent).join("/")}?sig=${sig}`;
  const response = await fetch(url, { method: json ? "GET" : "HEAD",
    headers: { Origin: "http://localhost:3000", Referer: "http://localhost:3000/villa-walkthrough" },
    signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (response.headers.get("access-control-allow-origin") !== "http://localhost:3000") throw new Error("CORS mismatch");
  const type = response.headers.get("content-type") || "";
  if (!type.startsWith(json ? "application/json" : "image/jpeg")) throw new Error(`Unexpected MIME ${type}`);
  browserChecks++;
  return json ? response.json() : undefined;
}
async function checkObject(relative: string) {
  const key = prefix + relative;
  expected.add(key);
  const bytes = objects.get(key);
  if (!bytes) throw new Error(`Missing or empty object: ${relative}`);
  if (compareLocal) {
    if ((await stat(path.join(localRoot, relative))).size !== bytes) throw new Error(`Local/cloud size mismatch: ${relative}`);
    localSizesMatched++;
  }
}
let cursor = 0;
const allFolders = [...folders];
await Promise.all(Array.from({ length: 10 }, async () => {
  while (cursor < allFolders.length) {
    const folder = allFolders[cursor++];
    try {
      await checkObject(`${folder}/meta.json`);
      const meta = await browserAsset(`${prefix}${folder}/meta.json`, true);
      if (JSON.stringify([meta.width, meta.height, meta.cols, meta.rows, meta.tileWidth, meta.tileHeight]) !== JSON.stringify([8640, 4320, 16, 8, 540, 540])) throw new Error("Unexpected grid or resolution");
      if (meta.preview !== "preview.jpg" || meta.tileUrl !== "tiles/tile_{col}_{row}.jpg") throw new Error("Unexpected asset layout");
      metadata++;
      await checkObject(`${folder}/${meta.preview}`); previews++;
      for (let row = 0; row < meta.rows; row++) for (let col = 0; col < meta.cols; col++) {
        await checkObject(`${folder}/tiles/tile_${col}_${row}.jpg`); tiles++;
      }
      await Promise.all([meta.preview, "tiles/tile_0_0.jpg", "tiles/tile_15_7.jpg"].map(file => browserAsset(`${prefix}${folder}/${file}`)));
    } catch (error) { failures.push({ asset: folder, error: (error as Error).message }); }
  }
}));
console.log(JSON.stringify({ configuredBase: VILLA_BALCONY_BASE_PATH, folders: folders.size,
  cloudObjects: objects.size, metadata, previews, tiles, localSizesMatched, browserChecks,
  unexpectedObjects: [...objects.keys()].filter(key => !expected.has(key)).length, failures }, null, 2));
if (failures.length || metadata !== 154 || previews !== 154 || tiles !== 19712) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
