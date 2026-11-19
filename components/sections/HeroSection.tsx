"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { BsArrowRight } from "react-icons/bs";
import { Landmark } from "lucide-react";
import { Cormorant_Garamond } from "next/font/google";
import DesktopSiteRail from "@/components/DesktopSiteRail";
import { warmVillaMasterPlanAssets } from "@/lib/villa-masterplan-preload";

const heroSerif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal"],
  variable: "--font-hero-serif",
});

type IdleCapableWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions,
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;

function HeroMagneticButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <div className="hero-liquid-wrap ml-auto inline-flex">
      <button
        className="hero-liquid-button"
        onClick={onClick}
        type="button"
      >
        <span className="hero-liquid-text">
          Explore Master Plan
          <BsArrowRight className="text-[0.9rem] text-[#cec3a0]" aria-hidden />
        </span>
      </button>
    </div>
  );
}

type HeroSectionProps = { imageSrc: string };

export default function HeroSection({ imageSrc }: HeroSectionProps) {
  const router = useRouter();
  const sectionRef = useRef<HTMLElement | null>(null);
  const scrollLockRef = useRef(false);

  const [imageReady, setImageReady] = useState(false);

  const line1 = "A Private World,";
  const line2Prefix = "Entirely";
  const line2Accent = "Your Own";

  const contentWrap: Variants = {
    hidden: {
      transition: {
        staggerChildren: 0,
      },
    },
    show: {
      transition: {
        staggerChildren: 0.08,
      },
    },
    exit: {
      transition: {
        staggerChildren: 0.09,
        staggerDirection: -1,
      },
    },
  };

  const contentItem: Variants = {
    hidden: {
      opacity: 0,
      y: 18,
      filter: "blur(8px)",
      transition: {
        duration: 0.24,
        ease: [0.4, 0, 0.2, 1] as const,
      },
    },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1] as const,
      },
    },
    exit: {
      opacity: 0,
      y: -56,
      filter: "blur(14px)",
      transition: {
        duration: 0.75,
        ease: [0.4, 0, 0.2, 1] as const,
      },
    },
  };

  const goToMasterPlan = useCallback(() => {
    if (scrollLockRef.current) return;

    scrollLockRef.current = true;
    warmVillaMasterPlanAssets(true);
    router.push("/master-plan");
  }, [router]);

  useEffect(() => {
    if (!imageReady) return;

    let timeoutId: TimeoutHandle | null = null;
    let idleId: number | null = null;
    const idleWindow = window as IdleCapableWindow;

    const warmMasterPlan = () => {
      router.prefetch("/master-plan");
      warmVillaMasterPlanAssets();
    };

    if (typeof idleWindow.requestIdleCallback === "function") {
      idleId = idleWindow.requestIdleCallback(warmMasterPlan, {
        timeout: 1200,
      });
    } else {
      timeoutId = globalThis.setTimeout(warmMasterPlan, 400);
    }

    return () => {
      if (
        idleId !== null &&
        typeof idleWindow.cancelIdleCallback === "function"
      ) {
        idleWindow.cancelIdleCallback(idleId);
      }

      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }
    };
  }, [router, imageReady]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY <= 20) return;
      if (scrollLockRef.current) return;

      e.preventDefault();
      goToMasterPlan();
    };

    el.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, [goToMasterPlan]);

  return (
    <section
      ref={sectionRef}
      className="relative app-screen w-full overflow-hidden bg-black text-white"
    >
      <Image
        src={imageSrc}
        alt="Laurels villa estate entrance"
        fill
        unoptimized
        loading="eager"
        fetchPriority="high"
        sizes="100vw"
        className="pointer-events-none select-none object-cover object-center"
        onLoad={() => setImageReady(true)}
      />

      <style jsx global>{`
        .hero-liquid-wrap {
          position: relative;
          z-index: 2;
          display: inline-flex;
          overflow: visible;
        }

        .hero-liquid-button {
          all: unset;
          position: relative;
          display: inline-flex;
          min-width: 12.5rem;
          height: clamp(2.5rem, 6vh, 3rem);
          cursor: pointer;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          overflow: hidden;
          border-radius: 999vw;
          border: 1px solid rgba(206, 195, 160, 0.62);
          background: rgba(0, 20, 43, 0.58);
          box-shadow: none;
          -webkit-backdrop-filter: blur(20px) saturate(1.16);
          backdrop-filter: blur(20px) saturate(1.16);
          transition: border-color 260ms ease;
        }

        .hero-liquid-button:hover {
          border-color: rgba(232, 222, 192, 0.94);
          background: rgba(0, 20, 43, 0.76);
          box-shadow: 0 14px 36px rgba(0, 11, 25, 0.28);
        }

        .hero-liquid-text {
          position: relative;
          z-index: 2;
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          padding-inline: 1.1rem;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.16em;
          color: rgba(250, 248, 242, 0.96);
          text-shadow: 0 1px 0 rgba(0, 10, 24, 0.32);
          text-transform: uppercase;
          user-select: none;
          transition:
            color 260ms ease,
            text-shadow 260ms ease;
        }

        .hero-liquid-button:hover .hero-liquid-text {
          color: rgba(247, 250, 245, 1);
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.34);
        }

        .hero-bottom-dock {
          --anim-hover-time: 400ms;
          --anim-hover-ease: cubic-bezier(0.25, 1, 0.5, 1);
          --border-width: 1px;
          position: relative;
          isolation: isolate;
          overflow: hidden;
          border-radius: 999px;
          border: 0;
          background:
            linear-gradient(
              -75deg,
              rgba(24, 62, 25, 0.16),
              rgba(118, 176, 88, 0.2),
              rgba(9, 34, 17, 0.2)
            );
          box-shadow:
            inset 0 0.125em 0.125em rgba(0, 0, 0, 0.16),
            inset 0 -0.125em 0.125em rgba(235, 255, 216, 0.28),
            0 0.25em 0.125em -0.125em rgba(0, 0, 0, 0.28),
            0 0 0.1em 0.18em inset rgba(180, 235, 142, 0.14),
            0 14px 34px rgba(0, 0, 0, 0.18);
          -webkit-backdrop-filter: blur(4px) saturate(1.35);
          backdrop-filter: blur(0.5px) saturate(1.35);
          transition: all var(--anim-hover-time) var(--anim-hover-ease);
        }

        .hero-bottom-dock:hover {
          -webkit-backdrop-filter: blur(0.5px) saturate(1.45);
          backdrop-filter: blur(0.5px) saturate(1.45);
          box-shadow:
            inset 0 0.125em 0.125em rgba(0, 0, 0, 0.16),
            inset 0 -0.125em 0.125em rgba(235, 255, 216, 0.42),
            0 0.15em 0.05em -0.1em rgba(0, 0, 0, 0.3),
            0 0 0.05em 0.12em inset rgba(204, 255, 172, 0.24),
            0 12px 30px rgba(0, 0, 0, 0.16);
        }

        .hero-bottom-dock::before {
          content: "";
          position: absolute;
          z-index: 1;
          inset: 0;
          border-radius: inherit;
          background:
            linear-gradient(
              var(--hero-liquid-angle-2),
              rgba(255, 255, 255, 0) 0%,
              rgba(236, 255, 212, 0.28) 40% 50%,
              rgba(255, 255, 255, 0) 55%
            );
          background-size: 200% 200%;
          background-position: 0% 50%;
          mix-blend-mode: screen;
          pointer-events: none;
          transition:
            background-position 500ms var(--anim-hover-ease),
            --hero-liquid-angle-2 500ms var(--anim-hover-ease);
        }

        .hero-bottom-dock:hover::before {
          background-position: 25% 50%;
        }

        .hero-bottom-dock::after {
          content: "";
          position: absolute;
          z-index: 2;
          inset: calc(var(--border-width) / -2);
          border-radius: inherit;
          padding: var(--border-width);
          box-sizing: border-box;
          background:
            conic-gradient(
              from var(--hero-liquid-angle-1) at 50% 50%,
              rgba(5, 39, 11, 0.62),
              rgba(22, 74, 20, 0) 5% 40%,
              rgba(214, 255, 178, 0.42) 50%,
              rgba(22, 74, 20, 0) 60% 95%,
              rgba(5, 39, 11, 0.62)
            ),
            linear-gradient(180deg, rgba(222, 255, 194, 0.28), rgba(40, 100, 34, 0.24));
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask-composite: exclude;
          pointer-events: none;
          transition:
            all var(--anim-hover-time) var(--anim-hover-ease),
            --hero-liquid-angle-1 500ms ease;
        }

        .hero-bottom-dock:hover::after {
          --hero-liquid-angle-1: -125deg;
        }

        .hero-bottom-dock > * {
          position: relative;
          z-index: 3;
        }

        .hero-bottom-dock-link {
          position: relative;
          color: rgba(229, 249, 216, 0.88);
          transition:
            background-color 180ms cubic-bezier(0.25, 1, 0.5, 1),
            color 180ms cubic-bezier(0.25, 1, 0.5, 1);
        }

        .hero-bottom-dock-link:hover,
        .hero-bottom-dock-link:focus-visible {
          color: rgba(244, 255, 235, 1);
          background: rgba(202, 255, 169, 0.1);
          box-shadow:
            inset 0 1px 0 rgba(239, 255, 224, 0.18),
            inset 0 -1px 0 rgba(0, 0, 0, 0.18),
            0 8px 20px rgba(0, 0, 0, 0.18);
        }

        .hero-bottom-dock-icon {
          width: 1.05rem;
          height: 1.05rem;
          filter: drop-shadow(0 0.18em 0.08em rgba(0, 0, 0, 0.26));
        }
      `}</style>

      <div
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{
          background: [
            "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 15%, rgba(0,0,0,0) 36%)",
            "radial-gradient(ellipse at 100% 100%, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.42) 30%, rgba(0,0,0,0.14) 53%, rgba(0,0,0,0) 72%)",
            "linear-gradient(270deg, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.2) 28%, rgba(0,0,0,0) 62%)",
            "linear-gradient(0deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 36%)",
          ].join(", "),
        }}
      />

      <DesktopSiteRail className="absolute left-6 top-1/2 z-20 -translate-y-1/2 2xl:left-7" />

      <div className="absolute inset-0 z-10 flex items-end justify-end px-6 pb-[max(calc(env(safe-area-inset-bottom)+5rem),8vh)] pt-24 sm:px-10 sm:pb-[clamp(2rem,7vh,5rem)] lg:px-12 xl:px-16 2xl:px-20">
        <motion.div
          variants={contentWrap}
          initial="hidden"
          animate="show"
          data-home-hero-copy
          className="ml-auto w-full max-w-[34rem] text-right"
        >
          <motion.div variants={contentItem}>
            <h1
              className={`${heroSerif.className} text-[clamp(1.7rem,2.5vw,3rem)] font-normal uppercase leading-[1.04] tracking-[0.035em] text-[#faf8f2] opacity-95 drop-shadow-[0_18px_46px_rgba(0,0,0,0.52)]`}
            >
              <span className="block whitespace-nowrap">{line1}</span>
              <span className="mt-1.5 block whitespace-nowrap">
                {line2Prefix}{" "}
                <span className="text-[#cec3a0] drop-shadow-[0_0_24px_rgba(206,195,160,0.18)]">
                  {line2Accent}
                </span>
              </span>
            </h1>
          </motion.div>

          <motion.div
            variants={contentItem}
            className="mt-4 ml-auto flex w-full max-w-[25rem] items-center text-[#cec3a0]/75"
          >
            <span className="h-px w-10 bg-[#cec3a0]/72" />
            <span className="mx-2.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#dff2b8]/20 bg-white/[0.06] backdrop-blur-md">
              <Landmark className="h-3.5 w-3.5" strokeWidth={1.35} />
            </span>
            <span className="h-px flex-1 bg-gradient-to-r from-[#cec3a0]/58 via-[#cec3a0]/28 to-transparent" />
          </motion.div>

          <motion.p
            variants={contentItem}
            className="mt-3 ml-auto max-w-[26rem] text-xs leading-[1.7] tracking-[0.025em] text-[#faf8f2]/80 sm:text-[13px] 2xl:text-sm"
          >
            Thoughtfully designed villas shaped by open sky, private gardens, and enduring architecture.
          </motion.p>

          <motion.div variants={contentItem} className="mt-5 flex justify-end">
            <HeroMagneticButton onClick={goToMasterPlan} />
          </motion.div>
        </motion.div>
      </div>

      <style jsx>{`
        @media (min-width: 641px) and (max-height: 800px) {
          h1 {
            font-size: clamp(1.6rem, 2.6vw, 2.75rem);
          }
        }

        @media (max-width: 640px) {
          h1 {
            font-size: clamp(1.3rem, 6.2vw, 2rem);
            letter-spacing: 0.025em;
          }
        }
      `}</style>
    </section>
  );
}
