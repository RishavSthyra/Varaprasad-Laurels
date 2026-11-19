"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";

type LuxuryVillaPreloaderProps = {
  onComplete: (reason: "played" | "already-seen") => void;
  onRevealStart?: () => void;
  progress?: number;
  readyToComplete?: boolean;
};

const SESSION_KEY = "vara-prasad-panel-preloader-v10-masterplan-warmup";
const PANEL_COUNT = 14;

export default function LuxuryVillaPreloader({
  onComplete,
  onRevealStart,
  progress = 0,
  readyToComplete = true,
}: LuxuryVillaPreloaderProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const panelsRef = useRef<Array<HTMLDivElement | null>>([]);
  const exitStartedRef = useRef(false);
  const visualProgressRef = useRef({ value: 0 });
  const [visualProgress, setVisualProgress] = useState(0);
  const clampedProgress = Math.round(Math.max(0, Math.min(100, progress)));
  const displayedProgress = readyToComplete ? 100 : clampedProgress;

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const context = gsap.context(() => {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      gsap.set(panelsRef.current, { yPercent: 0 });

      if (reduceMotion) {
        gsap.set(
          [logoRef.current, statusRef.current],
          { opacity: 1, y: 0 },
        );
        return;
      }

      const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
      intro
        .fromTo(
          logoRef.current,
          { autoAlpha: 0, y: 20 },
          { autoAlpha: 1, y: 0, duration: 0.62 },
          0.05,
        )
        .fromTo(
          statusRef.current,
          { autoAlpha: 0, y: 16 },
          { autoAlpha: 1, y: 0, duration: 0.5 },
          0.18,
        );
    }, root);

    return () => context.revert();
  }, []);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(SESSION_KEY) === "1") {
        onRevealStart?.();
        onComplete("already-seen");
      }
    } catch {
      // Storage can be unavailable in restrictive browser modes.
    }
  }, [onComplete, onRevealStart]);

  useEffect(() => {
    if (!progressRef.current || exitStartedRef.current) return;

    const tween = gsap.to(progressRef.current, {
      clipPath: `inset(${100 - displayedProgress}% 0% 0% 0%)`,
      duration: 0.5,
      ease: "power3.out",
      overwrite: true,
    });

    return () => {
      tween.kill();
    };
  }, [displayedProgress]);

  useEffect(() => {
    const currentValue = visualProgressRef.current.value;
    const distance = Math.max(0, displayedProgress - currentValue);
    const tween = gsap.to(visualProgressRef.current, {
      value: displayedProgress,
      duration:
        displayedProgress === 100
          ? 0.55
          : Math.max(0.35, Math.min(1.15, distance / 85)),
      ease: "power2.out",
      overwrite: true,
      onUpdate: () => {
        setVisualProgress(Math.round(visualProgressRef.current.value));
      },
    });

    return () => {
      tween.kill();
    };
  }, [displayedProgress]);

  useEffect(() => {
    if (!readyToComplete || exitStartedRef.current || !rootRef.current) return;
    exitStartedRef.current = true;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion) {
      onRevealStart?.();
      const timer = window.setTimeout(() => {
        try {
          window.sessionStorage.setItem(SESSION_KEY, "1");
        } catch {
          // Storage can be unavailable in restrictive browser modes.
        }
        onComplete("played");
      }, 160);
      return () => window.clearTimeout(timer);
    }

    const timeline = gsap.timeline({
      delay: 0.45,
      onComplete: () => {
        try {
          window.sessionStorage.setItem(SESSION_KEY, "1");
        } catch {
          // Storage can be unavailable in restrictive browser modes.
        }
        onComplete("played");
      },
    });

    timeline
      .to(contentRef.current, {
        autoAlpha: 0,
        y: -12,
        duration: 0.18,
        ease: "power2.inOut",
      })
      .call(() => onRevealStart?.())
      .set(backgroundRef.current, { autoAlpha: 0 })
      .to(
        panelsRef.current,
        {
          yPercent: -101,
          duration: 0.85,
          stagger: { each: 0.035, from: "end" },
          ease: "power4.inOut",
        },
        "+=0.02",
      );

    return () => {
      timeline.kill();
    };
  }, [onComplete, onRevealStart, readyToComplete]);

  return (
    <div
      ref={rootRef}
      data-luxury-villa-preloader
      role="status"
      aria-live="polite"
      aria-label={`Preparing the Vara Prasad villa experience ${displayedProgress}%`}
      className="fixed inset-0 z-[9999] isolate overflow-hidden text-[#e8dec0]"
    >
      <div
        ref={backgroundRef}
        className="absolute inset-0 bg-[#00142b]"
        aria-hidden="true"
      />

      <div className="absolute inset-0 z-20 flex" aria-hidden="true">
        {Array.from({ length: PANEL_COUNT }, (_, index) => (
          <div
            key={index}
            ref={(node) => {
              panelsRef.current[index] = node;
            }}
            className="relative h-full flex-1 will-change-transform [backface-visibility:hidden]"
          >
            <span className="absolute -left-px -right-px inset-y-0 bg-[#00142b]" />
          </div>
        ))}
      </div>

      <div
        ref={contentRef}
        className="relative z-30 flex min-h-screen min-h-[100svh] items-center justify-center px-6 py-8"
      >
        <div className="flex w-full max-w-[34rem] flex-col items-center text-center">
            <div
              ref={logoRef}
              className="relative h-[clamp(9rem,23vh,13.5rem)]"
            >
              <Image
                src="/vp_cons_images_Cropped.webp"
                alt="Vara Prasad Constructions"
                width={103}
                height={201}
                priority
                className="h-full w-auto select-none object-contain opacity-[0.13]"
                draggable={false}
              />
              <div
                ref={progressRef}
                className="absolute inset-0 will-change-[clip-path]"
                style={{ clipPath: "inset(100% 0% 0% 0%)" }}
                aria-hidden="true"
              >
                <Image
                  src="/vp_cons_images_Cropped.webp"
                  alt=""
                  width={103}
                  height={201}
                  priority
                  className="h-full w-auto select-none object-contain"
                  draggable={false}
                />
              </div>
            </div>
        </div>

        <div
          ref={statusRef}
          className="font-sora absolute bottom-[max(env(safe-area-inset-bottom),1.25rem)] right-[max(env(safe-area-inset-right),1.25rem)] flex items-start text-[#e8dec0]/72 sm:bottom-8 sm:right-10"
          aria-hidden="true"
        >
          <span className="text-[clamp(5rem,10vw,11rem)] font-light leading-[0.72] tracking-[-0.085em] tabular-nums">
            {visualProgress.toString().padStart(2, "0")}
          </span>
          <span className="ml-3 text-[clamp(0.7rem,1.2vw,1.15rem)] font-light leading-none">
            %
          </span>
        </div>
      </div>
    </div>
  );
}
