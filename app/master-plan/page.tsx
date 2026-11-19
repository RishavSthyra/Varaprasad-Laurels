import { buildPageMetadata } from "@/lib/metadata";
import MasterPlanLayout from "@/components/MasterPlanLayout";
import { getVillaInventoryApartments } from "@/lib/villas";
import {
  getAssetWorkerDomain,
  signR2AssetKeys,
} from "@/lib/server/r2-signed-assets";
import {
  filterSignableAssetKeys,
  isLocalAssetKey,
  isRemoteAssetUrl,
  toLocalPublicAssetPath,
} from "@/lib/master-plan-asset-keys";
import { TOWER_SELECTION_IMAGE_URL } from "@/lib/tower-selection-assets";
import { getVillasMasterPlanConfig } from "@/lib/villas-master-plan-config";
import { VILLA_MASTERPLAN_MODEL_URL } from "@/lib/villa-masterplan-model";

export const metadata = buildPageMetadata({
  title: "Master Plan",
  description:
    "Explore the Laurels estate plan with interactive villa discovery, collection filters, and residence availability.",
  keywords: [
    "Laurels master plan",
    "interactive villa plan",
    "villa explorer",
    "estate layout",
  ],
});

export const revalidate = 30;

function resolveMasterPlanAssetUrl(
  key: string,
  signedUrls: Record<string, string>,
) {
  if (isLocalAssetKey(key)) {
    return toLocalPublicAssetPath(key);
  }

  if (isRemoteAssetUrl(key)) {
    return key;
  }

  return signedUrls[key] ?? key;
}

export default async function MasterPlanPage() {
  const initialApartments = getVillaInventoryApartments();

  const workerDomain = getAssetWorkerDomain();
  const masterPlan = getVillasMasterPlanConfig();
  const criticalAssetKeys = filterSignableAssetKeys([
    masterPlan.fallbackImageKey,
    masterPlan.scrubVideoKey,
    masterPlan.interactionVideoKey,
    ...Object.values(masterPlan.unitViewVideos).flatMap((video) => [
      video.forwardKey,
      video.reverseKey,
    ]),
  ]);
  const signedMasterPlanCriticalAssets =
    criticalAssetKeys.length > 0 ? signR2AssetKeys(criticalAssetKeys) : {};
  const masterPlanFallbackUrl = resolveMasterPlanAssetUrl(
    masterPlan.fallbackImageKey,
    signedMasterPlanCriticalAssets,
  );

  return (
    <div className="relative app-shell bg-[#00142b]">
      <link rel="preconnect" href={workerDomain} crossOrigin="anonymous" />
      <link rel="dns-prefetch" href={workerDomain} />
      <link rel="preconnect" href="https://cdn.sthyra.com" crossOrigin="anonymous" />
      <link
        rel="preload"
        as="image"
        href={masterPlanFallbackUrl}
        fetchPriority="high"
      />
      <link
        rel="preload"
        as="fetch"
        href={VILLA_MASTERPLAN_MODEL_URL}
        crossOrigin="anonymous"
      />
      <link
        rel="preload"
        as="image"
        href="/villa%20center%20image2.avif"
      />
      <link
        rel="preload"
        as="image"
        href="/villa%20corner%20image.avif"
      />
      <link
        rel="preload"
        as="image"
        href={TOWER_SELECTION_IMAGE_URL}
        fetchPriority="high"
      />
      <div className="">
        <MasterPlanLayout
          initialApartments={initialApartments}
          initialSignedAssetUrls={signedMasterPlanCriticalAssets}
          masterPlanConfig={masterPlan}
          inventoryMode="villas"
        />
      </div>
    </div>
  );
}
