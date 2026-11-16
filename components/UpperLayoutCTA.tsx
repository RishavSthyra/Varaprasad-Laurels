"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./UpperLayoutCTA.module.css";
import {RoyalJewel, RoyalShield} from "./RoyalNavigationDetails";
import {
  Building2, Download, Footprints, House, LayoutGrid, Map, Menu, Phone, Sparkles, X,
} from "lucide-react";

interface CtaButtonType {
  name: string;
  link?: string;
  action: "link" | "quote-modal";
  isHighlight: boolean;
  icon: React.ReactNode;
}

type UpperLayoutCTAProps = {
  onQuoteClick: () => void;
  mergeRouteLinks?: boolean;
};

function shouldBottomDockCta() {
  if (typeof window === "undefined") {
    return false;
  }

  const compactViewport = window.matchMedia("(max-width: 1279px)").matches;
  const primaryPointerCoarse = window.matchMedia("(pointer: coarse)").matches;
  const finePointerAvailable =
    window.matchMedia("(pointer: fine)").matches ||
    window.matchMedia("(any-pointer: fine)").matches;

  return (
    compactViewport || (primaryPointerCoarse && !finePointerAvailable)
  );
}

function shouldHideMasterPlanCompactDesktopRail(pathname: string | null) {
  if (typeof window === "undefined" || pathname !== "/master-plan") {
    return false;
  }

  return (
    window.matchMedia("(min-width: 1280px) and (max-width: 1699px)").matches &&
    window.matchMedia("(pointer: fine)").matches &&
    !window.matchMedia("(pointer: coarse)").matches &&
    !window.matchMedia("(any-pointer: coarse)").matches
  );
}

function isQuickRouteActive(pathname: string, href?: string) {
  if (!href) {
    return false;
  }

  if (href === "/exterior-walkthrough") {
    return (
      pathname === "/exterior-walkthrough" ||
      pathname === "/exterior-tour" ||
      pathname === "/exterios-walkthrough"
    );
  }

  return pathname === href;
}

function getRemoteControlProps(button: CtaButtonType) {
  return {
    "data-trifecta-control-label": button.name,
    ...(button.action === "quote-modal"
      ? { "data-trifecta-quote-trigger": "true" }
      : {}),
  };
}

export default function UpperLayoutCTA({
  onQuoteClick,
  mergeRouteLinks = false,
}: UpperLayoutCTAProps) {
  const pathname = usePathname();
  const [shouldDockAtBottom, setShouldDockAtBottom] = useState(
    shouldBottomDockCta,
  );
  const [shouldHideCompactDesktopRail, setShouldHideCompactDesktopRail] =
    useState(() => shouldHideMasterPlanCompactDesktopRail(pathname));
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileMenuRendered, setIsMobileMenuRendered] = useState(false);
  const menuOverlayRef = useRef<HTMLDivElement | null>(null);
  const menuPanelRef = useRef<HTMLDivElement | null>(null);
  const menuHandleRef = useRef<HTMLDivElement | null>(null);
  const menuCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuItemRefs = useRef<(HTMLElement | null)[]>([]);
  const menuLetterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const menuUtilityRefs = useRef<(HTMLElement | null)[]>([]);
  const menuAnimationRef = useRef<gsap.core.Timeline | null>(null);
  const isMasterPlanRoute = pathname === "/master-plan";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const compactViewportMedia = window.matchMedia("(max-width: 1279px)");
    const touchViewportMedia = window.matchMedia("(pointer: coarse)");
    const finePointerMedia = window.matchMedia("(pointer: fine)");
    const anyFinePointerMedia = window.matchMedia("(any-pointer: fine)");

    const syncBottomDock = () => {
      setShouldDockAtBottom(
        compactViewportMedia.matches ||
          (touchViewportMedia.matches &&
            !finePointerMedia.matches &&
            !anyFinePointerMedia.matches),
      );
    };

    syncBottomDock();
    compactViewportMedia.addEventListener("change", syncBottomDock);
    touchViewportMedia.addEventListener("change", syncBottomDock);
    finePointerMedia.addEventListener("change", syncBottomDock);
    anyFinePointerMedia.addEventListener("change", syncBottomDock);

    return () => {
      compactViewportMedia.removeEventListener("change", syncBottomDock);
      touchViewportMedia.removeEventListener("change", syncBottomDock);
      finePointerMedia.removeEventListener("change", syncBottomDock);
      anyFinePointerMedia.removeEventListener("change", syncBottomDock);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const compactDesktopMedia = window.matchMedia(
      "(min-width: 1280px) and (max-width: 1699px)",
    );
    const finePointerMedia = window.matchMedia("(pointer: fine)");
    const coarsePointerMedia = window.matchMedia("(pointer: coarse)");
    const anyCoarsePointerMedia = window.matchMedia("(any-pointer: coarse)");

    const syncCompactDesktopRail = () => {
      setShouldHideCompactDesktopRail(
        pathname === "/master-plan" &&
          compactDesktopMedia.matches &&
          finePointerMedia.matches &&
          !coarsePointerMedia.matches &&
          !anyCoarsePointerMedia.matches,
      );
    };

    syncCompactDesktopRail();
    compactDesktopMedia.addEventListener("change", syncCompactDesktopRail);
    finePointerMedia.addEventListener("change", syncCompactDesktopRail);
    coarsePointerMedia.addEventListener("change", syncCompactDesktopRail);
    anyCoarsePointerMedia.addEventListener("change", syncCompactDesktopRail);

    return () => {
      compactDesktopMedia.removeEventListener("change", syncCompactDesktopRail);
      finePointerMedia.removeEventListener("change", syncCompactDesktopRail);
      coarsePointerMedia.removeEventListener("change", syncCompactDesktopRail);
      anyCoarsePointerMedia.removeEventListener(
        "change",
        syncCompactDesktopRail,
      );
    };
  }, [pathname]);

  const primaryButtons: CtaButtonType[] = [
    {
      name: "Contact Us",
      link: "tel:+91-808 800 4411",
      action: "link",
      isHighlight: false,
      icon: (
        <Phone />
      ),
    },
    {
      name: "Brochure",
      link: "/TULA-Whispers-of-Trees-Brochure.pdf",
      action: "link",
      isHighlight: false,
      icon: (
        <Download />
      ),
    },
  ];

  if (isMasterPlanRoute) {
    primaryButtons.push({
      name: "Home",
      link: "/",
      action: "link",
      isHighlight: isQuickRouteActive(pathname ?? "", "/"),
      icon: (
        <House />
      ),
    });
  }

  const routeButtons = useMemo<CtaButtonType[]>(() => {
    if (!mergeRouteLinks) {
      return [];
    }

    const buttons: CtaButtonType[] = [
      {
        name: "Home",
        link: "/",
        action: "link",
        isHighlight: isQuickRouteActive(pathname ?? "", "/"),
        icon: (
          <House />
        ),
      },
      {
        name: "Project Overview",
        link: "/project-overview",
        action: "link",
        isHighlight: isQuickRouteActive(pathname ?? "", "/project-overview"),
        icon: (
          <LayoutGrid />
        ),
      },
      {
        name: "Master Plan",
        link: "/master-plan",
        action: "link",
        isHighlight: isQuickRouteActive(pathname ?? "", "/master-plan"),
        icon: (
          <Building2 />
        ),
      },
      {
        name: "Amenities",
        link: "/amenities",
        action: "link",
        isHighlight: isQuickRouteActive(pathname ?? "", "/amenities"),
        icon: (
          <Sparkles />
        ),
      },
      {
        name: "Map",
        link: "/area-map",
        action: "link",
        isHighlight: isQuickRouteActive(pathname ?? "", "/area-map"),
        icon: (
          <Map />
        ),
      },
      {
        name: "Walkthrough",
        link: "/exterior-walkthrough",
        action: "link",
        isHighlight: isQuickRouteActive(pathname ?? "", "/exterior-walkthrough"),
        icon: (
          <Footprints />
        ),
      },
    ];

    return buttons.filter(
      (button) => !(isMasterPlanRoute && button.name === "Home"),
    );
  }, [isMasterPlanRoute, mergeRouteLinks, pathname]);

  const buttons = [...primaryButtons, ...routeButtons];
  const compactMenuButtons =
    routeButtons.length > 0 ? routeButtons : primaryButtons;
  const compactUtilityButtons =
    routeButtons.length > 0 ? primaryButtons : [];

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    if (!shouldDockAtBottom || !isMobileMenuRendered) {
      document.body.style.overflow = "";
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileMenuRendered, shouldDockAtBottom]);

  useEffect(() => {
    if (!shouldDockAtBottom || !isMobileMenuRendered) {
      menuAnimationRef.current?.kill();
      return;
    }

    const overlay = menuOverlayRef.current;
    const panel = menuPanelRef.current;
    const handle = menuHandleRef.current;
    const closeButton = menuCloseButtonRef.current;
    const items = menuItemRefs.current.filter(
      (item): item is HTMLElement => item !== null,
    );
    const letters = menuLetterRefs.current.filter(
      (item): item is HTMLSpanElement => item !== null,
    );
    const utilities = menuUtilityRefs.current.filter(
      (item): item is HTMLElement => item !== null,
    );

    if (!overlay || !panel) {
      return;
    }

    menuAnimationRef.current?.kill();

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set([overlay, panel, handle, closeButton, ...items, ...letters, ...utilities], {
        clearProps: "all",
      });
      if (!isMobileMenuOpen) {
        setIsMobileMenuRendered(false);
      }
      return;
    }

    if (isMobileMenuOpen) {
      gsap.set(overlay, { autoAlpha: 0 });
      gsap.set(panel, { yPercent: 100, scaleY: 0.985, transformOrigin: "bottom center" });
      gsap.set(handle, { opacity: 0, scaleX: 0.6, y: 10 });
      gsap.set(closeButton, { opacity: 0, scale: 0.86, rotate: -10 });
      gsap.set(items, { opacity: 0, y: 22 });
      gsap.set(letters, { opacity: 0, yPercent: 120 });
      gsap.set(utilities, { opacity: 0, y: 18, scale: 0.92 });

      const openTimeline = gsap.timeline();
      openTimeline
        .to(overlay, {
          autoAlpha: 1,
          duration: 0.3,
          ease: "expo.out",
        })
        .to(
          panel,
          {
            yPercent: 0,
            scaleY: 1,
            duration: 0.82,
            ease: "expo.out",
          },
          0,
        )
        .to(
          handle,
          {
            opacity: 1,
            scaleX: 1,
            y: 0,
            duration: 0.48,
            ease: "expo.out",
          },
          0.18,
        )
        .to(
          closeButton,
          {
            opacity: 1,
            scale: 1,
            rotate: 0,
            duration: 0.42,
            ease: "expo.out",
          },
          0.2,
        )
        .to(
          items,
          {
            opacity: 1,
            y: 0,
            duration: 0.52,
            ease: "expo.out",
            stagger: 0.04,
          },
          0.24,
        )
        .to(
          letters,
          {
            opacity: 1,
            yPercent: 0,
            duration: 0.56,
            ease: "expo.out",
            stagger: 0.006,
          },
          0.26,
        )
        .to(
          utilities,
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.42,
            ease: "expo.out",
            stagger: 0.035,
          },
          0.4,
        );

      menuAnimationRef.current = openTimeline;
      return () => {
        openTimeline.kill();
      };
    }

    const closeTimeline = gsap.timeline({
      onComplete: () => {
        setIsMobileMenuRendered(false);
      },
    });

    closeTimeline
      .to(utilities, {
        opacity: 0,
        y: 10,
        scale: 0.92,
        duration: 0.18,
        ease: "expo.in",
        stagger: {
          each: 0.02,
          from: "end",
        },
      })
      .to(
        items,
        {
          opacity: 0,
          y: 16,
          duration: 0.24,
          ease: "expo.in",
          stagger: {
            each: 0.018,
            from: "end",
          },
        },
        0.02,
      )
      .to(
        closeButton,
        {
          opacity: 0,
          scale: 0.88,
          rotate: -8,
          duration: 0.18,
          ease: "expo.in",
        },
        0.04,
      )
      .to(
        handle,
        {
          opacity: 0,
          scaleX: 0.72,
          y: 8,
          duration: 0.18,
          ease: "expo.in",
        },
        0.04,
      )
      .to(
        panel,
        {
          yPercent: 100,
          scaleY: 0.985,
          duration: 0.48,
          ease: "expo.in",
        },
        0.08,
      )
      .to(
        overlay,
        {
          autoAlpha: 0,
          duration: 0.22,
          ease: "expo.in",
        },
        0.16,
      );

    menuAnimationRef.current = closeTimeline;

    return () => {
      closeTimeline.kill();
    };
  }, [isMobileMenuOpen, isMobileMenuRendered, shouldDockAtBottom]);

  if (shouldHideCompactDesktopRail) {
    return null;
  }

  if (shouldDockAtBottom) {
    let mobileLetterIndex = 0;

    return (
      <>
        {isMobileMenuRendered ? (
          <div
            ref={menuOverlayRef}
            className="pointer-events-auto fixed inset-0 z-50 bg-black/48 backdrop-blur-[6px]"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setIsMobileMenuOpen(false);
              }
            }}
          >
            <div
              ref={menuPanelRef}
              className={`${styles.mobilePanel} absolute inset-x-0 bottom-0 max-h-[calc(100svh-1rem)] overflow-y-auto rounded-t-[2.25rem] border-t border-[#d6ae62]/60 bg-[#06152f] text-[#e8cc91] shadow-[0_-24px_70px_rgba(0,0,0,0.3)] backdrop-blur-3xl`}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
            >
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.65),rgba(255,255,255,0.14)_18%,transparent_45%,rgba(0,0,0,0.02))]" />
              <div className="relative flex flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:px-6 sm:pt-5">
                <div className="mb-4 flex items-center justify-between">
                  <div
                    ref={menuHandleRef}
                    className="h-1 w-14 rounded-full bg-[#d6ae62]/50"
                  />
                  <button
                    ref={menuCloseButtonRef}
                    type="button"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d6ae62]/40 bg-[#0d2855] text-[#e8cc91] transition active:scale-[0.98]"
                    aria-label="Close navigation menu"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mx-auto w-full max-w-[34rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="space-y-0">
                    {compactMenuButtons.map((button, index) => {
                      const labelChars = Array.from(button.name.toUpperCase());

                      const itemContent = (
                        <>
                          <div className="flex min-w-0 items-center gap-3.5">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d6ae62]/30 bg-[#0d2855] text-[#e1bd7c] transition duration-300 group-hover:border-[#f0d69c]/65 group-hover:text-[#f0d69c]">
                              {button.icon}
                            </span>
                            <span className="flex min-w-0 flex-wrap overflow-hidden text-[1.58rem] font-medium uppercase leading-[0.92] tracking-[-0.05em] text-[#e8cc91] sm:text-[1.9rem]">
                              {labelChars.map((char) => {
                                const letterIndex = mobileLetterIndex++;

                                return (
                                  <span
                                    key={`${button.name}-${letterIndex}-${char}`}
                                    ref={(node) => {
                                      menuLetterRefs.current[letterIndex] = node;
                                    }}
                                    className="inline-block"
                                  >
                                    {char === " " ? "\u00A0" : char}
                                  </span>
                                );
                              })}
                            </span>
                          </div>
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center text-[#d6ae62]/60 transition duration-300 group-hover:translate-x-1 group-hover:text-[#f0d69c]">
                            <span className="text-lg leading-none">+</span>
                          </span>
                        </>
                      );

                      const itemClassName = `group relative flex w-full items-center justify-between gap-3 border-b border-[#d6ae62]/20 py-4 text-left transition duration-300 last:border-b-0 sm:py-[1.15rem] ${
                        button.isHighlight
                          ? "bg-[#173d78]/40 text-[#f0d69c]"
                          : "text-[#e1bd7c] hover:text-[#f0d69c]"
                      }`;

                      return button.action === "link" && button.link ? (
                        <Link
                          key={button.name}
                          href={button.link}
                          title={button.name}
                          aria-label={button.name}
                          aria-current={button.isHighlight ? "page" : undefined}
                          {...getRemoteControlProps(button)}
                          onClick={() => setIsMobileMenuOpen(false)}
                          ref={(node) => {
                            menuItemRefs.current[index] = node;
                          }}
                          className={itemClassName}
                        >
                          {itemContent}
                        </Link>
                      ) : (
                        <button
                          key={button.name}
                          type="button"
                          title={button.name}
                          aria-label={button.name}
                          {...getRemoteControlProps(button)}
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            onQuoteClick();
                          }}
                          ref={(node) => {
                            menuItemRefs.current[index] = node;
                          }}
                          className={itemClassName}
                        >
                          {itemContent}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {compactUtilityButtons.length > 0 ? (
                  <div className="mt-4 flex justify-center">
                    <div className="inline-flex flex-wrap items-center gap-3 px-1 py-1">
                      {compactUtilityButtons.map((button, index) =>
                        button.action === "link" && button.link ? (
                          <Link
                            key={button.name}
                            href={button.link}
                            title={button.name}
                            aria-label={button.name}
                            onClick={() => setIsMobileMenuOpen(false)}
                            ref={(node) => {
                              menuUtilityRefs.current[index] = node;
                            }}
                            className={styles.mobileUtility}
                          >
                            <span className="flex h-4 w-4 items-center justify-center">
                              {button.icon}
                            </span>
                          </Link>
                        ) : (
                          <button
                            key={button.name}
                            type="button"
                            title={button.name}
                            aria-label={button.name}
                            {...getRemoteControlProps(button)}
                            onClick={() => {
                              setIsMobileMenuOpen(false);
                              onQuoteClick();
                            }}
                            ref={(node) => {
                              menuUtilityRefs.current[index] = node;
                            }}
                            className={styles.mobileUtility}
                          >
                            <span className="flex h-4 w-4 items-center justify-center">
                              {button.icon}
                            </span>
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {!isMobileMenuOpen ? (
          <div className="pointer-events-none fixed inset-x-0 bottom-[max(env(safe-area-inset-bottom),1rem)] z-[60] flex justify-start px-4 sm:px-5">
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuRendered(true);
                setIsMobileMenuOpen(true);
              }}
              className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d6ae62]/70 bg-[#06152f]/95 text-[#e8cc91] shadow-[0_12px_30px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(240,214,156,0.14)] backdrop-blur-2xl transition active:scale-[0.98]"
              aria-label="Open navigation menu"
              aria-expanded={false}
            >
              <Menu className="h-[1.05rem] w-[1.05rem]" />
            </button>
          </div>
        ) : null}
      </>
    );
  }


  const paletteStyle = {
    "--item-count": buttons.length,
  } as React.CSSProperties;

  return (
    <div className={styles.positioner}>
      <nav aria-label="Quick navigation"
        className={`${styles.navigation} ${buttons.length <= 3 ? styles.compact : ""}`}
        style={paletteStyle}>
        {/* <RoyalOrnament />
        <RoyalOrnament mirrored /> */}
        <div className={styles.surface} aria-hidden="true">
          <svg className={styles.frame}>
            <defs>
              <linearGradient id="royal-nav-frame" x1="0" x2="1" y1="0" y2=".3">
                <stop stopColor="#92703b" /><stop offset=".12" stopColor="#e8cc91" />
                <stop offset=".35" stopColor="#c99c50" /><stop offset=".5" stopColor="#fff0bd" />
                <stop offset=".7" stopColor="#d6ae62" /><stop offset="1" stopColor="#92703b" />
              </linearGradient>
            </defs>
            <rect x=".5" y=".5" width="calc(100% - 1px)" height="calc(100% - 1px)" rx="24" fill="none"
              stroke="url(#royal-nav-frame)" strokeWidth=".8" />
          </svg>
          <svg viewBox="0 0 920 90" preserveAspectRatio="none" className={styles.engraving}>
            <g fill="none" stroke="currentColor" strokeWidth=".65">
              {[0, 1, 2, 3, 4, 5].map((line) => (
                <React.Fragment key={line}>
                  <path d={`M0 ${12 + line * 7}C46 ${-10 + line * 6} 72 ${58 + line * 3} 155 ${10 + line * 4}S226 12 280 0`} />
                  <path d={`M920 ${78 - line * 7}C866 ${100 - line * 6} 844 ${32 - line * 3} 765 ${80 - line * 4}S694 78 640 90`} />
                </React.Fragment>
              ))}
            </g>
          </svg>
        </div>
        <div className={styles.items}>
          {buttons.map((button) => {
            const className = `${styles.action} ${button.isHighlight ? styles.active : ""}`;
            const content = (
              <>
                <span className={styles.itemShield} aria-hidden="true"><RoyalShield /></span>
                <span className={styles.icon} aria-hidden="true">{button.icon}</span>
                <span className={styles.tooltip} aria-hidden="true">{button.name}</span>
              </>
            );
            return (
              <div key={button.name} className={styles.item}>
                {button.action === "link" && button.link ? (
                  <Link href={button.link} className={className} aria-label={button.name}
                    aria-current={button.isHighlight ? "page" : undefined}
                    {...getRemoteControlProps(button)}>
                    {content}
                  </Link>
                ) : (
                  <button type="button" className={className} aria-label={button.name}
                    onClick={onQuoteClick} {...getRemoteControlProps(button)}>
                    {content}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <RoyalJewel className={styles.centerJewel} />
      </nav>
    </div>
  );
}
