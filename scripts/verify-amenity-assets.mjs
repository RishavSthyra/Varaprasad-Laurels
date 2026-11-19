// Read-only Cloudflare audit. No uploads, changes or deletions are performed.
import { createHash, createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: [".env.local", ".env"], quiet: true });
const catalog = JSON.parse(await readFile("data/amenitiesPage.json", "utf8"));
const worker = (process.env.ASSET_WORKER_DOMAIN || "https://curly-leaf-d240.aasish.workers.dev").replace(/\/+$/, "");
const secret = process.env.ASSET_SECRET;
if (!secret) throw new Error("ASSET_SECRET is required for read-only Worker verification.");
const origin = "http://localhost:3000";
const assets = catalog.items.flatMap(item => [
  { local: item.videoSrc, key: `Varaprasad_Laurels/Videos/videos/${path.basename(item.videoSrc)}`, type: "video/mp4" },
  { local: item.thumbnailSrc, key: `Varaprasad_Laurels/Images/first-frames/${path.basename(item.thumbnailSrc)}`, type: "image/avif" },
]);
let cursor = 0;
let checked = 0;
let bytesChecked = 0;
const failures = [];
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
function signedUrl(key) {
  const signature = createHmac("sha256", secret).update(key).digest("hex");
  return `${worker}/${key.split("/").map(encodeURIComponent).join("/")}?sig=${signature}`;
}
await Promise.all(Array.from({ length: 4 }, async () => {
  while (cursor < assets.length) {
    const asset = assets[cursor++];
    try {
      const local = await readFile(path.join("public", asset.local));
      const response = await fetch(signedUrl(asset.key), {
        headers: { Origin: origin, Referer: `${origin}/amenities` },
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.headers.get("content-type")?.startsWith(asset.type)) throw new Error(`Incorrect MIME type: ${response.headers.get("content-type")}`);
      if (response.headers.get("access-control-allow-origin") !== origin) throw new Error("CORS origin mismatch");
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length !== local.length || hash(bytes) !== hash(local)) throw new Error("Cloud bytes differ from the verified local file");
      bytesChecked += bytes.length;
      checked++;
      console.log(`OK ${asset.key} (${bytes.length} bytes)`);
    } catch (error) {
      failures.push({ key: asset.key, error: error.message });
      console.error(`FAIL ${asset.key}: ${error.message}`);
    }
  }
}));
const video = assets.find(asset => asset.type === "video/mp4");
let rangeSupported = false;
try {
  const local = await readFile(path.join("public", video.local));
  const response = await fetch(signedUrl(video.key), {
    headers: { Origin: origin, Range: "bytes=0-1023" }, signal: AbortSignal.timeout(30000),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  rangeSupported = response.status === 206 && response.headers.get("content-range") === `bytes 0-1023/${local.length}` && bytes.equals(local.subarray(0, 1024));
  if (!rangeSupported) throw new Error(`Range response not verified: HTTP ${response.status}`);
} catch (error) { failures.push({ key: video.key, error: error.message }); }
console.log(JSON.stringify({ checked, expected: assets.length, bytesChecked, rangeSupported, failures }));
if (failures.length) process.exitCode = 1;
