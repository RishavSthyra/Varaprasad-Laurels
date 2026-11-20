import { buildPageMetadata } from "@/lib/metadata";
import MasterPlanLayout from "@/components/MasterPlanLayout";
import { getVillaInventoryApartments } from "@/lib/villas";
import {
  getAssetWorkerDomain,
  signR2AssetKeys,
} from "@/lib/server/r2-signed-assets";
import { filterSignableAssetKeys } from "@/lib/master-plan-asset-keys";
import preview from "@/data/masterplan-preview.json";
import { MASTERPLAN_COMPACT_MEDIA, MASTERPLAN_DESKTOP_MEDIA } from "@/components/MasterPlanPreview";
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

export default function MasterPlanPage() {
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

  return (
    <div className="relative app-shell bg-[#00142b]">
      <link rel="preconnect" href={workerDomain} crossOrigin="anonymous" />
      <link rel="dns-prefetch" href={workerDomain} />
      <link rel="preconnect" href="https://cdn.sthyra.com" crossOrigin="anonymous" />
      <link
        rel="preload"
        as="image"
        href={preview.mobile}
        media={MASTERPLAN_COMPACT_MEDIA}
        fetchPriority="high"
      />
      <link rel="preload" as="image" href={preview.desktop} media={MASTERPLAN_DESKTOP_MEDIA} fetchPriority="high" />
      <link
        rel="preload"
        as="fetch"
        href={VILLA_MASTERPLAN_MODEL_URL}
        crossOrigin="anonymous"
        fetchPriority="low"
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
