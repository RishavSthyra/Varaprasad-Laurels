type ReverseVideo = Pick<HTMLVideoElement,
  "currentTime" | "seeking" | "addEventListener" | "removeEventListener"
> & Partial<Pick<HTMLVideoElement, "requestVideoFrameCallback" | "cancelVideoFrameCallback">>;

type AnimationClock = {
  now: () => number;
  request: (callback: FrameRequestCallback) => number;
  cancel: (id: number) => void;
};

/** Reverse playback must be decoder-paced, not wall-clock seeking: a slow GOP
 * decode must never turn into a multi-frame catch-up jump at the landing. */
export function animateVillaOrbitReverse({ video, start, target, travel, period, fps, onComplete, clock = {
  now: () => performance.now(),
  request: callback => requestAnimationFrame(callback),
  cancel: id => cancelAnimationFrame(id),
} }: {
  video: ReverseVideo;
  start: number;
  target: number;
  travel: number;
  period: number;
  fps: number;
  onComplete: () => void;
  clock?: AnimationClock;
}) {
  const distance = Math.abs(travel);
  let travelled = 0, nextAt = clock.now();
  let raf = 0, paintRaf = 0, presentation = 0;
  let cancelled = false, pending = false, landing = false;

  const cleanup = () => {
    cancelled = true;
    clock.cancel(raf);
    clock.cancel(paintRaf);
    if (presentation) video.cancelVideoFrameCallback?.(presentation);
    video.removeEventListener("seeked", seeked);
  };
  const presented = () => {
    if (cancelled || !pending || video.seeking) return;
    pending = false;
    clock.cancel(paintRaf);
    if (presentation) video.cancelVideoFrameCallback?.(presentation);
    presentation = 0;
    if (landing) {
      cleanup();
      onComplete();
    }
  };
  const seeked = () => {
    if (cancelled || !pending) return;
    // Prefer actual presentation; also cover browsers that omit a frame callback
    // when seeking within the same source frame. Do not seek again before paint.
    clock.cancel(paintRaf);
    paintRaf = clock.request(() => { paintRaf = clock.request(presented); });
  };
  const reverse = (now: number) => {
    if (cancelled) return;
    if (!pending && !video.seeking && now >= nextAt) {
      const remaining = distance - travelled;
      // Ease down over the final twelve frames, without inventing intermediate
      // images or changing the calibrated destination.
      const speed = 1.35 * Math.min(1, Math.max(0.25, Math.sqrt(remaining * fps / 12)));
      nextAt = Math.max(now, nextAt + 1000 / (fps * speed));
      travelled = Math.min(distance, travelled + 1 / fps);
      landing = distance - travelled < 1e-7;
      pending = true;
      if (video.requestVideoFrameCallback) presentation = video.requestVideoFrameCallback(presented);
      video.currentTime = landing ? target : ((start - travelled) % period + period) % period;
    }
    raf = clock.request(reverse);
  };
  video.addEventListener("seeked", seeked);
  raf = clock.request(reverse);
  return cleanup;
}
