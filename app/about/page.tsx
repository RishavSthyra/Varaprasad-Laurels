import React from "react";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "About",
  description:
    "Learn more about Laurels and the digital experience built around its villas and walkthroughs.",
  keywords: [
    "about Laurels villas",
    "project information",
    "residential development",
  ],
});

export default function page() {
  return (
    <div>This is 2nd Page</div>
  );
}
