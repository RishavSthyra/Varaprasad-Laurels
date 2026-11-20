# Homepage and masterplan warmup

The homepage now uses the Amenities water-feature scene: Cloudflare
`Videos/videos/entry.mp4` (HEVC, 3840 x 2160, 24 fps, ~5.04 seconds,
3,622,943 bytes), `Videos/entrance_reverse_av1.mp4` (AV1, same dimensions/
fps/duration, 11,581,331 bytes) and `Images/first-frames/entry.avif`
(718,517 bytes) as both preview and video poster.
The gallery display name is Water Feature; its stable `entrance` ID and
`entry` object keys are retained. The supplied `homepage_reverse_av1.mp4`
URL still contains the old gate scene; use the verified matching
`entrance_reverse_av1.mp4` upload instead (its ETag matches the local file's
MD5, `67820e3c25dded80d370490f5b869d93`). All three new asset URLs differ
from the gate scene, so old cached files are not restored for this scene.
The local gate image is no longer a homepage dependency; it is not deleted.
The logo/percentage preloader and right-aligned responsive copy are retained.

## Continuous forward/reverse playback

Use the two supplied Cloudflare clips, not the locally prepared combined clip.
Both use ordinary positive playback. `HomeHeroVideo` alternates on `ended`:
forward -> reverse -> forward, indefinitely. One player runs while the other
is paused and preloaded at its opening frame. Keep the outgoing frame visible
until the incoming player presents a frame, then hide/reset the old player.
There is no negative playback rate, per-frame reverse seeking, duplicated
network download per handoff or decoded canvas frame bank. Hidden tabs pause
both players; cleanup cancels pending presentation callbacks and listeners.
If reverse media fails or cannot play, repeat the forward clip safely. If
forward playback fails, keep the AVIF fallback and usable navigation.

## Foreground homepage media

- Load all three hero files through the shared complete-asset cache at high priority.
  Each uses one full GET, not byte-range/native-player
  duplication, a canvas frame bank or a speculative video preload hint.
- Verify MIME and full byte count before publishing a Blob URL or persisting.
  Dedicated caches are `laurels-home-poster-v1`, `laurels-home-video-v1` and
  `laurels-home-reverse-video-v1`;
  restore them before assigning any CDN source on a return visit. Strict Mode
  and client navigation reuse the same in-memory assets/pending promises.
- The normal reveal waits for complete assets and cache writes to settle,
  the poster to decode, and the first video frame to decode. The same AVIF
  remains beneath both muted inline players. Show playback only
  when a presented video frame is available; autoplay/AV1 failures keep the
  poster visible. Hidden tabs pause playback and resume when visible.
- Previously seen session flags cannot bypass this media-readiness check.
  An 8-second foreground deadline prevents a failed/slow video from trapping
  the page in a loader. The existing panel exit follows. Late media can finish
  caching and begin playback over the poster without reopening the loader.
- Storage denial/quota falls back to complete in-memory assets; cache/network
  failures fall back to the supplied native CDN sources. CacheStorage can be
  evicted by the browser: this is not a permanent/offline-site guarantee.
  Update the URL/version and verified size when replacing an asset.

## Optional next-route warmup

- Prioritize the homepage media first. Once cached/decoded, begin optional
  masterplan work; it no longer holds the foreground homepage loader open.
- Warm a continuous, decoded 1.5-second opening of the GOP3 video. Progress comes
  from `video.buffered` and `readyState`, not full-file download percentage.
- Load/parse the GLB through the same `useGLTF` URL/Suspense cache as the stage.
  The observer does not mount a Canvas or allocate a second WebGL renderer.
- Optional masterplan work never extends the homepage's media deadline.
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

Checks: `npx tsx --test lib/home-hero.test.ts lib/home-hero-cache.test.ts lib/masterplan-video-cache.test.ts lib/masterplan-warmup-policy.test.ts
lib/villa-masterplan-video.test.ts`. `scripts/verify-page-startup.cjs` exercises
desktop/mobile reveal, a delayed image, the shared video handoff, GLB cache reuse,
both orbit directions and drag scrubbing against a running local Next server.
`scripts/verify-masterplan-cache.cjs` additionally checks full-file completion,
single-player handoff, both arrows and drag with the CDN blocked, then a hard
reload from persistent storage with zero video network requests.

`scripts/verify-home-hero-video.cjs` checks repeated real forward HEVC/reverse AV1
playback, only one player running at a time, identical poster/preview, one full
request per asset, verified persistent payloads, hard reload with all hero CDN
files blocked, phone playback, forward/reverse failures and delayed playback.
Set `PLAYWRIGHT_MODULE` if Playwright is installed outside the repository.
Use Chrome's native GPU/decoder path for the supplied HEVC forward asset;
forcing software-only SwiftShader prevents its decoder starting on Windows.
Browsers without HEVC support retain the first-frame poster fallback.
