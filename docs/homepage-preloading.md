# Homepage and masterplan warmup

The homepage keeps the original local `public/gate.00297.avif`. Its logo/percentage
preloader is restored; right-aligned responsive copy appears during its exit.
The original panel effect uses a shorter, transform-only exit (~2 seconds).

- Load the visible hero image first. Once decoded, begin optional masterplan work.
- Warm a continuous, decoded 1.5-second opening of the GOP3 video. Progress comes
  from `video.buffered` and `readyState`, not full-file download percentage.
- Load/parse the GLB through the same `useGLTF` URL/Suspense cache as the stage.
  The observer does not mount a Canvas or allocate a second WebGL renderer.
- End the foreground warmup after at most 3.5 seconds, even if images, video,
  model or optional requests stall. The existing panel exit animation follows.
- After reveal, download the complete encoded MP4 in sequential, low-priority
  4 MiB HTTP ranges. Unlike native `preload` hints, this reaches the entire
  58,057,110-byte file. Each response's status, MIME, byte count and exposed ETag
  are checked. Keep completed chunks in this tab when a download pauses/retries.
- Speculation respects Save-Data, 2G and hidden tabs. Explicit masterplan entry
  starts the full cache even on a constrained connection. Hidden tabs pause at
  chunk boundaries and resume when visible; a stalled request has a 90s timeout.
  Failed downloads retry up to three times without poisoning the stored entry.
- Persist only the complete file in the dedicated `laurels-masterplan-video-v1`
  CacheStorage cache. Restore it before assigning a CDN source on later visits;
  keep only the active URL revision. If storage is unavailable/full, use the
  complete in-memory Blob instead. Change the URL revision and verified byte
  count together whenever replacing the MP4.
- Use the cached Blob URL in the same video element. If the stage is already
  mounted, switch only when paused at a decoded camera stop, never mid-orbit or
  during a drag. Hold one transient canvas still while restoring that exact
  time, avoiding a flash to the first-frame poster. Native CDN playback remains
  the fallback; initial opening playback does not wait for the full download.
- All encoded frames/keyframes are locally available once caching completes,
  but decoded frames are not pinned in GPU memory. Browser storage can still be
  evicted, and decode speed varies by device. This is not a permanent offline
  guarantee, a service worker, or a second video decoder. The initial native
  opening and full-file fetch can overlap some bytes on the first visit.
- The video element and parsed GLB are also reused during client navigation.
- Optional GLB failures are isolated and clear their failed loader cache so the
  real route can retry. The video player similarly retries a failed warmup.

Checks: `npx tsx --test lib/home-hero.test.ts lib/masterplan-video-cache.test.ts lib/masterplan-warmup-policy.test.ts
lib/villa-masterplan-video.test.ts`. `scripts/verify-page-startup.cjs` exercises
desktop/mobile reveal, a delayed image, the shared video handoff, GLB cache reuse,
both orbit directions and drag scrubbing against a running local Next server.
`scripts/verify-masterplan-cache.cjs` additionally checks full-file completion,
single-player handoff, both arrows and drag with the CDN blocked, then a hard
reload from persistent storage with zero video network requests.
