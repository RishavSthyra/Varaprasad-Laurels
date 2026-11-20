import HomePageClient from "@/components/HomePageClient";
import { buildPageMetadata } from "@/lib/metadata";
import { HOME_HERO_IMAGE_SRC, HOME_HERO_VIDEO_SRC, HOME_HERO_REVERSE_VIDEO_SRC } from "@/lib/home-hero";

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

export default function HomePage() {
  return (
    <>
      <link rel="preconnect" href="https://cdn.sthyra.com" crossOrigin="anonymous" />
      {/* Restore persistent assets before assigning a CDN source. An unconditional
          preload here would redownload media even on a cache-only return visit. */}
      <HomePageClient imageSrc={HOME_HERO_IMAGE_SRC} videoSrc={HOME_HERO_VIDEO_SRC} reverseVideoSrc={HOME_HERO_REVERSE_VIDEO_SRC} />
    </>
  );
}
