"use client";

import Image from "next/image";
import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** Homepage branding without the lifting panels or its session-only dismissal.
 * Progress is supplied by the actual first-pano loading state. */
export default function ExteriorWalkthroughPreloader({ progress = 0 }: { progress?: number }) {
  const clampedProgress = Math.max(0, Math.min(100, Math.round(progress)));
  const reduceMotion = useReducedMotion();
  const isClient = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const value = useMotionValue(clampedProgress);
  const percentage = useTransform(value, current => Math.round(current).toString().padStart(2, "0"));
  const logoFill = useTransform(value, current => `inset(${100 - current}% 0% 0% 0%)`);

  useEffect(() => {
    const tween = animate(value, clampedProgress, { duration: reduceMotion ? 0 : 0.35, ease: "easeOut" });
    return () => tween.stop();
  }, [clampedProgress, reduceMotion, value]);

  const overlay = (
    <motion.div
      data-exterior-walkthrough-preloader
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0.1 : 0.25 }}
      role="status"
      aria-live="polite"
      aria-label={`Preparing the Vara Prasad exterior walkthrough ${clampedProgress}%`}
      className="fixed inset-0 z-[2147483646] isolate overflow-hidden bg-[#00142b] text-[#e8dec0]"
    >
      <div aria-hidden="true" data-preloader-vectors className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -bottom-28 -left-28 h-72 w-72 rotate-45 border border-[#cec3a0]/10 sm:h-96 sm:w-96" />
        <div className="absolute -right-20 -top-20 h-56 w-56 rotate-45 border border-[#cec3a0]/10 sm:h-72 sm:w-72" />
      </div>
      <div className="relative flex min-h-[100svh] items-center justify-center px-6 py-8">
        <div className="relative h-[clamp(9rem,23vh,13.5rem)]">
          <Image src="/vp_cons_images_Cropped.webp" alt="Vara Prasad Constructions"
            width={103} height={201} priority draggable={false}
            className="h-full w-auto select-none object-contain opacity-[0.13]" />
          <motion.div style={{ clipPath: logoFill }} className="absolute inset-0" aria-hidden="true">
            <Image src="/vp_cons_images_Cropped.webp" alt="" width={103} height={201}
              priority draggable={false} className="h-full w-auto select-none object-contain" />
          </motion.div>
        </div>
        <div aria-hidden="true" className="font-sora absolute bottom-[max(env(safe-area-inset-bottom),1.25rem)] right-[max(env(safe-area-inset-right),1.25rem)] flex items-start text-[#e8dec0]/72 sm:bottom-8 sm:right-10">
          <motion.span className="text-[clamp(5rem,10vw,11rem)] font-light leading-[0.72] tracking-[-0.085em] tabular-nums">{percentage}</motion.span>
          <span className="ml-3 text-[clamp(0.7rem,1.2vw,1.15rem)] font-light leading-none">%</span>
        </div>
      </div>
    </motion.div>
  );
  // Escape the viewer's isolated stacking context so navigation cannot sit on
  // top of, or receive pointer input through, the full-screen loading overlay.
  return isClient ? createPortal(overlay, document.body) : overlay;
}
