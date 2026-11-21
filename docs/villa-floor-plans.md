# Villa floor plans and POIs

The corrected reference drawings are in `public/Villa 1 Renders/`. They replace
the mistakenly supplied Villa 2 plans and are used
across the current shared villa interior tour, not treated as separately verified
as-built layouts for every villa. The originals are preserved.

The masterplan's villa residence panel now uses the same three drawings through
`data/villa-residence-config.json`'s explicit `sharedFloorPlanSet: "villa-1"`.
Ground/First/Second tabs and their enlarged view render the full AVIF uncropped.
The sidebar labels them "Villa 1 reference plan"; each villa's CAD room schedule
and dimensions remain its own data. Future type-specific `floorPlans` entries
override this shared preview. No terrace image is invented, and no legacy
apartment floor plan is substituted. Check with
`node scripts/verify-villa-residence-plans.cjs` (actual Villa 51 panel and phone
layout) and `npx tsx --test lib/villa-residence.test.ts` (all villa types).

Runtime assets are in `public/villa-floor-plans/villa-1/`: three full-resolution
AVIF plans and three thumbnails, totalling 1,062,826 bytes (94.3% smaller than
the 18,734,655 bytes of PNG originals). Separate Villa 1 URLs prevent cached
Villa 2 images from being reused. The prior generated Villa 2 AVIFs remain in
the parent directory but are not referenced by the website. Full AVIFs preserve the original dimensions
and use quality 65, effort 8, 4:4:4 chroma. Thumbnails use quality 55 and a maximum
640px edge. Regenerate with:

```powershell
node scripts/generate-villa-floor-plans.mjs
```

Both villa and clubhouse generators use the same implementation in
`scripts/lib/generate-numbered-floor-plans.mjs`, with separate sources, output
directories and data files. No source PNG, pano export or clubhouse mapping is
overwritten by the villa generator.

`data/villa-floor-plans.json` holds the dedicated room references, labels,
percentage positions and explicit user-supplied camera assignments. All floors
now use dots, like the clubhouse, in the compact minimap and expanded plan.
Stable reference numbers remain in the JSON and developer-only tooltips,
not inside the dots. Defaults are yellow-gold; hover, focus and
selection use the same standard blue as clubhouse POIs.

| Level | References | Full resolution | Full AVIF bytes |
| --- | --- | --- | ---: |
| Ground | 1, 2, 4, 5, 6, 7, 8, 14, 15, 16, 17, 18 | 1690 × 1854 | 292,698 |
| First | 22, 23, 24, 26, 27, 28, 31, 32, 34, 35, 36 | 1904 × 1825 | 223,137 |
| Second | 41, 44, 45, 46, 47, 48 | 2133 × 2234 | 442,130 |

References cover rooms, circulation/landings, stair flights and usable outdoor
areas shown on the renders. Lift cars and double-height voids are not marked.
Positions were placed visually on the supplied plans, not inferred from pano
coordinates. The initial 48 Villa 1 references were reduced to 29 at the user's
request, without renumbering retained points. There are 25 linked POIs, each with
the exact supplied node ID, filename, cloud folder and arrival view. Only ground
references 15, 16, 17 and first-floor reference 23 remain `null`; they were not
mapped by the user. Selecting a pending dot does not mark it active, teleport,
expand the minimap or display any message. On desktop, the separate small blue
expand icon opens only an enlarged, uncropped map with clickable POIs and a close
icon. There is no header, sidebar, room list, zoom toolbar or outer padded card.
Escape and clicking the backdrop also close the enlarged map.

`arrivalView` yaw and pitch are degrees, converted to radians only when clicked.
Zero zoom and reference 44's fractional zoom 0.05 are preserved. Points 7 and 8
intentionally share one camera/view. Points 6 and 18 share `GF_CAM2_F0003` but
retain their distinct saved views; angles are stored per POI, never keyed only
by camera ID. Clicking the currently active pano restores the chosen POI's view,
with walking controls locked for the short camera animation. Minimap dots remain
clickable during loading/animation: the latest requested destination and its
per-POI view wait until the current transition finishes, then run serially. Rapid
clicks replace the queued request rather than stacking unnecessary loads. No
loading or pending-assignment notices appear over either map.
These settings apply only to POI navigation, not ordinary arrow walking. The
original camera export, repeated-render aliases and walking graph are unchanged;
no missing bedroom render or connection is invented.

The pano-info debug panel has moved to the exterior walkthrough and is no longer
enabled in villa interiors. Existing verified assignments remain in this JSON;
walking, balcony, floor and back controls are unchanged.

Villa floor controls align with the back button at the top (16px inset, or 24px
from 768px). Phones use an arrow-only back link and a smaller map, 160–176px wide;
the floor and balcony controls share that width. Tablet maps are 224px wide.
On phones/tablets the expand icon is replaced by an X: the entire map/control
column slides fully offscreen to the right. A top-right map button restores it,
without reloading the panorama. Only transforms/visibility animate (180ms), with
reduced-motion support. Fine-pointer laptops retain desktop expansion; coarse
pointer tablets up to 1366px use hide/restore. Clubhouse uses the same compact UI.

Verification:

```powershell
npx tsx --test lib/villa-floor-plans.test.ts lib/clubhouse-floor-plans.test.ts lib/villa-interior-tour.test.ts
npx tsc --noEmit
node scripts/verify-villa-floor-plans.cjs
```

The browser runner checks all 29 dot positions and individually clickable hit
targets, all 25 linked destinations and measured yaw/pitch/zoom, shared-pano view
restoration, quiet pending selections, gold/blue colors, AVIF decoding, minimal
expanded-map navigation, focus return, developer clipboard, retained balcony
access, 320/390px phones and tablet hide/restore. `VILLA_FLOORS=ground,first` or `VILLA_POIS=6,18` can limit
the audit; `VILLA_NUMBER=20` exercises another villa's shared interior.
