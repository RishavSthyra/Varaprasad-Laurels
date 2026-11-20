// Read-only R2 audit. No uploads, deletions, purges or local asset changes.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import { createHash, createHmac } from "node:crypto";
import path from "node:path";
import dotenv from "dotenv";
import sharp from "sharp";

dotenv.config({ path: [".env.local", ".env"], quiet: true });
const endpoint = "https://2fe8b97f277d6ada48a33be5db19daa7.r2.cloudflarestorage.com";
const prefix = "Varaprasad_Laurels/Panos/varaprasad_exterior_panos_remaining_v2/";
const rawPrefix = "Varaprasad_Laurels/Panos/Exterior PANOS_Remaining_v2/";
const local = path.resolve("public/varaprasad_exterior_panos_remaining_v2");
const rawLocal = path.resolve("Exterior PANOS_Remaining_v2");
const worker = (process.env.ASSET_WORKER_DOMAIN || "https://curly-leaf-d240.aasish.workers.dev").replace(/\/+$/, "");
const secret = process.env.ASSET_SECRET;
if (!secret) throw new Error("ASSET_SECRET is required for the browser-delivery audit.");
const md5 = bytes => createHash("md5").update(bytes).digest("hex");
const failures = [];
async function listing(keyPrefix) {
  const { stdout } = await promisify(execFile)("aws", ["s3api", "list-objects-v2", "--bucket", "sthyra-assets",
    "--prefix", keyPrefix, "--endpoint-url", endpoint, "--output", "json"], { windowsHide: true, maxBuffer: 24 * 1024 * 1024 });
  return new Map((JSON.parse(stdout).Contents ?? []).filter(object => !object.Key.endsWith("/")).map(object => [object.Key, object]));
}
const [objects, rawObjects] = await Promise.all([listing(prefix), listing(rawPrefix)]);
const folders = (await readdir(local, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name);
const hashes = new Map();
let matched = 0, bytesMatched = 0, tiles = 0, remoteGets = 0, rawMatched = 0, rawBytesMatched = 0, cursor = 0;
async function compare(relative) {
  const bytes = await readFile(path.join(local, relative));
  const hash = md5(bytes), object = objects.get(prefix + relative);
  if (!object || object.Size !== bytes.length || object.ETag.replaceAll('"', "") !== hash) throw new Error(`Missing/size/checksum mismatch: ${relative}`);
  hashes.set(relative, hash); matched++; bytesMatched += bytes.length;
  return bytes;
}
async function delivered(relative, origin, json = false) {
  const key = prefix + relative;
  const sig = createHmac("sha256", secret).update(key).digest("hex");
  const response = await fetch(`${worker}/${key.split("/").map(encodeURIComponent).join("/")}?sig=${sig}`, {
    headers: { Origin: origin, Referer: `${origin}/exterior-walkthrough` }, signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(`Delivery HTTP ${response.status}: ${relative}`);
  if (response.headers.get("access-control-allow-origin") !== origin) throw new Error(`Delivery CORS mismatch: ${relative}`);
  if (!response.headers.get("content-type")?.startsWith(json ? "application/json" : "image/jpeg")) throw new Error(`Delivery MIME mismatch: ${relative}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (md5(bytes) !== hashes.get(relative)) throw new Error(`Delivered bytes differ: ${relative}`);
  if (!json) await sharp(bytes).stats(); // Decode image pixels, not just headers.
  remoteGets++;
}
await Promise.all(Array.from({ length: 5 }, async () => {
  while (cursor < folders.length) {
    const folder = folders[cursor++];
    try {
      const meta = JSON.parse(await compare(`${folder}/meta.json`));
      if (meta.width !== 8640 || meta.height !== 4320 || meta.cols !== 16 || meta.rows !== 8 || meta.tileWidth !== 540 || meta.tileHeight !== 540) throw new Error(`Unexpected metadata: ${folder}`);
      await compare(`${folder}/${meta.preview}`);
      for (let row = 0; row < meta.rows; row++) for (let col = 0; col < meta.cols; col++) {
        await compare(`${folder}/${meta.tileUrl.replace("{col}", col).replace("{row}", row)}`); tiles++;
      }
      await Promise.all([
        delivered(`${folder}/meta.json`, "http://localhost:3000", true),
        delivered(`${folder}/meta.json`, "https://varaprasad-laurels.vercel.app", true),
        ...[meta.preview, meta.tileUrl.replace("{col}", 0).replace("{row}", 0), meta.tileUrl.replace("{col}", 15).replace("{row}", 7)]
          .map(file => delivered(`${folder}/${file}`, "https://varaprasad-laurels.vercel.app")),
      ]);
    } catch (error) { failures.push({ folder, error: error.message }); }
  }
}));
console.log(`Generated audit: ${matched} checksum matches; ${remoteGets} browser-delivery GETs passed.`);

// AWS CLI defaults to 8 MiB multipart chunks. Validate both the part count and
// combined part digest; a same-sized but damaged source cannot pass this check.
const rawNames = (await readdir(rawLocal, { withFileTypes: true })).filter(entry => entry.isFile()).map(entry => entry.name);
for (const name of rawNames) {
  try {
    const object = rawObjects.get(rawPrefix + name), bytes = await readFile(path.join(rawLocal, name));
    if (!object || object.Size !== bytes.length) throw new Error(`Raw backup missing/size differs: ${name}`);
    const etag = object.ETag.replaceAll('"', "");
    let expected = md5(bytes);
    if (etag.includes("-")) {
      const parts = [];
      for (let start = 0; start < bytes.length; start += 8 * 1024 * 1024) parts.push(createHash("md5").update(bytes.subarray(start, start + 8 * 1024 * 1024)).digest());
      expected = `${md5(Buffer.concat(parts))}-${parts.length}`;
    }
    if (etag !== expected) throw new Error(`Raw backup multipart checksum differs: ${name}`);
    rawMatched++; rawBytesMatched += bytes.length;
  } catch (error) { failures.push({ error: error.message }); }
}
const extras = [...objects.keys()].filter(key => !hashes.has(key.slice(prefix.length)));
console.log(JSON.stringify({ generatedFolders: folders.length, cloudGeneratedObjects: objects.size, matchedGeneratedFiles: matched,
  generatedBytes: bytesMatched, tiles, deliveredGets: remoteGets, unexpectedGeneratedObjects: extras.length,
  rawLocalFiles: rawNames.length, cloudRawFiles: rawObjects.size, matchedRawFiles: rawMatched, rawBytes: rawBytesMatched, failures }, null, 2));
if (failures.length || folders.length !== 35 || matched !== 4550 || objects.size !== 4550 || extras.length || remoteGets !== 175 || rawMatched !== 35 || rawObjects.size !== 35) process.exitCode = 1;
