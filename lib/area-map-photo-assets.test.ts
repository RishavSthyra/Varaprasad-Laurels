import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import photos from "../public/data/laurels-poi-photos.json";
import { areaMapPhotoAssets, getAreaMapPhotoKey, getAreaMapPhotoUrl, AREA_MAP_PHOTO_PLACEHOLDER } from "./area-map-photo-assets";

test("all 27 original photos and 27 thumbnails resolve to their exact uploaded R2 keys", () => {
  assert.equal(areaMapPhotoAssets.length, 54);
  assert.equal(new Set(areaMapPhotoAssets.map((asset) => asset.key)).size, 54);
  for (const photo of photos) for (const localPath of [photo.image, photo.thumbnail]) {
    assert.equal(getAreaMapPhotoKey(localPath), `Varaprasad_Laurels/Images/laurels/${localPath.split("/").at(-1)}`);
    const asset = areaMapPhotoAssets.find((asset) => asset.localPath === localPath)!;
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);
    assert(asset.bytes > 0);
  }
  assert.equal(getAreaMapPhotoKey("/images/poi/laurels/310-v2-thumb.avif"), "Varaprasad_Laurels/Images/laurels/310-v2-thumb.avif");
});

test("photo rendering never falls back to a local photograph or unsafe path", () => {
  const local = photos[0].image;
  const url = "https://example.workers.dev/Varaprasad_Laurels/Images/laurels/301.avif?sig=test";
  assert.equal(getAreaMapPhotoUrl(local, { [local]: url }), url);
  assert.equal(getAreaMapPhotoUrl(local, {}), AREA_MAP_PHOTO_PLACEHOLDER);
  assert.equal(getAreaMapPhotoUrl(undefined, {}), AREA_MAP_PHOTO_PLACEHOLDER);
  for (const invalid of ["/images/poi/laurels/../secret.avif", "/foo/301.avif", "https://example.com/301.avif"]) {
    assert.throws(() => getAreaMapPhotoKey(invalid), /Unrecognized/);
  }
});

test("desktop and mobile thumbnails/cards share server-signed cloud URLs", () => {
  const page = fs.readFileSync("app/area-map/page.tsx", "utf8");
  const component = fs.readFileSync("components/MapComponent.tsx", "utf8");
  assert(page.includes("signR2AssetKeys(areaMapPhotoAssets.map"));
  assert(page.includes("photoUrls={photoUrls}"));
  assert.equal((component.match(/<PoiDetailsCard photoUrls=\{photoUrls\}/g) ?? []).length, 2);
  assert.equal((component.match(/getPoiImage\(poi, photoUrls\)/g) ?? []).length, 2);
  assert(component.includes("getAreaMapPhotoUrl(poi.image, photoUrls)"));
  assert(!component.includes("<img src={poi.image}"));
});
