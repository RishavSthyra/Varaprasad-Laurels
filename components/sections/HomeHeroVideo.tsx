"use client";

import { useEffect, useRef, useState } from "react";

type Direction = "forward" | "reverse";

/** Two cached clips, one playing at a time. Keep the outgoing last frame
 * visible until the incoming player presents a frame; never reverse-seek AV1.
 */
export default function HomeHeroVideo({ videoSrc, reverseVideoSrc, poster, revealed, onSettled }: {
  videoSrc?: string;
  reverseVideoSrc?: string;
  poster?: string;
  revealed: boolean;
  onSettled?: () => void;
}) {
  const forwardRef = useRef<HTMLVideoElement>(null);
  const reverseRef = useRef<HTMLVideoElement>(null);
  const activeRef = useRef<Direction>("forward");
  const [visible, setVisible] = useState<Direction | null>(null);

  useEffect(() => {
    const forward = forwardRef.current, reverse = reverseRef.current;
    if (!forward || !reverse || !videoSrc) return;
    const players = { forward, reverse };
    let disposed = false, serial = 0, pending: Direction | null = null;
    let reverseFailed = Boolean(reverse.error);
    const callbacks = new Map<HTMLVideoElement, number>();
    const cancelFrames = () => {
      for (const [player, id] of callbacks) player.cancelVideoFrameCallback?.(id);
      callbacks.clear();
    };
    const show = (direction: Direction | null) => {
      // Hide the old player before resetting it to its standby opening frame.
      forward.style.opacity = direction === "forward" ? "1" : "0";
      reverse.style.opacity = direction === "reverse" ? "1" : "0";
      setVisible(direction);
    };
    const start = (direction: Direction, restart = false) => {
      if (disposed || !revealed || document.hidden) return;
      const player = players[direction];
      const other = players[direction === "forward" ? "reverse" : "forward"];
      const token = ++serial;
      pending = direction;
      cancelFrames();
      other.pause();
      if (restart && player.currentTime > 0) player.currentTime = 0;
      const presented = () => {
        callbacks.delete(player);
        if (disposed || token !== serial || document.hidden) return;
        pending = null;
        activeRef.current = direction;
        show(direction);
        if (other.currentTime > 0) other.currentTime = 0;
      };
      void player.play().then(() => {
        if (disposed || token !== serial) return;
        if (player.requestVideoFrameCallback) callbacks.set(player, player.requestVideoFrameCallback(presented));
        else presented();
      }).catch(error => {
        if (disposed || token !== serial || error?.name === "AbortError") return;
        pending = null;
        if (direction === "reverse") {
          reverseFailed = true;
          start("forward", true);
        } else {
          show(null);
          onSettled?.();
        }
      });
    };
    const advance = () => start(activeRef.current === "forward" && reverseVideoSrc && !reverseFailed ? "reverse" : "forward", true);
    const sync = () => {
      if (!revealed || document.hidden) {
        serial++;
        pending = null;
        cancelFrames();
        forward.pause(); reverse.pause();
      } else if (players[activeRef.current].ended) advance();
      else start(activeRef.current);
    };
    const onForwardEnded = () => { if (activeRef.current === "forward" && !pending) advance(); };
    const onReverseEnded = () => { if (activeRef.current === "reverse" && !pending) advance(); };
    const onReverseError = () => {
      reverseFailed = true;
      if (activeRef.current === "reverse" || pending === "reverse") start("forward", true);
    };
    const onForwardError = () => {
      serial++; pending = null; cancelFrames();
      forward.pause(); reverse.pause(); show(null); onSettled?.();
    };
    forward.addEventListener("ended", onForwardEnded);
    reverse.addEventListener("ended", onReverseEnded);
    forward.addEventListener("error", onForwardError);
    reverse.addEventListener("error", onReverseError);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      disposed = true; serial++; cancelFrames();
      forward.pause(); reverse.pause();
      forward.removeEventListener("ended", onForwardEnded);
      reverse.removeEventListener("ended", onReverseEnded);
      forward.removeEventListener("error", onForwardError);
      reverse.removeEventListener("error", onReverseError);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [videoSrc, reverseVideoSrc, revealed, onSettled]);

  return <>
    <video ref={forwardRef} data-home-hero-video data-home-direction="forward" data-video-visible={visible === "forward"}
      src={videoSrc} poster={poster} muted playsInline preload="auto" disablePictureInPicture aria-hidden="true"
      onLoadedData={onSettled} style={{ opacity: visible === "forward" ? 1 : 0 }}
      className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-center" />
    <video ref={reverseRef} data-home-hero-video data-home-direction="reverse" data-video-visible={visible === "reverse"}
      src={reverseVideoSrc} muted playsInline preload="auto" disablePictureInPicture aria-hidden="true"
      style={{ opacity: visible === "reverse" ? 1 : 0 }}
      className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-center" />
  </>;
}
