import { VILLA_MASTERPLAN_VIDEO_URL } from "./villa-masterplan-video";

// This revision is the verified 309-frame GOP3 encode. Change the URL revision
// and size together when replacing it, so an older orbit cannot be reused.
export const MASTERPLAN_VIDEO_BYTES = 58_057_110;
export const MASTERPLAN_VIDEO_CACHE = "laurels-masterplan-video-v1";
const CHUNK_BYTES = 4 * 1024 * 1024;

type CacheStore = Pick<Cache, "match" | "put" | "keys" | "delete">;
type Options = {
  url: string;
  bytes: number;
  fetch: typeof fetch;
  storage: () => Promise<CacheStore | undefined>;
  objectURL: (blob: Blob) => string;
  chunkBytes?: number;
  mime?: string;
  priority?: RequestPriority;
  /** Small foreground assets can use a single full GET, not HTTP ranges. */
  rangeRequests?: boolean;
};
export type VideoCacheStatus = {
  bytes: number; total: number; objectURL?: string;
  source?: "storage" | "network"; error?: string;
};

/** One bounded download, shared by all routes. Partial chunks survive a pause
 * in this tab; only a validated, complete MP4 is written to persistent storage.
 * No decoded 4K frame bank, second decoder or service worker is allocated. */
export class MasterplanVideoCache {
  private chunks: Blob[] = [];
  private pending?: Promise<void>;
  private listeners = new Set<() => void>();
  private etag?: string;
  private status: VideoCacheStatus;

  constructor(private options: Options) {
    this.status = { bytes: 0, total: options.bytes };
  }
  getStatus = () => this.status;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private update(value: Partial<VideoCacheStatus>) {
    this.status = { ...this.status, ...value };
    for (const listener of this.listeners) listener();
  }
  warm(allowed: () => boolean = () => true) {
    if (this.status.objectURL) return Promise.resolve();
    if (this.pending) return this.pending;
    this.pending = this.download(allowed).catch(error => {
      this.update({ error: error instanceof Error ? error.message : "Video cache unavailable" });
    }).finally(() => { this.pending = undefined; });
    return this.pending;
  }
  private async download(allowed: () => boolean) {
    const { url, bytes, objectURL, mime = "video/mp4", rangeRequests = true } = this.options;
    let store: CacheStore | undefined;
    try { store = await this.options.storage(); } catch { /* Private mode/quota: use memory. */ }
    if (!this.chunks.length && store) {
      try {
        const cached = await store.match(url);
        if (cached?.status === 200 && cached.headers.get("content-type")?.includes(mime)) {
          const blob = await cached.blob();
          if (blob.size === bytes) {
            this.update({ bytes, objectURL: objectURL(blob), source: "storage", error: undefined });
            return;
          }
          await store.delete(url);
        }
      } catch { /* A bad/evicted entry must never prevent native playback. */ }
    }
    this.update({ error: undefined });
    while (this.status.bytes < bytes && allowed()) {
      const start = this.status.bytes;
      const end = rangeRequests ? Math.min(bytes - 1, start + (this.options.chunkBytes ?? CHUNK_BYTES) - 1) : bytes - 1;
      // Range is CORS-safelisted. Do not depend on Content-Range being exposed
      // by the CDN; verify status, actual bytes, MIME and exposed ETag instead.
      const response = await this.options.fetch(url, {
        headers: rangeRequests ? { Range: `bytes=${start}-${end}` } : undefined, credentials: "omit",
        priority: this.options.priority ?? "low",
        signal: AbortSignal.timeout(90_000),
      });
      if (![200, 206].includes(response.status) || !response.headers.get("content-type")?.includes(mime)) {
        throw new Error("Invalid masterplan video response");
      }
      const etag = response.headers.get("etag");
      if (this.etag && etag && etag !== this.etag) {
        this.chunks = [];
        this.etag = undefined;
        this.update({ bytes: 0 });
        throw new Error("Masterplan changed during download; retrying a fresh copy");
      }
      this.etag = etag ?? this.etag;
      const blob = await response.blob();
      if (response.status === 200 && start === 0 && blob.size === bytes) {
        this.chunks = [blob];
        this.update({ bytes });
      } else {
        if (response.status !== 206 || blob.size !== end - start + 1) throw new Error("Incomplete masterplan video range");
        this.chunks.push(blob);
        this.update({ bytes: end + 1 });
      }
    }
    if (this.status.bytes !== bytes) return;
    const blob = new Blob(this.chunks, { type: mime });
    this.chunks = [];
    this.update({ objectURL: objectURL(blob), source: "network" });
    if (store) {
      try {
        await store.put(url, new Response(blob, { headers: { "Content-Type": mime, "Content-Length": String(bytes) } }));
        // Keep only the active orbit revision; don't accumulate 58 MB videos.
        for (const key of await store.keys()) if (key.url !== url) await store.delete(key);
      } catch { /* Storage denied/full: the complete in-memory copy still works. */ }
    }
  }
}

let cache: MasterplanVideoCache | undefined;
export function getMasterplanVideoCache() {
  if (typeof window === "undefined") throw new Error("Masterplan cache is browser-only");
  return cache ??= new MasterplanVideoCache({
    url: VILLA_MASTERPLAN_VIDEO_URL, bytes: MASTERPLAN_VIDEO_BYTES,
    fetch: window.fetch.bind(window),
    storage: async () => "caches" in window ? caches.open(MASTERPLAN_VIDEO_CACHE) : undefined,
    // Retained for this tab's lifetime, just like the single shared video.
    objectURL: blob => URL.createObjectURL(blob),
  });
}
