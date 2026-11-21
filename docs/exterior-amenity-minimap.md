# Exterior landscape minimap points

Only the 19 user-assigned references remain visible. The retained dots keep
their original registered landscape-plan positions on the Cloudflare ortho.
All other old reference markers, including 24, are removed; the old amenities
menus remain hidden.

Dots match the clubhouse: gold `#fce190` normally and blue `#2f7fb5` on hover,
keyboard focus or when their pano is active. Reference numbers stay in the data
and development titles, not visible text.

Click a compact or expanded dot to open its exact pano at the supplied
yaw/pitch/zoom. The expanded map closes after successful navigation, including
re-selecting the current pano. Dot clicks do not start dragging or expand the
map, and further clicks are disabled while a pano transition is in progress.

## Confirmed destinations

The latest user correction assigns **reference 25 to pano 142**, not 269.
The separate pano 269 dot is deferred at the user's request and is not shown.

| Ref | Player pano | Location |
| --- | --- | --- |
| 1 | 4 | Entry arch and security cabin |
| 2 | 208 | Driveway - eastern street |
| 3 | 205 | Plaza with feature wall - north-east |
| 7 | 196 | Feature wall - central garden |
| 8 | 282 | Yoga / meditation deck with shade structure |
| 9 | 284 | Water feature |
| 11 | 252 | Sunken seating |
| 12 | 35 | Golf putting - south-east |
| 13 | 40 | Informal seating - southern tip |
| 15 | 257 | Basketball practice court |
| 16 | 266 | Box cricket / mini soccer |
| 17 | 271 | Pickle-ball court |
| 19 | 274 | Barbeque zone |
| 20 | 275 | Beach volleyball |
| 22 | 149 | Children's play area - trampoline and rock climbing |
| 25 | 142 | Lawn - clubhouse north |
| 30 | 100 | Plaza with feature wall - western main-road end |
| 36 | 81 | Feature wall - south-west |
| 40 | 11 | Pedestrian pathway - south block corner |

Exact node IDs, cloud folders, exported centimetre positions and arrival angles
in degrees are in `data/exterior-amenity-minimap.json`. Camera coordinates,
rotations, road-arrow rules and villa pointers are unchanged.

## Placement provenance

The existing registration uses landscape concept PDF pages 9/10 and the supplied
`20260818 - UPDATED LANDSCAPE MASTERPLAN 1.dwg`. The data retains the source
hash, estate boundary, road anchors and affine registration. No retained point
was moved. This is visual plan-to-ortho registration, not a land survey.
Surrounding forest/private gardens are excluded. Road-anchor residuals are
below 10 pixels on the 1920-wide registration image.

## Current location registration

The current-location marker no longer uses the unrelated legacy amenity-menu
projection or negates the exported Y axis. `lib/exterior-tour/minimap-position.ts`
derives an affine world-to-image fit from all 19 confirmed pano/POI pairs, using
the original centimetre coordinates and existing registered ortho dot positions.
An inverse-distance-weighted interpolation of the fit residuals passes through
each confirmed point and stays continuous when walking away from it. No pano
coordinates, navigation links, POI positions, camera headings or arrival views
are edited. This is registration to user-confirmed feature locations, not a
surveyed camera/GPS overlay; intermediate locations are interpolated.

All 285 supplied pano positions fall within the ortho without edge clamping.
At every assigned POI pano the compact follow view centres its dot and the
expanded current marker sits exactly on the dot. Current location and selected
POIs share the existing blue `#2f7fb5`; inactive POIs remain gold. Selection is
derived from the actual active pano, including direct entry and arrow walking,
not just the last clicked button.

Checks: `npx tsx --test lib/exterior-tour/minimap-position.test.ts` covers all
285 positions, exact registration for all 19 points and local continuity.
The browser runner also checks compact/expanded player-to-dot centre alignment
and active blue after navigation. Set `EXTERIOR_POI_REFS=1,25,40` for a shorter
desktop run; phone/compact coverage is retained.

## Checks

- `npx tsx --test lib/exterior-tour/amenity-minimap.test.ts lib/exterior-tour/minimap.test.ts lib/exterior-tour/remaining.test.ts lib/exterior-tour/view-navigation.test.ts`
  verifies mappings, folders, views, source coordinates, site containment and
  unchanged road navigation.
- `node scripts/verify-exterior-amenity-minimap.cjs` checks real cloud pano
  clicks, exact arrival views, gold/blue states, compact/expanded navigation,
  phone layout, same-pano re-selection and fixed dot size under zoom.
  Set `PLAYWRIGHT_MODULE` if Playwright is outside this repository.
- The exterior development-only pano-info panel is unchanged. It lists all
  285 panos and copies their metadata/live view, with polling only while open.
  It stays absent in production and villa/clubhouse interiors.

## Masterplan phone/tablet menu

The hamburger matches the compact filter breakpoint: up to 1023px, or coarse-
pointer tablets up to 1366px. Its safe-area top-left placement clears the bottom
filter actions, and the trigger/open menu sit above the filter layer. Other
routes and desktop navigation retain their layout.

Checks: `npx tsx --test lib/mobile-site-nav.test.ts` and
`node scripts/verify-masterplan-mobile-menu.cjs` (phone portrait/landscape,
tablet, large touch tablet, open/close and Escape).
