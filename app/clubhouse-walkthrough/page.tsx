import { Suspense } from "react";
import ClubhousePanoWalkthrough from "@/components/tour/ClubhousePanoWalkthrough";
import { getClubhouseEntry } from "@/lib/clubhouse-tour";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Clubhouse Walkthrough",
  description: "Explore all five clubhouse levels in an interactive panoramic walkthrough.",
  robots: { index: false, follow: false },
});

export default async function ClubhouseWalkthroughPage({ searchParams }: {
  searchParams: Promise<{ floor?: string | string[]; node?: string | string[] }>;
}) {
  const query = await searchParams;
  const initialNodeId = getClubhouseEntry(
    typeof query.floor === "string" ? query.floor : undefined,
    typeof query.node === "string" ? query.node : undefined,
  );
  return <main className="h-dvh w-full bg-[#0a0a0a]">
    <Suspense fallback={<div role="status" className="flex h-full items-center justify-center text-white/70">Opening clubhouse…</div>}>
      <ClubhousePanoWalkthrough key={initialNodeId} initialNodeId={initialNodeId} />
    </Suspense>
  </main>;
}
