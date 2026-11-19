import { CustomStyleExample } from "@/components/MapComponent";
import React from "react";
import { buildPageMetadata } from "@/lib/metadata";
import { areaMapPhotoAssets } from "@/lib/area-map-photo-assets";
import { signR2AssetKeys } from "@/lib/server/r2-signed-assets";

export const metadata = buildPageMetadata({
  title: "Area Map",
  description:
    "Explore the surrounding area, nearby landmarks, and location context for the Laurels villa estate.",
  keywords: [
    "area map",
    "location map",
    "nearby landmarks",
    "Laurels villa estate location",
  ],
});

export default function page() {
  // Sign URLs on the server so thumbnails have their final cloud src in the
  // first HTML response, without a client-side signing request/waterfall.
  const signedUrls = signR2AssetKeys(areaMapPhotoAssets.map((asset) => asset.key));
  const photoUrls = Object.fromEntries(areaMapPhotoAssets.map((asset) => [asset.localPath, signedUrls[asset.key]]));
  return (
    <React.Fragment>
      <CustomStyleExample photoUrls={photoUrls} />
    </React.Fragment>
  );
}
