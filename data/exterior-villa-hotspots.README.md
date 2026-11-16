# Exterior villa entrances

Edit `data/exterior-villa-hotspots.json`. Only entrances on the active panorama are loaded; all entrances share the small local arrow GLB. Duplicate a `panos` entry for another panorama. For multiple villas visible from the same pano, add more objects inside that pano's `pointers` array. Give every pointer a unique `id`.

The CAD-reviewed configuration now contains **77 distinct panoramas and 77 villa entrances**: Villas 01–78, excluding Villa 21 under the existing project exclusion. Each included villa appears exactly once. All four original CAD/backup files and the source GLB remain unchanged.

**Numbering correction:** the yellow-Beetle entrance at player **193/251 is Villa 12, West-facing**. Its former Villa 8 label was provisional. The actual Villa 8 entrance is assigned to player pano 207. Your previous three manual pointer entries are preserved in `docs/exterior-villa-hotspots.before-cad-2026-11-16.json`.

## Numbering

Use the **number displayed in the player**: `193` means **193/251**, the yellow-car view. Its underlying zero-based source frame/folder is `F0192` / `EP.00192`. Do not enter `194` or `193/251` in JSON. The first player number is `1` (source frame `0`). Preview directly at `/exterior-walkthrough?pano=193`.

## Fields

| Field | Meaning |
| --- | --- |
| `panoNumber` | Numeric player counter, 1–251. |
| `villaNumber` | CAD villa number, displayed to assistive technology and passed to the interior URL. |
| `facing` | Exactly `East` or `West`, checked against the villa catalog. This is villa metadata; it does not automatically rotate the marker or interior camera. |
| `position.yawDegrees` | Horizontal position in this panorama's local image coordinates: 0 is panorama forward, 90 right, 180 behind, 270 left. Independent of the current camera direction. Do not copy this number from a different pano: each image has its own source heading. |
| `position.pitchDegrees` | Vertical placement: 0 horizon; negative points down toward the entrance ground. |
| `position.distanceMetres` | Viewer-to-marker distance, up to 15 m to remain inside the panorama sphere. This is virtual placement, not surveyed CAD coordinates. |
| `rotation.yawDegrees` | Initial rotation around the vertical axis. |
| `rotation.pitchDegrees`, `rotation.rollDegrees` | Model tilt; leave 0 to keep the arrow upright. |
| `heightMetres` | Arrow height; current white pointer is 0.60 m. |
| `bounceHeightMetres` | How far the arrow bounces. |
| `bouncePeriodSeconds` | Duration of one smooth bounce. |
| `rotationPeriodSeconds` | Duration of one complete turn. |
| `color` | Hex color; `#ffffff` is white. |
| `interior.path` | Existing tour route, currently `/interior-kitchen-foyer`. |
| `interior.nodeId` | Interior pano node ID. Current `spline_pano_03_F0018` is the foyer. Set `null` to use the tour's default entry. |

The current project has one shared interior tour. Villa/facing are preserved in its URL, but are not a claim that 77 villa-specific interior datasets exist. Add those destinations when their datasets/routes are available. A different facing does not imply mirroring an interior.

No visible label is drawn: click/tap the white arrow to enter. The marker is keyboard-accessible, respects reduced-motion preferences, and stops animating when the tab is hidden. Invalid JSON configuration is reported in the console rather than crashing the walkthrough. Run `tsx --test lib/exterior-tour/villa-hotspots.test.ts` to validate edits.

## Placement audit and precision

`docs/exterior-villa-hotspots-cad-audit.json` records the drawing/GLB hashes, CAD label positions, garage-floor geometry references, camera positions, heading corrections, visual adjustments, and the per-villa pano assignments. The floor-plan drawing supplies villa identity; the GLB parking floors and source pano coordinates supply the initial placement; Cloudflare preview views were inspected for garage paving, vehicles, and foreground planting. Villa 74's missing exported parking floor was located using its matching Villa 77 template and entrance-step transform, then checked against the actual image.

The source-node positions are centimetres; GLB coordinates are metres. For the initial model-derived angle, use `atan2(-deltaX, deltaZ)` in degrees, subtract that pano's source `yaw`, add 90°, and wrap into 0–360°. The rendered marker stays at a virtual radius of 8.5 m, inside the 10 m panorama sphere. That virtual distance is not the surveyed distance to the villa. Pitch places the marker on the visible garage paving. These are visually calibrated UI markers, not a claim of survey-grade precision at every zoom.

The camera position does not cover every garage equally front-on. A few selected approaches are angled or farther away to keep all 77 pano assignments distinct. Only those 77 views show pointers; the remaining exterior views do not.

Marker materials render after the panorama adapter's transparent high-resolution tile layer, so the white arrow remains visible when tiles finish loading. The arrow remains fully opaque; only its ring and shadow use visual transparency.

## Villa / player-pano lookup

| Villa | Pano number | Facing |
| --- | --- | --- |
| 01 | 235 | East |
| 02 | 216 | West |
| 03 | 224 | West |
| 04 | 222 | West |
| 05 | 221 | East |
| 06 | 219 | East |
| 07 | 227 | East |
| 08 | 207 | West |
| 09 | 205 | West |
| 10 | 204 | East |
| 11 | 201 | East |
| 12 | 193 | West |
| 13 | 191 | West |
| 14 | 192 | East |
| 15 | 180 | West |
| 16 | 178 | East |
| 17 | 183 | East |
| 18 | 166 | West |
| 19 | 163 | West |
| 20 | 161 | West |
| 22 | 158 | East |
| 23 | 160 | East |
| 24 | 162 | East |
| 25 | 164 | East |
| 26 | 167 | East |
| 27 | 17 | West |
| 28 | 20 | West |
| 29 | 22 | West |
| 30 | 24 | West |
| 31 | 25 | West |
| 32 | 33 | East |
| 33 | 30 | East |
| 34 | 28 | East |
| 35 | 26 | East |
| 36 | 23 | East |
| 37 | 21 | East |
| 38 | 19 | East |
| 39 | 16 | East |
| 40 | 114 | West |
| 41 | 116 | West |
| 42 | 118 | West |
| 43 | 120 | West |
| 44 | 122 | West |
| 45 | 119 | East |
| 46 | 117 | East |
| 47 | 115 | East |
| 48 | 113 | East |
| 49 | 61 | West |
| 50 | 59 | West |
| 51 | 57 | West |
| 52 | 54 | West |
| 53 | 52 | West |
| 54 | 50 | West |
| 55 | 46 | West |
| 56 | 45 | West |
| 57 | 42 | West |
| 58 | 44 | East |
| 59 | 47 | East |
| 60 | 49 | East |
| 61 | 51 | East |
| 62 | 53 | East |
| 63 | 56 | East |
| 64 | 58 | East |
| 65 | 60 | East |
| 66 | 104 | West |
| 67 | 68 | West |
| 68 | 70 | West |
| 69 | 72 | West |
| 70 | 91 | West |
| 71 | 77 | West |
| 72 | 79 | West |
| 73 | 84 | West |
| 74 | 78 | East |
| 75 | 90 | East |
| 76 | 92 | East |
| 77 | 71 | East |
| 78 | 69 | East |
