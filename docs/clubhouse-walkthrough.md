# Clubhouse walkthrough

Route: `/clubhouse-walkthrough`.

This route uses the existing `InteriorPanoWalkthrough` component, its tiled
adapter, directional arrows, camera controls and fade transitions. The small
client wrapper supplies clubhouse data rather than duplicating the viewer.
It is intentionally not added to the main site navigation yet.

## Source and quality

- Navigation: `data/Clubhouse_Pano_Data.json`, 105 unique camera IDs.
- Cloudflare assets: `sthyra-assets/Varaprasad_Laurels/Panos/varaprasad_clubhouse_panos/`.
- The existing signer resolves this R2 key prefix to Worker URLs for metadata,
  previews and tiles. The private S3 API and raw `Clubhouse Panos 12k` source
  images are not used in the browser. No local panorama fallback is configured.
- Exact render basenames map to folder names. The supplied `Thid` and `Forth`
  spellings are retained on disk; the UI displays Third and Fourth correctly.
- Every panorama is 12,288 × 6,144 with 16 × 8 original 768 × 768 JPEG tiles.
- Verified all 105 metadata files, 105 non-empty previews and 13,440 non-empty
  tiles. Nothing was regenerated, resized, recompressed, overwritten or deleted.
- The foreground viewer always requests the full tiled panorama, including on
  mobile/slow connections. Previews are only the initial loading layer.
- The supplied clubhouse renders appear as AVIF plans at top right. Ground uses
  nine dot POIs linked to the user's exact cameras, with visually reviewed POI
  arrival views. The other four floors also use dot POIs, with 23
  user-supplied camera mappings and exact arrival yaw/pitch/zoom. Only references
  47 and 56 are still pending. Reference 45 was removed. All plan POIs use gold by default and
  standard blue on hover/focus or when active. Tap to enlarge/zoom. All five floors share
  `data/clubhouse-floor-plans.json`; see [clubhouse-floor-plans.md](clubhouse-floor-plans.md).
  Measurements and bare-shell controls are not shown.

## Loading and cache

The audited folder map lets the viewer start immediately with the active node;
it does not fetch all 105 metadata files. Only the active pano and a bounded
number of neighbours are authorized and loaded through the existing signer.
Metadata and resolved assets are reused for return visits. The viewer's bounded
image cache is also used for preloading, rather than a separate unbounded cache.

After a short quiet period, at most two likely neighbouring views are warmed,
starting with forward travel. Only their previews and four view/zoom-aware tiles
are prefetched, using low-priority requests and two tile downloads at a time.
Obsolete speculative requests are aborted on navigation/unmount. Slow connections
warm fewer previews without downgrading the active panorama's tile quality.
Rapid clicks are guarded by the existing synchronous in-flight navigation lock.

The large generated and source image directories remain ignored by Git.
The viewer no longer requires local clubhouse panoramas. No local or remote
assets were deleted or overwritten during the cloud migration.

Cloud audit on 2026-11-18: all 105 folders, 105 metadata files, 105 previews and
13,440 non-empty tiles were present (13,650 objects total; no extras/missing).
Metadata retained 12,288 × 6,144 resolution and 16 × 8 tiles. All 315 Worker
GETs (metadata, preview and one tile per pano) passed CORS, byte-size, ETag/MD5
and decoding checks. The local tile folder was already absent, so this audit
does not claim a byte-for-byte comparison against local originals.
After switching, headless Chrome visited all five floors in the same viewer:
131 observed clubhouse Cloudflare responses were HTTP 200, zero local clubhouse
requests occurred, and no page errors were recorded.

Read-only verification (no upload, delete or purge):

```powershell
node scripts/verify-exterior-panos.mjs --clubhouse --remote-only --endpoint https://2fe8b97f277d6ada48a33be5db19daa7.r2.cloudflarestorage.com
```

## Floors and navigation

| Floor | Views |
| --- | ---: |
| Ground | 26 |
| First | 20 |
| Second | 19 |
| Third | 35 |
| Terrace (fourth camera group) | 5 |

Each floor has its own spatial graph. Matching XY coordinates on different floors
never produce automatic arrow links. Consecutive frames within an exported pano
path are retained as explicit same-floor links, including sparse samples.

The Floor selector fades to a verified entry panorama without recreating the
viewer. The public Zone/View selector stays hidden. The pano debug panel has
moved to the exterior walkthrough and is not enabled in clubhouse interiors. Room numbers
are references on the floor plan, not inferred camera/path numbers.
Floor-access markers are configured separately in
`data/clubhouse-floor-transitions.json`. All angles in that file are **degrees**:
`yaw`/`pitch` place an icon on the sphere. All labels use fixed 3D planes, never
camera-facing billboards. `presentation: "floating"` sets the compact floating
sign styling; omitted/`"wall"` retains wall styling. `wallYaw` sets the fixed plane
orientation in either case. The upper-floor floating pairs share the same front
plane rather than turning towards the camera independently as the view changes.
`entryViews` supplies yaw, pitch and zoom for initial entries and cross-floor
arrivals only. Same-floor walking still preserves the visitor's live direction.
Ground Views 7–8 retain their front-wall labels. The First floor is unchanged.
Second-floor labels float over the actual stair openings: Up over the rising
steps, Down lower over the descending stairwell gap. Third-floor labels float
straight ahead, side by side at equal pitch. Fourth/terrace has an upright return label in front
of the roof-access doorway, clear of the side wall and lift signage.
For the retained wall markers, corrected local yaw is used:
for these axis-aligned walls, position yaw (degrees) + `wallYaw` is 90 modulo
180 on side faces and 0 modulo 180 on front faces. Do not reverse the local
rotation sign; that makes the marker float across the wall or become squeezed.

Inspected locations: Ground Zone 1 Views 7–8; First, Second and Third Zone 1
View 1; Fourth Zone 1 View 0. Ground has Up; intermediate floors have Up and Down;
Fourth has Down. The third-floor landing shows the descending stairs but no
visible upward flight; the fourth-floor images show the lift/roof-access lobby,
not a stair flight. Their upper-floor connection is a **floor-access shortcut**,
not a claim that an unrendered staircase is physically at the marker position.

Each icon is an accessible button: a 3D `elementLayer` for wall labels, or a
fixed scene-anchored `elementLayer` for floating labels too. They are translucent white at
rest and solid white on hover or keyboard focus, with no hover movement.
Transitions reuse the same viewer and fade; the existing in-flight guard blocks
rapid repeated navigation. Every destination has an explicit arrival view.
The ground-floor reception framing follows the supplied entrance screenshot;
returning down from First lands beside the ground stairs looking into the hall.

Both selectors use the shared custom glass dropdown, with a frosted popup,
selected checkmark, keyboard navigation, Escape/outside dismissal, focus return
and scrollable long viewpoint lists. They disable during transitions. Clubhouse
Dimensions controls are hidden in every layout, including the shared room menu;
other interior tours retain their configured controls.

Direct links:

- `/clubhouse-walkthrough?floor=ground`
- `/clubhouse-walkthrough?floor=first`
- `/clubhouse-walkthrough?floor=second`
- `/clubhouse-walkthrough?floor=third`
- `/clubhouse-walkthrough?floor=fourth`
- `/clubhouse-walkthrough?node=Third_Floor_Pano_4_F0000`

Explicit valid node IDs take precedence over floor; invalid values fall back to
a verified floor entry or the ground entry. Changing selectors is in-place; it
does not reload the route or update the initial deep-link query.

## Verification

```powershell
npx tsx --test lib/clubhouse-floor-transitions.test.ts lib/clubhouse-tour.test.ts lib/villa-residence.test.ts lib/master-plan-hotspots.test.ts lib/exterior-tour/*.test.ts
npx tsc --noEmit
```

Headless Chrome verified the initial pano, all five floor changes with the same
canvas retained, all floor viewpoint counts, the `Thid` filename mapping and a
12-click burst resulting in a single forward move. All observed clubhouse
responses were HTTP 200 in the original local-asset UI check. Cloud mode now
uses the shared signer, verified by its cloud-resolution regression test. A 390px touch
viewport loaded the First floor deep link with a 390px document width.

Existing unrelated development warnings remain: three unused declarations in the
legacy viewer, multiple bundled Three.js instances, the remote-control relay
connection, and the site's mobile `UpperLayoutCTA` SSR hydration mismatch. The
clubhouse viewer still loads and navigates after that site-wide hydration warning.

Floor-marker verification: all nine links were exercised in headless Chrome,
including a complete Ground → Fourth → Ground round trip retaining the same
canvas. Arrival yaw/pitch and 55% → 100% hover opacity were checked. A 390px touch
viewport tapped the Ground View 8 marker successfully and arrived in the First
floor lounge without horizontal overflow. Tests also validate adjacent-floor
directions, calibrated targets and unchanged same-floor/legacy view behavior.
