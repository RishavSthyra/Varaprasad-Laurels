"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import {
  FileDown,
  Heart,
  Footprints,
  Home,
  LandPlot,
  Landmark,
  MapPin,
  Menu,
  Phone,
  Send,
  X,
} from "lucide-react";
import {
  type SiteNavHref,
  isSiteNavItemActive,
  siteNavItems,
} from "@/lib/site-navigation";
import { TRIFECTA_LEAD_OPEN_EVENT } from "@/lib/trifecta-remote-control";
import styles from "./MobileSiteNav.module.css";

const navItemIcons: Record<SiteNavHref, typeof Home> = {
  "/": Home,
  "/project-overview": Landmark,
  "/area-map": MapPin,
  "/amenities": Heart,
  "/master-plan": LandPlot,
  "/exterior-walkthrough": Footprints,
} as const;

export default function MobileSiteNav() {
  const pathname = usePathname();
  const [isRendered, setIsRendered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const flowerRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const navItemRefs = useRef<(HTMLElement | null)[]>([]);
  const actionRefs = useRef<(HTMLElement | null)[]>([]);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const isAreaMapRoute = pathname === "/area-map";
  const isMasterPlanRoute = pathname === "/master-plan" || pathname === "/master-plan-new";

  useEffect(() => {
    if (!isRendered || !isOpen) return;

    const overlay = overlayRef.current;
    const panel = panelRef.current;
    const flower = flowerRef.current;
    const header = headerRef.current;
    const closeButton = closeButtonRef.current;
    const navItemsToAnimate = navItemRefs.current.filter(
      (item): item is HTMLElement => item !== null,
    );
    const actions = actionRefs.current.filter(
      (item): item is HTMLElement => item !== null,
    );

    if (!overlay || !panel) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    timelineRef.current?.kill();

    if (prefersReducedMotion) {
      gsap.set(
        [
          overlay,
          panel,
          header,
          closeButton,
          flower,
          ...navItemsToAnimate,
          ...actions,
        ],
        { clearProps: "all" },
      );
      closeButton?.focus();
      return;
    }

    gsap.set(overlay, { autoAlpha: 0 });
    gsap.set(panel, {
      yPercent: 105,
      scale: 0.985,
      transformOrigin: "bottom center",
    });
    gsap.set([header, closeButton, flower], { autoAlpha: 0, y: 16 });
    gsap.set(navItemsToAnimate, { autoAlpha: 0, y: 24, scale: 0.985 });
    gsap.set(actions, { autoAlpha: 0, y: 18, scale: 0.96 });

    const timeline = gsap.timeline();
    timeline
      .to(overlay, {
        autoAlpha: 1,
        duration: 0.26,
        ease: "power2.out",
      })
      .to(
        panel,
        {
          yPercent: 0,
          scale: 1,
          duration: 0.86,
          ease: "expo.out",
        },
        0,
      )
      .to(
        [header, closeButton],
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.48,
          ease: "power3.out",
          stagger: 0.05,
        },
        0.22,
      )
      .to(
        flower,
        {
          autoAlpha: 1,
          y: 0,
          rotate: 0,
          duration: 0.72,
          ease: "power3.out",
        },
        0.18,
      )
      .to(
        navItemsToAnimate,
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.46,
          ease: "power3.out",
          stagger: 0.055,
        },
        0.34,
      )
      .to(
        actions,
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.42,
          ease: "power3.out",
          stagger: 0.045,
        },
        0.56,
      );

    timeline.eventCallback("onComplete", () => closeButton?.focus());
    timelineRef.current = timeline;

    return () => {
      timeline.kill();
    };
  }, [isOpen, isRendered]);

  useEffect(() => {
    if (!isRendered) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isRendered]);

  const openMenu = () => {
    setIsRendered(true);
    setIsOpen(true);
  };

  const closeMenu = () => {
    const overlay = overlayRef.current;
    const panel = panelRef.current;
    const navItemsToAnimate = navItemRefs.current.filter(
      (item): item is HTMLElement => item !== null,
    );
    const actions = actionRefs.current.filter(
      (item): item is HTMLElement => item !== null,
    );

    if (!overlay || !panel) {
      setIsOpen(false);
      setIsRendered(false);
      triggerRef.current?.focus();
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsOpen(false);
      setIsRendered(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
      return;
    }

    timelineRef.current?.kill();

    const timeline = gsap.timeline({
      onComplete: () => {
        setIsOpen(false);
        setIsRendered(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
      },
    });

    timeline
      .to(actions, {
        autoAlpha: 0,
        y: -10,
        scale: 0.96,
        duration: 0.16,
        ease: "power2.in",
        stagger: { each: 0.025, from: "end" },
      })
      .to(
        navItemsToAnimate,
        {
          autoAlpha: 0,
          y: -18,
          scale: 0.985,
          duration: 0.22,
          ease: "power2.in",
          stagger: { each: 0.025, from: "end" },
        },
        0.02,
      )
      .to(
        panel,
        {
          yPercent: 105,
          scale: 0.985,
          duration: 0.52,
          ease: "expo.in",
        },
        0.12,
      )
      .to(
        overlay,
        {
          autoAlpha: 0,
          duration: 0.22,
          ease: "power2.in",
        },
        0.22,
      );

    timelineRef.current = timeline;
  };

  useEffect(() => {
    if (!isRendered) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const openQuote = () => {
    window.dispatchEvent(new Event(TRIFECTA_LEAD_OPEN_EVENT));
    closeMenu();
  };

  return (
    <div className={isMasterPlanRoute ? styles.masterPlan : "xl:hidden"}>
      {isRendered ? (
        <div
          ref={overlayRef}
          className={`fixed inset-0 bg-[#000d1d]/64 backdrop-blur-[7px] ${isMasterPlanRoute ? "z-[150]" : "z-[70]"}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeMenu();
            }
          }}
        >
          <nav
            ref={panelRef}
            aria-label="Mobile site navigation"
            className={`absolute bottom-0 max-h-[92dvh] overflow-y-auto overscroll-contain border-[#cec3a0]/45 bg-[linear-gradient(180deg,rgba(0,28,54,0.99)_0%,rgba(0,20,43,0.985)_100%)] text-[#faf8f2] shadow-[0_-28px_76px_rgba(0,10,24,0.42),inset_0_1px_0_rgba(255,255,255,0.06)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
              isAreaMapRoute
                ? "inset-x-0 rounded-t-[1.75rem] border-x-0 border-b-0 border-t px-4 pb-[calc(env(safe-area-inset-bottom)+0.85rem)] pt-4 sm:bottom-4 sm:left-1/2 sm:right-auto sm:w-[min(34rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:rounded-[2rem] sm:border sm:px-6 sm:pb-6 sm:pt-6"
                : "inset-x-0 rounded-t-[2.15rem] border-x-0 border-b-0 border-t px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-5 sm:rounded-t-[2.5rem] sm:px-7 sm:pb-[calc(env(safe-area-inset-bottom)+1.4rem)] sm:pt-7"
            }`}
          >
            <div
              ref={flowerRef}
              className={`pointer-events-none absolute -right-12 -top-16 rotate-45 border border-[#cec3a0]/12 ${isAreaMapRoute ? "h-36 w-36 opacity-70 sm:h-48 sm:w-48" : "h-44 w-44 sm:-right-8 sm:-top-16 sm:h-60 sm:w-60"}`}
            >
            </div>

            <div
              ref={headerRef}
              className={`relative z-10 ${isAreaMapRoute ? "mb-4 sm:mb-5" : "mb-7"}`}
            >
              <p className="text-[0.66rem] font-bold uppercase tracking-[0.32em] text-[#cec3a0]">
                Laurels · Villa Estate
              </p>
              <h2
                className={`mt-2 font-semibold leading-none text-[#faf8f2] ${isAreaMapRoute ? "text-[1.35rem] sm:text-[1.65rem]" : "text-[2rem]"}`}
              >
                Navigation
              </h2>
            </div>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeMenu}
              className={`absolute z-20 flex items-center justify-center rounded-full border border-[#cec3a0]/36 bg-[#cec3a0]/8 text-[#cec3a0] shadow-[0_12px_28px_rgba(0,10,24,0.2)] ${isAreaMapRoute ? "right-4 top-4 size-11 sm:right-6 sm:top-6 sm:size-12" : "right-5 top-5 size-12 sm:right-7 sm:top-7 sm:size-14"}`}
              aria-label="Close navigation menu"
            >
              <X className="size-5" />
            </button>

            <div className="relative z-10 overflow-hidden rounded-[1.65rem] border border-[#cec3a0]/22 bg-white/[0.025]">
              {siteNavItems.map((item, index) => {
                const Icon = navItemIcons[item.href];
                const isActive = isSiteNavItemActive(pathname, item);
                const isLastItem = index === siteNavItems.length - 1;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMenu}
                    ref={(node) => {
                      navItemRefs.current[index] = node;
                    }}
                    className={`group relative flex items-center justify-between font-semibold transition active:scale-[0.99] ${isAreaMapRoute ? "h-[3.55rem] px-3 text-[0.82rem] sm:h-16 sm:px-4 sm:text-sm" : "h-[4.35rem] px-4 text-base sm:h-[4.75rem] sm:px-5"} ${
                      isActive
                        ? "bg-[linear-gradient(90deg,rgba(206,195,160,0.16)_0%,rgba(206,195,160,0.05)_48%,transparent_100%)] text-[#faf8f2]"
                        : "text-[#faf8f2]/76"
                    } ${!isLastItem ? "border-b border-[#cec3a0]/14" : ""}`}
                  >
                    <span
                      className={`absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full transition ${
                        isActive ? "bg-[#cec3a0]" : "bg-transparent"
                      }`}
                    />
                    <span className={`inline-flex min-w-0 items-center ${isAreaMapRoute ? "gap-3" : "gap-4"}`}>
                      <span
                        className={`flex shrink-0 items-center justify-center rounded-full ${isAreaMapRoute ? "size-9 sm:size-10" : "size-10"} ${
                          isActive
                            ? "bg-[#cec3a0] text-[#00142b] shadow-[0_10px_20px_rgba(0,8,20,0.26)]"
                            : "border border-[#cec3a0]/24 bg-[#cec3a0]/6 text-[#cec3a0]"
                        }`}
                      >
                        <Icon className="size-4.5" />
                      </span>
                      <span className="truncate">{item.label}</span>
                    </span>
                    <Send
                      className={`size-4.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${
                        isActive ? "text-[#cec3a0]" : "text-[#cec3a0]/55"
                      }`}
                    />
                  </Link>
                );
              })}
            </div>

            {!isMasterPlanRoute ? <div className={`relative z-10 grid grid-cols-3 ${isAreaMapRoute ? "mt-4 gap-2 sm:mt-5 sm:gap-3" : "mt-6 gap-3"}`}>
              <a
                ref={(node) => {
                  actionRefs.current[0] = node;
                }}
                href="tel:+918088004411"
                className={`flex items-center justify-center rounded-full border border-[#cec3a0]/26 bg-[#cec3a0]/7 text-[#cec3a0] shadow-[0_10px_22px_rgba(0,10,24,0.14)] ${isAreaMapRoute ? "h-11 sm:h-12" : "h-14"}`}
                aria-label="Call"
              >
                <Phone className="size-4.5" />
              </a>
              <a
                ref={(node) => {
                  actionRefs.current[1] = node;
                }}
                href="/TULA-Whispers-of-Trees-Brochure.pdf"
                className={`flex items-center justify-center rounded-full border border-[#cec3a0]/26 bg-[#cec3a0]/7 text-[#cec3a0] shadow-[0_10px_22px_rgba(0,10,24,0.14)] ${isAreaMapRoute ? "h-11 sm:h-12" : "h-14"}`}
                aria-label="Download brochure"
              >
                <FileDown className="size-4.5" />
              </a>
              <button
                ref={(node) => {
                  actionRefs.current[2] = node;
                }}
                type="button"
                onClick={openQuote}
                className={`flex items-center justify-center rounded-full border border-[#e8dec0]/70 bg-[#cec3a0] text-[#00142b] shadow-[0_14px_30px_rgba(0,8,20,0.28)] ${isAreaMapRoute ? "h-11 sm:h-12" : "h-14"}`}
                aria-label="Get a quote"
              >
                <Send className="size-4.5" />
              </button>
            </div> : null}
          </nav>
        </div>
      ) : null}

      {!isRendered ? (
        <div
          className={`pointer-events-none fixed inset-x-0 flex justify-start ${isMasterPlanRoute ? "z-[120]" : "z-[70]"} ${
            isMasterPlanRoute
              ? styles.masterPlanTrigger
              : isAreaMapRoute
              ? "top-[max(env(safe-area-inset-top),1rem)] px-3 sm:px-5"
              : "bottom-[max(env(safe-area-inset-bottom),1rem)] px-4 sm:px-6"
          }`}
        >
          <button
            ref={triggerRef}
            type="button"
            onClick={openMenu}
            className={`pointer-events-auto flex items-center justify-center rounded-full border border-[#cec3a0]/48 bg-[#00142b]/92 text-[#cec3a0] shadow-[0_18px_42px_rgba(0,10,24,0.32),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl ${isMasterPlanRoute ? "size-10 sm:size-11" : isAreaMapRoute ? "size-11 sm:size-12" : "size-13"}`}
            aria-label="Open navigation menu"
            aria-expanded={false}
          >
            <Menu className="size-5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
