import HomePageClient from "@/components/HomePageClient";
import { getPublishedDeveloperRuntimeConfig } from "@/lib/developer-config";
import { buildPageMetadata } from "@/lib/metadata";
import { VILLA_MASTERPLAN_VIDEO_KEY } from "@/lib/villa-masterplan-video";
import { signR2AssetKeys } from "@/lib/server/r2-signed-assets";

const HOME_FORWARD_VIDEO_URL =
  "https://cdn.sthyra.com/TULA/Videos/Home%20Page2.mp4";
const HOME_REVERSE_VIDEO_URL =
  "https://cdn.sthyra.com/TULA/Videos/Reverse%20Home%20Page.mp4";
const HOME_FIRST_FRAME_URL =
  "https://cdn.sthyra.com/TULA/Videos/Home%20Page2_first_frame.avif";

export const metadata = buildPageMetadata({
  title: "Laurels | Private Villa Estate",
  description: "Discover Laurels, a private villa estate by Vara Prasad Constructions.",
  keywords: [
    "Laurels villas",
    "Vara Prasad Constructions",
    "luxury villas",
    "master plan",
    "project overview",
    "villa walkthrough",
  ],
});

export default async function HomePage() {
  const runtimeConfig = await getPublishedDeveloperRuntimeConfig();
  const home = {
    ...runtimeConfig.home,
    heroVideoKey: HOME_FORWARD_VIDEO_URL,
    heroLoopVideoKey: HOME_REVERSE_VIDEO_URL,
    heroMobileFallbackKey: HOME_FIRST_FRAME_URL,
    heroStageFallbackKey: HOME_FIRST_FRAME_URL,
    heroPosterKey: HOME_FIRST_FRAME_URL,
    masterPlanWarmupVideoKey: VILLA_MASTERPLAN_VIDEO_KEY,
  };
  // Seed CDN-backed R2 URLs on the server, without a hydration-time API trip.
  const signedHomeCriticalAssets = signR2AssetKeys([
    home.heroVideoKey,
    home.heroLoopVideoKey,
    home.heroMobileFallbackKey,
    home.heroStageFallbackKey,
    home.heroPosterKey,
    home.heroLogoKey,
  ]);

  return (
    <>
      <link
        rel="preload"
        as="image"
        href={signedHomeCriticalAssets[home.heroPosterKey]}
        fetchPriority="high"
      />
      <HomePageClient
        config={home}
        initialSignedAssetUrls={signedHomeCriticalAssets}
      />
    </>
  );
}
