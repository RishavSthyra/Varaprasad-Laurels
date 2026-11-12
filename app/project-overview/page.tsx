import FlipBookDeck from "@/components/deck/FlipBookDeck";
import {
  BROCHURE_LAST_PAGE_SRC,
  BROCHURE_PRIORITY_PAGE_SRCS,
} from "@/lib/brochure-pages";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Project Overview",
  description:
    "Discover the Laurels private villa estate through its architecture, landscape and curated lifestyle story.",
  keywords: [
    "project overview",
    "real estate presentation",
    "Laurels villa estate",
    "project highlights",
  ],
});

export default function DeckPage() {
  return (
    <>
      {BROCHURE_PRIORITY_PAGE_SRCS.map((src) => (
        <link key={src} rel="preload" as="image" href={src} />
      ))}
      <link rel="preload" as="image" href={BROCHURE_LAST_PAGE_SRC} />
      <FlipBookDeck />
    </>
  );
}
