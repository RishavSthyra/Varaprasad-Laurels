import type { Metadata } from "next";
import ProjectLayoutMap from "@/components/ProjectLayoutMap";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Project Layout",
  description:
    "View the interactive Laurels estate layout with amenities mapping and spatial context.",
  keywords: [
    "project layout",
    "amenities map",
    "site plan",
    "Laurels villa estate layout",
  ],
});

export default function ProjectLayoutPage() {
  return <ProjectLayoutMap />;
}
