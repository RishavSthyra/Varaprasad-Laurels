"use client";

import { useCallback, useEffect, useState } from "react";
import HeroSection from "@/components/sections/HeroSection";
import LuxuryVillaPreloader from "@/components/ui/LuxuryVillaPreloader";
import { scheduleAmenityVideoWarmup } from "@/lib/amenity-video-warmup";
import { primeSignedAssetUrls } from "@/src/lib/signed-assets";
import { useSignedAssetUrls } from "@/src/lib/use-signed-assets";
import type { HomeDeveloperConfig } from "@/types/developer-config";

const HERO_STARTUP_TIMEOUT_MS = 8_000;

export default function HomePageClient({
  config,
  initialSignedAssetUrls = {},
}: {
  config: HomeDeveloperConfig;
  initialSignedAssetUrls?: Record<string, string>;
}) {
  const {
    heroVideoKey,
    heroLoopVideoKey,
    heroMobileFallbackKey,
    heroStageFallbackKey,
    heroPosterKey,
    heroLogoKey,
  } = config;
  primeSignedAssetUrls(initialSignedAssetUrls);
  const signedAssetUrls = useSignedAssetUrls([
    heroVideoKey,
    heroLoopVideoKey,
    heroMobileFallbackKey,
    heroStageFallbackKey,
    heroPosterKey,
    heroLogoKey,
  ]);
  const resolve = (key: string) =>
    signedAssetUrls[key] ?? initialSignedAssetUrls[key] ?? null;
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [introComplete, setIntroComplete] = useState(false);
  const [heroRevealStarted, setHeroRevealStarted] = useState(false);
  const [heroReady, setHeroReady] = useState(false);
  const [startupTimedOut, setStartupTimedOut] = useState(false);

  // One bounded wait for the visible video. Slow/blocked media must not trap
  // visitors behind the loader; the configured poster and navigation still work.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setStartupTimedOut(true);
    }, HERO_STARTUP_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!heroReady && !startupTimedOut) return;
    const timer = window.setTimeout(() => setLoading(false), 100);
    return () => window.clearTimeout(timer);
  }, [heroReady, startupTimedOut]);

  // Nonessential media only warms once the homepage has been revealed.
  useEffect(() => {
    if (!introComplete) return;
    return scheduleAmenityVideoWarmup({ profile: "home" });
  }, [introComplete]);

  const handleHeroVideoProgressChange = useCallback((nextProgress: number) => {
    setProgress((current) =>
      Math.max(current, Math.min(96, Math.round(nextProgress * 100))),
    );
  }, []);
  const handleHeroRevealStart = useCallback(() => {
    setHeroRevealStarted(true);
  }, []);
  const handleIntroComplete = useCallback(() => {
    setLoading(false);
    setHeroRevealStarted(true);
    setIntroComplete(true);
  }, []);

  return (
    <>
      {!introComplete ? (
        <LuxuryVillaPreloader
          progress={!loading ? 100 : progress}
          readyToComplete={!loading}
          onRevealStart={handleHeroRevealStart}
          onComplete={handleIntroComplete}
        />
      ) : null}
      <main
        aria-hidden={!heroRevealStarted}
        className={`app-screen overflow-hidden bg-neutral-950 text-white transition-opacity duration-300 ${
          heroRevealStarted ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <HeroSection
          heroLogoSrc={resolve(heroLogoKey)}
          heroPosterSrc={resolve(heroPosterKey) ?? resolve(heroStageFallbackKey)}
          heroVideoSrc={resolve(heroVideoKey)}
          heroLoopVideoSrc={heroReady || startupTimedOut ? resolve(heroLoopVideoKey) : null}
          staticHeroImageSrc={resolve(heroMobileFallbackKey)}
          playIntroAnimation={!loading}
          onHeroReadyChange={setHeroReady}
          onHeroVideoProgressChange={handleHeroVideoProgressChange}
        />
      </main>
    </>
  );
}
