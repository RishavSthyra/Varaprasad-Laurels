import { unstable_cache } from "next/cache";
import MasterPlanLayout from "@/components/MasterPlanLayout";
import { buildPageMetadata } from "@/lib/metadata";
import { getInventoryApartments } from "@/lib/inventory";
import {
  filterSignableAssetKeys,
  isLocalAssetKey,
  isRemoteAssetUrl,
  toLocalPublicAssetPath,
} from "@/lib/master-plan-asset-keys";
import { getOrbitPreviewMasterPlanConfig } from "@/lib/master-plan-orbit-preview";
import {
  getAssetWorkerDomain,
  signR2AssetKeys,
} from "@/lib/server/r2-signed-assets";
import { TOWER_SELECTION_IMAGE_URL } from "@/lib/tower-selection-assets";
import type { InventoryApartment } from "@/types/inventory";

const NEW_MASTER_PLAN_ORBIT_VIDEO_URL =
  "https://cdn.sthyra.com/TULA/Videos/1234_GOP2_SCRUB_OPTIMIZED.mp4";

const NEW_MASTER_PLAN_FALLBACK_IMAGE_URL =
  "https://cdn.sthyra.com/TULA/Images/1234_GOP3_SCRUB_OPTIMIZED_first_frame%20%281%29.avif";

const NEW_MASTER_PLAN_HOTSPOT_FRAMES = [0, 91, 153, 240] as const;

const NEW_MASTER_PLAN_HOTSPOT_KEYS = ["A1", "A4", "A3", "A2"] as const;

const NEW_MASTER_PLAN_MAX_METERS_CALIBRATION = {
  cameraStops: [
    {
      frame:  0,
      position: { x: 74.017, y:-75.83, z: 34.018 },
      // projectionOffsetY: 0.1,
      rotationDegrees: { x: 82.557, y: 0, z: 6.088 },
      // rotationDegrees: { x: 88.867, y: 0, z: -2.406 },
    },
    {
      frame: 90,
      position: { x: -114.475, y: 56.875, z: 28.284 },
      rotationDegrees: { x: 83.609, y: 0, z: -89.617 },
    },
    {
      frame: 153,
      position: { x: 5.813, y: 166.065, z: 28.284 },
      rotationDegrees: { x: -85.308, y: -180, z: 0.989 },
    },
    {
      frame: 240,
      position: { x: 179.771, y: 30.479, z: 20.163 },
      rotationDegrees: { x: 92.103, y: 0, z: 88.682 },
    },
  ],
  dummyAnchors: [
    { x: 90.522, y: 58.165, z: 1.276 },
    { x: -71.603, y: 78.157, z: 1.276 },
  ],
} as const;

export const metadata = buildPageMetadata({
  title: "Master Plan New",
  description:
    "Explore the Laurels villa estate plan with the updated interactive orbit.",
});

export const revalidate = 30;

const getCachedInventoryApartments = unstable_cache(
  getInventoryApartments,
  ["master-plan-inventory"],
  {
    revalidate: 30,
    tags: ["inventory"],
  },
);

type MasterPlanSearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: MasterPlanSearchParams, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function readFiniteSearchNumber(
  searchParams: MasterPlanSearchParams,
  key: string,
) {
  const value = Number(readSearchParam(searchParams, key));
  return Number.isFinite(value) ? value : undefined;
}

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

export default async function NewMasterPlanPage({
  searchParams,
}: {
  searchParams: Promise<MasterPlanSearchParams>;
}) {
  let initialApartments: InventoryApartment[] = [];

  try {
    initialApartments = await getCachedInventoryApartments();
  } catch {
    console.error("Failed to load master plan inventory.");
  }

  const workerDomain = getAssetWorkerDomain();
  const resolvedSearchParams = await searchParams;
  const allowOrbitDebug = process.env.NODE_ENV === "development";
  let masterPlan = getOrbitPreviewMasterPlanConfig({
    fov: 90,
    hotspotFrames: NEW_MASTER_PLAN_HOTSPOT_FRAMES,
    hotspotKeys: NEW_MASTER_PLAN_HOTSPOT_KEYS,
    maxMetersCalibration: NEW_MASTER_PLAN_MAX_METERS_CALIBRATION,
    ...(allowOrbitDebug
      ? {
          debugModel:
            readSearchParam(resolvedSearchParams, "orbitDebug") === "1",
          fov:
            readFiniteSearchNumber(resolvedSearchParams, "orbitFov") ?? 90,
          modelOffset: {
            x: readFiniteSearchNumber(resolvedSearchParams, "modelX"),
            y: readFiniteSearchNumber(resolvedSearchParams, "modelY"),
            z: readFiniteSearchNumber(resolvedSearchParams, "modelZ"),
          },
          modelScaleMultiplier: readFiniteSearchNumber(
            resolvedSearchParams,
            "modelScale",
          ),
          modelYawOffsetDegrees: readFiniteSearchNumber(
            resolvedSearchParams,
            "modelYaw",
          ),
        }
      : {}),
  });

  masterPlan = {
    ...masterPlan,
    fallbackImageKey: NEW_MASTER_PLAN_FALLBACK_IMAGE_URL,
    interactionVideoKey: NEW_MASTER_PLAN_ORBIT_VIDEO_URL,
    mediaFit: "cover",
    reverseHotspotDirection: false,
    scrubVideoKey: NEW_MASTER_PLAN_ORBIT_VIDEO_URL,
  };

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
  const masterPlanVideoUrl = resolveMasterPlanAssetUrl(
    masterPlan.scrubVideoKey,
    signedMasterPlanCriticalAssets,
  );

  return (
    <div className="relative app-shell bg-black">
      <link rel="preconnect" href={workerDomain} crossOrigin="anonymous" />
      <link rel="dns-prefetch" href={workerDomain} />
      <link
        rel="preload"
        as="image"
        href={masterPlanFallbackUrl}
        fetchPriority="high"
      />
      <link rel="preload" as="video" href={masterPlanVideoUrl} />
      <link
        rel="preload"
        as="image"
        href={TOWER_SELECTION_IMAGE_URL}
        fetchPriority="high"
      />
      <MasterPlanLayout
        initialApartments={initialApartments}
        initialSignedAssetUrls={signedMasterPlanCriticalAssets}
        masterPlanConfig={masterPlan}
      />
    </div>
  );
}
