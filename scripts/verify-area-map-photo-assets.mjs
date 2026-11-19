// Read-only verification of all uploaded POI photos and thumbnails. No writes.
import { readFile } from "node:fs/promises";
import { createHash, createHmac } from "node:crypto";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: [".env.local", ".env"], quiet: true });
const photos = JSON.parse(await readFile("public/data/laurels-poi-photos.json", "utf8"));
const worker = (process.env.ASSET_WORKER_DOMAIN || "https://curly-leaf-d240.aasish.workers.dev").replace(/\/+$/, "");
const secret = process.env.ASSET_SECRET;
if (!secret) throw new Error("ASSET_SECRET is required for verification.");
const assets = photos.flatMap((photo) => [
  { name: path.basename(photo.image), sha256: photo.sha256, bytes: photo.bytes },
  { name: path.basename(photo.thumbnail), sha256: photo.thumbnailSha256, bytes: photo.thumbnailBytes },
]);
let cursor = 0, checked = 0, bytesChecked = 0;
const failures = [];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (cursor < assets.length) {
    const asset = assets[cursor++];
    try {
      const key = `Varaprasad_Laurels/Images/laurels/${asset.name}`;
      const signature = createHmac("sha256", secret).update(key).digest("hex");
      const url = `${worker}/${key.split("/").map(encodeURIComponent).join("/")}?sig=${signature}`;
      const response = await fetch(url, { headers: { Origin: "http://localhost:3000", Referer: "http://localhost:3000/area-map" }, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.headers.get("content-type")?.startsWith("image/avif")) throw new Error("Unexpected content type");
      if (response.headers.get("access-control-allow-origin") !== "http://localhost:3000") throw new Error("CORS origin mismatch");
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length !== asset.bytes || createHash("sha256").update(bytes).digest("hex") !== asset.sha256) throw new Error("Bytes differ from the original verified photo");
      checked++; bytesChecked += bytes.length;
    } catch (error) { failures.push({ name: asset.name, error: error.message }); }
  }
}));
console.log(JSON.stringify({ checked, expected: assets.length, bytesChecked, failures }, null, 2));
if (failures.length) process.exitCode = 1;
