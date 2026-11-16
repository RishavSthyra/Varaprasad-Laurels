import { Suspense } from "react";
import InteriorPanoWalkthrough from "@/components/tour/InteriorPanoWalkthrough";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Kitchen and Foyer Interior Walkthrough",
  description:
    "Explore a Laurels villa kitchen and foyer through an interactive panoramic walkthrough.",
  keywords: [
    "Laurels villa interior walkthrough",
    "kitchen panorama",
    "foyer panorama",
  ],
});

export default async function InteriorKitchenFoyerPage({
  searchParams,
}: {
  searchParams: Promise<{ node?: string | string[] }>;
}) {
  const query = await searchParams;
  const initialNodeId = typeof query.node === "string" && /^[a-zA-Z0-9_-]+$/.test(query.node)
    ? query.node : undefined;
  return (
    <main className="h-dvh w-full bg-[#0a0a0a]">
      <Suspense fallback={<div className="h-full w-full bg-[#0a0a0a]" />}>
        <InteriorPanoWalkthrough
          key={initialNodeId ?? "default"}
          initialNodeId={initialNodeId}
          className="h-full w-full rounded-none border-0"
        />
      </Suspense>
    </main>
  );
}
