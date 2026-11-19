import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import catalog from "@/data/amenitiesPage.json";
import {
  CDN_AMENITIES_FINAL_BASE_URL,
  isDirectAssetUrl,
  isHlsAssetUrl,
  resolveAmenitiesFinalAssetUrl,
} from "./amenities-final-assets";

test("Laurels assets default to split cloud paths independently of the old CDN setting", () => {
  const current = process.env.NEXT_PUBLIC_LAURELS_AMENITIES_VIDEO_BASE_URL;
  const poster = process.env.NEXT_PUBLIC_LAURELS_AMENITIES_POSTER_BASE_URL;
  const old = process.env.NEXT_PUBLIC_AMENITIES_FINAL_BASE_URL;
  try {
    delete process.env.NEXT_PUBLIC_LAURELS_AMENITIES_VIDEO_BASE_URL;
    delete process.env.NEXT_PUBLIC_LAURELS_AMENITIES_POSTER_BASE_URL;
    process.env.NEXT_PUBLIC_AMENITIES_FINAL_BASE_URL = "https://old.example/TULA";
    const local = "/varaprasad_amenities/videos/kids-play-area.mp4";
    assert.equal(resolveAmenitiesFinalAssetUrl(local), "Varaprasad_Laurels/Videos/videos/kids-play-area.mp4");
    assert.equal(resolveAmenitiesFinalAssetUrl("/varaprasad_amenities/first-frames/kids-play-area.avif"),
      "Varaprasad_Laurels/Images/first-frames/kids-play-area.avif");
    assert.equal(isDirectAssetUrl(resolveAmenitiesFinalAssetUrl(local)), false);
  } finally {
    if (current === undefined) delete process.env.NEXT_PUBLIC_LAURELS_AMENITIES_VIDEO_BASE_URL;
    else process.env.NEXT_PUBLIC_LAURELS_AMENITIES_VIDEO_BASE_URL = current;
    if (poster === undefined) delete process.env.NEXT_PUBLIC_LAURELS_AMENITIES_POSTER_BASE_URL;
    else process.env.NEXT_PUBLIC_LAURELS_AMENITIES_POSTER_BASE_URL = poster;
    if (old === undefined) delete process.env.NEXT_PUBLIC_AMENITIES_FINAL_BASE_URL;
    else process.env.NEXT_PUBLIC_AMENITIES_FINAL_BASE_URL = old;
  }
});

test("independent Laurels overrides redirect videos and posters and preserve boundaries", () => {
  const previous = process.env.NEXT_PUBLIC_LAURELS_AMENITIES_VIDEO_BASE_URL;
  const poster = process.env.NEXT_PUBLIC_LAURELS_AMENITIES_POSTER_BASE_URL;
  try {
    process.env.NEXT_PUBLIC_LAURELS_AMENITIES_VIDEO_BASE_URL = " https://assets.example/Videos/// ";
    process.env.NEXT_PUBLIC_LAURELS_AMENITIES_POSTER_BASE_URL = "Laurels/Images/first-frames/";
    assert.equal(resolveAmenitiesFinalAssetUrl("/varaprasad_amenities/videos/gym.mp4"),
      "https://assets.example/Videos/gym.mp4");
    assert.equal(resolveAmenitiesFinalAssetUrl("/varaprasad_amenities/first-frames/gym.avif"),
      "Laurels/Images/first-frames/gym.avif");
    process.env.NEXT_PUBLIC_LAURELS_AMENITIES_VIDEO_BASE_URL = "Varaprasad_Laurels/Videos/videos";
    const key = resolveAmenitiesFinalAssetUrl("/varaprasad_amenities/videos/gym.mp4");
    assert.equal(key, "Varaprasad_Laurels/Videos/videos/gym.mp4");
    assert.equal(isDirectAssetUrl(key), false, "R2 object keys must use the existing signing flow");
    assert.equal(resolveAmenitiesFinalAssetUrl("/varaprasad_amenities-other/video.mp4"),
      "/varaprasad_amenities-other/video.mp4");
    assert.equal(resolveAmenitiesFinalAssetUrl("/varaprasad_amenities/videos-other/video.mp4"),
      "/varaprasad_amenities/videos-other/video.mp4");
    assert.equal(resolveAmenitiesFinalAssetUrl("/varaprasad_amenities/first-frames-other/gym.avif"),
      "/varaprasad_amenities/first-frames-other/gym.avif");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_LAURELS_AMENITIES_VIDEO_BASE_URL;
    else process.env.NEXT_PUBLIC_LAURELS_AMENITIES_VIDEO_BASE_URL = previous;
    if (poster === undefined) delete process.env.NEXT_PUBLIC_LAURELS_AMENITIES_POSTER_BASE_URL;
    else process.env.NEXT_PUBLIC_LAURELS_AMENITIES_POSTER_BASE_URL = poster;
  }
});

test("legacy HLS and unrelated asset URLs keep their existing behavior", () => {
  const previous = process.env.NEXT_PUBLIC_AMENITIES_FINAL_BASE_URL;
  try {
    delete process.env.NEXT_PUBLIC_AMENITIES_FINAL_BASE_URL;
    assert.equal(resolveAmenitiesFinalAssetUrl("/AmenitiesGoodExpoOptimized/pool/master.m3u8"),
      `${CDN_AMENITIES_FINAL_BASE_URL}/pool/master.m3u8`);
    assert.equal(resolveAmenitiesFinalAssetUrl("https://other.example/clip.mp4"),
      "https://other.example/clip.mp4");
    assert.equal(isHlsAssetUrl("master.m3u8?sig=test"), true);
    assert.equal(isHlsAssetUrl("clip.mp4"), false);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_AMENITIES_FINAL_BASE_URL;
    else process.env.NEXT_PUBLIC_AMENITIES_FINAL_BASE_URL = previous;
  }
});

test("all 22 catalog pairs resolve to cloud keys and retain matching local copies", () => {
  assert.equal(catalog.items.length, 22);
  assert.equal(new Set(catalog.items.map(item => item.id)).size, 22);
  assert.equal(new Set(catalog.items.map(item => item.videoSrc)).size, 22);
  assert.equal(new Set(catalog.items.map(item => item.thumbnailSrc)).size, 22);
  for (const item of catalog.items) {
    assert.match(item.videoSrc, /^\/varaprasad_amenities\/videos\/[a-z0-9-]+\.mp4$/);
    assert.match(item.thumbnailSrc, /^\/varaprasad_amenities\/first-frames\/[a-z0-9-]+\.avif$/);
    assert.equal(path.basename(item.videoSrc, ".mp4"), path.basename(item.thumbnailSrc, ".avif"));
    assert.equal(resolveAmenitiesFinalAssetUrl(item.videoSrc),
      `Varaprasad_Laurels/Videos/videos/${path.basename(item.videoSrc)}`);
    assert.equal(resolveAmenitiesFinalAssetUrl(item.thumbnailSrc),
      `Varaprasad_Laurels/Images/first-frames/${path.basename(item.thumbnailSrc)}`);
    for (const url of [item.videoSrc, item.thumbnailSrc]) {
      assert(fs.statSync(path.join(process.cwd(), "public", url)).size > 0, `Missing asset: ${url}`);
    }
  }
});
