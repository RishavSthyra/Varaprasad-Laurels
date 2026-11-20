# Masterplan framing and compact filters

The villa masterplan has one fitted 16:9 render rectangle inside its available
stage. Its preview, native scrub video, temporary cached-source still and GLB
hover canvas use the same bounds. CSS size-container units fit this rectangle
to both the stage width and height, without a per-frame JavaScript resize loop.
Source camera positions, rotations, FOV calibration and stop frames are unchanged.
Phones and touch tablets use a contained frame, with navy letterboxing rather
than cropped media. PCs and laptops use a covering frame that fills the stage.
The common 16:9 rectangle also keeps GLB hover alignment correct when cropped.
Pointer capture/scrubbing is attached to that frame, not its letterboxing.

The villa stage now stays mounted across responsive layout changes. CSS media
queries choose desktop cover vs compact contain and the 36/64svh split directly
in server HTML, rather than first painting the desktop branch and replacing it
after `matchMedia`. The compact filters are server-rendered and CSS-hidden only
on desktop, so direct loads and client navigation begin in the same layout.

The GLB/video stage is a separate client chunk. Its server fallback and the route
loading view use the same fitted preview, with a tiny inline blurred image before
any network request finishes. Derived AVIFs preserve the entire source framing:
960px/109,261 bytes for compact screens and 1920px/345,858 bytes for desktop,
versus the original 629,559 bytes. Matching media-specific high-priority preloads
avoid downloading both sizes. The native video does not fetch another large
poster; the preview below it remains visible until a decoded frame is ready.
Card/tower image preloads no longer compete with the preview; GLB fetch preload
has low priority. The original `1.00000.avif` remains untouched. Regenerate via
`node scripts/generate-masterplan-preview.mjs`.
Existing post-hero homepage warmup also warms the appropriate decoded preview,
using the same background-loading/Save-Data gates as video and GLB warmup.

Compact layouts (screens below 1024px and coarse-pointer touch tablets up to
1366px) have a persistent
bottom filter sheet outside the desktop-only wrapper. The 64svh sheet leaves
36svh for an uncropped stage above it. Desktop filters still start closed.
Touch capability alone does not select tablet mode: mouse-operated laptops
can report touch points, so the primary pointer must also be coarse.
The sheet reuses the residence dock's villa type, plot area, road position,
facing, availability, search, reset and matching-villa results; it does not use
the legacy apartment block/BHK form. Only the active filters/results pane mounts.
Scrolling stays inside the sheet. Residences slide up from the bottom rather
than the side; closing results or pressing Escape returns to the filters.
Only transform/opacity animate, with reduced-motion support. The persistent
filters are a non-modal region, so they do not trap focus or block scrubbing.

Checks: `npx tsx --test lib/masterplan-responsive.test.ts
lib/master-plan-controls.test.ts lib/villa-masterplan-model.test.ts
lib/villa-masterplan-video.test.ts`. `scripts/verify-masterplan-responsive.cjs`
checks 320px through 2560px viewports, portrait/landscape, preview-only fallback,
filter selection/reset/search/results, matching canvas bounds and real mobile
GOP3 playback/dragging against a running local server.

`scripts/verify-masterplan-first-paint.cjs` blocks app chunks to audit actual
server-painted phone/tablet/desktop geometry before hydration, then checks client
navigation from home. `scripts/verify-interior-touch-motion.cjs` exercises real
phone touch swipes in villa and clubhouse viewers: touch speed is 1.25 (previously
3.6), inertia 0.65 (previously 0.82), with desktop settings unchanged.
