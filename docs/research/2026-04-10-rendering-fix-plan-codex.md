# 2026-04-10 Rendering Fix Plan (Codex)

## Scope and verification

Reviewed:

- `docs/research/2026-04-10-v02-review-codex.md`
- `docs/research/2026-04-10-v02-review-opus.md`
- `docs/research/2026-04-10-v02-review-gemini.md`
- `src/renderer/PseudoTeePane.tsx`
- `src/renderer/echo-appearance.ts`
- `src/renderer/Scene3DPane.tsx`
- `src/renderer/vtk-helpers.ts`
- `src/store.ts`
- `src/App.tsx`
- `src/assets/loader.ts`
- `src/assets/runtime-loaders.ts`
- `src/assets/types.ts`
- `tools/asset-pipeline/process_lctsc_case.py`
- `tools/asset-pipeline/generate_motion.py`
- `public/cases/0.1.0/lctsc_s1_006/case_manifest.json`

Verified locally:

- `renderEchoSector()` is on the active pseudo-TEE path.
- The old `applySectorMask()` path is not in the current runtime code.
- `valve_meshes.glb` exists on disk but is not referenced by the public case manifest.
- `scene.glb` and `heart_detail.glb` both contain the same `heart` mesh geometry.
- Motion VTIs are present and not all identical, but `phase_00.vti` and `phase_01.vti` are voxel-identical.
- Focused tests passed:
  - `src/renderer/__tests__/echo-appearance.test.ts`
  - `src/assets/__tests__/loader.test.ts`
  - `src/assets/__tests__/public-case-assets.test.ts`

## Issue 1: Pseudo-TEE shows colored label patches, not grayscale echo

### Diagnosis

`renderEchoSector()` is definitely being called. When `labelVolume` exists, `PseudoTeePane.flush()` reslices the label volume with nearest-neighbor interpolation, then passes the resliced labels into `renderEchoSector()` to synthesize the grayscale sector image (`src/renderer/PseudoTeePane.tsx:281-308`).

The colored patches are not coming from an old CT-windowed sector-mask path. The current code immediately overlays RGBA label colors on top of that grayscale output whenever `labelsVisible` is true (`src/renderer/PseudoTeePane.tsx:276-314`). `labelsVisible` defaults to `true` in the store (`src/store.ts:585-609`), and the review screenshots clearly had that mode active because the button text was `Hide labels` (`src/App.tsx:111-116`).

There is also no CT-intensity contribution in the live pseudo-TEE renderer. The `volume` prop is still passed into `PseudoTeePane` (`src/App.tsx:159-167`), but the pseudo-TEE render path only reads `labelVolume`; `volume` is stored in local state and never used in `flush()` (`src/renderer/PseudoTeePane.tsx:251-308`, `src/renderer/PseudoTeePane.tsx:335-359`).

So the actual output is:

- synthetic grayscale from label IDs only
- plus a 40% alpha RGB label overlay (`src/renderer/label-colors.ts:3-27`)
- with labels shown by default

That matches the review complaint: a grayscale wedge underneath, but visually dominated by colored patches.

### Root cause

1. The pseudo-TEE pane still applies the label color overlay in the normal user path, not just in a debug path (`src/renderer/PseudoTeePane.tsx:276-314`, `src/store.ts:587`).
2. The pseudo-TEE renderer is label-only. It does not use `heart_roi.vti` for any grayscale modulation, so the image has only coarse tissue-class brightness buckets from `TISSUE_TABLE` (`src/renderer/echo-appearance.ts:17-95`, `src/renderer/echo-appearance.ts:191-268`).
3. The oblique slice and pseudo-TEE panes share one global `labelsVisible` flag, so the UI currently cannot keep labels on in oblique while keeping pseudo-TEE grayscale-only (`src/App.tsx:111-116`, `src/App.tsx:159-167`, `src/App.tsx:214-221`).

### Fix

1. Split label visibility into separate UI states:
   - `pseudoLabelsVisible`
   - `obliqueLabelsVisible`
   File changes:
   - `src/store.ts`
   - `src/App.tsx`
   - `src/ui/ProbeHUD.tsx` or wherever the toggle UX lands

2. Default pseudo-TEE labels to off.
   - Keep label overlay available only as an explicit debug/teaching aid.
   - Keep oblique labels on by default if that remains the main anatomy-explanation pane.

3. In `PseudoTeePane`, treat color overlay as optional debug rendering, not the default output.
   File changes:
   - `src/renderer/PseudoTeePane.tsx`
   - optionally `src/renderer/types.ts`

4. Improve the grayscale itself after the overlay is removed.
   - Use `heart_roi.vti` to modulate the label-driven brightness, or at minimum use CT-derived boundary energy to sharpen chamber walls and valve planes.
   - Keep `renderEchoSector()` as the primary tissue-class renderer, but add a second-stage modulation pass that uses the CT volume already being loaded.
   File changes:
   - `src/renderer/PseudoTeePane.tsx`
   - `src/renderer/echo-appearance.ts`

### Expected visual result

- The pseudo-TEE pane reads as a grayscale fan image, not a segmentation overlay.
- Blood pools stay dark.
- Myocardium and valve boundaries are brighter.
- The oblique pane can still carry label overlays without contaminating the pseudo-TEE teaching surface.

## Issue 2: 3D model looks like wireframe, not solid anatomy

### Diagnosis

The imported anatomy actors are not explicitly switched to wireframe. The only explicit wireframe call in the current renderer is the fallback placeholder box (`src/renderer/vtk-helpers.ts:111-126`). `Scene3DPane` adds imported GLB actors to the scene exactly as loaded and does not set representation, color, opacity, specular, or highlight rules on them (`src/renderer/Scene3DPane.tsx:98-125`).

However, the shipped asset/runtime combination still explains the "wireframe-like" look:

1. `loadCaseBundle()` hardcodes exactly two GLB inputs, `sceneGlb` and `heartDetailGlb`, then concatenates their actors (`src/assets/loader.ts:200-239`).
2. The asset pipeline exports the same `heart` mesh into both files when the only heart mesh available is the coarse shell (`tools/asset-pipeline/process_lctsc_case.py:728-745`).
3. Local asset inspection shows the public `scene.glb` heart and `heart_detail.glb` heart are byte-identical in positions and indices.
4. That means the app is rendering two co-located heart surfaces on top of each other, which is a classic recipe for z-fighting / contour shimmer.
5. The GLBs carry no materials, and the public heart GLBs also have no normal attributes. `export_glb()` just adds raw trimesh geometry to a scene with no material assignment (`tools/asset-pipeline/process_lctsc_case.py:166-175`), and `create_mesh_from_mask()` never computes or writes normals/material metadata (`tools/asset-pipeline/process_lctsc_case.py:132-163`).
6. `createRenderWindow()` and `Scene3DPane` add no anatomy-specific lighting setup, so imported actors fall back to default white surface shading with no specular emphasis (`src/renderer/vtk-helpers.ts:34-48`, `src/renderer/Scene3DPane.tsx:213-243`).
7. Valve meshes exist on disk but are never loaded because the manifest schema and loader do not have a slot for `valve_meshes.glb` (`public/cases/0.1.0/lctsc_s1_006/case_manifest.json:20-34`, `src/assets/types.ts:68-79`, `src/assets/loader.ts:214-219`).

So the 3D pane is not intentionally wireframe. It is showing:

- duplicated heart surfaces
- no per-structure colors
- no custom lighting/material treatment
- no valve leaflets
- no chamber/great-vessel decomposition in the loaded heart detail asset

That is why the result reads as abstract contour clutter instead of solid anatomy.

### Root cause

1. Duplicate heart geometry is being loaded into the same scene (`src/assets/loader.ts:230-235`, `tools/asset-pipeline/process_lctsc_case.py:734-745`).
2. The loader/manifest schema does not support valve mesh loading (`src/assets/types.ts:68-79`, `src/assets/loader.ts:214-219`, `public/cases/0.1.0/lctsc_s1_006/case_manifest.json:20-34`).
3. Imported anatomy actors get no presentation-layer styling (`src/renderer/Scene3DPane.tsx:114-118`).
4. The exported GLBs do not include materials/normals, so the runtime has very little to work with visually (`tools/asset-pipeline/process_lctsc_case.py:132-175`).
5. `heart_detail.glb` is not actually "detail" in the public case; it is another copy of the coarse heart shell.

### Fix

1. Fix the manifest and loader to support an explicit list of mesh assets, not two hardcoded GLB slots.
   Preferred schema direction:
   - `assets.meshGlbs: [{ path, role }]`
   - roles like `context`, `heart-shell`, `heart-detail`, `valves`
   File changes:
   - `src/assets/types.ts`
   - `src/assets/loader.ts`
   - `tools/asset-pipeline/process_lctsc_case.py`
   - `public/cases/.../case_manifest.json`

2. Load `valve_meshes.glb`.
   - Add it to the public manifest.
   - Make the loader include it.
   - Style valves distinctly in the scene.

3. Stop loading duplicate co-located heart geometry.
   Preferred asset split:
   - `scene.glb`: thoracic context only (`lungs`, `spinalcord`, `esophagus`)
   - `heart_detail.glb`: distinct heart structures only
   - `valve_meshes.glb`: leaflets
   If that split is not ready yet, remove `heart_detail.glb` from the manifest until it is actually different from `scene.glb`.

4. Add runtime actor styling by actor/mesh name.
   Minimum rules:
   - heart shell: warm red / desaturated myocardium tone
   - lungs: low-opacity dark gray
   - esophagus/spinal cord: subdued context colors
   - valves: bright ivory/yellow-white
   - active teaching structures: more opaque / brighter
   File changes:
   - `src/renderer/Scene3DPane.tsx`
   - optionally a new `src/renderer/scene-style.ts`

5. Force consistent solid-surface rendering and shading for imported actors.
   - Set surface representation explicitly on imported actors.
   - Set diffuse/specular/specularPower/opacity intentionally.
   - Add an explicit light setup instead of relying on vtk defaults.
   File changes:
   - `src/renderer/Scene3DPane.tsx`
   - `src/renderer/vtk-helpers.ts`

6. Improve the exported meshes themselves.
   - Export normals.
   - Export materials/colors or at least enough mesh identity for runtime styling.
   - Generate distinct chamber/great-vessel meshes for the public heart detail asset instead of a single shell.
   File changes:
   - `tools/asset-pipeline/process_lctsc_case.py`
   - possibly follow-on generator changes if chamber-specific mesh export is moved into a separate script

7. Replace the wireframe placeholder box with a non-anatomical loading/empty state so load failures do not resemble broken anatomy.
   File changes:
   - `src/renderer/vtk-helpers.ts`
   - `src/renderer/Scene3DPane.tsx`

### Expected visual result

- The 3D pane shows a solid, shaded heart silhouette instead of contour shimmer.
- Valves are visible and recognizable.
- Thoracic context is present but visually subordinate.
- The sector plane cuts through a believable anatomy model with readable depth and structure hierarchy.

## Issue 3: Motion shows phase counter but no visible contraction

### Diagnosis

The phase-specific VTI files are real and not all identical. Local voxel comparison against the shipped public bundle showed:

- `phase_00` vs `phase_01`: `0 / 21,576,348` voxels changed
- `phase_00` vs `phase_02`: `135,142 / 21,576,348` voxels changed
- `phase_00` vs `phase_03`: `236,945 / 21,576,348` voxels changed
- peak observed change (`phase_05` / `phase_06` vs `phase_00`): `311,108 / 21,576,348` voxels changed

So the motion assets are not missing, but the first step is literally identical to ED and the overall deformation is modest.

The runtime wiring is mostly present:

- `App.tsx` derives `activeLabelVolume` from `phaseVolumes.get(resolvedPhase) ?? scene.labelVolume` (`src/App.tsx:57-61`).
- That `activeLabelVolume` is passed into both `PseudoTeePane` and `ObliqueSlicePane` (`src/App.tsx:159-167`, `src/App.tsx:214-221`).
- `PseudoTeePane` reruns `flush()` whenever `labelVolume` changes, and `flush()` reruns `renderEchoSector()` (`src/renderer/PseudoTeePane.tsx:301-308`, `src/renderer/PseudoTeePane.tsx:340-359`).
- `ObliqueSlicePane` also reruns on `labelVolume` change (`src/renderer/ObliqueSlicePane.tsx:270-285`, `src/renderer/ObliqueSlicePane.tsx:303-319`).

So yes: the phase-specific label volume is wired into the renderer, and yes: `renderEchoSector()` is re-called when the phase volume prop changes.

The biggest current bug is state/UI mismatch:

- `setPhase()` updates `cardiacPhase` immediately, but only updates `resolvedPhase` if the requested volume is already cached (`src/store.ts:643-666`).
- Phase loads are async and only later promote `resolvedPhase` when the requested phase finishes loading (`src/store.ts:287-350`).
- The UI phase readout and slider are bound to `cardiacPhase`, not `resolvedPhase` (`src/ui/ProbeHUD.tsx:95-101`, `src/ui/ProbeHUD.tsx:191-210`).
- The status strip also displays `cardiacPhase` first and only appends `(loading)` if `resolvedPhase !== cardiacPhase` (`src/App.tsx:130-135`).

That means the UI can say "phase changed" while the panes are still rendering the previous label volume.

There is also a second, asset-level problem:

- `generate_motion.py` defines `SYSTOLIC_CURVE[1] = 0.0` and `EJECTION_CURVE[1] = 0.0` (`tools/asset-pipeline/generate_motion.py:58-60`).
- The per-phase generation loop uses those curves directly (`tools/asset-pipeline/generate_motion.py:733-819`).
- That guarantees the first displayed animation transition is effectively unchanged in the ventricles and vessels, and in the shipped bundle `phase_01` ended up voxel-identical to `phase_00`.

Finally, the 3D pane is static by current implementation:

- `Scene3DPane` receives `meshes`, not phase-specific meshes (`src/App.tsx:193-198`).
- `store.cardiac.setPhase()` never updates `scene.meshes`; it only manages phase label volumes (`src/store.ts:643-666`).

So no 3D contraction should be expected until mesh motion is a separate feature.

### Root cause

1. The phase counter can advance before the renderer has the requested phase loaded (`src/store.ts:643-666`, `src/ui/ProbeHUD.tsx:191-210`).
2. The first motion step is identical to ED because the phase curves start with zero effective ventricular/vessel deformation (`tools/asset-pipeline/generate_motion.py:58-60`, `tools/asset-pipeline/generate_motion.py:774-789`).
3. The remaining label deltas are present but relatively sparse, so the current motion amplitude is easy to miss in screenshots.
4. The 3D pane is static by design in the current implementation.

### Fix

1. Separate requested phase from rendered phase in the UI.
   Recommended state shape:
   - `requestedPhase`
   - `resolvedPhase`
   - `isPhaseLoading`
   Show the rendered phase by default, not the requested phase.
   File changes:
   - `src/store.ts`
   - `src/ui/ProbeHUD.tsx`
   - `src/App.tsx`

2. Make playback/capture phase-safe.
   Options:
   - preload all 12 phase VTIs when the case loads
   - or preload them when the user presses Play
   - or block phase advancement in screenshot tooling until `resolvedPhase === requestedPhase`
   For review/screenshot generation, preloading all 12 is the simplest and most reliable path.

3. Regenerate the public motion assets with visibly distinct early phases.
   Specific generator changes:
   - make `phase_01` differ from ED
   - increase early systolic chamber delta
   - verify ED vs ES cavity reduction in the ME 4C and TG SAX planes, not just in whole-volume voxel counts
   File changes:
   - `tools/asset-pipeline/generate_motion.py`

4. Add a motion verification step to asset generation / QA.
   At minimum:
   - compare `phase_00` and `phase_05` or `phase_06`
   - compare resliced pseudo-TEE outputs for ME 4C and TG SAX
   - fail QA if the rendered diff is below a minimum threshold
   File changes:
   - new validation script or test under `tools/asset-pipeline/`
   - optionally a focused Vitest or Node-based asset inspection test

5. Be explicit that 3D anatomy is static until mesh motion exists.
   Short term:
   - label the current feature as label-volume motion in pseudo/oblique only
   Longer term:
   - add phase-specific mesh deformation or swap animated meshes into `Scene3DPane`

### Expected visual result

- When the phase label changes, the pseudo-TEE and oblique panes change in the same frame sequence.
- ED vs ES shows obvious cavity contraction / wall thickening in the teaching views.
- The first animation step is no longer a dead frame.
- The 3D pane is either clearly labeled static or later upgraded to actual mesh motion.

## Recommended implementation order

1. Fix Issue 1 UI defaults first.
   - This is the fastest path to stop the pseudo-TEE pane looking like a color-label debug view.

2. Fix Issue 2 loader/schema/pipeline next.
   - Load valves.
   - stop double-loading the same heart mesh
   - add actor styling

3. Fix Issue 3 state mismatch and phase QA after that.
   - Make the UI report rendered phase, not merely requested phase.
   - Regenerate motion with a visible first step and stronger ED/ES contrast.

4. Then do a new screenshot review with:
   - pseudo labels off
   - oblique labels on
   - valves loaded
   - ED and ES captured after phase resolve
