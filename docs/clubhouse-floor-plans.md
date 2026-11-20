# Clubhouse floor plans and POIs

Source renders remain untouched in `public/Club House Render/`. Runtime images
are in `public/clubhouse-floor-plans/`: five full-resolution AVIF plans and five
640px maximum-edge thumbnails. Conversion uses Sharp AVIF quality 65, effort 8,
4:4:4 chroma; small thumbnails use quality 55. No full-size source is upscaled or
resized. Regenerate from the project root with:

```powershell
node scripts/generate-clubhouse-floor-plans.mjs
```

Full plans plus thumbnails total 1,243,609 bytes, 95.3% smaller than the source
PNGs. Full-plan resolution is unchanged; originals are retained.

`data/clubhouse-floor-plans.json` is the dedicated, shared clubhouse POI data file
for **all five floors**. It defines stable reference IDs, room labels, positions,
explicit pano IDs/filenames/folders and POI arrival views. Every floor has
`markerStyle: "dot"`; stable reference numbers remain in the data for mapping,
but are not displayed inside POIs. All plan POIs are yellow-gold (`#fce190`) by default and standard
blue (`#2f7fb5`, not royal blue) on hover, keyboard focus or when active. The same
palette is used on thumbnails, expanded plans and room-list indicators.
Markers are HTML buttons, not baked into the image. Locations
were placed by inspecting the supplied renders; they are not a world-coordinate
projection. Room names follow the drawings. Four guest rooms are numbered from
top to bottom only to distinguish their repeated "ROOM" labels. Double-height
voids, shafts and lift cars are intentionally not room destinations.

| Level | Room numbers |
| --- | --- |
| Ground (dots, mapped) | 1, 3, 4, 5, 6, 7, 9, 11, 16 |
| First | 17, 18, 19, 23, 24 |
| Second | 25, 26, 27, 28, 29, 31, 36 |
| Third | 37, 39, 47 (pending), 49, 51, 53, 54, 55, 56 (pending), 58, 61 |
| Terrace (existing `fourth` camera group) | 62, 63 |

There are 34 retained references: 32 exact camera mappings and two pending
rooms. The user supplied all linked camera IDs, filenames and folders, plus
the exact arrival angles for First, Second, Third and Terrace. Requested removals
are removed without renumbering or reassignment. Reference 23 retains its previous
position at 13% left, 44% top, below the now-removed reference 20.
Gym reference 26 maps to `Second_Floor_Pano_2_F0001`, with the user's arrival
view of yaw -65.1°, pitch -4.54°, zoom 10. Room 1 toilet reference 45 was removed
at the user's request. Only references 47 and 56 remain
`null`; they were not specified in the
latest mappings. Those dots retain their room tooltip but do not navigate,
appear active or display a pending-assignment message.
After the user confirms the matching camera, set that marker's `nodeId` to its exact ID
from `data/Clubhouse_Pano_Data.json`. Only IDs belonging to the same floor can
navigate. A linked marker uses the existing viewer's guarded `goToNode` flow;
it does not create another viewer or invent navigation coordinates.

All `arrivalView` values are **degrees** in this JSON, converted to viewer
radians at the boundary. Ground views were chosen by inspecting the exact cloud
previews: reception, hall entrance, lifts, pool, loungers, washroom fixtures,
hall seating/stage and rising stair flight. They apply only to explicit POI
clicks. Same-floor arrow walking still preserves its live facing; existing
stair/floor-arrival calibration is unchanged. Clicking the already-current dot
also restores its saved view instead of leaving the camera aimed at the ground.

The pano-info debug panel is no longer enabled in clubhouse interiors; it now
appears only in the exterior walkthrough during development. Existing saved
filenames, folders and arrival views remain in the floor-plan data.
All five floors' map dots have no number text;
developer-only tooltips retain their IDs for further corrections.

The top-right minimap fills its frame at the plan's original aspect ratio,
without the former padded outer card, heading or caption. Its POIs are independent
buttons: clicking a linked POI navigates directly with its saved arrival view,
never opens the expanded plan. Pending POIs do not navigate or appear active.
During transitions, dots remain clickable; the latest requested camera/view is
queued until the current move finishes. Neither map displays loading/pending
messages. The minimap fills its controls column (256px desktop, 224px tablet,
160–176px phone), with floor controls matching its width.
Only the separate blue (`#2f7fb5`) 14px expand icon over the top-right of the map
opens the full-screen plan. It has a transparent 32px hit target, no visible
background or outer box. The expanded desktop view is just the original-aspect
plan, POIs and close icon: no header, room list, sidebar or padded outer card.
On phones/tablets an X replaces expand and slides the whole controls column off
the right edge; a top-right map button restores it without reloading the viewer.
Escape closes the desktop enlargement; keyboard focus
returns to the expand button. Plan images remain contained without cropping.
Only the active floor's thumbnail and explicitly expanded full plan are loaded.
The First-floor minimap alone is rotated 90° clockwise into landscape, using
`minimapRotation: 90`. Its image and POI hit targets share one transformed layer;
the expand icon stays upright. Original plan dimensions, POI coordinates,
panorama arrival views and the expanded full plan are unchanged.

Verification: `npx tsx --test lib/clubhouse-floor-plans.test.ts
lib/clubhouse-tour.test.ts lib/clubhouse-floor-transitions.test.ts` passes with
24 tests and one intentionally skipped local-pano audit. With a local dev server,
`node scripts/verify-clubhouse-floor-plans.cjs` checks all five floor plans,
34 button positions, AVIF decoding, quiet pending points, minimal enlargement, focus return,
same-floor debug navigation, clipboard text and a 390px mobile layout.
`node scripts/verify-clubhouse-ground-pois.cjs` checks all nine exact ground
destinations and measured arrival angles, the current-node view reset, one
retained canvas, the four other floors' dots and mobile dot navigation.
`node scripts/verify-clubhouse-poi-mappings.cjs` checks direct minimap navigation
to every linked destination and measured arrival angle on all five floors,
separate expand controls, edge-to-edge map geometry, gold/default and
blue/hover/active colors, pending-room safety, retained marker formats, one
canvas per floor and 390px mobile layouts. `CLUBHOUSE_FLOORS=first,second`
can limit the audit.
