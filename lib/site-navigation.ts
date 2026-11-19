export type SiteNavHref =
  | "/"
  | "/project-overview"
  | "/area-map"
  | "/amenities"
  | "/master-plan"
  | "/exterior-walkthrough";

export type SiteNavItem = {
  href: SiteNavHref;
  label: string;
  matches?: string[];
};

// Shared names match the top bar; keep hidden routes implemented for later use.
export const siteNavLabels: Record<SiteNavHref, string> = {
  "/": "Home",
  "/project-overview": "Project Overview",
  "/area-map": "Map",
  "/amenities": "Amenities",
  "/master-plan": "Master Plan",
  "/exterior-walkthrough": "Walkthrough",
};

export function isSiteNavigationVisible(href?: string) {
  return href !== "/project-overview";
}

const allSiteNavItems: SiteNavItem[] = [
  { href: "/", label: siteNavLabels["/"] },
  { href: "/project-overview", label: siteNavLabels["/project-overview"] },
  { href: "/area-map", label: siteNavLabels["/area-map"] },
  { href: "/amenities", label: siteNavLabels["/amenities"] },
  { href: "/master-plan", label: siteNavLabels["/master-plan"] },
  {
    href: "/exterior-walkthrough",
    label: siteNavLabels["/exterior-walkthrough"],
    matches: [
      "/exterios-walkthrough",
      "/exterior-tour",
      "/exterior-walkthrough",
    ],
  },
];

export const siteNavItems = allSiteNavItems.filter((item) => isSiteNavigationVisible(item.href));

export function isSiteNavItemActive(pathname: string, item: SiteNavItem) {
  if (item.href === "/") {
    return pathname === "/";
  }

  if (item.matches?.includes(pathname)) {
    return true;
  }

  return pathname === item.href;
}

export function isExteriorWalkthroughPath(pathname: string) {
  return (
    pathname === "/exterios-walkthrough" ||
    pathname === "/exterior-tour" ||
    pathname === "/exterior-walkthrough"
  );
}

export function isAnyWalkthroughPath(pathname: string) {
  return (
    pathname === "/walkthrough" ||
    pathname === "/interior-kitchen-foyer" ||
    pathname === "/clubhouse-walkthrough" ||
    pathname === "/villa-walkthrough" ||
    isExteriorWalkthroughPath(pathname)
  );
}
