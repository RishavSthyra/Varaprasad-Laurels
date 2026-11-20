import ExteriorPanoWalkthrough from "@/components/tour/ExteriorPanoWalkthrough";
import exteriorNodes from "@/data/Varaprasad_Exterior_Pano_Data_v1.json";
import { remainingExteriorNodes } from "@/lib/exterior-tour/remaining";
import { buildPageMetadata } from "@/lib/metadata";
import {
  getAssetWorkerDomain,
  signR2AssetKey,
} from "@/lib/server/r2-signed-assets";
import type { ExteriorPanoNodeSource } from "@/lib/exterior-tour/types";
import { getPublishedDeveloperRuntimeConfig } from "@/lib/developer-config";
import { exteriorImageFilenameToPanoId } from "@/lib/exterior-tour/nodes";
import { getVillaPointers } from "@/lib/exterior-tour/villa-hotspots";
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
        href="/vp_cons_images_Cropped.webp"
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

export default async function ExteriorTourPage({
  searchParams,
}: {
  searchParams: Promise<{ pano?: string | string[] }>;
}) {
  const query = await searchParams;
  const runtimeConfig = await getPublishedDeveloperRuntimeConfig();
  const exterior = {
    ...runtimeConfig.exterior,
    panoBasePath: EXTERIOR_PANO_ASSET_BASE_URL,
    initialNodeId: EXTERIOR_ASSET_INITIAL_NODE_ID,
    nodes: [...exteriorNodes, ...remainingExteriorNodes],
  };
  const exteriorTourNodes: ExteriorPanoNodeSource[] = exterior.nodes.filter((node) => !isIgnoredExteriorPano(node));
  const requestedPanoNumber = typeof query.pano === "string" && /^\d{1,4}$/.test(query.pano)
    ? Number(query.pano) : null;
  // Match the visible player counter, not the zero-based asset folder number.
  const requestedNode = requestedPanoNumber === null ? undefined
    : exteriorTourNodes[requestedPanoNumber - 1];
  const previewPointer = requestedNode ? getVillaPointers(requestedNode.id)[0] : undefined;
  const preferredInitialNodeId =
    requestedNode?.id ??
    (exterior.initialNodeId && exteriorTourNodes.find((node) => node.id === exterior.initialNodeId)?.id) ??
    exteriorTourNodes[0]?.id;
  const initialPreviewKey = requestedNode
    ? `${requestedNode.asset_base_path ?? exterior.panoBasePath}/${requestedNode.pano_id ?? exteriorImageFilenameToPanoId(requestedNode.image_filename)}/preview.jpg`
    : EXTERIOR_ASSET_INITIAL_PREVIEW_KEY;
  const initialPreviewUrl = initialPreviewKey.startsWith("/") ? initialPreviewKey : signR2AssetKey(initialPreviewKey);
  const signedExteriorMenuAssets = {
    [initialPreviewKey]: initialPreviewUrl,
  };

  return (
    <main className="relative h-[100svh] min-h-[100svh] w-full overflow-hidden bg-[#040608]">
      <ExteriorWalkthroughHead initialPreviewUrl={initialPreviewUrl} />

      <div className="absolute inset-0">
        <ExteriorPanoWalkthrough
          key={preferredInitialNodeId}
          nodes={exteriorTourNodes}
          cdnBaseUrl={exterior.panoBasePath}
          initialNodeId={preferredInitialNodeId}
          initialYawOffsetDegrees={requestedNode
            ? (previewPointer ? previewPointer.position.yawDegrees - requestedNode.yaw
              // New images already face their exported camera heading. The
              // viewer uses local yaw; don't apply the world heading twice.
              : requestedNode.route_id ? -requestedNode.yaw : 0)
            : 172}
          initialSignedAssetUrls={signedExteriorMenuAssets}
          amenities={[]}
          showAmenities={false}
          className="h-full w-full rounded-none"
          title={exterior.title}
          subtitle={exterior.subtitle}
        />
      </div>
    </main>
  );
}
