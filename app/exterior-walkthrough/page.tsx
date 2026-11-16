import ExteriorPanoWalkthrough from "@/components/tour/ExteriorPanoWalkthrough";
import { exteriorAmenities as canonicalExteriorAmenities } from "@/data/exteriorAmenities";
import exteriorNodes from "@/data/Varaprasad_Exterior_Pano_Data_v1.json";
import { buildPageMetadata } from "@/lib/metadata";
import {
  getAssetWorkerDomain,
  signR2AssetKey,
} from "@/lib/server/r2-signed-assets";
import type { ExteriorPanoNodeSource } from "@/lib/exterior-tour/types";
import { getPublishedDeveloperRuntimeConfig } from "@/lib/developer-config";
import {
  EXTERIOR_ASSET_INITIAL_NODE_ID,
  EXTERIOR_ASSET_INITIAL_PREVIEW_KEY,
  EXTERIOR_PANO_ASSET_BASE_URL,
} from "@/lib/exterior-tour/assets";

function isIgnoredExteriorPano(node: ExteriorPanoNodeSource) {
  return (
    /\.0000(?:\.[^/.]+)?$/i.test(node.id) ||
    /\.0000(?:\.[^/.]+)?$/i.test(node.image_filename)
  );
}

export const metadata = buildPageMetadata({
  title: "Exterior Walkthrough",
  description:
    "Experience the Laurels villa estate through an immersive exterior panoramic walkthrough.",
  keywords: [
    "exterior walkthrough",
    "panorama tour",
    "site walkthrough",
    "Laurels villa estate exterior",
  ],
});

function ExteriorWalkthroughHead({ initialPreviewUrl }: { initialPreviewUrl?: string }) {
  const workerDomain = getAssetWorkerDomain();

  return (
    <>
      <link rel="preconnect" href={workerDomain} crossOrigin="anonymous" />
      <link rel="dns-prefetch" href={workerDomain} />
      <link
        rel="preload"
        as="image"
        href="/vp_cons_images.webp"
        fetchPriority="high"
      />
      {initialPreviewUrl ? <link
        rel="preload"
        as="image"
        href={initialPreviewUrl}
        crossOrigin="anonymous"
        fetchPriority="high"
      /> : null}
    </>
  );
}

export default async function ExteriorTourPage() {
  const runtimeConfig = await getPublishedDeveloperRuntimeConfig();
  const exterior = {
    ...runtimeConfig.exterior,
    panoBasePath: EXTERIOR_PANO_ASSET_BASE_URL,
    initialNodeId: EXTERIOR_ASSET_INITIAL_NODE_ID,
    nodes: exteriorNodes,
  };
  const exteriorTourNodes = exterior.nodes.filter((node) => !isIgnoredExteriorPano(node));
  const preferredInitialNodeId =
    (exterior.initialNodeId && exteriorTourNodes.find((node) => node.id === exterior.initialNodeId)?.id) ??
    exteriorTourNodes[0]?.id;
  const initialPreviewUrl = signR2AssetKey(EXTERIOR_ASSET_INITIAL_PREVIEW_KEY);
  const signedExteriorMenuAssets = {
    [EXTERIOR_ASSET_INITIAL_PREVIEW_KEY]: initialPreviewUrl,
    ...Object.fromEntries(
      canonicalExteriorAmenities.map((amenity) => [
        amenity.image,
        signR2AssetKey(amenity.image),
      ]),
    ),
  };

  return (
    <main className="relative h-[100svh] min-h-[100svh] w-full overflow-hidden bg-[#040608]">
      <ExteriorWalkthroughHead initialPreviewUrl={initialPreviewUrl} />

      <div className="absolute inset-0">
        <ExteriorPanoWalkthrough
          nodes={exteriorTourNodes}
          cdnBaseUrl={exterior.panoBasePath}
          initialNodeId={preferredInitialNodeId}
          initialYawOffsetDegrees={172}
          initialSignedAssetUrls={signedExteriorMenuAssets}
          amenities={canonicalExteriorAmenities}
          className="h-full w-full rounded-none"
          title={exterior.title}
          subtitle={exterior.subtitle}
        />
      </div>
    </main>
  );
}
