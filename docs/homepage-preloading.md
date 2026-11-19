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
- After reveal, request progressively larger video buffers (3, 6, 10.3 seconds),
  spaced apart. Respect Save-Data, 2G and hidden tabs. Opening the actual route
  upgrades loading immediately and takes ownership of the same video element.
- Native `preload` is a browser hint: the browser can download more than each
  requested buffer target. These are not independently encoded streaming chunks.
- The video buffer and parsed GLB are reused during client navigation. A hard
  reload may evict them; persistent HTTP caching depends on browser/CDN headers.
  No promise of permanent offline storage or a service worker is made.
- Optional GLB failures are isolated and clear their failed loader cache so the
  real route can retry. The video player similarly retries a failed warmup.

Checks: `npx tsx --test lib/home-hero.test.ts lib/masterplan-warmup-policy.test.ts
lib/villa-masterplan-video.test.ts`. `scripts/verify-page-startup.cjs` exercises
desktop/mobile reveal, a delayed image, the shared video handoff, GLB cache reuse,
both orbit directions and drag scrubbing against a running local Next server.
