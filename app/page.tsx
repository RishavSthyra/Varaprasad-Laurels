import HomePageClient from "@/components/HomePageClient";
import { buildPageMetadata } from "@/lib/metadata";
import { HOME_HERO_IMAGE_SRC } from "@/lib/home-hero";

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
      <link
        rel="preload"
        as="image"
        href={HOME_HERO_IMAGE_SRC}
        fetchPriority="high"
      />
      <HomePageClient imageSrc={HOME_HERO_IMAGE_SRC} />
    </>
  );
}
