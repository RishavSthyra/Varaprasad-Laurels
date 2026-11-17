# Exterior villa entrances

Edit `data/exterior-villa-hotspots.json`. Only entrances on the active panorama are loaded; all entrances share the small local arrow GLB. Create a `panos` entry only if that panorama is not already listed. For multiple villas visible from the same pano, add more objects inside that pano's existing `pointers` array. Give every pointer a globally unique `id` and include each villa only once per pano.

The configuration now covers **77 villas across 134 panoramas, with 218 pointers**: Villas 01–78, excluding Villa 21 under the existing project exclusion. **80 panos contain multiple villa pointers** (up to three). The same villa can appear in several panos, but only once inside any one pano. All 78 previously configured pointers retain their exact positions, IDs, appearance, and interior destinations. All four original CAD/backup files and the source GLB remain unchanged.

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

Pointers are an explicit image-reviewed whitelist, not one assigned pano per villa and not an automatic distance-based visibility guess. A villa gets a pointer in each reviewed nearby view where the parking opening and usable garage paving are adequately visible. Several villas may therefore have pointers in one pano. Views hidden by walls/planting, narrow side slivers, and distant ambiguous parking areas are omitted. Source pano headings and local yaw/pitch are recalculated per view. Existing markers are never relocated by this expansion.

Marker materials render after the panorama adapter's transparent high-resolution tile layer, so the white arrow remains visible when tiles finish loading. The arrow remains fully opaque; only its ring and shadow use visual transparency.

## Multi-view visibility review

`docs/exterior-villa-visibility-review.json` records the 2026-11-17 review: all 251 camera positions were geometrically screened; 200 Cloudflare previews were inspected through 522 garage/pano projections, including close side/corner exceptions. 140 new pointers were accepted and 304 candidate views rejected; the original 78 pointers were preserved. This is visual UI calibration, not a guarantee of survey-grade visibility at every zoom.

Player **19/251 now includes Villas 38 and 28** (the black SUV and the opposite Ferrari garage). Player 20 keeps its original Villa 28 pointer and also includes the other reviewed visible garages. Villa 78 remains on both panos 69 and 97, with its other clear approaches listed below.

To add another view, merge a pointer into the existing pano entry if it exists; do not duplicate the pano object. Use a globally unique pointer ID, the correct villa/facing/interior, and angles calibrated for that exact panorama. Do not add two pointers for the same villa in one pano. Rejecting duplicate villa/pano pairs prevents doubled arrows and overlapping click targets. Only the active pano’s one-to-three markers are created, sharing one arrow GLB request and one animation loop.

The preservation tests fingerprint the original pointer objects. If intentionally changing an original pointer later, update its preservation snapshot as part of that reviewed change; otherwise an accidental relocation fails validation.

## Villa / player-pano lookup

All currently configured views, not only each villa’s original primary view.

| Villa | Pano numbers | Facing |
| --- | --- | --- |
| 01 | 235 | East |
| 02 | 216, 217, 226, 227 | West |
| 03 | 219, 220, 223, 224, 225 | West |
| 04 | 221, 222 | West |
| 05 | 221, 222 | East |
| 06 | 218, 219, 220, 223, 224, 225 | East |
| 07 | 216, 217, 226, 227 | East |
| 08 | 200, 202, 207, 208 | West |
| 09 | 203, 204, 205 | West |
| 10 | 204, 205 | East |
| 11 | 201, 202, 206, 207 | East |
| 12 | 190, 191, 192, 193, 194 | West |
| 13 | 191 | West |
| 14 | 191, 192 | East |
| 15 | 178, 179, 180 | West |
| 16 | 177, 178, 180, 181 | East |
| 17 | 9, 175, 176, 182, 183, 184 | East |
| 18 | 166, 167 | West |
| 19 | 163, 164 | West |
| 20 | 161, 162 | West |
| 22 | 155, 156, 157, 158 | East |
| 23 | 159, 160 | East |
| 24 | 161, 162 | East |
| 25 | 163, 164 | East |
| 26 | 166, 167 | East |
| 27 | 16, 17 | West |
| 28 | 18, 19, 20 | West |
| 29 | 20, 21, 22 | West |
| 30 | 22, 23, 24 | West |
| 31 | 25, 26, 27 | West |
| 32 | 32, 33 | East |
| 33 | 29, 30 | East |
| 34 | 27, 28 | East |
| 35 | 25, 26 | East |
| 36 | 23, 24 | East |
| 37 | 20, 21 | East |
| 38 | 18, 19 | East |
| 39 | 15, 16, 17, 169 | East |
| 40 | 113, 114 | West |
| 41 | 116 | West |
| 42 | 118, 119 | West |
| 43 | 120, 121 | West |
| 44 | 122, 123 | West |
| 45 | 118, 119, 120 | East |
| 46 | 116, 117 | East |
| 47 | 114, 115 | East |
| 48 | 113, 114 | East |
| 49 | 60, 61, 62, 111 | West |
| 50 | 58, 59 | West |
| 51 | 55, 56, 57 | West |
| 52 | 53, 54 | West |
| 53 | 51, 52 | West |
| 54 | 49, 50 | West |
| 55 | 46, 47 | West |
| 56 | 44, 45 | West |
| 57 | 42, 43 | West |
| 58 | 44, 45 | East |
| 59 | 46, 47 | East |
| 60 | 49, 50 | East |
| 61 | 51, 52 | East |
| 62 | 53, 54 | East |
| 63 | 56, 57 | East |
| 64 | 58, 59 | East |
| 65 | 60, 61 | East |
| 66 | 103, 104 | West |
| 67 | 67, 68, 98, 99, 100 | West |
| 68 | 69, 70, 95, 96, 97 | West |
| 69 | 71, 72, 93, 94 | West |
| 70 | 74, 75, 91, 92 | West |
| 71 | 76, 77, 88, 89, 90 | West |
| 72 | 78, 79, 86, 87 | West |
| 73 | 81, 84, 85 | West |
| 74 | 77, 78, 79, 87, 88 | East |
| 75 | 75, 76, 90, 91 | East |
| 76 | 73, 74, 91, 92, 93 | East |
| 77 | 70, 71, 72, 94, 95 | East |
| 78 | 68, 69, 96, 97 | East |
