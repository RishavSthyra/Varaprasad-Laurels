# Villa masterplan model

Current local asset: `public/models/villa 02_new_glb.glb`, including the
clubhouse. Both stage and preload use this export and its matching 7,270-root
manifest: 77 selectable villas (plot 21 excluded), plus the separate clubhouse
hover target. The model is 3,980,472 bytes. The previous 7,028,408-byte
`villa 01.glb` remains untouched on disk and its legacy mapping remains supported.
This model-only switch keeps the existing camera coordinates, rotation, FOV,
dummy anchors, alignment transform and background image unchanged.

The live background is now
`https://cdn.sthyra.com/Varaprasad_Laurels/Videos/masterplan_scrub_gop3_60mb.mp4?v=cors-20261119`:
the approved 58,057,110-byte H.264 High GOP3 encode. Cloud bytes are SHA-256
checked against the local encode, and HTTP range (206), MIME and CORS are verified.
Both early warmup and the stage use the same cloud URL/media element. The
URL revision bypasses cached responses from before the production origin was
allowed by CORS; no video bytes or camera calibration have changed. The local
`public/masterplan_scrub_gop3_60mb.mp4` is optional and no longer used at runtime.
It is 3840 x 2160, 30 fps, 309 frames, 10.3 seconds. The preloaded placeholder
and video poster remain `public/1.00000.avif`; they stay visible until video data
is decoded, including when media events occurred before client hydration.
`public/master_west.avif` and all Downloads source/alternate encodes are retained.

The existing top arrows navigate two calibrated stops. `VillaMasterPlanVideo`
uses native forward playback and sequential reverse seeks, then pauses/seeks
to the exact target. During motion, both the hover canvas and tooltip are hidden;
the correct GLB camera returns only once the stop has decoded. Only one stage
is mounted for the active desktop/compact layout (not two hidden video decoders).

### Second stop

- Max camera: `02_Gates Edited_Camera 027_001`.
- Render/source frame: **159**, zero-based, at **5.3 seconds**.
- Layout frame: **160**, because the existing UI timeline is one-based.
- Supplied position in millimetres: X 374850.68, Y 251392.626, Z 210660.86.
- Supplied Max rotation in degrees: X 67.085, Y 0, Z 118.366.
- Three position in metres: (374.85068, 210.66086, -251.392626).

Frames 156-162 were reviewed against the supplied camera with a temporary
wireframe in the test browser. Frame 159 is retained; no coordinate/FOV/model
nudge was introduced to fit the image. Only these two supplied poses are used;
there are no fabricated intermediate camera calibrations. The old TULA four-stop
timeline/media is not used by this villa configuration.

`lib/villa-masterplan-model.ts` supplies one model key/URL for the stage,
masterplan configuration and preload. The exterior garage pointer's `arrow.glb`
is unrelated and unchanged.

The new export has 7,270 flattened roots, not 8,591. Reusing the old array offsets
would mislabel villas and omit the last blocks. The export-specific manifest in
`data/villa-masterplan-model.json` maps 7,255 roots to all 77 selectable CAD villa
numbers, excluding plot 21. Eight clubhouse roots form a separate hover target;
seven landscape/helper roots remain non-interactive. Some relocated villa components occupy separate
root ranges, so a single contiguous range per villa is not sufficient.

The clubhouse shell, roof, court and remaining parts at roots 7262–7269 merge
into one highlight with a "Clubhouse" label. It does not receive villa inventory
colors from filters, trigger villa image preloading, or select a villa on click.
Clicking the clubhouse now opens `/clubhouse-walkthrough` at the default ground-floor
entry. Its hover label is also a link, and sustained hover prefetches that route.
It remains separate from villa selection/filtering and cannot open during a drag.
Browser checks confirmed its hover label/highlight, clearing on pointer exit,
remaining hoverable while a plot-area filter is active, and no villa opening
when hovering the clubhouse. Existing villa hover remains functional.

The read-only audit compares 6,909 exact root transforms/names to the previous
CAD-mapped export and checks the remaining components against the prior villa
footprints. It produces the checked manifest without altering either GLB.
The existing planar model alignment is retained because the shared villa
geometry retains its original transforms. The camera pose is configured
separately below.

## Start-frame camera

The first stop preserves the user-edited camera values that were present before
adding this video and its second stop:

- Source position in millimetres: X -469245.944, Y -374528.689, Z 205835.847.
- Source Max rotation in degrees: X 67.133, Y 0, Z -46.65.
- Source horizontal FOV: 29.172 degrees at 16:9.
- Villa camera's vertical FOV: 16.654896395479096 degrees.

The source position is converted once using `(x, z, -y) / 1000`. The Max-to-Three
basis, source dummy anchors and exact planar mapping are unchanged from the
tracked version. GLB geometry retains its native dimensions; no new fit scale,
translation, coordinate nudges or guessed orientation is applied.

The actual villa renderer is `VillasMasterPlanStage`, whose `CameraRig` consumes
vertical FOV directly and performs the original image-cover aspect correction.
Passing horizontal 29.172 degrees directly into that vertical field was a
regression. The legacy `MasterPlanFrameHoverStage` is a different path, not the
villa renderer; its helper refactor and the temporary `master-plan-camera.ts`
helper were removed. The earlier double-conversion diagnosis mistakenly traced
that legacy path and does not describe the active villa stage.

The initial small-scale `018_001` camera position is not substituted for the
current user-edited first pose. Regression tests cover both explicit poses,
the horizontal-to-vertical FOV conversion, the exact source-frame/time mapping,
and the unchanged model manifest.

Earlier browser verification, before this camera-pose update, loaded the new GLB with HTTP 200, found all 77 unique
rendered villa IDs, and confirmed the Villa 51 hover aligned with the background
and its click opened Villa 51's residence view. The pre-existing UpperLayoutCTA
hydration warning remains unrelated to this asset change.

```powershell
node scripts/audit-villa-masterplan-model.mjs
npx tsx --test lib/villa-masterplan-model.test.ts
```
