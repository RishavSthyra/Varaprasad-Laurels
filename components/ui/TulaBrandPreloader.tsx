"use client";

import { motion, useReducedMotion } from "framer-motion";
import PreloaderCornerLogo from "@/components/ui/PreloaderCornerLogo";

const TULA_LOGO_URL = "/vp_cons_images.webp";

type TulaBrandPreloaderProps = {
  progress?: number;
};

export default function TulaBrandPreloader({
  progress = 0,
}: TulaBrandPreloaderProps) {
  const clampedProgress = Math.max(0, Math.min(100, Math.round(progress)));
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      data-tula-brand-preloader
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: reduceMotion ? 0.15 : 0.55,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="fixed inset-0 z-[9999] overflow-hidden bg-[#00142b]"
      role="status"
      aria-label={`Loading exterior panoramas ${clampedProgress}%`}
    >
      <div className="[&_img]:brightness-0 [&_img]:invert [&_img]:opacity-70 [&_img]:sepia">
        <PreloaderCornerLogo />
      </div>
      <div className="absolute inset-[-8%] bg-[radial-gradient(ellipse_62%_46%_at_18%_74%,rgba(41,79,116,0.28)_0%,rgba(13,43,71,0.16)_46%,transparent_74%),radial-gradient(ellipse_54%_40%_at_86%_18%,rgba(206,195,160,0.12)_0%,transparent_70%),radial-gradient(ellipse_74%_58%_at_50%_42%,rgba(13,48,79,0.32)_0%,rgba(0,20,43,0.18)_42%,transparent_72%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_68%_54%_at_50%_48%,transparent_0%,rgba(18,29,15,0.14)_58%,rgba(12,21,11,0.38)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(13,23,11,0.24)_0%,transparent_28%,transparent_72%,rgba(13,22,11,0.30)_100%)]" />

      <div
        className="pointer-events-none absolute inset-0 z-[1] hidden overflow-hidden xl:block"
        aria-hidden="true"
      >
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rotate-45 border border-[#cec3a0]/10" />
        <div className="absolute -right-20 -top-20 h-72 w-72 rotate-45 border border-[#cec3a0]/10" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-7">
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{
            duration: reduceMotion ? 0.2 : 0.85,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="flex flex-col items-center"
          style={{ width: "clamp(200px, 34vw, 520px)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="select-none drop-shadow-[0_18px_42px_rgba(22,31,18,0.34)]"
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              maxHeight: "clamp(220px, 42vh, 540px)",
              objectFit: "contain",
            }}
            src={TULA_LOGO_URL}
            alt="Vara Prasad Constructions"
            width={401}
            height={201}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            draggable={false}
          />
          <span
            className="text-center font-normal uppercase leading-[1.2] tracking-[0.08em] text-[#f3eddd]/78"
            style={{
              marginTop: "clamp(0.55rem, 1.3vh, 1.25rem)",
              fontSize: "clamp(0.56rem, 0.8vw, 0.98rem)",
            }}
          >
            Laurels · Private Villa Estate
          </span>

          <div
            className="h-px w-full overflow-hidden bg-[#f3eddd]/20"
            style={{ marginTop: "clamp(1rem, 2vh, 1.75rem)" }}
            aria-hidden
          >
            <motion.div
              className="h-full origin-left bg-[#f3eddd] shadow-[0_0_12px_rgba(243,237,221,0.38)]"
              initial={false}
              animate={{ scaleX: clampedProgress / 100 }}
              transition={{
                duration: reduceMotion ? 0.15 : 0.45,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
