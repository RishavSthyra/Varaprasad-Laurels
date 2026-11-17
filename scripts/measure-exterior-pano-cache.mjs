// Read-only: signed GETs only. No upload, purge, R2 mutation, or cache busting.
// node scripts/measure-exterior-pano-cache.mjs [--origin http://localhost:3000]
import { createHmac } from "node:crypto";
import dotenv from "dotenv";

dotenv.config({ path: [".env.local", ".env"], quiet: true });
const originIndex = process.argv.indexOf("--origin");
const origin = originIndex >= 0 ? process.argv[originIndex + 1] : "http://localhost:3000";
if (!origin || new URL(origin).origin !== origin) throw new Error("Pass an origin without a trailing slash or path.");
const domain = (process.env.ASSET_WORKER_DOMAIN ||
  "https://curly-leaf-d240.aasish.workers.dev").replace(/\/+$/, "");
if (!process.env.ASSET_SECRET) throw new Error("ASSET_SECRET is not configured.");
const base = "Varaprasad_Laurels/Panos/varaprasad_exterior_panos";
function signedUrl(key) {
  const sig = createHmac("sha256", process.env.ASSET_SECRET).update(key).digest("hex");
  return `${domain}/${key.split("/").map(encodeURIComponent).join("/")}?sig=${sig}`;
}
async function measure(key) {
  const start = performance.now();
  const response = await fetch(signedUrl(key), {
    headers: { Origin: origin, Referer: `${origin}/` },
    signal: AbortSignal.timeout(20000),
  });
  const headersMs = performance.now() - start;
  const bytes = await response.arrayBuffer();
  return {
    response, bytes,
    result: {
      status: response.status, bytes: bytes.byteLength,
      headersMs: Math.round(headersMs), totalMs: Math.round(performance.now() - start),
      cacheStatus: response.headers.get("cf-cache-status"),
      age: response.headers.get("age"),
      cacheControl: response.headers.get("cache-control"),
      corsOrigin: response.headers.get("access-control-allow-origin"),
      corsMatches: response.headers.get("access-control-allow-origin") === origin ||
        response.headers.get("access-control-allow-origin") === "*",
      vary: response.headers.get("vary"),
      colo: response.headers.get("cf-ray")?.split("-").at(-1),
    },
  };
}
const assets = [];
for (const pano of ["EP.00018", "EP.00096", "EP.00192"]) {
  const metaResponse = await measure(`${base}/${pano}/meta.json`);
  if (!metaResponse.response.ok) {
    assets.push({ pano, metadata: metaResponse.result });
    continue;
  }
  const meta = JSON.parse(new TextDecoder().decode(metaResponse.bytes));
  const col = Math.floor((meta.actualCols ?? meta.cols) / 2);
  const row = Math.floor((meta.actualRows ?? meta.rows) / 2);
  const explicit = meta.tiles?.find((tile) => tile.col === col && tile.row === row);
  const tile = explicit ? `tiles/${explicit.file}` :
    (meta.tileUrl ?? `tiles/tile_{col}_{row}.${meta.tileFormat ?? "jpg"}`)
      .replace("{col}", String(col)).replace("{row}", String(row));
  const samples = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    samples.push((await measure(`${base}/${pano}/${tile}`)).result);
  }
  assets.push({ pano, tile, metadata: metaResponse.result, samples });
}
console.log(JSON.stringify({
  measuredAt: new Date().toISOString(), host: new URL(domain).host, origin,
  note: "One client/location; Node has no browser HTTP cache. First sample is not necessarily a cold edge cache. Timings include this client's network, not a global benchmark.",
  assets,
}, null, 2));
