"use client";

import HeroSection from "@/components/sections/HeroSection";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import LuxuryVillaPreloader from "@/components/ui/LuxuryVillaPreloader";
import { canWarmVillaMasterPlan, observeVillaMasterPlanOpening, scheduleVillaMasterPlanBuffering, warmVillaMasterPlanAssets } from "@/lib/villa-masterplan-preload";
import { HOME_WARMUP_MAX_WAIT_MS } from "@/lib/masterplan-warmup-policy";

const ModelWarmup = dynamic(() => import("./VillaMasterPlanModelWarmup"), { ssr: false });

export default function HomePageClient({ imageSrc }: { imageSrc: string }) {
  const [imageReady, setImageReady] = useState(false);
  const [warming, setWarming] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoSettled, setVideoSettled] = useState(false);
  const [modelSettled, setModelSettled] = useState(false);
  const [deadlineReached, setDeadlineReached] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [complete, setComplete] = useState(false);
  const ready = deadlineReached || (imageReady && (!warming || (videoSettled && modelSettled)));
  const progress = Math.round((imageReady ? 35 : 0) + videoProgress * 35 + (modelSettled ? 30 : 0));
  const handleImageReady = useCallback(() => {
    setWarming(canWarmVillaMasterPlan());
    setImageReady(true);
  }, []);
  const handleModelSettled = useCallback(() => setModelSettled(true), []);
  const handleReveal = useCallback(() => setRevealed(true), []);
  const handleComplete = useCallback(() => { setRevealed(true); setComplete(true); }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDeadlineReached(true), HOME_WARMUP_MAX_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!imageReady || !warming) return;
    const unsubscribe = observeVillaMasterPlanOpening((value, settled) => {
      setVideoProgress(current => Math.max(current, value));
      setVideoSettled(current => current || settled);
    });
    warmVillaMasterPlanAssets();
    return unsubscribe;
  }, [imageReady, warming]);
  useEffect(() => {
    if (!complete || !imageReady || !warming) return;
    return scheduleVillaMasterPlanBuffering();
  }, [complete, imageReady, warming]);

  return (
    <>
      {!complete ? <LuxuryVillaPreloader progress={progress} readyToComplete={ready}
        onRevealStart={handleReveal} onComplete={handleComplete} /> : null}
      {imageReady && warming ? <ModelWarmup onSettled={handleModelSettled} /> : null}
      <main
        aria-hidden={!revealed}
        data-home-static
        data-warmup-model-settled={modelSettled}
        data-warmup-video-settled={videoSettled}
        data-warmup-timeout={deadlineReached}
        className={`app-screen overflow-hidden bg-neutral-950 text-white ${revealed ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <HeroSection imageSrc={imageSrc} onImageReady={handleImageReady} revealContent={revealed} />
      </main>
    </>
  );
}
