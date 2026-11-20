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

The arrow selector now lives in `lib/exterior-tour/view-navigation.ts`. It is
shared by clicks, arrow availability and directional warmup, so a disabled
direction does not quietly resolve a different destination.

- Forward/Back use a 30-degree half-cone; Left/Right retain a broader turn cone.
- All supported local samples are compared, not just the first nearby-neighbour
  list. Similar forward alignments prefer the nearest sample; turn controls
  enter the nearest valid corner sample rather than skipping it.
- Local candidates are bounded to typical export sampling distances. Non-adjacent
  joins must stay near the exported camera paths. This is a conservative path
  corridor check, not a collision/navmesh or proof that every rendered road has
  complete camera coverage. The gate bend/overlapping return lane is retained.
- Path/candidate checks are cached per graph/node. Rotation recomputes only small
  directional rankings. Availability is checked at most once per 80ms and React
  updates only when an arrow's enabled state changes; timers/listeners are cleaned up.
- Clicks recheck the live camera and return quietly when no candidate exists.
  They no longer treat absence of a forward connection as a panorama load error.
- Debug jumps, history and the explicitly labelled next-pano/trail sequence
  remain separate from the view-relative arrows. Exported positions, headings,
  villa pointers and pano assets are unchanged.
- An isolated activity-camera run is not automatically bridged through a fence
  to make it reachable by road arrows. For example, Camera 06's `00271` preview
  is inside the fenced court, while `EP.00132` is on the clubhouse plaza outside.
  Its own Forward/Back route still works; debug/explicit pano entry remains
  available until a verified entrance/amenity link is assigned. The underlying
  broad proximity graph is retained but is not proof of a walkable connection.

Specific regressions: the default gate view retains its 6.5m forward connection
to `EP.00249`. The user has confirmed that player pano 15 (`EP.00014`) continues
straight to player pano 61 (`EP.00060`, node `Exterior_PANO_Spline_F0060`). This
directed connection is recorded separately in `data/exterior-road-connections.json`.
It permits this specific 46.6m step despite the normal local-distance budget,
but still obeys the live-view Forward/Back cone. At yaw -5.5 degrees Forward goes
directly to 61, not the diagonal `EP.00168` or player 62 (`EP.00061`). Local
Left/Right choices remain unchanged; facing the nearby branch still enters its
nearest pano. No other long-distance links, reverse links or coordinates are inferred.

Verification: `npx tsx --test lib/exterior-tour/view-navigation.test.ts` and
`node scripts/verify-exterior-road-navigation.cjs` (with `PLAYWRIGHT_MODULE` set
if Playwright is installed outside this project). Browser checks cover the
default gate and confirmed pano 15-to-61 connection on desktop/phone, pano 15 after rotation,
debug selection, and remaining Camera 06 Forward/Back.
