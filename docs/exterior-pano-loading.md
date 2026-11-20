# Exterior panorama loading

## Scope

The November 17, 2026 update changes client request scheduling, not the tiles.
No panorama assets, image quality, camera transforms, pointer placements, or
Cloudflare settings were changed. No multi-resolution levels were generated.

## Scheduling

The route fallback and first-pano loading overlay share
`ExteriorWalkthroughPreloader`: the homepage's navy background, cropped logo
with vertical progress fill, and large bottom-right percentage. Subtle static
corner vectors remain; there are no lifting panels or session-storage skips.
The viewer's existing progress/readiness state controls dismissal, with a short
opacity-only fade and reduced-motion support. No artificial loading delay or
new panorama downloads are introduced by this branding change.

- The active viewer retains PSV's native image transport and visible-tile queue.
- Speculation waits for a quiet view (500 ms, or 150 ms for arrow hover/focus),
  then waits for the current central tiles. A 2-second upper bound prevents an
  unavailable current tile from permanently disabling next-pano preparation.
- Only two candidate panoramas are prepared, sequentially, at low fetch priority.
  Explicit arrow intent takes precedence over the forward/sequential prediction.
- The first candidate gets its preview and a bounded set of arrival-view tiles
  before the second candidate's preview starts. Desktop permits at most two
  speculative tile transfers; compact/iOS permits one.
- Tile selection uses camera yaw, pitch, vertical FOV/zoom, and viewport aspect,
  with conservative spherical bounds for panorama seams and poles. Next-arrow
  detail predicts the existing DEFAULT_ZOOM arrival behaviour; it does not alter
  the camera to match prefetching.
- Navigating, changing direction/pitch/zoom materially, or unmounting aborts old
  image transfers and pending timers. Metadata/signing remain shared and may
  finish, but cannot start more images after that run has been cancelled.
- Image subscriptions share the viewer's existing bounded cache. Cancelling one
  subscription never cancels a foreground consumer of the same request. Failed
  or cancelled speculation never marks a panorama unavailable.
- Interior tours retain their existing tile selection when no viewport is passed.

These are scheduling improvements, not a guarantee that every connection or
device will render the next full-resolution panorama instantly.

## Read-only live cache sample

Run from the project directory:

```powershell
node scripts/measure-exterior-pano-cache.mjs
node scripts/measure-exterior-pano-cache.mjs --origin http://localhost:3001
```

The script reads local environment credentials without printing them, signs GET
requests, and prints only sanitized timings/headers. It does not upload, purge,
delete, or add cache-busting parameters. It uses three real centre tiles and
three repeated GETs per tile; Node does not reuse a browser HTTP cache.

Measured at 2026-11-17 07:00 UTC, assets.sthyra.com, Cloudflare SIN:

| Asset folder | Tile bytes | First total ms | Second total ms | Third total ms | Cache statuses |
| --- | ---: | ---: | ---: | ---: | --- |
| EP.00018 | 325391 | 342 | 685 | 111 | absent, HIT, HIT |
| EP.00096 | 256519 | 104 | 130 | 88 | HIT, HIT, HIT |
| EP.00192 | 340791 | 178 | 147 | 119 | HIT, HIT, HIT |

All three metadata GETs also returned HIT. Successful responses advertised
`public, max-age=31536000, immutable` and matched `http://localhost:3000` CORS.
8/9 tile GETs explicitly reported HIT. The absent first cache-status header must
not be called a confirmed MISS; a first sample is not necessarily a cold cache.
These are one-location network measurements, not a before/after speed benchmark.

The deployed Worker rejected localhost:3001 metadata GETs with HTTP 403 and a
non-matching CORS origin. Local source allows private development origins, so
the deployment and local source differ. No Worker deployment was performed.

## Verification

- 44 exterior-tour tests pass, including cancellation/refetch races, independent
  foreground subscribers, queue ordering, seam/pole visibility, and all existing
  villa-pointer regression tests.
- TypeScript and targeted ESLint pass.
- Headless Chrome: pano 19/251 renders; neighbour previews/detail have Low fetch
  priority; changed intent cancels outdated requests (`net::ERR_ABORTED`);
  sequential navigation to 20/251 reuses warmed detail; five immediate forward
  activations during one transition advance only once.
- Because the deployed Worker rejects port 3001, browser asset requests in QA
  were relayed with the allowed localhost:3000 origin and test-only response CORS.
  Live cache timings above were measured directly, without that relay.
- Existing unrelated local QA warnings: missing legacy minimap image, remote
  relay WebSocket connection, and multiple Three.js instances. A directional
  arrow can also report no candidate when looking away from the route; sequential
  next-pano navigation was verified independently. These were not changed here.

## View-relative road navigation (2026-11-20)

The original view-relative selector from commit `7be4cc5` is restored in
`lib/exterior-tour/view-navigation.ts`. The later tightening was reverted at
the user's request because it blocked previously working Forward movement.

- All four directions use the original 60-degree half-cone (alignment > 0.5),
  neighbour-first ranking, original distance/score weights and nearby fallback.
- The new 30-degree global Forward/Back cone, sampled-road corridor requirement,
  clamped local-distance budget and nearest-aligned ranking are removed.
- Arrow buttons have their original transition-only disabled state. The
  direction-availability state and rotation polling/listener are removed.
- Warmup and clicks share the restored selector. An empty result still returns
  quietly rather than showing a panorama load error.
- Exported camera coordinates, rotations, panorama assets, villa pointers,
  debug selection and the labelled trail sequence are unchanged.

The only explicit navigation exception is the user-confirmed **player pano
15 ↔ player pano 61** road link, recorded in
`data/exterior-road-connections.json`. These are nodes
`Exterior_PANO_Spline_F0014` / `Exterior_PANO_Spline_F0060` and folders
`EP.00014` / `EP.00060` (not player 62 / `EP.00061`).
When facing along that confirmed road, Forward/Back prioritise the direct link
in either direction. Turning toward another branch uses the original selector;
Left/Right remain unchanged. The explicit link's own view-alignment check does
not restrict navigation anywhere else.

Verification:

- `npx tsx --test lib/exterior-tour/view-navigation.test.ts` compares all 285
  panos, 24 view angles and four directions against a frozen copy of the
  original selector, allowing only the confirmed link exception. It also checks
  player pano 5, the starting gate, unchanged poses, sequential mode and buttons.
- `node scripts/verify-exterior-road-navigation.cjs` (with `PLAYWRIGHT_MODULE`
  set if Playwright is installed outside this project) checks actual Forward
  clicks, pano 15 → 61 and 61 → 15 on desktop/phone, the reported pano 5,
  branch navigation and remaining Camera 06 Forward/Back.
