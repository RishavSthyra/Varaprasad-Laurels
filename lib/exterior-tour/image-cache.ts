import type { PanoImageLoader } from "./pano";

type ViewerImageCache = {
  get: (url: string, key: string) => unknown;
  add: (url: string, key: string, data: Blob) => void;
  purge: () => void;
};

// Use the SAME blob cache as Photo Sphere Viewer. Warming an unrelated Image
// object only warms HTTP cache and makes the viewer fetch/decode it again.
export function createPanoImageLoader(cache: ViewerImageCache): PanoImageLoader {
  return async (url, priority, cacheKey = url) => {
    if (cache.get(url, cacheKey)) {
      return url;
    }
    const response = await fetch(url, {
      mode: "cors",
      credentials: "omit",
      cache: "force-cache",
      priority,
    });
    if (!response.ok) {
      throw new Error(`Failed to preload panorama image: HTTP ${response.status}`);
    }
    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error("Empty panorama image");
    }
    cache.add(url, cacheKey, blob);
    cache.purge();
    return url;
  };
}
