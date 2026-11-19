import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import sharp from "sharp";
import sources from "../data/poi.json";
import credits from "../public/data/laurels-poi-photos.json";
import metrics from "../public/data/laurels-route-metrics.json";
import {
  areaMapProject, areaMapPois, straightLineDistance, googleMapsDirections,
  getAreaMapBounds, isValidPoiRoute, poiRouteSignature, getPoiRoadMetrics,
  AREA_MAP_INITIAL_ZOOM, getAnimatedRouteSegment,
} from "./area-map";

test("project pin is the exact owner-supplied Laurels location", () => {
  assert.equal(areaMapProject.lat, 17.455878751829474);
  assert.equal(areaMapProject.lng, 78.19507378655005);
  assert.equal(areaMapProject.name, "Varaprasad Laurels");
  assert.equal(new Set(areaMapPois.map((poi) => poi.id)).size, 27);
  assert.equal(new Set(areaMapPois.map((poi) => poi.category)).size, 8);
  for (const poi of areaMapPois) {
    assert(straightLineDistance(areaMapProject, poi) < 25000, `${poi.name} is in west Hyderabad, not the previous Bengaluru dataset`);
    assert(poi.coordinateSource.startsWith("https://"));
    assert(poi.description.length > 15);
  }
});

test("campus branches and approximate pins are explicitly distinguished", () => {
  const gaudium = areaMapPois.find((poi) => poi.id === 302)!;
  assert.equal(gaudium.lng, 78.2426406);
  assert.match(gaudium.name, /Kollur/);
  assert.match(areaMapPois.find((poi) => poi.id === 301)!.coordinateNote!, /Approximate/);
  const [southwest, northeast] = getAreaMapBounds();
  for (const point of [areaMapProject, ...areaMapPois]) {
    assert(point.lng >= southwest[0] && point.lng <= northeast[0]);
    assert(point.lat >= southwest[1] && point.lat <= northeast[1]);
  }
});

test("Google Maps directions use exact project and destination coordinates, with no API key", () => {
  const poi = areaMapPois[0];
  const url = new URL(googleMapsDirections(poi));
  assert.equal(url.hostname, "www.google.com");
  assert.equal(url.searchParams.get("api"), "1");
  assert.equal(url.searchParams.get("origin"), `${areaMapProject.lat},${areaMapProject.lng}`);
  assert.equal(url.searchParams.get("destination"), `${poi.lat},${poi.lng}`);
  assert.equal(url.searchParams.get("travelmode"), "driving");
  assert.equal(new URL(googleMapsDirections()).searchParams.has("origin"), false);
});

test("every POI has a verified local driving route, with honest modelled times", async () => {
  assert.equal(metrics.length, areaMapPois.length);
  for (const poi of areaMapPois) {
    const route = JSON.parse(await fs.readFile(`public/data/laurels-routes/${poi.id}.json`, "utf8"));
    assert(isValidPoiRoute(route, poi), `${poi.id}: road geometry and project/destination signature`);
    assert.equal(route.signature, poiRouteSignature(poi));
    assert(route.coordinates.length > 5, "Real road geometry rather than an invented 5-point curve");
    assert(route.distance > straightLineDistance(areaMapProject, poi) * 0.8);
    assert(route.snapped?.every((p) => p.distance < 300));
    assert.equal(getPoiRoadMetrics(poi)?.distance, route.distance);
    assert.match(poi.timeLabel, /^~.+drive$/);
    assert.match(route.note ?? "", /not live traffic/);
  }
});

test("old-city, wrong-POI, moved-pin and malformed route caches are rejected", async () => {
  const poi = areaMapPois[0];
  const route = JSON.parse(await fs.readFile(`public/data/laurels-routes/${poi.id}.json`, "utf8"));
  assert(!isValidPoiRoute({ ...route, signature: "77.63,13.15:77.7,13.2" }, poi));
  assert(!isValidPoiRoute({ ...route, id: 201 }, poi));
  assert(!isValidPoiRoute({ ...route, duration: NaN }, poi));
  assert(!isValidPoiRoute({ ...route, coordinates: [[77.63, 13.15], [77.7, 13.2]] }, poi));
  assert(!isValidPoiRoute({ ...route, coordinates: [[78.19, 17.45], [78.5, 17.5]] }, poi));
  assert(!isValidPoiRoute(route, { ...poi, lat: poi.lat + 0.001 }));
  for (const invalid of [null, [], "route", 5, {}, { coordinates: [null] }]) assert(!isValidPoiRoute(invalid, poi));
});

test("all photos and lightweight thumbnails are real, decodable local AVIFs with source credits", async () => {
  assert.equal(credits.length, areaMapPois.length);
  const creditById = new Map(credits.map((photo) => [photo.id, photo]));
  let totalThumbnailBytes = 0;
  for (const poi of areaMapPois) {
    const photo = creditById.get(poi.id)!;
    assert(photo, `${poi.id}: photo credit exists`);
    assert.equal(poi.image, photo.image);
    assert.equal(poi.thumbnail, photo.thumbnail);
    assert(photo.sourcePage.startsWith("https://"));
    assert(photo.credit.length > 0);
    assert.match(photo.changes, /AVIF/);
    const bytes = await fs.readFile(`public${photo.image}`);
    const thumbnail = await fs.readFile(`public${photo.thumbnail}`);
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), photo.sha256);
    assert.equal(crypto.createHash("sha256").update(thumbnail).digest("hex"), photo.thumbnailSha256);
    const mainMeta = await sharp(bytes).metadata();
    const thumbMeta = await sharp(thumbnail).metadata();
    assert.equal(mainMeta.format, "heif");
    assert.equal(mainMeta.compression, "av1");
    assert(mainMeta.width! <= 1280 && mainMeta.height! <= 1000);
    assert(thumbMeta.width! <= 320 && thumbMeta.height! <= 240);
    await sharp(bytes).resize(32, 32).raw().toBuffer();
    await sharp(thumbnail).raw().toBuffer();
    totalThumbnailBytes += thumbnail.length;
    const source = sources.find((entry) => entry.id === poi.id)!;
    if (source.photo.provider === "commons") {
      assert.equal(photo.title, source.photo.title);
      assert.match(photo.license, /^(CC0|CC BY|Public domain)/);
      assert(photo.licenseUrl?.startsWith("https://"));
    } else {
      assert.match(photo.permissionStatus, /permission should be checked/);
      assert.equal(photo.licenseUrl, null, "Do not falsely mark official-site photos as openly licensed");
    }
  }
  assert(totalThumbnailBytes < 500 * 1024, "Entire 27-place thumbnail set remains below 500 KB");
});

test("legacy assets remain on disk but are not referenced by the new map", async () => {
  assert((await fs.stat("public/images/poi/201-stonehill-international-school.avif")).size > 0);
  const component = await fs.readFile("components/MapComponent.tsx", "utf8");
  assert(!/Whisper of Trees|Trifecta Veranza|Bengaluru|\/RGA\.webp|"4\.4"|buildCurvedRoute/.test(component));
  assert(!component.includes("pLimit"), "No automatic route burst for all POIs");
  assert(component.includes('textFont="Noto Sans Regular"'), "Cluster font exists on both map styles");
});

test("the starting view stays close to Laurels and detail cards are compact and full bleed", async () => {
  assert.equal(AREA_MAP_INITIAL_ZOOM, 13.8);
  const component = await fs.readFile("components/MapComponent.tsx", "utf8");
  assert(component.includes("focusProject(map, 0, mode)"));
  assert(!component.includes("fitOverview("));
  assert(!component.includes("googleMapsDirections"));
  assert(!component.includes("Laurels · Mokila</span>"));
  assert(!component.includes("MetricPill"));
  assert(!component.includes("radial-gradient(circle_at_80%_86%"), "No blue tint over the basemap");
  assert(!component.includes("function PhotoCredit("));
  assert(!component.includes("MapCredits"), "Trial has no custom credits icon or popup");
  assert(!component.includes("POIs & routes ©"), "No persistent bottom credits strip");
  assert(!component.includes('aria-label="Map and photo credits"'));
  const nextConfig = await fs.readFile("next.config.ts", "utf8");
  assert(nextConfig.includes("devIndicators: false"), "Development badge is hidden without suppressing errors");
  assert(component.includes('const routeBaseColor = "#f3ead2"'));
  assert(component.includes('const routeHighlightColor = "#2449a4"'));
  assert.equal((component.match(/<PoiDetailsCard\b/g) ?? []).length, 2, "Desktop/mobile use one shared card");
  const oldPois = JSON.parse(await fs.readFile("data/archive/poi-bengaluru.json", "utf8"));
  assert.equal(oldPois[0].id, 201, "Previous POI data is preserved");
  for (const poi of sources) {
    assert.equal(poi.image, areaMapPois.find((entry) => entry.id === poi.id)!.image);
    assert(poi.description.length <= 90, `${poi.id}: concise description`);
  }
});

test("3D is the default and reset mode without a delayed flat-camera race", async () => {
  const component = await fs.readFile("components/MapComponent.tsx", "utf8");
  assert(component.includes('const DEFAULT_MAP_DISPLAY_MODE: MapDisplayMode = "3d"'));
  assert(component.includes("useState<MapDisplayMode>(DEFAULT_MAP_DISPLAY_MODE)"));
  assert(component.includes("setMapDisplayMode(DEFAULT_MAP_DISPLAY_MODE)"));
  assert(!component.includes('setMapDisplayMode("normal")'));
  assert(component.includes("pitch={55}"));
  assert(component.includes("bearing={-18}"));
  assert(component.includes("...cameraForMode(mode)"));
  assert(!component.includes("}, 120)"), "Camera waits for map readiness, not a timer");
});

test("animated blue trail occupies only a short part of sparse or uneven routes", () => {
  for (const coordinates of [
    [[78, 17], [78.1, 17]],
    [[78, 17], [78.001, 17], [78.08, 17], [78.1, 17]],
  ] as [number, number][][]) {
    const segment = getAnimatedRouteSegment(coordinates, 0.5);
    assert(segment.length >= 2);
    assert(Math.abs(segment[segment.length - 1][0] - segment[0][0] - 0.016) < 0.000001);
    assert(segment[0][0] > coordinates[0][0]);
    assert(segment[segment.length - 1][0] < coordinates[coordinates.length - 1][0]);
    const nextSegment = getAnimatedRouteSegment(coordinates, 0.501);
    assert(nextSegment[0][0] > segment[0][0]);
    assert(nextSegment[0][0] - segment[0][0] < 0.001, "Continuous interpolation rather than vertex-sized jumps");
  }
  assert.deepEqual(getAnimatedRouteSegment([], 0.5), []);
  assert.deepEqual(getAnimatedRouteSegment([[78, 17]], 0.5), []);
  assert.deepEqual(getAnimatedRouteSegment([[78, 17], [78, 17]], 0.5), []);
  assert.deepEqual(getAnimatedRouteSegment([[78, 17], [78.1, 17]], NaN), []);
});
