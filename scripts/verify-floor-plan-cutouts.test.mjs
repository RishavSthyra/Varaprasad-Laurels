import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { FLOOR_PLAN_CUTOUT_SOURCES } from "./lib/floor-plan-cutout-sources.mjs";

for (const source of FLOOR_PLAN_CUTOUT_SOURCES) {
  const plans = JSON.parse(await fs.readFile(`data/${source.group}-floor-plans.json`, "utf8"));
  const plan = plans.find(plan => plan.id === source.id);
  test(`${source.group} ${plan.id}: user cutout, high-quality AVIF, unchanged canvas/POIs, local alpha assets`, async () => {
    assert.equal(plan.image, source.image);
    assert.equal(plan.thumbnail, source.thumbnail);
    const { data: before, info } = await sharp(source.input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { data: after, info: outputInfo } = await sharp(path.join("public", plan.image)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, plan.width);
    assert.equal(info.height, plan.height);
    assert.equal(outputInfo.width, plan.width);
    assert.equal(outputInfo.height, plan.height);
    let alphaError = 0, rgbError = 0, opaqueChannels = 0, emptyPixels = 0, retainedEmpty = 0;
    for (let offset = 0; offset < before.length; offset += 4) {
      alphaError += Math.abs(after[offset + 3] - before[offset + 3]);
      if (before[offset + 3] === 0) {
        emptyPixels++;
        if (after[offset + 3] < 8) retainedEmpty++;
      }
      if (before[offset + 3] === 255) {
        for (let channel = 0; channel < 3; channel++) rgbError += Math.abs(after[offset + channel] - before[offset + channel]);
        opaqueChannels += 3;
      }
    }
    assert(emptyPixels > 0 && retainedEmpty / emptyPixels > 0.999, "User's removed background stays transparent");
    // AVIF is intentionally visually high-quality/lossy, not bit-identical RGB.
    // Tiny antialiasing differences at alpha edges must not turn into a new mask.
    assert(alphaError / (info.width * info.height) < 0.1, "Preserve the user's alpha silhouette");
    assert(rgbError / opaqueChannels < 2.5, "Bound visible RGB compression error on 0–255 channels");
    for (const marker of plan.markers) {
      const x = Math.round(marker.left / 100 * (info.width - 1));
      const y = Math.round(marker.top / 100 * (info.height - 1));
      const offset = (y * info.width + x) * 4 + 3;
      // The supplied terrace PNG intentionally also has a transparent open
      // terrace (reference 63). Preserve that source instead of filling it in.
      assert(Math.abs(before[offset] - after[offset]) <= 2, `Reference ${marker.number} keeps the supplied alpha`);
    }
    const size = (await fs.stat(path.join("public", plan.image))).size;
    assert(size < (await fs.stat(source.input)).size * 0.3, "Full AVIF is at least 70% smaller than the source PNG");
    const metadata = await sharp(path.join("public", plan.image)).metadata();
    assert.equal(metadata.compression, "av1");
    assert.equal(metadata.hasAlpha, true);
    const thumbnail = await sharp(path.join("public", plan.thumbnail)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert(Math.max(thumbnail.info.width, thumbnail.info.height) <= 640);
    let transparent = 0;
    for (let i = 3; i < thumbnail.data.length; i += 4) if (thumbnail.data[i] === 0) transparent++;
    assert(transparent > 0, "Thumbnail must retain outer transparency too");
  });
}
