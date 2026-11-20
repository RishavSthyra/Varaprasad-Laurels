# Remaining exterior panoramas — v2

The exterior tour keeps its 251 existing Cloudflare panoramas and appends 34
matched Cloudflare stops. Original villa pointers and the first 251 player counters
are unchanged. The separate area-map page is not affected.

`data/exterior-remaining-v2-cameras.json` contains the seven supplied camera JSON
exports, grouped by camera. Their coordinates, vectors, rotations, IDs and source
filenames are preserved. `lib/exterior-tour/remaining.ts` adds asset aliases and
global navigation order without editing the export values.

| Camera | Player counters | Render naming |
| --- | --- | --- |
| 02 | 252–256 | Local frames 00000–00004 |
| 03 | 257–259 | Local frames 00000–00002 |
| 04 | 260–263 | Local frames 00000–00003 |
| 05 | 264–269 | Global frames 00263–00268 |
| 06 | 270–277 | Global frames 00269–00277, excluding missing 00272 |
| 07 | 278–282 | Local frames 00000–00004 |
| 08 | 283–285 | Local frames 00000–00002 |

Camera 06 frame 272 has data but no image. Camera 07 image 00005 has no matching
data. Neither is included, and no position is invented for the latter. Camera
runs do not connect merely because they are adjacent in the export: their
directional branches use the existing coordinate-based graph. Sequential trail
controls stay within a camera run rather than teleporting to the next run.
Direct entries to a new run start at camera-local yaw zero, avoiding applying
the exported world heading twice; movement preserves the world-facing heading.

The new R2 asset root is
`Varaprasad_Laurels/Panos/varaprasad_exterior_panos_remaining_v2`.
The older remaining-panos cloud folder is a different export. Each included
panorama uses its existing 8640×4320 metadata, preview and 128 540×540 JPEG tiles.
No re-encoding or raw PNG requests are needed by the viewer. Per-pano roots keep
all assets on the existing signed Cloudflare route and shared player/cache.

## Cloud migration audit — 2026-11-20

`scripts/verify-exterior-v2-cloud.mjs` performed a read-only pre-deletion audit:

- All 35 generated folders, 35 metadata files, 35 previews and 4,480 tiles:
  **4,550 objects / 634,927,913 bytes**, matching local sizes and MD5/ETags.
- Zero missing, empty, changed or unexpected generated objects.
- **175 signed Worker GETs**: metadata with both localhost and production CORS,
  plus every preview and the first/last tile of each panorama with production
  CORS. Downloaded samples matched local checksums; images decoded successfully.
- All **35 original PNGs / 2,144,499,726 bytes** also matched their R2 backup
  sizes and multipart ETags (AWS CLI 8 MiB part hashes), under
  `Varaprasad_Laurels/Panos/Exterior PANOS_Remaining_v2/`.

The runtime now signs metadata, preview, full tiles and speculative warmup URLs
from the new v2 cloud prefix. It never requests the raw PNGs or optional local
generated folder. The source PNG without coordinates remains backed up but is
still deliberately not added as a tour stop.

After this migration, these two optional asset folders may be removed locally:

- `public/varaprasad_exterior_panos_remaining_v2`
- `Exterior PANOS_Remaining_v2`

Neither was deleted by the migration. Both are ignored by Git to prevent
re-adding the large cloud-hosted files. Keep `data/exterior-remaining-v2-cameras.json`
and `lib/exterior-tour/remaining.ts`: those are runtime navigation/configuration,
not disposable image assets. Production needs a redeploy to use the updated root.
Regenerating tiles later requires downloading the source PNGs again if removed.

Cloud-only browser checks covered all seven camera groups (02–08), next/back,
Camera 06 directional movement and the 390px minimap. Local generated-pano URLs
were blocked: successful runs recorded zero local pano requests, missing cloud
files or page exceptions. Camera groups can be checked in separate browser runs
using `EXTERIOR_CAMERAS=02,03` etc. to keep long software-WebGL sessions bounded.
All 57 exterior unit tests, TypeScript and scoped ESLint checks passed.

`showAmenities={false}` hides the exterior POI markers, current-amenity card and
desktop/mobile amenities menu without deleting their configuration. The ortho
minimap, zoom/pan/expand controls and current-position indicator remain enabled.
The existing minimap projection is unchanged. It projects 79 original stops and
12 added stops beyond the ortho image bounds, where the old UI clamps the marker
to the edge. Correcting this pre-existing calibration needs verified matching
world/image reference points, not adjusted panorama coordinates.

Checks: `npx tsx --test lib/exterior-tour/remaining.test.ts
lib/exterior-tour/pano.test.ts lib/exterior-tour/villa-hotspots.test.ts`.
`scripts/verify-exterior-v2.cjs` checks one rendered stop in each camera run,
next/back, desktop/mobile minimaps, signed cloud full-detail requests and errors
against a running local Next server. It blocks the old local asset path to
simulate local deletion without changing files on disk.
