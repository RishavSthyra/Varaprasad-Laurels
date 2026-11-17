// Read-only audit: only S3 ListObjectsV2 and signed Worker GETs are used.
// No local files or cloud objects are written, uploaded, or deleted.
// Add --villa to audit the villa manifest/local tiles and every villa's Worker assets.
import { createHash, createHmac } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import dotenv from "dotenv";
import sharp from "sharp";

dotenv.config({ path: [".env.local", ".env"], quiet: true });

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const endpoint = argument("--endpoint", process.env.R2_ENDPOINT);
const profile = argument("--profile", "r2");
const bucket = argument("--bucket", "sthyra-assets");
const villaMode = process.argv.includes("--villa");
const assetFolder = villaMode ? "varaprasad_villa_panos" : "varaprasad_exterior_panos";
const prefix = `Varaprasad_Laurels/Panos/${assetFolder}/`;
const localRoot = path.resolve("public", assetFolder);
const inventoryOnly = process.argv.includes("--inventory-only");
const failures = [];

function hash(bytes, algorithm = "sha256") {
  return createHash(algorithm).update(bytes).digest("hex");
}

function hmac(key, value, encoding) {
  return createHmac("sha256", key).update(value).digest(encoding);
}

function encode(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function decodeXml(value) {
  return value.replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function tag(xml, name) {
  const match = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return match ? decodeXml(match[1]) : "";
}

async function getCredentials() {
  const text = await readFile(
    process.env.AWS_SHARED_CREDENTIALS_FILE ?? path.join(homedir(), ".aws", "credentials"),
    "utf8",
  );
  let active = false;
  const fields = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("[")) {
      active = line === `[${profile}]`;
    } else if (active && line && !line.startsWith("#")) {
      const separator = line.indexOf("=");
      if (separator > 0) fields[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
    }
  }
  if (!fields.aws_access_key_id || !fields.aws_secret_access_key) {
    throw new Error(`AWS profile ${profile} is missing credentials.`);
  }
  return fields;
}

async function listObjects(credentials, continuationToken) {
  const url = new URL(`/${encode(bucket)}`, endpoint);
  const params = { "list-type": "2", "max-keys": "1000", prefix };
  if (continuationToken) params["continuation-token"] = continuationToken;
  const query = Object.entries(params).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encode(key)}=${encode(value)}`).join("&");
  url.search = query;
  const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = date.slice(0, 8);
  const payloadHash = hash("");
  const headers = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": date,
  };
  if (credentials.aws_session_token) headers["x-amz-security-token"] = credentials.aws_session_token;
  const headerNames = Object.keys(headers).sort();
  const signedHeaders = headerNames.join(";");
  const canonicalHeaders = headerNames.map((key) => `${key}:${headers[key]}\n`).join("");
  const canonical = `GET\n${url.pathname}\n${query}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${day}/auto/s3/aws4_request`;
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${credentials.aws_secret_access_key}`, day), "auto"), "s3"), "aws4_request");
  headers.Authorization = `AWS4-HMAC-SHA256 Credential=${credentials.aws_access_key_id}/${scope}, SignedHeaders=${signedHeaders}, Signature=${hmac(signingKey, `AWS4-HMAC-SHA256\n${date}\n${scope}\n${hash(canonical)}`, "hex")}`;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
  const xml = await response.text();
  if (!response.ok) throw new Error(`R2 listing failed: HTTP ${response.status}, ${tag(xml, "Code")}`);
  return {
    objects: [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map(([, item]) => ({
      key: tag(item, "Key"),
      size: Number(tag(item, "Size")),
      etag: tag(item, "ETag").replace(/"/g, ""),
    })),
    next: tag(xml, "NextContinuationToken"),
  };
}

async function collectFiles(directory, relative = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = `${relative}${entry.name}`;
    if (entry.isDirectory()) files.push(...await collectFiles(path.join(directory, entry.name), `${name}/`));
    else if (entry.isFile()) files.push(name);
  }
  return files;
}

async function concurrent(items, limit, callback) {
  let cursor = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (cursor < items.length) await callback(items[cursor++]);
  }));
}

async function checkWorkerAsset(relative) {
  const key = `${prefix}${relative}`;
  const secret = process.env.ASSET_SECRET;
  if (!secret) throw new Error("ASSET_SECRET is required for Worker verification.");
  const origin = (process.env.ASSET_WORKER_DOMAIN ?? "https://curly-leaf-d240.aasish.workers.dev").replace(/\/+$/, "");
  const url = `${origin}/${key.split("/").map(encode).join("/")}?sig=${hmac(secret, key, "hex")}`;
  const response = await fetch(url, {
    headers: { Origin: "http://localhost:3000", Referer: `http://localhost:3000/${villaMode ? "master-plan" : "exterior-walkthrough"}` },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`${relative}: Worker HTTP ${response.status}`);
  if (response.headers.get("access-control-allow-origin") !== "http://localhost:3000") {
    throw new Error(`${relative}: Worker CORS origin mismatch`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const local = await readFile(path.join(localRoot, relative));
  if (!bytes.equals(local)) throw new Error(`${relative}: Worker content differs from local file`);
  if (relative.endsWith(".jpg")) {
    if (!response.headers.get("content-type")?.startsWith("image/")) throw new Error(`${relative}: incorrect image MIME type`);
    const metadata = await sharp(bytes).metadata();
    if (!metadata.width || !metadata.height) throw new Error(`${relative}: invalid image`);
  } else {
    JSON.parse(bytes.toString("utf8"));
  }
}

async function main() {
  if (!endpoint || !/^https:\/\/[a-z0-9.-]+\.r2\.cloudflarestorage\.com\/?$/i.test(endpoint)) {
    throw new Error("Pass --endpoint https://<account>.r2.cloudflarestorage.com");
  }
  const credentials = await getCredentials();
  const remote = new Map();
  let token;
  do {
    const page = await listObjects(credentials, token);
    page.objects.forEach((object) => remote.set(object.key.slice(prefix.length), object));
    token = page.next;
    console.log(`Listed ${remote.size} R2 objects${token ? " (continuing)" : " (complete)"}`);
  } while (token);

  const localFiles = await collectFiles(localRoot);
  const expected = new Set(localFiles);
  const missingByFolder = {};
  const folders = [...new Set(localFiles.map((name) => name.split("/")[0]))].sort();
  let checked = 0;
  let checksums = 0;
  let bytes = 0;
  await concurrent(localFiles, 8, async (relative) => {
    const object = remote.get(relative);
    if (!object) {
      failures.push(`${relative}: missing in R2`);
      const folder = relative.split("/")[0];
      missingByFolder[folder] = (missingByFolder[folder] ?? 0) + 1;
      return;
    }
    const local = inventoryOnly ? null : await readFile(path.join(localRoot, relative));
    const size = local ? local.length : (await stat(path.join(localRoot, relative))).size;
    bytes += size;
    if (!size || size !== object.size) failures.push(`${relative}: byte size mismatch`);
    if (local && /^[a-f0-9]{32}$/i.test(object.etag)) {
      checksums++;
      if (hash(local, "md5") !== object.etag.toLowerCase()) failures.push(`${relative}: MD5 mismatch`);
    }
    if (++checked % 5000 === 0) console.log(`Compared ${checked}/${localFiles.length} files`);
  });

  const nodes = villaMode
    ? JSON.parse(await readFile("data/villa-panos.json", "utf8")).panos
    : JSON.parse(await readFile("data/Varaprasad_Exterior_Pano_Data_v1.json", "utf8"));
  for (const node of nodes) {
    const folder = villaMode ? node.folder : `EP.${String(node.frame).padStart(5, "0")}`;
    if (!folders.includes(folder)) failures.push(`${villaMode ? `Villa ${node.villaNumber}` : node.id}: missing panorama folder ${folder}`);
  }
  for (const folder of folders) {
    const meta = JSON.parse(await readFile(path.join(localRoot, folder, "meta.json"), "utf8"));
    const cols = meta.actualCols ?? meta.cols;
    const rows = meta.actualRows ?? meta.rows;
    for (const relative of [`${folder}/meta.json`, `${folder}/${meta.preview ?? "preview.jpg"}`]) {
      if (!remote.has(relative) && !expected.has(relative)) failures.push(`${relative}: required file missing`);
    }
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const template = meta.tileUrl ?? `tiles/tile_{col}_{row}.${meta.tileFormat ?? "jpg"}`;
        const relative = `${folder}/${template.replace("{col}", col).replace("{row}", row)}`;
        if (!remote.has(relative) && !expected.has(relative)) failures.push(`${relative}: required tile missing`);
      }
    }
  }

  const sampleFolders = villaMode ? folders : [...new Set([folders[0], folders[Math.floor(folders.length / 2)], folders.at(-1)])];
  const samples = sampleFolders.flatMap((folder) => [`${folder}/meta.json`, `${folder}/preview.jpg`, `${folder}/tiles/tile_0_0.jpg`]);
  let workerChecked = 0;
  await concurrent(samples, 3, async (relative) => {
    try { await checkWorkerAsset(relative); }
    catch (error) { failures.push(error.message); }
    if (++workerChecked % 30 === 0) console.log(`Verified ${workerChecked}/${samples.length} Worker responses`);
  });

  const extra = [...remote.keys()].filter((key) => !expected.has(key));
  console.log(JSON.stringify({
    auditedAt: new Date().toISOString(), prefix,
    folders: folders.length, nodes: nodes.length, localFiles: localFiles.length,
    remoteObjects: remote.size, filesCompared: checked, md5Compared: checksums,
    missingObjects: Object.values(missingByFolder).reduce((sum, count) => sum + count, 0),
    missingByFolder,
    totalBytes: bytes, extraRemoteObjects: extra.length, workerSamples: samples.length,
    failures: failures.length, details: failures.slice(0, 30),
  }, null, 2));
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
