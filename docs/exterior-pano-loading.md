# Exterior panorama loading

## Scope

The November 17, 2026 update changes client request scheduling, not the tiles.
No panorama assets, image quality, camera transforms, pointer placements, or
Cloudflare settings were changed. No multi-resolution levels were generated.

## Scheduling

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
