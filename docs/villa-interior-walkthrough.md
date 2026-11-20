# Shared villa interior preview

Route: `/villa-walkthrough?villa=1` (also accepts `floor=ground|first|second`
and a verified `node=GF_CAM5_F0000` etc.). All catalogued villas temporarily
use the supplied Villa 1 interior, with the selected villa's own balcony images.
The short preview badge makes the shared indoor preview explicit;
the tour is not mirrored or claimed to match every villa type's room dimensions.
Villa 21 remains excluded. Villa 7's exterior panorama remains unavailable.

Uses the existing `InteriorPanoWalkthrough` component, not a second renderer.
Masterplan "Enter walkthrough" links and exterior garage pointers use the new
route with the selected villa number and its CAD facing. Existing manual pointer
positions and the large exterior hotspot JSON are unchanged. Legacy apartment
node IDs are not forwarded into the new tour. Per-type destinations remain
editable in `data/villa-residence-config.json` for later separate interiors.

## Assets and floors

- Data: `data/Varaprasad_Interior_Pano_Data_v1.json`.
- Runtime assets: R2 `Varaprasad_Laurels/Panos/varaprasad_villa_1_interior/`.
- Optional local backup/audit folder: `public/varaprasad_villa_1_interior/`.
- 108 exact filename-matched asset folders: Ground 43, First 41, Second 24.
- 100 distinct walking stops: Ground 36, First 40, Second 24. Eight repeated
  renders resolve to their canonical stop; all files and the source JSON remain intact.
- Original 8640 × 4320 resolution, 16 × 8 tiles of 540 × 540 per pano.
- Audited all 108 metadata files, 108 decodable previews and 13,824 non-empty tiles.
- Nothing regenerated, recompressed, uploaded or deleted.
- Generated assets and the `NEW INTERIOR` raw PNG folder are ignored by Git.

The custom glass Floor selector fades between calibrated floor entries without
recreating the viewer. Second floor enters at its landing, not the wardrobe
camera listed first in the export. The villa tour hides the View selector on
every floor. First and second floors show a glass "View balcony" button instead;
ground floor has neither control. On a balcony the button becomes "Back to
interior", returning to the room from which it was opened (or the adjacent
interior stop for a direct balcony link). Clubhouse controls are unchanged.
Same-floor spatial arrows are separated by floor; consecutive frames retain
their explicit path links. Cross-floor arrows are never guessed from shared XY
coordinates. No terrace was supplied, so none is offered. Old apartment floor
plans, bare-shell assets and dimension labels are disabled.

The supplied Villa 1 renders now appear as optimized AVIF minimaps and expanded
floor plans. `data/villa-floor-plans.json` holds 29 retained dot POIs, including
25 exact user-supplied camera/arrival mappings. Ground 15, 16, 17 and First 23
are still unassigned. POI arrivals preserve the supplied yaw/pitch/zoom without
changing normal walking, balcony or floor-entry calibration. See
[villa-floor-plans.md](villa-floor-plans.md) for the dedicated data and audit.

## Coordinate and render audit

`data/villa-interior-navigation.json` records the reviewed repeated-render aliases.
The runtime reflects Y coordinates and camera yaw together for the villa export's
handedness. The source JSON is not modified. Arrival heading, direction buttons,
3D links and predictive preloading all use that same basis. Direct in-pano arrow
clicks preserve heading just like the direction rail and view selector.

The supplied seven GF_CAM0 images repeat the five-frame GF_CAM5 take, including
two held final frames. CAM5's coordinates and rotation changes match this take;
CAM0's do not. The default entrance therefore uses GF_CAM5_F0000. An old CAM0
deep link resolves to its matching CAM5 frame. FF_CAM1_F0006 repeats the initial
landing at identical coordinates and is likewise collapsed into FF_CAM1_F0000.
Zero-distance and exactly sideways candidates cannot masquerade as forward/back.

The actual GF_CAM0 bedroom take needs re-exporting. Until then, the five GF_CAM1
wardrobe views remain accessible from the view selector and allow movement
within that path, but there is deliberately no invented walking link through the
missing bedroom. First and Second floors are fully connected. Remove the relevant
aliases after reviewing the corrected replacement images; the audit fails if an
aliased preview no longer matches its canonical render.

## Villa-specific balconies

`getVillaInteriorTour(villaNumber)` keeps the shared source JSON, coordinates,
floor sections and navigation graph unchanged. It resolves processed balcony renders
under R2 `Varaprasad_Laurels/Panos/varaprasad_villa_balconyPanos/` for the selected villa:

- First floor: `Villa NN Balcony 02`, replacing the two black outdoor renders
  `FF_CAM2_F0007` and `FF_CAM2_F0008`. Only one replacement pano is supplied per
  villa/floor, so both existing balcony stops use it (not two invented images).
- Second floor: `Villa NN Balcony 01` at the end of the balcony-door approach,
  `SF_CAM1_F0003`. The supplied shared tour has no outdoor second-floor capture;
  this endpoint at the glazed doors now opens the villa-specific balcony view.
- `SF_CAM2` is a dark cinema/bar, not a balcony, and stays untouched.
- Villas 1–78 except excluded Villa 21 have both images, including Villa 7.
  Villa 7's missing exterior street pano is unrelated to these balcony assets.

The existing shared renderer resolves these nodes against its balcony asset
store, including previews, metadata and view-prioritized tiles. No extra viewer,
full-resolution download, image re-encoding, or runtime asset-directory scan is
introduced. The supplied 8640 × 4320 originals and 540 × 540 tiles are retained.
Back arrows and floor selection still use the original shared tour graph.
The existing `PanoAssetStore` signs Cloudflare Worker URLs for metadata, previews
and tiles on demand and caches them across return visits. It does not fall back
to local balcony assets or fetch the raw `Balcony panos 12k` source folder.
Local balcony copies are ignored by Git and left untouched as backups.

All 154 native balcony preview directions were visually reviewed. Their centres
already frame the balcony seating/open side; the wall-facing regression came
from inheriting a shared interior camera's yaw/pitch/zoom into the independent
balcony render. `VILLA_BALCONY_ENTRY_VIEWS` resets balcony arrivals to native yaw
0, pitch 0, zoom 10. This applies to the balcony button, walking/3D arrows and
direct links. Predictive tile warmup uses that same target view. Ordinary indoor
movement and clubhouse floor arrivals retain their existing heading behavior.
No panorama pixels, source poses, asset folders or render quality are changed.
The directional arrow rail is hidden only on balcony panoramas; "Back to
interior" and floor selection remain available, and indoor arrows are unchanged.

Validation covers all 154 metadata/previews and 19,712 non-empty tiles. Browser
checks cover Villa 20 on both floors, walking from the first-floor interior onto
its balcony, returning from the second-floor balcony to the shared interior,
Villa 1's distinct first-floor set, and Villa 78's second-floor set at 390px width.
No failed panorama requests occurred. Desktop checks reported no browser errors;
mobile still reports the pre-existing `UpperLayoutCTA` hydration warning noted
below, without preventing the balcony viewer or navigation from working.

## Loading

The verified folder map bypasses a startup scan of all 108 metadata files.
Both indoor and balcony assets use signed Cloudflare Worker URLs; there is no
local image fallback. Active full-resolution tiles take priority;
after a quiet period only two likely neighbours are warmed, with low-priority
previews and up to four view-aware tiles each (fewer on slow connections).
Obsolete preloads are aborted, metadata/authorization promises are deduplicated,
and the existing bounded viewer image cache is reused. A synchronous navigation
lock handles rapid repeated arrow clicks. Panorama quality is not reduced.

Shared indoor and balcony images now use Cloudflare. No local generated pano
folder is required at runtime. To audit without modifying source assets:

```powershell
node scripts/verify-villa-interior-panos.mjs
node scripts/verify-villa-interior-cloud.mjs
npx tsx scripts/verify-villa-balcony-cloud.ts
npx tsx --test lib/villa-interior-tour.test.ts lib/villa-residence.test.ts lib/exterior-tour/villa-hotspots.test.ts
npx tsx --test lib/interior-tour/navigation.test.ts
```

The interior cloud audit verifies all 14,040 expected objects (108 metadata files,
108 previews, 13,824 tiles). The balcony audit checks 20,020 objects (154 metadata,
154 previews, 19,712 tiles). Both compare all file sizes to local backups when
available, validate every cloud metadata grid, and check signed HTTP access, MIME and CORS for each
set's metadata, preview and two edge tiles. AWS CLI credentials and `ASSET_SECRET`
are required for this read-only audit; no upload or delete is performed.

After migration, browser checks loaded all three floors, including mobile,
with zero local interior/balcony requests and no failed pano responses.
First-floor forward/back movement and the balcony/return buttons also passed.
All 14 navigation/asset regression tests and TypeScript checks passed.

Before the cloud migration, browser checks covered all three floor entries, a remote camera within the
second floor, rapid arrow clicks, and floor selection on a 390px mobile viewport.
The viewer canvas survives floor changes. The initial desktop load requested
three metadata files rather than scanning 108; observed image requests succeeded
without any asset-signing requests. An existing mobile `UpperLayoutCTA` hydration
warning is independent of this tour and remains outside this integration.

Navigation regression checks cover 15-degree heading samples at all 100 unique
stops, first-floor forward/reverse movement, 90-degree camera turns, repeated
coordinates, and floor isolation. Browser forward/back/3D-link checks on all
three floors retained pitch and world heading without recreating the canvas.
