# Masterplan → villa panorama

Clicking a mapped villa GLB or an Explore Villa residence card opens its own
Cloudflare-hosted tiled panorama in place. The masterplan stays mounted underneath. After
the first pano frame is ready, the pano fades over the masterplan for 1.2 seconds;
Back reverses that fade without reloading or recalibrating the masterplan. Reduced
motion preferences disable the animated fade. GLB geometry, placement, depth
occlusion and hover/filter materials are unchanged.

## Asset identity

`data/villa-panos.json` explicitly maps each villa number to its exact folder under
`Varaprasad_Laurels/Panos/varaprasad_villa_panos` in the `sthyra-assets` R2 bucket.
The corresponding local originals remain in `public/varaprasad_villa_panos`.
Camera numbers and frame numbers are **not** used
as villa numbers. There are currently 76 folders, not 78: Villas 7 and 21 are
missing. All 76 have a preview, metadata and 128 original JPEG tiles (12,288 ×
6,144 full resolution). The files were inspected, not regenerated or modified.

Villa 7 is intentionally pano-unavailable in `data/villa-residence-config.json`.
Its information can still be opened, but no neighbouring villa panorama is
substituted. Villa 21 remains excluded from the masterplan catalogue/interaction.

Each manifest entry has editable `yawDegrees`, `pitchDegrees` and PSV `zoom`
(0–100). Defaults are the panorama render's native centre (0/0), not estimated
world-space camera data. These affect only the single-villa panorama, never the
precise masterplan GLB calibration.

## Correct villa information

The new `VillaResidenceExperience` retains the previous left/right detail-panel
arrangement but reads each villa's actual type, facing, plot area/dimensions,
position, road frontages, built-up area, per-floor area and room dimensions from
`data/villas.json`. The panels use a warm ivory/stone finish with restrained gold
accents. The right summary is compact and does not scroll. Each panel can be
hidden and reopened independently without leaving or reloading the panorama.

The supplied local files are exterior villa panoramas, **not interior tours or
floor-plan drawings**. The left card opens on a Villa tab with an edge-to-edge
catalogue exterior image above its plot dimensions and areas. Ground, First and
Second replace that image with the configured floor plan and show the correct
CAD room schedule below; missing floor plans have an explicit placeholder.
Terrace is omitted from these UI tabs (the source CAD data is retained).
Room schedules are paginated, with fewer rows on short screens.
There is no fallback to the old apartment floor plan or TULA interior tour.
Open walkthrough is visible but disabled until a verified villa tour is assigned.
Sales status continues to come from the existing inventory; pano availability
does not invent a Reserved/Sold sales status.

Configure verified assets in `data/villa-residence-config.json`, for example:

```json
{
  "unavailablePanoVillaNumbers": [7],
  "floorPlans": {
    "type-a-351-east": {
      "ground": "/villa-floorplans/type-a-east-ground.avif"
    }
  },
  "interiorTours": {
    "type-a-351-east": {
      "path": "/villa-interior/type-a-east",
      "nodeId": "entrance"
    }
  }
}
```

These example asset paths/routes must actually be supplied/implemented before
being configured. Floor keys are `ground`, `first`, `second`, `terrace`. Catalogue
type IDs identify all five layouts/facings; no type is guessed from the mesh name.

## Cloudflare delivery and verification

The manifest's `assetBaseUrl` is now the relative R2 key prefix (no leading slash).
`PanoAssetStore` uses the existing `/api/sign-asset` endpoint to get signed Worker
URLs for metadata, previews and all 128 tiles. The browser does not use the
private S3 API endpoint, raw PNG folder or local villa pano URLs. Folder identities,
camera orientation, tile resolution, caching and the masterplan crossfade are unchanged.

Before switching delivery, a read-only audit on 2026-11-17 checked all 9,880
objects (76 metadata files, 76 previews, 9,728 tiles) against local sizes and MD5
checksums. No objects were missing, mismatched or extra. For every villa, its
metadata, preview and first tile also passed a live signed Worker GET, CORS,
content equality and image-decode check: 228 successful responses. See
`docs/villa-pano-cloud-audit.json` for the recorded result.

Repeat the same read-only audit (uses existing local R2 profile and environment):

```powershell
node scripts/verify-exterior-panos.mjs --villa --endpoint https://2fe8b97f277d6ada48a33be5db19daa7.r2.cloudflarestorage.com --profile r2
```

No local panorama files, Cloudflare objects or cloud settings were changed by
the audit or source switch. No uploads, overwrites, deletes or purges were run.

Local generated panos and `raw-panos` are ignored by Git, not deleted. A deployment
without the local assets now uses the cloud tiles; its existing asset signing
environment must be configured. `scripts/generate-panos.ts` retains the user's existing edits and was
not run or changed by this integration.

## Verification

- 59 combined villa-residence, masterplan and exterior regression tests pass;
  TypeScript and targeted ESLint pass.
- Local asset audit: 76 previews, 76 metadata files and all 9,728 tiles present.
- Cloud audit: all 9,880 corresponding R2 objects match local sizes and MD5;
  228 live Worker checks pass. Headless Chrome opens Villa 03 using
  `assets.sthyra.com` metadata, preview and sharp tiles with no local villa-pano
  requests; all observed villa cloud responses are HTTP 200.
- Unit tests cover exact folder matching, missing/excluded villas, CAD details
  and absence of old-project floor-plan/interior fallbacks.
- Headless Chrome: an actual GLB hover/click on Villa 50 opens the Villa 050
  folder; Type A West room schedules and floor switching work; Back preserves
  the masterplan; Villa 7 has no fallback request; a Type B Villa 03 shows 6,500
  sq ft; mobile panels and zoom controls render without horizontal overflow.
- On compact screens, Floor details and Villa details controls switch between
  panels; hiding either leaves a clean pano view and a reopen control. The live
  overlap uses a 1.2-second opacity transition while both panorama and masterplan
  canvases remain mounted.
- Existing unrelated development issue: the root QuoteRequestController/
  UpperLayoutCTA tree reports a hydration mismatch on initial load. This is
  outside the villa overlay and was not modified here.
