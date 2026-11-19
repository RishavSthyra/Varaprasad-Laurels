import { Suspense } from "react";
import { notFound } from "next/navigation";
import VillaInteriorPanoWalkthrough from "@/components/tour/VillaInteriorPanoWalkthrough";
import { getVillaInteriorEntry } from "@/lib/villa-interior-tour";
import { getVillaRecord } from "@/lib/villa-residence";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Villa Interior Walkthrough", description: "Explore the shared villa interior across three floors.",
  robots: { index: false, follow: false },
});
export default async function VillaWalkthroughPage({ searchParams }: {
  searchParams: Promise<{ villa?: string | string[]; floor?: string | string[]; node?: string | string[] }>;
}) {
  const query = await searchParams;
  const villaNumber = query.villa === undefined ? 1 : typeof query.villa === "string" ? Number(query.villa) : NaN;
  if (!Number.isInteger(villaNumber) || !getVillaRecord(villaNumber)) notFound();
  const initialNodeId = getVillaInteriorEntry(
    typeof query.floor === "string" ? query.floor : undefined,
    typeof query.node === "string" ? query.node : undefined,
  );
  return <main className="h-dvh w-full bg-[#0a0a0a]">
    <Suspense fallback={<div role="status" className="flex h-full items-center justify-center text-white/70">Opening villa interior…</div>}>
      <VillaInteriorPanoWalkthrough key={`${villaNumber}-${initialNodeId}`} villaNumber={villaNumber} initialNodeId={initialNodeId} />
    </Suspense>
  </main>;
}
