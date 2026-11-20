import { MasterplanVideoCache as MediaAssetCache } from "./masterplan-video-cache";
import { HOME_HERO_IMAGE_SRC, HOME_HERO_VIDEO_SRC, HOME_HERO_IMAGE_BYTES, HOME_HERO_VIDEO_BYTES, HOME_HERO_REVERSE_VIDEO_SRC, HOME_HERO_REVERSE_VIDEO_BYTES } from "./home-hero";

export const HOME_POSTER_CACHE = "laurels-home-poster-v1";
export const HOME_VIDEO_CACHE = "laurels-home-video-v1";
export const HOME_REVERSE_VIDEO_CACHE = "laurels-home-reverse-video-v1";

let assets: { poster: MediaAssetCache; video: MediaAssetCache; reverse: MediaAssetCache } | undefined;

/** Three bounded encoded blobs, shared across client navigation/Strict Mode.
 * Restore CacheStorage before fetching; the cache itself creates no decoders.
 * Separate caches keep revision pruning from deleting the other hero asset.
 */
export function getHomeHeroAssets() {
  if (typeof window === "undefined") throw new Error("Homepage media cache is browser-only");
  const create = (url: string, bytes: number, mime: string, cacheName: string) => new MediaAssetCache({
    url, bytes, mime, rangeRequests: false, priority: "high",
    fetch: window.fetch.bind(window),
    storage: async () => "caches" in window ? caches.open(cacheName) : undefined,
    objectURL: blob => URL.createObjectURL(blob),
  });
  return assets ??= {
    poster: create(HOME_HERO_IMAGE_SRC, HOME_HERO_IMAGE_BYTES, "image/avif", HOME_POSTER_CACHE),
    video: create(HOME_HERO_VIDEO_SRC, HOME_HERO_VIDEO_BYTES, "video/mp4", HOME_VIDEO_CACHE),
    reverse: create(HOME_HERO_REVERSE_VIDEO_SRC, HOME_HERO_REVERSE_VIDEO_BYTES, "video/mp4", HOME_REVERSE_VIDEO_CACHE),
  };
}
