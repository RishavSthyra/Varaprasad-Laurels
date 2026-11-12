"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Footprints,
  Heart,
  House,
  LandPlot,
  Landmark,
  MapPin,
  SlidersHorizontal,
} from "lucide-react";
import {
  type SiteNavHref,
  isSiteNavItemActive,
  siteNavItems,
} from "@/lib/site-navigation";
import { cn } from "@/lib/utils";

const railItemIcons: Record<SiteNavHref, typeof House> = {
  "/": House,
  "/project-overview": Landmark,
  "/area-map": MapPin,
  "/amenities": Heart,
  "/master-plan": LandPlot,
  "/exterior-walkthrough": Footprints,
};

type DesktopSiteRailProps = {
  className?: string;
};

export default function DesktopSiteRail({
  className,
}: DesktopSiteRailProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside
      aria-label="Primary navigation"
      className={cn(
        "desktop-site-rail relative hidden flex-col items-center overflow-visible rounded-[2.35rem] border border-[#fce190]/45 bg-[linear-gradient(180deg,#061c35_0%,#00142b_54%,#000d20_100%)] text-[#fce190] shadow-[0_24px_54px_rgba(0,7,20,0.52),inset_0_1px_0_rgba(252,225,144,0.14),inset_0_-1px_0_rgba(0,0,0,0.38)] xl:flex",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.35rem]">
        <div className="absolute inset-[5px] rounded-[2rem] border border-[#fce190]/10" />
        <div className="absolute inset-x-2 top-0 h-24 rounded-full bg-[radial-gradient(circle_at_50%_0%,rgba(252,225,144,0.13),transparent_72%)]" />
      </div>

      <div className="relative z-10 flex w-full justify-center pt-0.5">
        <Image
          src="/vp_cons_images_Cropped.webp"
          width={110}
          height={219}
          alt="Vara Prasad Constructions"
          className="h-auto w-[1.9rem] object-contain"
          priority
        />
      </div>

      <nav
        className="desktop-site-rail__nav relative z-10 flex flex-col items-center"
        aria-label="Site sections"
      >
        {siteNavItems.map((item) => {
          const Icon = railItemIcons[item.href];
          const isActive = isSiteNavItemActive(pathname, item);

          return (
            <div key={item.href} className="group relative flex items-center">
              <button
                type="button"
                onClick={() => router.push(item.href)}
                className={cn(
                  "desktop-site-rail__nav-button flex items-center justify-center rounded-full transition duration-200",
                  isActive
                    ? "desktop-site-rail__nav-button--active border border-[#fff4c7]/60 bg-[radial-gradient(circle_at_34%_24%,#fff4c7_0%,#fce190_52%,#d0ad43_100%)] text-[#00142b] shadow-[0_10px_24px_rgba(0,7,20,0.4),inset_0_1px_0_rgba(255,255,255,0.5)]"
                    : "desktop-site-rail__nav-button--inactive text-[#fce190]/68 hover:bg-[#fce190]/10 hover:text-[#fff4c7]",
                )}
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
              >
                <Icon
                  className={
                    isActive
                      ? "desktop-site-rail__nav-icon--active"
                      : "desktop-site-rail__nav-icon--inactive"
                  }
                  strokeWidth={isActive ? 2.1 : 1.75}
                />
              </button>

              <div className="pointer-events-none absolute left-[calc(100%+0.8rem)] top-1/2 z-20 -translate-y-1/2 whitespace-nowrap rounded-full border border-[#fce190]/30 bg-[#00142b] px-3 py-1.5 text-[0.64rem] font-semibold tracking-[0.1em] text-[#fce190] opacity-0 shadow-[0_12px_28px_rgba(0,7,20,0.44)] transition duration-200 group-hover:translate-x-1 group-hover:opacity-100">
                {item.label}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="desktop-site-rail__divider relative z-10 h-px bg-[#fce190]/35" />

      <div className="desktop-site-rail__filter group relative z-10 flex flex-col items-center">
        <button
          type="button"
          onClick={() => router.push("/master-plan")}
          className="flex flex-col items-center"
          aria-label="Open villa filters"
        >
          <span className="desktop-site-rail__filter-button flex items-center justify-center rounded-full border border-[#fce190]/26 bg-[#0a223b] text-[#fce190] shadow-[0_9px_22px_rgba(0,7,20,0.34),inset_0_1px_0_rgba(252,225,144,0.08)] transition hover:border-[#fce190]/48 hover:text-[#fff4c7]">
            <SlidersHorizontal
              className="desktop-site-rail__filter-icon"
              strokeWidth={1.8}
            />
          </span>
          <span className="desktop-site-rail__filter-label font-medium tracking-[0.08em] text-[#fce190]/60">
            Filters
          </span>
        </button>
        <div className="desktop-site-rail__filter-tooltip pointer-events-none absolute left-[calc(100%+0.8rem)] z-20 -translate-y-1/2 whitespace-nowrap rounded-full border border-[#fce190]/30 bg-[#00142b] px-3 py-1.5 text-[0.64rem] font-semibold tracking-[0.1em] text-[#fce190] opacity-0 shadow-[0_12px_28px_rgba(0,7,20,0.44)] transition duration-200 group-hover:translate-x-1 group-hover:opacity-100">
          Open filters
        </div>
      </div>

      <div
        className="desktop-site-rail__media-slot relative z-10 shrink-0 overflow-hidden rounded-b-[2.3rem]"
        data-sidebar-media-slot
      >
        <Image
          src="/Golden Wireframe Villa Side Panel.avif"
          alt=""
          aria-hidden="true"
          width={724}
          height={2172}
          sizes="86px"
          className="pointer-events-none absolute bottom-0 left-0 h-auto w-[200%] max-w-none object-contain object-bottom"
        />
      </div>
    </aside>
  );
}
