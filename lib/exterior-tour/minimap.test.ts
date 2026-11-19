import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { EXTERIOR_MINIMAP_IMAGE_LAYOUT, EXTERIOR_MINIMAP_IMAGE_URL } from "../../data/exteriorMinimap";

test("compact and expanded exterior minimaps use the cloud ortho image", () => {
  assert.equal(EXTERIOR_MINIMAP_IMAGE_URL, "https://cdn.sthyra.com/Varaprasad_Laurels/Images/ortho.avif");
  assert.deepEqual(EXTERIOR_MINIMAP_IMAGE_LAYOUT, { width: 3840, height: 2160 });
  assert.equal(EXTERIOR_MINIMAP_IMAGE_LAYOUT.width / EXTERIOR_MINIMAP_IMAGE_LAYOUT.height, 16 / 9);
  const viewer = readFileSync("components/tour/ExteriorPanoWalkthrough.tsx", "utf8");
  assert(viewer.includes("const signedMinimapImageUrl = EXTERIOR_MINIMAP_IMAGE_URL"));
  assert(viewer.includes("src={minimapImageSrc}"));
});
