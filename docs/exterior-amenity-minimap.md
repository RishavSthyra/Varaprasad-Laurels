# Exterior landscape reference numbers

Numbered reference markers are separate from the old (still hidden) amenity menus and pano links. They appear on the existing Cloudflare ortho minimap, in both compact and expanded views. Expand and use +/- then drag to inspect close-together points. Hover/focus a number to read its name. Clicking an unassigned reference does not change the panorama or dismiss the map.

## Source and placement

- Landscape concept document, physical PDF pages 9 and 10. Page 9 supplies the estate perimeter and 23-item legend; page 10 clarifies the central garden and north-eastern strip.
- The supplied `20260818 - UPDATED LANDSCAPE MASTERPLAN 1.dwg` matches the previously reviewed drawing's SHA-256 in `exterior-villa-hotspots-cad-audit.json`. CAD is a site-layout reference, not a reason to reuse the old hidden amenity coordinates.
- `data/exterior-amenity-minimap.json` records the source-page positions, perimeter, road control points, affine registration and source drawing hash. Marker centres are tested against the estate polygon. The surrounding forest, neighbouring layout roads and red-dot private gardens are excluded.
- This is visual registration of a concept plan to a rendered image, **not survey-grade positioning**. The fitted road control points have a maximum residual below 10 pixels on a 1920-wide ortho. Several planned landscape features are obscured by trees or differ in the ortho render; their names follow the concept document.
- No panorama positions, rotations, villa pointers or existing pano-to-minimap calibration were changed.

## Stable numbering for pano assignments

References **1-23** match the PDF legend. Repeated physical features have separate references **24-40**, so each can receive its own pano later. Every `nodeId` is deliberately `null` until the user supplies the corresponding pano and arrival view.

## Exterior pano-info tool

In `npm run dev`, open **Pano debug · Development only** at the lower left of the exterior walkthrough. It shows the current filename, node ID, exact cloud folder, one-based player counter, exported position in centimetres, and live yaw/pitch/zoom. The selector can browse all 285 exterior panos, including the remaining-v2 cameras. Use **Copy pano details** and send the minimap reference number together with those details.

Live camera polling runs only while the panel is expanded, and copy/navigation are disabled while a pano loads. The tool does not render in production. It is no longer enabled in villa or clubhouse interiors; their normal floor/minimap/balcony controls are unchanged.

| Ref | Location |
| --- | --- |
| 1 | Entry arch / security cabin |
| 2 | Eastern driveway |
| 3 | North-east plaza / feature wall |
| 4 | North-east lawn |
| 5 | North-east shaded deck |
| 6 | Zen garden |
| 7 | Central garden feature wall |
| 8 | Yoga / meditation deck |
| 9 | Water feature |
| 10 | Clubhouse-east pedestrian path |
| 11 | Sunken seating |
| 12 | South-east golf putting |
| 13 | Southern-tip informal seating |
| 14 | Pickle-ball gallery seating |
| 15 | Basketball practice court |
| 16 | Box cricket / mini soccer |
| 17 | Pickle-ball court |
| 18 | Clubhouse-south plaza |
| 19 | Barbeque zone |
| 20 | Beach volleyball |
| 21 | Screening wall |
| 22 | Children's play area |
| 23 | Outdoor gym |
| 24 | Exit arch / security cabin |
| 25 | Clubhouse-north lawn |
| 26 | Lawn above box cricket |
| 27 | Western main-road-end lawn |
| 28 | Yoga-garden lawn |
| 29 | Western main-road-end shaded deck |
| 30 | Western main-road-end plaza / feature wall |
| 31 | Southern-tip golf putting |
| 32 | Basketball gallery seating |
| 33 | Clubhouse-east plaza |
| 34 | North-east boundary feature wall |
| 35 | Feature wall below clubhouse |
| 36 | South-west feature wall |
| 37 | Southern garden west feature wall |
| 38 | Southern garden east feature wall |
| 39 | Central-west pedestrian path |
| 40 | South-block-corner pedestrian path |

Checks: `npx tsx --test lib/exterior-tour/amenity-minimap.test.ts lib/exterior-tour/minimap.test.ts lib/exterior-tour/remaining.test.ts`.

Browser regression: `node scripts/verify-exterior-amenity-minimap.cjs` (set `PLAYWRIGHT_MODULE` to an installed Playwright module if needed). Verifies desktop/phone marker centres against the recorded registration, decoded Cloudflare image, zoom without inflated point sizes, unassigned clicks, collapse, and no panorama changes or browser exceptions.

Pano-info regression: `node scripts/verify-exterior-pano-debug.cjs` checks original/remaining-v2 metadata and copied views, all 285 choices, mobile containment, and absence of the panel in both interior tours.
