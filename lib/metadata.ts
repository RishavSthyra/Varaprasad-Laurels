import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";

export const SITE_NAME = `${BRAND.project} by ${BRAND.developer}`;
export const DEFAULT_DESCRIPTION =
  `${BRAND.project} is a private villa estate by ${BRAND.developer}.`;
export const SITE_ICON_URL = "/favicon.png?v=vp-sidebar-v1";
export const SITE_APPLE_ICON_URL = "/apple-touch-icon.png?v=vp-sidebar-v1";
export const SITE_LOGO_GOLD_URL = BRAND.logoGold;
export const SITE_LOGO_BLUE_URL = BRAND.logoBlue;

type BuildPageMetadataOptions = {
  title: string;
  description: string;
  keywords?: string[];
  robots?: Metadata["robots"];
};

export function buildPageMetadata({
  title,
  description,
  keywords = [],
  robots,
}: BuildPageMetadataOptions): Metadata {
  return {
    title,
    description,
    keywords,
    ...(robots ? { robots } : {}),
    openGraph: {
      title,
      description,
      siteName: SITE_NAME,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
