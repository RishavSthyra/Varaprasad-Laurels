// Read-only backup audit before removing local generated assets.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createHash, createHmac } from "node:crypto";
import dotenv from "dotenv";

dotenv.config({ path: [".env.local", ".env"], quiet: true });
const prefix = "Varaprasad_Laurels/Panos/varaprasad_exterior_panos_remaining/";
const root = path.resolve("public/varaprasad_exterior_panos_remaining");
const { stdout } = await promisify(execFile)("aws", ["s3api", "list-objects-v2", "--bucket", "sthyra-assets",
  "--prefix", prefix, "--endpoint-url", "https://2fe8b97f277d6ada48a33be5db19daa7.r2.cloudflarestorage.com", "--output", "json"],
{ windowsHide: true, maxBuffer: 24 * 1024 * 1024 });
const objects = new Map((JSON.parse(stdout).Contents || []).map(object => [object.Key, object]));
const folders = (await readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name);
const worker = (process.env.ASSET_WORKER_DOMAIN || "https://curly-leaf-d240.aasish.workers.dev").replace(/\/+$/, "");
const secret = process.env.ASSET_SECRET;
if (!secret) throw new Error("ASSET_SECRET is required.");
const failures = [];
const expected = new Set();
let checked = 0, tiles = 0, previews = 0, metadata = 0, browserChecks = 0, cursor = 0;
async function objectMatches(relative) {
  const key = prefix + relative;
  expected.add(key);
  const object = objects.get(key);
  if (!object || !object.Size) throw new Error(`Missing or empty object: ${relative}`);
  const bytes = await readFile(path.join(root, relative));
  if (object.Size !== bytes.length) throw new Error(`Size mismatch: ${relative}`);
  if (object.ETag.replaceAll('"', "") !== createHash("md5").update(bytes).digest("hex")) throw new Error(`MD5/ETag mismatch: ${relative}`);
  checked++;
  return bytes;
}
async function accessible(relative, json = false) {
  const key = prefix + relative;
  const sig = createHmac("sha256", secret).update(key).digest("hex");
  const response = await fetch(`${worker}/${key.split("/").map(encodeURIComponent).join("/")}?sig=${sig}`, {
    method: json ? "GET" : "HEAD", headers: { Origin: "http://localhost:3000", Referer: "http://localhost:3000/exterior-walkthrough" },
    signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${relative}: HTTP ${response.status}`);
  if (response.headers.get("access-control-allow-origin") !== "http://localhost:3000") throw new Error(`CORS mismatch: ${relative}`);
  if (!response.headers.get("content-type")?.startsWith(json ? "application/json" : "image/jpeg")) throw new Error(`MIME mismatch: ${relative}`);
  browserChecks++;
  return json ? response.json() : undefined;
}
await Promise.all(Array.from({ length: 6 }, async () => {
  while (cursor < folders.length) {
    const folder = folders[cursor++];
    try {
      const meta = JSON.parse(await objectMatches(`${folder}/meta.json`)); metadata++;
      const remoteMeta = await accessible(`${folder}/meta.json`, true);
      if (JSON.stringify(meta) !== JSON.stringify(remoteMeta)) throw new Error(`Metadata differs: ${folder}`);
      await objectMatches(`${folder}/${meta.preview}`); previews++;
      for (let row = 0; row < meta.rows; row++) for (let col = 0; col < meta.cols; col++) {
        await objectMatches(`${folder}/${meta.tileUrl.replace("{col}", col).replace("{row}", row)}`); tiles++;
      }
      await Promise.all([meta.preview, meta.tileUrl.replace("{col}", 0).replace("{row}", 0),
        meta.tileUrl.replace("{col}", meta.cols - 1).replace("{row}", meta.rows - 1)].map(file => accessible(`${folder}/${file}`)));
    } catch (error) { failures.push({ folder, error: error.message }); }
  }
}));
const url = "https://cdn.sthyra.com/Varaprasad_Laurels/Videos/masterplan_scrub_gop3_60mb.mp4";
const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
if (!response.ok) throw new Error(`Cloud video HTTP ${response.status}`);
const cloudHash = createHash("sha256"); let videoBytes = 0;
for await (const chunk of response.body) { cloudHash.update(chunk); videoBytes += chunk.length; }
const localVideo = await readFile("public/masterplan_scrub_gop3_60mb.mp4");
const videoMatches = videoBytes === localVideo.length && cloudHash.digest("hex") === createHash("sha256").update(localVideo).digest("hex");
if (!videoMatches) failures.push({ error: "Cloud video differs from the approved local encode" });
console.log(JSON.stringify({ folders: folders.length, cloudObjects: objects.size, md5MatchedFiles: checked, metadata, previews,
  tiles, browserChecks, unexpectedObjects: [...objects.keys()].filter(key => !expected.has(key)).length,
  videoBytes, videoMatches, failures }, null, 2));
if (failures.length || folders.length !== 45 || checked !== 5850) process.exitCode = 1;
