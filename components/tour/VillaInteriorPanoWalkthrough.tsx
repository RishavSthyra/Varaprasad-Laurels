"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import {
  getVillaInteriorTour, VILLA_INTERIOR_ENTRY_VIEWS, VILLA_BALCONY_DESTINATIONS, VILLA_BALCONY_ENTRY_VIEWS,
  VILLA_INTERIOR_NAVIGATION_PAIRS, VILLA_INTERIOR_SECTIONS,
} from "@/lib/villa-interior-tour";

const InteriorPanoWalkthrough = dynamic(() => import("./InteriorPanoWalkthrough"), {
  ssr: false,
  loading: () => <div role="status" className="flex h-full items-center justify-center bg-[#0a0a0a] text-sm text-white/70">Opening villa interior…</div>,
});
const NO_PAIRS: ReadonlyArray<readonly [string, string]> = [];
const NO_YAW_OVERRIDES: ReadonlyArray<readonly [string, string, number]> = [];

export default function VillaInteriorPanoWalkthrough({ initialNodeId, villaNumber }: {
  initialNodeId: string; villaNumber: number;
}) {
  const tour = useMemo(() => getVillaInteriorTour(villaNumber), [villaNumber]);
  return <div className="relative h-full w-full" data-villa-interior={villaNumber}>
    <InteriorPanoWalkthrough
      initialNodeId={initialNodeId} config={tour.config}
      verifiedPanoFolders={tour.folders} navigationSections={VILLA_INTERIOR_SECTIONS}
      entryViews={VILLA_INTERIOR_ENTRY_VIEWS} nodeLabels={tour.labels}
      panoEntryViews={VILLA_BALCONY_ENTRY_VIEWS}
      showViewpointSelector={false} balconyDestinations={VILLA_BALCONY_DESTINATIONS}
      priorityPreloading blockedNavigationPairs={NO_PAIRS}
      additionalNavigationPairs={VILLA_INTERIOR_NAVIGATION_PAIRS} navigationYawOverrides={NO_YAW_OVERRIDES}
      panoOnly showMinimap={false} minimapUnavailable showModeToggle={false} showDimensionsToggle={false}
      className="h-full w-full rounded-none border-0"
    />
    <div className="absolute left-4 top-4 z-30 flex flex-col items-start gap-2 md:left-6 md:top-6">
      <Link href="/master-plan" className="flex items-center gap-2 rounded-full border border-[#dcb76f66] bg-[#06152fe8] px-4 py-2.5 text-xs font-medium text-[#e1bd7c] backdrop-blur-xl focus-visible:outline-2 focus-visible:outline-[#e1bd7c]">
        <ArrowLeft size={15} /> Back to masterplan
      </Link>
    </div>
  </div>;
}
