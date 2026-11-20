"use client";

import { useEffect, useRef, useState } from "react";
import { getVillaMasterPlanVideo, warmCompleteVillaMasterPlanVideo } from "@/lib/villa-masterplan-preload";
import { getMasterplanVideoCache } from "@/lib/masterplan-video-cache";
import { getVillaMasterPlanVideoTime, getVillaOrbitTravel, VILLA_MASTERPLAN_VIDEO_URL, type VillaOrbitMotion } from "@/lib/villa-masterplan-video";

type Props = {
  src: string; poster?: string; frame: number; fps: number; totalFrames: number;
  motion?: VillaOrbitMotion | null;
  scrubbing?: boolean;
  onMotion: () => void; onSettled: (frame: number) => void; onFailure: () => void;
};

/** Native forward playback through the seam; bounded GOP3 seeks in reverse.
 * Hover returns only once the exact calibrated stop has been decoded. */
export default function VillaMasterPlanVideo({ src, poster = "", frame, fps, totalFrames, motion, scrubbing = false, onMotion, onSettled, onFailure }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const idleRef = useRef(false);
  const promoteRef = useRef<(() => void) | null>(null);
  const freezeRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const video = getVillaMasterPlanVideo(src);
    videoRef.current = video;
    // The server-rendered image beneath us already supplies the poster. Avoid
    // downloading the original large still again through the native player.
    if (poster) video.poster = poster;
    else video.removeAttribute("poster");
    video.preload = "auto";
    video.className = "h-full w-full select-none object-contain opacity-0 transition-opacity duration-200";
    host.appendChild(video);
    const cache = getMasterplanVideoCache();
    let restoring: number | undefined;
    let cacheFailed = false;
    const check = () => {
      if (video.readyState >= 2 && !video.seeking && (restoring === undefined || Math.abs(video.currentTime - restoring) < 1 / fps)) {
        restoring = undefined;
        video.classList.replace("opacity-0", "opacity-100");
        setReady(true);
      }
    };
    const restore = () => { if (restoring !== undefined) video.currentTime = restoring; };
    const promote = () => {
      const full = cache.getStatus().objectURL;
      if (src !== VILLA_MASTERPLAN_VIDEO_URL || !full || video.src === full || cacheFailed || !idleRef.current || !video.paused || video.seeking) return;
      // Preserve the exact current camera while loading the local blob. One
      // transient still, not hundreds of decoded 4K frames held in memory.
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (!context || !canvas.width) return;
      try { context.drawImage(video, 0, 0); } catch { return; }
      canvas.className = "pointer-events-none absolute inset-0 h-full w-full object-contain";
      freezeRef.current?.remove();
      freezeRef.current = canvas;
      host.appendChild(canvas);
      restoring = video.currentTime;
      idleRef.current = false;
      setReady(false);
      onMotion();
      video.src = full;
      video.load();
    };
    promoteRef.current = promote;
    const unsubscribe = cache.subscribe(promote);
    const fail = () => {
      setReady(false);
      if (video.src.startsWith("blob:") && !cacheFailed) {
        cacheFailed = true;
        restoring ??= video.currentTime || getVillaMasterPlanVideoTime(frame, fps, totalFrames);
        video.src = src;
        video.load();
      } else onFailure();
    };
    // Native listeners also handle events fired before React hydration/mount.
    for (const event of ["loadeddata", "canplay", "seeked"]) video.addEventListener(event, check);
    video.addEventListener("loadedmetadata", restore);
    video.addEventListener("error", fail);
    const id = requestAnimationFrame(check);
    if (video.networkState === 0 || video.error) video.load();
    warmCompleteVillaMasterPlanVideo();
    return () => {
      cancelAnimationFrame(id);
      video.pause();
      for (const event of ["loadeddata", "canplay", "seeked"]) video.removeEventListener(event, check);
      video.removeEventListener("error", fail);
      video.removeEventListener("loadedmetadata", restore);
      unsubscribe();
      promoteRef.current = null;
      idleRef.current = false;
      freezeRef.current?.remove();
      freezeRef.current = null;
      if (video.parentElement === host) host.removeChild(video);
      videoRef.current = null;
    };
    // Frame/fps changes belong to the motion effect, not the player lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, poster, onFailure, onMotion]);

  useEffect(() => {
    const video = videoRef.current;
    if (!ready || !video) return;
    const target = getVillaMasterPlanVideoTime(frame, fps, totalFrames);
    const period = totalFrames / fps;
    const start = video.currentTime;
    const travel = getVillaOrbitTravel(start, target, period, motion?.direction);
    let raf = 0, timer = 0, presentation = 0;
    let cancelled = false, finishing = false, settled = false;
    const complete = () => {
      if (cancelled || settled || video.seeking || video.readyState < 2 || Math.abs(video.currentTime - target) > 0.5 / fps) return;
      settled = true;
      if (!scrubbing) {
        idleRef.current = true;
        freezeRef.current?.remove();
        freezeRef.current = null;
        onSettled(frame);
        promoteRef.current?.();
      }
    };
    const finish = () => {
      if (cancelled || finishing) return;
      finishing = true;
      video.pause();
      if (typeof video.requestVideoFrameCallback === "function") presentation = video.requestVideoFrameCallback(complete);
      if (Math.abs(video.currentTime - target) > 0.0001) video.currentTime = target;
      else raf = requestAnimationFrame(complete);
      timer = window.setTimeout(complete, 300);
    };
    const seeked = () => { if (finishing) raf = requestAnimationFrame(() => { raf = requestAnimationFrame(complete); }); };
    video.addEventListener("seeked", seeked);
    video.pause();
    idleRef.current = false;
    onMotion();

    if (scrubbing || Math.abs(travel) < 0.5 / fps) finish();
    else if (travel > 0) {
      // Track unwrapped media time, including the last frame -> first frame.
      let previous = start, travelled = 0;
      video.loop = true;
      video.playbackRate = 1.35;
      const forward = () => {
        if (cancelled) return;
        let delta = video.currentTime - previous;
        if (delta < -period / 2) delta += period;
        travelled += Math.max(0, delta);
        previous = video.currentTime;
        if (travelled >= travel - 0.5 / fps) { finish(); return; }
        raf = requestAnimationFrame(forward);
      };
      void video.play().then(() => { if (!cancelled) raf = requestAnimationFrame(forward); })
        .catch(() => { if (!cancelled) finish(); });
    } else {
      const started = performance.now();
      const reverse = (now: number) => {
        if (cancelled) return;
        if (!video.seeking) {
          const distance = Math.min(-travel, (now - started) / 1000 * 1.35);
          if (distance >= -travel) { finish(); return; }
          video.currentTime = ((start - distance) % period + period) % period;
        }
        raf = requestAnimationFrame(reverse);
      };
      raf = requestAnimationFrame(reverse);
    }
    return () => {
      cancelled = true;
      idleRef.current = false;
      video.pause(); video.loop = false;
      cancelAnimationFrame(raf); window.clearTimeout(timer);
      if (presentation) video.cancelVideoFrameCallback(presentation);
      video.removeEventListener("seeked", seeked);
    };
  }, [fps, frame, motion, onMotion, onSettled, ready, scrubbing, totalFrames]);

  return <div ref={hostRef} className="pointer-events-none absolute inset-0" />;
}
