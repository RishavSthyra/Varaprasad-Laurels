// One-time, rate-limited asset preparation. Never deletes files or touches cloud storage.
// node scripts/prepare-laurels-area-map.mjs --images
// node scripts/prepare-laurels-area-map.mjs --routes
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const project = JSON.parse(await fs.readFile(path.join(root, "data/area-map-project.json"), "utf8"));
const pois = JSON.parse(await fs.readFile(path.join(root, "data/poi.json"), "utf8"));
const imageDir = path.join(root, "public/images/poi/laurels");
const dataDir = path.join(root, "public/data");
const headers = { "User-Agent": "LaurelsAreaMap/1.0 (one-time project POI asset preparation)" };
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const plainText = (value = "") => value.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
function licenseLink(license, url) {
  if (url) return url.replace(/^http:/, "https:");
  if (license === "CC0") return "https://creativecommons.org/publicdomain/zero/1.0/";
  if (license === "Public domain") return "https://creativecommons.org/publicdomain/mark/1.0/";
  return null;
}

async function fetchBytes(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(25000) });
    if (response.status === 429 || response.status === 503) {
      if (attempt < 2) {
        await delay(Math.min(Number(response.headers.get("retry-after")) * 1000 || 5000, 15000));
        continue;
      }
    }
    if (!response.ok) throw new Error(`${response.status}: ${url}`);
    return Buffer.from(await response.arrayBuffer());
  }
  throw new Error(`Could not retrieve ${url}`);
}

async function photoSource(poi, previous) {
  // Reuse a previously verified source when rebuilding deleted local assets.
  // Keep the original photo/credit instead of repeating discovery or changing it.
  if (previous?.sourceImage && previous.sourcePage && previous.credit &&
    (poi.photo.provider === "commons"
      ? previous.title === poi.photo.title && /^(CC0|CC BY|Public domain)/.test(previous.license)
      : previous.sourceImage === poi.photo.sourceImage)) {
    const { title, sourceImage, sourcePage, credit, license, licenseUrl, permissionStatus } = previous;
    return { ...(title ? { title } : {}), sourceImage, sourcePage, credit, license,
      licenseUrl: licenseLink(license, licenseUrl), permissionStatus };
  }
  if (poi.photo.provider === "official") {
    return {
      sourceImage: poi.photo.sourceImage,
      sourcePage: poi.photo.sourcePage,
      credit: poi.photo.credit,
      license: "Copyright retained by source",
      licenseUrl: null,
      permissionStatus: "No public reuse licence found; publisher permission should be checked before public deployment",
    };
  }
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query", titles: poi.photo.title, prop: "imageinfo",
    iiprop: "url|size|extmetadata", iiurlwidth: "1280", format: "json",
  }).toString();
  const data = JSON.parse((await fetchBytes(url)).toString());
  const page = Object.values(data.query?.pages ?? {})[0];
  let info = page?.imageinfo?.[0];
  if (!info) throw new Error(`No Commons photograph: ${poi.photo.title}`);
  // Commons returns the original host for small originals. Request the nearest
  // smaller supported thumbnail size instead of repeatedly hitting that host.
  if (new URL(info.thumburl ?? info.url).hostname === "upload.wikimedia.org") {
    await delay(1100);
    url.searchParams.set("iiurlwidth", String(info.width > 960 ? 960 : info.width > 500 ? 500 : 330));
    const resized = JSON.parse((await fetchBytes(url)).toString());
    info = Object.values(resized.query?.pages ?? {})[0]?.imageinfo?.[0] ?? info;
  }
  const metadata = info.extmetadata;
  const license = plainText(metadata?.LicenseShortName?.value);
  if (!/^(CC0|CC BY|Public domain)/.test(license)) throw new Error(`Review photo licence: ${poi.photo.title} (${license})`);
  return {
    title: poi.photo.title,
    sourceImage: info.thumburl ?? info.url,
    sourcePage: info.descriptionurl,
    credit: plainText(metadata?.Artist?.value || metadata?.Credit?.value || "Wikimedia Commons contributor"),
    license,
    licenseUrl: licenseLink(license, metadata?.LicenseUrl?.value),
    permissionStatus: "Public reuse licence recorded from Wikimedia Commons",
  };
}

async function prepareImages() {
  await fs.mkdir(imageDir, { recursive: true });
  await fs.mkdir(dataDir, { recursive: true });
  const manifestPath = path.join(dataDir, "laurels-poi-photos.json");
  const previous = JSON.parse(await fs.readFile(manifestPath, "utf8").catch(() => "[]"));
  const records = [];
  let failed = false;
  for (const poi of pois) {
    try {
      const old = previous.find((record) => record.id === poi.id);
      const stem = poi.photo.version ? `${poi.id}-v${poi.photo.version}` : String(poi.id);
      const localImage = `/images/poi/laurels/${stem}.avif`;
      const file = path.join(imageDir, `${stem}.avif`);
      const thumbFile = path.join(imageDir, `${stem}-thumb.avif`);
      if (old?.image === localImage && await fs.access(file).then(() => true, () => false) && await fs.access(thumbFile).then(() => true, () => false)) {
        if ((poi.photo.title && old.title !== poi.photo.title) || (poi.photo.sourceImage && old.sourceImage !== poi.photo.sourceImage)) throw new Error("Photo source changed. Increment photo.version to preserve the previous asset.");
        const bytes = await fs.readFile(file);
        const thumbBytes = await fs.readFile(thumbFile);
        if (sha256(bytes) === old.sha256 && sha256(thumbBytes) === old.thumbnailSha256) {
          records.push({ ...old, licenseUrl: licenseLink(old.license, old.licenseUrl) });
          console.log(`Verified existing photo ${poi.id}: ${poi.name}`);
          continue;
        }
        throw new Error(`Existing photo has changed: ${file}. Review manually; refusing to overwrite it.`);
      }
      // New paths only: an interrupted run must never silently replace an existing asset.
      if (await fs.access(file).then(() => true, () => false)) throw new Error(`Unrecorded existing photo: ${file}`);
      const source = await photoSource(poi, old);
      await delay(1100);
      const input = await fetchBytes(source.sourceImage);
      const original = await sharp(input).metadata();
      if (!original.width || !original.height || original.width < 320 || original.height < 180) throw new Error(`Photo too small: ${poi.name}`);
      const main = await sharp(input).rotate().resize({ width: 1280, height: 1000, fit: "inside", withoutEnlargement: true })
        .toColourspace("srgb").avif({ quality: 72, effort: 6, chromaSubsampling: "4:4:4" }).toBuffer();
      const thumb = await sharp(input).rotate().resize({ width: 320, height: 240, fit: "inside", withoutEnlargement: true })
        .toColourspace("srgb").avif({ quality: 64, effort: 6, chromaSubsampling: "4:4:4" }).toBuffer();
      await fs.writeFile(file, main, { flag: "wx" });
      await fs.writeFile(thumbFile, thumb, { flag: "wx" });
      const meta = await sharp(main).metadata();
      records.push({
        id: poi.id, name: poi.name, ...source,
        image: localImage, thumbnail: `/images/poi/laurels/${stem}-thumb.avif`,
        width: meta.width, height: meta.height, bytes: main.length, thumbnailBytes: thumb.length,
        originalBytes: input.length, sha256: sha256(main), thumbnailSha256: sha256(thumb),
        changes: "Resized without enlargement, colour-normalized to sRGB, converted to AVIF; no subject alterations",
        retrievedAt: project.verifiedAt,
      });
      console.log(`Prepared ${poi.id}: ${poi.name} — ${Math.round(main.length / 1024)} KB + ${Math.round(thumb.length / 1024)} KB thumbnail`);
      // Save progress after every asset so a slow remote source does not lose completed work.
      await fs.writeFile(manifestPath, JSON.stringify([...records, ...previous.filter((item) => !records.some((record) => record.id === item.id))], null, 2) + "\n");
      await delay(1100);
    } catch (error) {
      failed = true;
      console.error(`${poi.id}: ${error.message}`);
    }
  }
  await fs.writeFile(manifestPath, JSON.stringify([...records, ...previous.filter((item) => !records.some((record) => record.id === item.id))], null, 2) + "\n");
  if (failed) process.exitCode = 1;
}

async function prepareRoutes() {
  const dir = path.join(dataDir, "laurels-routes");
  await fs.mkdir(dir, { recursive: true });
  let failed = false;
  for (const poi of pois) {
    const file = path.join(dir, `${poi.id}.json`);
    const signature = `${project.lng},${project.lat}:${poi.lng},${poi.lat}`;
    const old = JSON.parse(await fs.readFile(file, "utf8").catch(() => "null"));
    if (old?.signature === signature && old.coordinates?.length > 1) {
      console.log(`Verified existing route ${poi.id}`);
      continue;
    }
    if (old) throw new Error(`Existing route changed: ${file}. Review manually before replacing.`);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${project.lng},${project.lat};${poi.lng},${poi.lat}?overview=simplified&geometries=geojson&alternatives=false`;
      const result = JSON.parse((await fetchBytes(url)).toString());
      const route = result.routes?.[0];
      if (result.code !== "Ok" || !route?.geometry?.coordinates?.length) throw new Error(`No road route: ${result.code}`);
      const snapped = result.waypoints.map((waypoint) => ({ location: waypoint.location, distance: waypoint.distance }));
      const record = {
        id: poi.id, name: poi.name, signature, source: "OSRM / OpenStreetMap", calculatedAt: project.verifiedAt,
        duration: route.duration, distance: route.distance, coordinates: route.geometry.coordinates,
        snapped, note: "Modelled driving route, not live traffic. Start/end may snap to the nearest mapped road; private access and entrance locations must be checked.",
      };
      await fs.writeFile(file, JSON.stringify(record) + "\n", { flag: "wx" });
      console.log(`Road route ${poi.id}: ${(route.distance / 1000).toFixed(1)} km, ${Math.round(route.duration / 60)} min; snap ${snapped.map((p) => Math.round(p.distance)).join("/")} m`);
    } catch (error) {
      failed = true;
      console.error(`${poi.id}: ${error.message}`);
    }
    await delay(1200);
  }
  const metrics = [];
  for (const poi of pois) {
    const record = JSON.parse(await fs.readFile(path.join(dir, `${poi.id}.json`), "utf8").catch(() => "null"));
    if (record?.signature !== `${project.lng},${project.lat}:${poi.lng},${poi.lat}`) continue;
    const { coordinates, ...summary } = record;
    metrics.push({ ...summary, points: coordinates.length });
  }
  await fs.writeFile(path.join(dataDir, "laurels-route-metrics.json"), JSON.stringify(metrics, null, 2) + "\n");
  if (failed) process.exitCode = 1;
}

if (process.argv.includes("--images")) await prepareImages();
else if (process.argv.includes("--routes")) await prepareRoutes();
else throw new Error("Pass --images or --routes. This script never uploads or deletes assets.");
