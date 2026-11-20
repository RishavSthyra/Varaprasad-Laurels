"use client";

import dynamic from "next/dynamic";
import { CLUBHOUSE_ENTRY_VIEWS, CLUBHOUSE_FLOOR_MARKERS } from "@/lib/clubhouse-floor-transitions";
import { CLUBHOUSE_FLOOR_PLANS } from "@/lib/clubhouse-floor-plans";
import {
  CLUBHOUSE_CONFIG, CLUBHOUSE_NAVIGATION_PAIRS, CLUBHOUSE_NODE_LABELS, CLUBHOUSE_PANO_FOLDERS, CLUBHOUSE_SECTIONS,
} from "@/lib/clubhouse-tour";

const InteriorPanoWalkthrough = dynamic(() => import("./InteriorPanoWalkthrough"), {
  ssr: false,
  loading: () => <div role="status" className="flex h-full items-center justify-center bg-[#0a0a0a] text-sm text-white/70">Opening clubhouse…</div>,
});
const NO_PAIRS: ReadonlyArray<readonly [string, string]> = [];
const NO_YAW_OVERRIDES: ReadonlyArray<readonly [string, string, number]> = [];

export default function ClubhousePanoWalkthrough({ initialNodeId }: { initialNodeId: string }) {
  return <InteriorPanoWalkthrough
    initialNodeId={initialNodeId}
    config={CLUBHOUSE_CONFIG}
    verifiedPanoFolders={CLUBHOUSE_PANO_FOLDERS}
    navigationSections={CLUBHOUSE_SECTIONS}
    entryViews={CLUBHOUSE_ENTRY_VIEWS}
    floorMarkers={CLUBHOUSE_FLOOR_MARKERS}
    nodeLabels={CLUBHOUSE_NODE_LABELS}
    priorityPreloading
    blockedNavigationPairs={NO_PAIRS}
    additionalNavigationPairs={CLUBHOUSE_NAVIGATION_PAIRS}
    navigationYawOverrides={NO_YAW_OVERRIDES}
    panoOnly
    showMinimap={false}
    numberedFloorPlans={CLUBHOUSE_FLOOR_PLANS}
    showModeToggle={false}
    showViewpointSelector={false}
    showDimensionsToggle={false}
    className="h-full w-full rounded-none border-0"
  />;
}
