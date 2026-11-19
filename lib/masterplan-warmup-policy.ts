export const HOME_WARMUP_MAX_WAIT_MS = 3_500;
export const MASTERPLAN_OPENING_SECONDS = 1.5;
export const MASTERPLAN_BACKGROUND_TARGETS = [3, 6, 10.3] as const;

type MediaBuffer = Pick<HTMLMediaElement, "buffered" | "duration" | "readyState">;

/** Only a continuous range starting at frame zero counts as opening readiness. */
export function getOpeningBufferProgress(video: MediaBuffer, seconds = MASTERPLAN_OPENING_SECONDS) {
  const target = Number.isFinite(video.duration) && video.duration > 0
    ? Math.min(seconds, video.duration) : seconds;
  let end = 0;
  for (let index = 0; index < video.buffered.length; index++) {
    if (video.buffered.start(index) > end + 1 / 30) break;
    end = Math.max(end, video.buffered.end(index));
  }
  const progress = Math.max(0, Math.min(1, end / target));
  // A buffered byte range alone is insufficient: the first frame must decode.
  return video.readyState >= 2 ? progress : Math.min(progress, 0.9);
}

export function shouldWarmMasterplan(connection?: { saveData?: boolean; effectiveType?: string }, hidden = false) {
  return !hidden && !connection?.saveData && !/(^|-)2g$/.test(connection?.effectiveType ?? "");
}
