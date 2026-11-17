import type { PanoImageLoader } from "./pano";

type ViewerImageCache = {
  get: (url: string, key: string) => unknown;
  add: (url: string, key: string, data: Blob) => void;
  purge: () => void;
};

// Use the SAME blob cache as Photo Sphere Viewer. Warming an unrelated Image
// object only warms HTTP cache and makes the viewer fetch/decode it again.
export function createPanoImageLoader(cache: ViewerImageCache): PanoImageLoader {
  type Subscriber = {
    resolve: (url: string) => void;
    reject: (error: unknown) => void;
    cleanup: () => void;
  };
  type Download = { controller: AbortController; subscribers: Set<Subscriber> };
  const downloads = new Map<string, Download>();

  return (url, priority, cacheKey = url, signal) => {
    if (signal?.aborted) return Promise.reject(signal.reason);
    if (cache.get(url, cacheKey)) {
      return Promise.resolve(url);
    }
    const key = `${cacheKey}|${url}`;
    let download = downloads.get(key);
    const isNew = !download;
    if (!download) {
      download = { controller: new AbortController(), subscribers: new Set() };
      downloads.set(key, download);
    }
    const active = download;
    const result = new Promise<string>((resolve, reject) => {
      const subscriber: Subscriber = {
        resolve, reject,
        cleanup: () => signal?.removeEventListener("abort", onAbort),
      };
      const onAbort = () => {
        subscriber.cleanup();
        active.subscribers.delete(subscriber);
        reject(signal?.reason);
        // Never abort another subscriber (especially an actual navigation).
        if (active.subscribers.size === 0) {
          if (downloads.get(key) === active) downloads.delete(key);
          active.controller.abort();
        }
      };
      active.subscribers.add(subscriber);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
    if (isNew) {
      void (async () => {
        try {
          const response = await fetch(url, {
            mode: "cors", credentials: "omit", cache: "force-cache",
            priority, signal: active.controller.signal,
          });
          if (!response.ok) {
            throw new Error(`Failed to preload panorama image: HTTP ${response.status}`);
          }
          const blob = await response.blob();
          active.controller.signal.throwIfAborted();
          if (blob.size === 0) throw new Error("Empty panorama image");
          cache.add(url, cacheKey, blob);
          cache.purge();
          for (const subscriber of active.subscribers) subscriber.resolve(url);
        } catch (error) {
          for (const subscriber of active.subscribers) subscriber.reject(error);
        } finally {
          for (const subscriber of active.subscribers) subscriber.cleanup();
          active.subscribers.clear();
          if (downloads.get(key) === active) downloads.delete(key);
        }
      })();
    }
    return result;
  };
}
