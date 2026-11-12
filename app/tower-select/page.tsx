import TowerSelect from "@/components/TowerSelect";
import { buildPageMetadata } from "@/lib/metadata";
import { TOWER_SELECTION_IMAGE_URL } from "@/lib/tower-selection-assets";

export const metadata = buildPageMetadata({
  title: "Choose Your Villa",
  description:
    "Explore the villa collections at Laurels and continue into the residence discovery experience.",
  keywords: [
    "villa selection",
    "Laurels villas",
    "Vara Prasad Constructions",
    "private villa estate",
  ],
});

export default function MasterPlanPage() {
  return (
    <div className="relative h-dvh overflow-hidden bg-[#00142b]">
      <link
        rel="preload"
        as="image"
        href={TOWER_SELECTION_IMAGE_URL}
        fetchPriority="high"
      />
      <div className="">
        <TowerSelect />
      </div>
    </div>
  );
}
