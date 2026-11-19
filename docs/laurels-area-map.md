# Laurels area map

Route: `/area-map` (local preview: <http://localhost:3000/area-map>).

The exact owner-supplied project position is **17.455878751829474, 78.19507378655005**. The supplied Google Maps link resolves to Laurels Gates Infra on Kondakal–Shankarpally Road, Mokila. This replaces the old Bengaluru project location in the active map.

## Data and coverage

- `data/area-map-project.json`: project name, exact pin, supplied Google Maps link, verification date.
- `data/poi.json`: the canonical, formatted POI file with one field per line, local image paths, distance/time labels, concise descriptions and source metadata. It contains 27 curated destinations in eight categories: education, hospitals, shopping, parks, landmarks, sports, transport and workplaces. This is a selected neighbourhood guide, **not an exhaustive list of every business in Hyderabad**.
- Every POI records its coordinate source, locality and a specific description. Most pins are OpenStreetMap campus/building/station locations. These are not surveyed entrances. Indus International School's directory-sourced approximate campus coordinates are documented in the data.
- Gaudium uses its **Kollur / Velimela campus**, not the separate Gachibowli junior campus. Railway and metro stations are grouped as **Transport**, not incorrectly called bus stops. Universities are grouped as **Education**.
- The previous Bengaluru POI file is preserved unchanged in `data/archive/poi-bengaluru.json`. `data/laurels-area-pois.json` is the earlier source snapshot, not the active file. Old `data/poi-image-sources.json` and photographs are retained.

OpenStreetMap coordinate data is attributed to its contributors under [ODbL](https://www.openstreetmap.org/copyright). The checked-in JSON is the local data extract; no geocoding API is called by visitors. One-time coordinate checks used [Nominatim](https://operations.osmfoundation.org/policies/nominatim/), sequentially from one machine, with an identifying User-Agent, at less than one request per second. Do not turn this into autocomplete, background bulk discovery, or a recurring public-geocoder task.

## Photos and permissions

All 27 POIs have an actual relevant photograph, a full card image and a lightweight thumbnail, stored locally under `public/images/poi/laurels/`. Images were visually reviewed; poorly representative first choices were replaced with versioned files while retaining the earlier files.

`public/data/laurels-poi-photos.json` retains source URLs, authors, licences, sizes, dimensions, SHA-256 hashes and AVIF conversion notes. At the owner's request, this trial has no custom credits strip, info icon, popup or inline card source paragraph. Restore applicable photo attribution before public deployment. Native basemap attribution is unchanged. The Next.js development indicator is hidden via `devIndicators: false`; runtime/build errors still surface normally.

**Publishing review required:** 23 images have recorded Wikimedia Commons reuse licences. Four images (Indus, Gaudium, Samashti and Citizens Hospital) were sourced from their official institution websites; no public reuse licence was found. Their copyright remains with the source, and their entries explicitly say that publisher permission needs checking. Downloading or attribution alone does not grant a reuse licence. Obtain approval or replace these four with owner-authorized photographs before a public/commercial deployment. They are not labelled Creative Commons or licence-cleared.

AVIF derivatives retain the source licence, including applicable attribution/share-alike terms. Photos are up to 1280×1000, without enlargement, sRGB, AVIF quality 72, effort 6, 4:4:4 chroma. Thumbnails are up to 320×240 at quality 64. The low-resolution Mrugavani source remains low-resolution rather than being artificially upscaled. No panorama assets were recompressed.

Local versioned photographs have long-lived immutable HTTP caching. The preparation script refuses to overwrite unrecorded/changed images. To deliberately change a photo, update its source and increment `photo.version`; the old image remains on disk.

## Routes, loading and accuracy

- `public/data/laurels-routes/<id>.json`: 27 genuine OSRM driving geometries, checked on 2026-11-18. Every record includes project/destination signature, road distance, modelled duration and endpoint road-snap distances.
- `public/data/laurels-route-metrics.json`: small summary used for sorting, distance filters and estimated times before a route is opened. Geometry is fetched locally only for the currently selected POI, not all 27 on page load.
- Route preparation verified endpoint snaps below 300 m; the project's nearest mapped road is about 48 m from the supplied pin. Private roads, entrances and access restrictions still need on-site confirmation. A campus pin does not guarantee public entry.
- Displayed driving times are **estimates, not live traffic**. They are not claimed to be Google driving estimates. Routes are attributed to [OSRM](https://project-osrm.org/) and OpenStreetMap.
- Routes are validated before display or session-cache reuse. Wrong-project, moved-pin, wrong-ID, malformed or out-of-region geometry is rejected. Session cache is namespaced to Laurels and keyed by project/destination coordinates. Obsolete selection requests are aborted.
- No fabricated curved-road fallback or invented default ratings. Missing road geometry produces an explicit notice, without fabricated fallback geometry.
- Directions fit both project and destination into the unobscured map area and remain visible across the cluster zoom threshold. Category selection, distance filters, suggested/nearest/alphabetical sorting and all three map styles remain available.
- The map UI has no Google Maps links; **Get Directions** opens the local road geometry in the map. The underlying URL helper remains tested for potential future use. No Google photo or Places feed is scraped/rehosted.
- Basemap overlays are restored on MapLibre's `style.load` event, not an arbitrary timer after `styledata`. A style revision safely recreates clusters, routes and 3D layers even when React batches readiness changes. Clean style swaps preserve the camera and avoid incompatible provider glyph state; cluster labels use the available Noto Sans Regular font.

## Card and camera layout

- The starting view and reset focus on the supplied project pin at zoom **13.8**, offset into the unobscured map area rather than fitting every POI at startup.
- The default and reset mode is **3D**, with a 55-degree pitch and -18-degree bearing. Camera setup waits for map readiness; users can still choose Normal or Carto. Reopening the sidebar retains their selected mode. The basemap has no blue tint overlay.
- Desktop and mobile reuse one detail-card component. Its photo fills the top edge with rounded top corners, while the category badge and close button overlay the image.
- A smaller title, locality, short description and unboxed highlighted road distance/time sit below the image. No per-card traffic disclaimer or source line.
- POI markers use cream icons with a royal-blue selected state. Routes have a solid cream base (`#f3ead2`) and a narrow royal-blue (`#2449a4`) moving highlight.
- The highlight is a distance-interpolated trail covering at most 16% of the geometry, including sparse two-vertex routes. It no longer uses a fixed 30-vertex window that could cover a whole route.

## Reproduction and checks

```powershell
node scripts/prepare-laurels-area-map.mjs --images
node scripts/prepare-laurels-area-map.mjs --routes
npx tsx --test lib/area-map.test.ts
npx tsc --noEmit
npx eslint components/MapComponent.tsx components/ui/map.tsx lib/area-map.ts lib/area-map.test.ts scripts/prepare-laurels-area-map.mjs next.config.ts
```

Preparation performs rate-limited one-time downloads and skips hash-verified local assets. It never uploads, deletes, stages or commits anything. Routes are local snapshots, not a paid Google API dependency. Do not run repetitive route harvesting against a public demo service; for live production traffic-aware routing, configure an appropriately licensed provider.

Previous baseline checks: production build passed; the combined map/masterplan/interior/clubhouse regression run passed 34 tests with one pre-existing optional local-clubhouse-asset check skipped. Browser QA at 1440×900 and 390×844 checked the supplied pin, all 27 AVIF thumbnail decodes, zero initial POI route requests, category/distance/alphabetical filters, a zoomed-out driving route, Google directions URLs, all three basemap styles, mobile controls, immutable image caching, and an intentionally unavailable route without invented geometry. Earlier images and unrelated working-tree edits were retained.

UI refinement checks: nine area-map regression tests cover the canonical data, preserved legacy file, close initial zoom, shared card, separate credits and short interpolated highlight. Desktop/mobile browser checks verify full-width images, small unboxed metrics, no visible Google Maps links, correct route paint, credit-dialog keyboard dismissal and lazy route loading.
