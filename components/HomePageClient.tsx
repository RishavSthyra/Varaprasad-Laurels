"use client";

import HeroSection from "@/components/sections/HeroSection";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import LuxuryVillaPreloader from "@/components/ui/LuxuryVillaPreloader";
import { canWarmVillaMasterPlan, observeVillaMasterPlanOpening, scheduleVillaMasterPlanBuffering, warmVillaMasterPlanAssets } from "@/lib/villa-masterplan-preload";
import { HOME_HERO_WARMUP_MAX_WAIT_MS } from "@/lib/home-hero";
import { getHomeHeroAssets } from "@/lib/home-hero-cache";

const ModelWarmup = dynamic(() => import("./VillaMasterPlanModelWarmup"), { ssr: false });

export default function HomePageClient({ imageSrc, videoSrc, reverseVideoSrc }: { imageSrc: string; videoSrc: string; reverseVideoSrc: string }) {
  const [imageReady, setImageReady] = useState(false);
  const [posterSource, setPosterSource] = useState<string>();
  const [videoSource, setVideoSource] = useState<string>();
  const [reverseSource, setReverseSource] = useState<string>();
  const [assetProgress, setAssetProgress] = useState({ poster: 0, video: 0, reverse: 0 });
  const [assetsSettled, setAssetsSettled] = useState(false);
  const [assetsCached, setAssetsCached] = useState(false);
  const [heroVideoSettled, setHeroVideoSettled] = useState(false);
  const [videoSettled, setVideoSettled] = useState(false);
  const [modelSettled, setModelSettled] = useState(false);
  const [deadlineReached, setDeadlineReached] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [complete, setComplete] = useState(false);
  const warming = imageReady && assetsSettled && heroVideoSettled && canWarmVillaMasterPlan();
  const ready = deadlineReached || (imageReady && assetsSettled && heroVideoSettled);
  const progress = Math.round(assetProgress.poster * 20 + (assetProgress.video + assetProgress.reverse) * 32.5 + (imageReady ? 5 : 0) + (heroVideoSettled ? 10 : 0));
  const handleImageReady = useCallback(() => setImageReady(true), []);
  const handleVideoSettled = useCallback(() => setHeroVideoSettled(true), []);
  const handleModelSettled = useCallback(() => setModelSettled(true), []);
  const handleReveal = useCallback(() => setRevealed(true), []);
  const handleComplete = useCallback(() => { setRevealed(true); setComplete(true); }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDeadlineReached(true), HOME_HERO_WARMUP_MAX_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    let active = true;
    const assets = getHomeHeroAssets();
    const update = () => {
      if (!active) return;
      const poster = assets.poster.getStatus(), video = assets.video.getStatus(), reverse = assets.reverse.getStatus();
      setAssetProgress({ poster: poster.bytes / poster.total, video: video.bytes / video.total, reverse: reverse.bytes / reverse.total });
      if (poster.objectURL) setPosterSource(poster.objectURL);
      else if (poster.error) setPosterSource(imageSrc);
      if (video.objectURL) setVideoSource(video.objectURL);
      else if (video.error) setVideoSource(videoSrc);
      if (reverse.objectURL) setReverseSource(reverse.objectURL);
      else if (reverse.error) setReverseSource(reverseVideoSrc);
    };
    const unsubscribePoster = assets.poster.subscribe(update);
    const unsubscribeVideo = assets.video.subscribe(update);
    const unsubscribeReverse = assets.reverse.subscribe(update);
    update();
    void Promise.all([assets.poster.warm(), assets.video.warm(), assets.reverse.warm()]).then(() => {
      if (!active) return;
      update();
      // CORS/cache/storage failures must not strand the visitor in a loader.
      // Direct native media keeps the supplied poster/video as the fallback.
      setPosterSource(assets.poster.getStatus().objectURL ?? imageSrc);
      setVideoSource(assets.video.getStatus().objectURL ?? videoSrc);
      setReverseSource(assets.reverse.getStatus().objectURL ?? reverseVideoSrc);
      setAssetsCached(Boolean(assets.poster.getStatus().objectURL && assets.video.getStatus().objectURL && assets.reverse.getStatus().objectURL));
      setAssetsSettled(true);
    });
    return () => { active = false; unsubscribePoster(); unsubscribeVideo(); unsubscribeReverse(); };
  }, [imageSrc, videoSrc, reverseVideoSrc]);
  useEffect(() => {
    if (!imageReady || !warming) return;
    const unsubscribe = observeVillaMasterPlanOpening((_progress, settled) => {
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
      {!complete ? <LuxuryVillaPreloader progress={progress} readyToComplete={ready} skipIfSeen={false}
        onRevealStart={handleReveal} onComplete={handleComplete} /> : null}
      {imageReady && warming ? <ModelWarmup onSettled={handleModelSettled} /> : null}
      <main
        aria-hidden={!revealed}
        data-home-media
        data-home-assets-cached={assetsCached}
        data-home-assets-settled={assetsSettled}
        data-home-video-settled={heroVideoSettled}
        data-warmup-model-settled={modelSettled}
        data-warmup-video-settled={videoSettled}
        data-warmup-timeout={deadlineReached}
        className={`app-screen overflow-hidden bg-neutral-950 text-white ${revealed ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <HeroSection imageSrc={posterSource} videoSrc={videoSource} reverseVideoSrc={reverseSource}
          onImageReady={handleImageReady} onVideoSettled={handleVideoSettled} revealContent={revealed} />
      </main>
    </>
  );
}
