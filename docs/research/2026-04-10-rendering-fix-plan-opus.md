# Rendering Fix Plan: 3 Critical Issues

**Date:** 2026-04-10
**Author:** Claude Opus 4.6 (1M context)
**Status:** Fix plan (not yet implemented)
**Inputs:** Three independent code reviews (Codex, Opus, Gemini), full source code audit

---

## Issue 1: Pseudo-TEE Shows Colored Patches Instead of Grayscale Echo

### Root Cause

The echo rendering pipeline is correct -- `renderEchoSector()` in `echo-appearance.ts` outputs single-channel grayscale (Uint8, 1 component per pixel). The tissue brightness table is well-designed: blood pools at brightness 12, myocardium at 150, valves at 220, with Rayleigh speckle, boundary boost, depth attenuation, and TGC. This IS grayscale.

The colored patches come from the **label overlay layer** rendered on top. In `PseudoTeePane.tsx`, the rendering pipeline is:

1. **Line 301:** `renderEchoSector(labelValues, runtime.values, ...)` -- writes grayscale echo to the 1-component output image
2. **Line 312-314:** `renderLabelOverlay(labelValues, overlayRuntime, ...)` -- writes RGBA colored patches from `LABEL_COLOR_TABLE` into a separate 4-component overlay image
3. **Line 317:** `labelOverlaySlice.setVisibility(true)` -- the overlay is drawn ON TOP of the grayscale echo as a second VTK image slice

The overlay is guarded by `overlayActive` (line 276), which reads `latestStateRef.current.labelsVisible`. In `App.tsx` line 68, `labelsVisible` defaults to `true` in the store (`ui.labelsVisible: true` at store.ts line 601). The toolbar button says "Hide labels" (confirming labels are ON), and all screenshots were taken with labels visible.

**The echo renderer itself is fine.** The problem is that the 40%-alpha colored label overlay (`LABEL_OVERLAY_ALPHA = 0.4`) paints over the grayscale echo, making it look like colored patches rather than ultrasound. Since the UI defaults to labels-on and reviewers never toggled them off, 100% of screenshots show the overlay.

### Why This Is Worse Than It Sounds

Even with labels hidden, the underlying grayscale echo has issues:
- The speckle grain is coarse (grainPx = 3 for myocardium) at the current 0.6mm output spacing
- Blood pools at brightness 12 look nearly black (correct for anechoic), but there is not enough contrast at the tissue-blood boundary
- The boundary boost of 90-120 is additive, which at the pixel level looks like bright edges between label regions rather than smooth echo interfaces

But the dominant visual problem is the overlay. Fix that first.

### Specific Fix

**File: `src/renderer/PseudoTeePane.tsx`**

Option A (minimal, recommended): When echo appearance mode is active, skip the label overlay entirely. The echo sector already uses labels for tissue classification -- overlaying label colors defeats the purpose.

```
// In flush(), around line 276:
// BEFORE:
const overlayActive = Boolean(latestStateRef.current.labelsVisible);

// AFTER:
const overlayActive = false; // Label overlay disabled for echo mode
```

Option B (better UX): Make the overlay toggle independent from the oblique-pane label toggle. Add a separate "Show echo labels" toggle that defaults to OFF for the pseudo-TEE pane. This allows the oblique slice to still show colored labels while the pseudo-TEE pane shows pure grayscale echo.

```
// In App.tsx, pass labelsVisible={false} to PseudoTeePane:
<PseudoTeePane
  appearance={{ depthMm }}
  height={height}
  labelVolume={activeLabelVolume}
  labelsVisible={false}  // Echo mode: never overlay labels
  ref={pseudoTeePaneRef}
  volume={volume}
  width={width}
/>
```

Option C (most flexible): Add a store field `ui.echoLabelsVisible` defaulting to `false`, with its own toggle button in the pseudo-TEE pane header. Wire that to the PseudoTeePane's `labelsVisible` prop.

**Files to change:**
- `src/renderer/PseudoTeePane.tsx` -- Option A: one-line change; Option B: no change needed
- `src/App.tsx` -- Option B: hardcode `labelsVisible={false}` on PseudoTeePane
- `src/store.ts` -- Option C: add `echoLabelsVisible` field

**Recommended:** Option B. It is the simplest change that correctly separates echo rendering from debug label overlay, and the oblique pane retains its colored labels.

### Expected Result

The pseudo-TEE pane shows pure grayscale with:
- Dark anechoic blood pools (brightness ~12)
- Brighter myocardium (brightness ~150 + speckle)
- Bright valve echoes (brightness ~220)
- Visible boundary lines at tissue interfaces
- Depth attenuation and near-field clutter

This will look substantially more echo-like. It will not look like diagnostic ultrasound (that requires more work on speckle, lateral resolution simulation, and dynamic range curves), but it will no longer look like a colored label map.

---

## Issue 2: 3D Model Renders as Unrecognizable Wireframe

### Root Cause (Three Separate Sub-Issues)

**Sub-issue 2A: No per-structure styling on imported GLB actors**

In `vtk-helpers.ts` line 68-77, `loadGLB()` returns actors directly from `vtkGLTFImporter` without any post-processing. In `runtime-loaders.ts` line 9-18, `loadGlbActors()` does the same. In `Scene3DPane.tsx` line 113-119, `syncMeshes()` adds actors to the renderer with `actor.setVisibility(true)` and nothing else -- no color, no opacity, no lighting, no material properties.

VTK.js GLTFImporter actors inherit whatever materials are embedded in the GLB file. If the GLB was exported from 3D Slicer's marching-cubes output without explicit PBR materials, the actors get default white/gray with whatever representation the exporter chose. The reviewers report "wireframe-like" appearance, which suggests either:
- The GLB meshes have degenerate normals (common with marching cubes on label boundaries)
- The mesh topology is non-manifold or has many thin sliver triangles
- The default lighting in the VTK render window is too dim to show surface shading

The `createRenderWindow()` function (vtk-helpers.ts line 34-49) creates a `vtkGenericRenderWindow` with just a background color and trackball interactor. It does NOT add any lights. VTK.js defaults to a single headlight, but without explicit configuration this often produces flat, washed-out surfaces that look wireframe-like.

**Sub-issue 2B: Valve meshes not loaded**

The manifest at `public/cases/0.1.0/lctsc_s1_006/case_manifest.json` declares `sceneGlb` and `heartDetailGlb` but NOT `valve_meshes.glb`. The file `valve_meshes.glb` (671KB) exists on disk but is never loaded because `loadCaseBundle()` (loader.ts line 214-219) only loads assets explicitly listed in the manifest's `assets` object. There is no `valveMeshesGlb` key in the manifest schema.

**Sub-issue 2C: Placeholder wireframe box is confusing**

In `vtk-helpers.ts` line 111-127, `createPlaceholderBoxActor()` creates a cube with `setRepresentationToWireframe()`. This is shown whenever `meshes.length === 0`. During loading, or if meshes fail to load, users see an actual wireframe box. Once meshes DO load, the placeholder is hidden (Scene3DPane.tsx line 121). But if the loaded meshes themselves appear wireframe-like (sub-issue 2A), the visual impression compounds.

### Specific Fix

**Fix 2A: Apply per-structure colors and proper surface rendering**

File: `src/renderer/Scene3DPane.tsx` -- add a `styleMeshActors()` function called from `syncMeshes()`:

```typescript
import { LABEL_COLOR_TABLE } from './label-colors';

// Map GLB actor names to label IDs for coloring
const ACTOR_NAME_TO_LABEL: Record<string, number> = {
  'left_ventricle': 11,
  'right_ventricle': 12,
  'left_atrium': 13,
  'right_atrium': 14,
  'myocardium': 15,
  'aorta': 16,
  'pulmonary_artery': 17,
  'mitral_valve': 20,
  'aortic_valve': 21,
  'tricuspid_valve': 22,
  'pulmonic_valve': 23,
  'heart': 7,
  'esophagus': 5,
  'lung': 6,
  'lung_r': 6,
  'lung_l': 6,
  'svc': 3,
  'ivc': 4,
};

const styleMeshActors = (actors: readonly vtkActor[]): void => {
  actors.forEach((actor) => {
    const prop = actor.getProperty();

    // Force surface rendering (not wireframe)
    prop.setRepresentationToSurface();

    // Lighting for solid shading
    prop.setAmbient(0.15);
    prop.setDiffuse(0.7);
    prop.setSpecular(0.25);
    prop.setSpecularPower(32);

    // Try to match actor name to label color
    // vtkGLTFImporter names actors from GLB node names
    const name = (actor as any).getClassName?.() ?? '';
    // Attempt name-based color assignment
    for (const [key, labelId] of Object.entries(ACTOR_NAME_TO_LABEL)) {
      if (name.toLowerCase().includes(key)) {
        const color = LABEL_COLOR_TABLE[labelId];
        if (color) {
          prop.setColor(color[0] / 255, color[1] / 255, color[2] / 255);
        }
        break;
      }
    }

    // Set context structures (lung, esophagus) to be semi-transparent
    // Heart chambers semi-transparent, valves opaque
    prop.setOpacity(0.85);
  });
};
```

Then in `syncMeshes()`:
```typescript
resolvedMeshes.forEach((actor) => {
  actor.setVisibility(true);
  renderer.addActor(actor);
});
styleMeshActors(resolvedMeshes);  // ADD THIS
```

**Important caveat on actor naming:** The `vtkGLTFImporter` may not expose node names in a way that is easy to match. The actual approach may need to be index-based (matching actor order to a known structure list from the manifest) or based on inspecting the GLB structure. Test with the actual `scene.glb` and `heart_detail.glb` files to determine what metadata is available on the imported actors. If names are not accessible, use the manifest's `structures` array to map actors by index.

File: `src/renderer/vtk-helpers.ts` -- improve the render window creation to add explicit lighting:

```typescript
export const createRenderWindow = (
  container: HTMLElement,
  background: RGBColor = DEFAULT_BACKGROUND,
): VtkGenericRenderWindow => {
  const generic = vtkGenericRenderWindow.newInstance({
    background,
    listenWindowResize: false,
  });
  generic.setContainer(container);
  generic.getInteractor().setInteractorStyle(
    vtkInteractorStyleTrackballCamera.newInstance()
  );

  // Add explicit two-point lighting for better surface perception
  const renderer = generic.getRenderer();
  renderer.setTwoSidedLighting(true);
  // VTK.js headlight is usually sufficient, but ensure it exists
  // The default createLight() provides one; add a fill light
  // renderer.addLight(...) -- only if testing shows default is insufficient

  generic.resize();
  return generic;
};
```

**Fix 2B: Add valve meshes to manifest and loading pipeline**

File: `public/cases/0.1.0/lctsc_s1_006/case_manifest.json` -- add valve meshes to assets:

```json
"assets": {
  "sceneGlb": { "path": "scene.glb" },
  "heartDetailGlb": { "path": "heart_detail.glb" },
  "valveMeshesGlb": { "path": "valve_meshes.glb" },
  "heartRoiVti": { "path": "heart_roi.vti" },
  "labelVti": { "path": "heart_labels.vti", "scalarType": "Uint8" }
}
```

File: `src/assets/types.ts` -- add `valveMeshesGlb` to the assets interface:

```typescript
assets?: {
  sceneGlb?: MeshAssetRef;
  heartDetailGlb?: MeshAssetRef;
  valveMeshesGlb?: MeshAssetRef;  // ADD
  heartRoiVti?: VolumeAssetRef;
  labelVti?: VolumeAssetRef;
};
```

File: `src/assets/loader.ts` -- load valve meshes alongside scene and heart detail:

```typescript
// In loadCaseBundle's Promise.all, add:
manifest.assets?.valveMeshesGlb?.path
  ? loadGlbActors(getAssetUrl(entry, manifest.assets.valveMeshesGlb.path))
  : Promise.resolve([]),
```

And combine into the meshes array:
```typescript
meshes: [...sceneMeshes, ...heartDetailMeshes, ...valveMeshes],
```

**Fix 2C: Replace wireframe placeholder**

File: `src/renderer/vtk-helpers.ts` -- change `createPlaceholderBoxActor()` to use surface representation or remove it entirely in favor of a loading spinner:

```typescript
export const createPlaceholderBoxActor = (): VtkActor => {
  const cube = vtkCubeSource.newInstance({
    center: [0, 0, 0],
    xLength: 120,
    yLength: 80,
    zLength: 100,
  });
  const mapper = vtkMapper.newInstance();
  mapper.setInputConnection(cube.getOutputPort());

  const actor = vtkActor.newInstance();
  actor.setMapper(mapper);
  actor.getProperty().setColor(0.3, 0.35, 0.4);
  actor.getProperty().setOpacity(0.15);
  actor.getProperty().setRepresentationToSurface();  // CHANGE from wireframe
  return actor;
};
```

### Files to Change

| File | Change |
|------|--------|
| `src/renderer/Scene3DPane.tsx` | Add `styleMeshActors()`, call from `syncMeshes()` |
| `src/renderer/vtk-helpers.ts` | Improve lighting in `createRenderWindow()`, fix placeholder |
| `src/assets/types.ts` | Add `valveMeshesGlb` to asset interface |
| `src/assets/loader.ts` | Load valve meshes in `loadCaseBundle()` |
| `public/cases/0.1.0/lctsc_s1_006/case_manifest.json` | Add `valveMeshesGlb` entry |

### Expected Result

- Heart chambers rendered as solid colored surfaces (red-family for left, blue-family for right)
- Valve leaflets present in the scene (bright white-yellow, matching label-colors.ts)
- Aorta in gold, PA in violet, matching the label palette
- Proper depth perception from lighting and specular highlights
- No confusing wireframe during loading

---

## Issue 3: Motion Not Visible Despite Phase Advancing

### Root Cause (Two Compounding Problems)

**Problem 3A: Phase 0 and Phase 1 are byte-identical files**

Verified on disk:
- `heart_labels.vti` = 330,080 bytes
- `phases/phase_00.vti` = 330,080 bytes -- **identical** to `heart_labels.vti` (`cmp` confirms)
- `phases/phase_01.vti` = 330,080 bytes -- **identical** to phase 0
- `phases/phase_02.vti` = 340,601 bytes -- **different** (first real motion frame)
- Phases 2-11 have varying sizes (328K-340K), confirming they contain different label maps

The animation starts at phase 0 and advances. If the cycle was captured at only phases 0-3 in screenshots (as the Codex review says: frames 0 through 3 mapping to ED, IsoC, Ej-1), and the animation had just started, it may have been showing phases 0 and 1 (identical) before reaching phase 2 (first different frame). This alone could explain "pixel-identical" across some frames.

However, this is NOT the only problem.

**Problem 3B: SyncManager does not subscribe to cardiac phase changes**

The critical rendering path:

1. In `App.tsx` line 59-61, `activeLabelVolume` is derived from Zustand:
   ```typescript
   const activeLabelVolume = useTeeSimStore(
     (state) => state.cardiac.phaseVolumes.get(state.cardiac.resolvedPhase)
              ?? state.scene.labelVolume,
   );
   ```
   This correctly resolves to the phase-specific label volume.

2. `activeLabelVolume` is passed as the `labelVolume` prop to `PseudoTeePane` (line 163) and `ObliqueSlicePane` (line 222).

3. When `activeLabelVolume` changes (new phase volume loaded and resolved), React re-renders App, which passes the new `labelVolume` prop to both panes.

4. In `PseudoTeePane.tsx` line 358, the `useEffect` fires when `labelVolume` changes, updating `latestStateRef.current.labelVolume` and calling `flush()`. This SHOULD re-render the echo with the new label data.

5. **BUT** -- the `useSyncManager` hook (SyncManager.ts) only subscribes to probe pose changes:
   ```typescript
   const unsubscribe = store.subscribe(
     selectProbePose,
     (_nextProbePose, _previousProbePose) => {
       queueUpdate(store.getState());
     },
     { equalityFn: probePoseEqual },
   );
   ```
   It does NOT subscribe to `cardiac.resolvedPhase` or `activeLabelVolume` changes.

6. However, that should not matter because `PseudoTeePane` receives `labelVolume` as a React prop, and the `useEffect` at line 358 depends on `[..., labelVolume, ...]`. When the prop changes, `flush()` is called directly. This path is independent of the SyncManager.

**So what actually fails?** Let me trace more carefully:

The `PseudoTeePaneHandle` (exposed via `useImperativeHandle`) has a `setImagingPlane` method used by SyncManager, but `flush()` is called by the `useEffect` whenever `labelVolume` prop changes. The `flush()` function reads `latestStateRef.current.labelVolume`, which was just updated by the effect. The reslice uses `nextLabelVolume` (line 281):

```typescript
reslice.setInputData(nextLabelVolume);
```

This should work IF the new VtkImageData object is actually a different reference. The question is: does `activeLabelVolume` actually change reference when the phase changes?

Looking at the store: `setPhase()` (store.ts line 643-665) updates `cardiacPhase` and `resolvedPhase`. The `resolvedPhase` only changes if the volume is already cached:

```typescript
resolvedPhase: hasRequestedVolume ? nextPhase : state.cardiac.resolvedPhase,
```

If the volume is NOT cached yet, `resolvedPhase` stays the same, `activeLabelVolume` stays the same, and no re-render happens. The volume is loaded asynchronously via `ensureMotionPhaseLoaded()`, which updates `resolvedPhase` only after the async load completes (store.ts line 343-344):

```typescript
resolvedPhase:
  innerState.cardiac.cardiacPhase === normalizedPhase
    ? normalizedPhase
    : innerState.cardiac.resolvedPhase,
```

But by the time the async load finishes, `cardiacPhase` may have already advanced past this phase (animation is running). If `cardiacPhase !== normalizedPhase` at completion time, `resolvedPhase` is NOT updated, the volume is cached but never selected, and the panes continue showing the stale volume.

**This is the race condition:** The animation advances `cardiacPhase` faster than volumes can load asynchronously. Each loaded volume only updates `resolvedPhase` if it matches the CURRENT `cardiacPhase` at the moment the load completes. Since network loads take time, the animation has already moved on, and `resolvedPhase` never updates.

Additionally, even for phase 0 (which is pre-cached), the `activeLabelVolume` selector returns `state.cardiac.phaseVolumes.get(0) ?? state.scene.labelVolume`. Since phase 0's volume IS `state.scene.labelVolume` (set at store.ts line 522), the reference is the same object. Zustand's selector sees no change, so no re-render.

### Specific Fix

**Fix 3A: Fix the race condition in resolvedPhase updates**

File: `src/store.ts` -- when a motion phase volume finishes loading, update `resolvedPhase` to the loaded phase if no better (closer to current) phase is already resolved:

```typescript
// In ensureMotionPhaseLoaded(), the set() callback around line 330:
set((innerState) => {
  if (innerState.scene.currentCaseId !== caseId) {
    return innerState;
  }

  const nextPhaseVolumes = new Map(innerState.cardiac.phaseVolumes);
  nextPhaseVolumes.set(normalizedPhase, volume);

  // FIXED: Always update resolvedPhase to the closest available phase
  const currentPhase = innerState.cardiac.cardiacPhase;
  const currentResolved = innerState.cardiac.resolvedPhase;

  // If this loaded phase IS the current phase, use it immediately
  // If it's closer to current phase than the current resolved phase, use it
  const distanceToLoaded = Math.abs(normalizedPhase - currentPhase);
  const distanceToCurrent = Math.abs(currentResolved - currentPhase);
  const nextResolved = (normalizedPhase === currentPhase || distanceToLoaded < distanceToCurrent)
    ? normalizedPhase
    : currentResolved;

  return {
    cardiac: {
      ...innerState.cardiac,
      phaseVolumes: prunePhaseCache(nextPhaseVolumes, currentPhase),
      resolvedPhase: nextResolved,
    },
  };
});
```

**Fix 3B: Ensure setPhase always triggers a re-render of the resolved volume**

File: `src/store.ts` -- in `setPhase()`, if the volume is already cached, update `resolvedPhase` immediately (this part already works, but add a prefetch for the NEXT phase):

The current code at line 653-654 already does:
```typescript
resolvedPhase: hasRequestedVolume ? nextPhase : state.cardiac.resolvedPhase,
```

This is correct. The issue is that after setting phase N, it prefetches N and N+1, but by the time N+1 loads, the phase has already advanced to N+2. We need more aggressive prefetching.

Add to `setPhase()`:
```typescript
queueMotionPrefetch(nextPhase);
queueMotionPrefetch(nextPhase + 1);
queueMotionPrefetch(nextPhase + 2);  // ADD: prefetch two ahead
```

**Fix 3C: Handle the ObliqueSlicePane re-render gap**

The `ObliqueSlicePane` has a separate issue. Its `flush()` (ObliqueSlicePane.tsx line 238) checks `latestStateRef.current.volume` but the label overlay checks `latestStateRef.current.labelVolume`. The label volume IS being updated via the prop change -> useEffect path. But the SyncManager only calls `setVolume()` and `setImagingPlane()` on the handle -- it does NOT call `flush()` or `render()` when only the label volume changes. The React useEffect DOES call flush, so this path should work.

However, there is a subtle timing issue: the SyncManager calls `pane.render()` on rAF, and the React useEffect also calls `flush()`. If they collide, the last one wins. Since the SyncManager subscription fires on probe-pose changes (not label-volume changes), the React effect is the sole trigger for label-volume updates, which should be correct.

**The real gap:** Verify that the `useEffect` dependency `[..., labelVolume, ...]` actually detects a change. If `activeLabelVolume` returns the same VtkImageData object reference (e.g., because resolvedPhase didn't change), React will skip the effect.

**Fix 3D: Force re-render when resolvedPhase changes (belt and suspenders)**

File: `src/App.tsx` -- add `resolvedCardiacPhase` as a dependency that forces pane re-renders:

Currently `resolvedCardiacPhase` is read (line 58) but only used in the status strip (line 133). It is not used as a prop to any pane. When `resolvedPhase` changes, `activeLabelVolume` selector re-evaluates, and if the VtkImageData reference is different, the pane prop changes.

But add an explicit effect to force a render cycle:

```typescript
useEffect(() => {
  // Force panes to re-render when the resolved cardiac phase changes
  pseudoTeePaneRef.current?.render();
  obliquePaneRef.current?.render();
}, [resolvedCardiacPhase, activeLabelVolume]);
```

**Fix 3E: Ensure phase VTI files actually contain motion**

The pipeline that generates `phase_00.vti` through `phase_11.vti` produced identical files for phases 0 and 1. This may be a pipeline bug (the motion model does not generate displacement for the first two phases) or intentional (ED and early IsoC have minimal motion). Either way, the motion only becomes visible starting at phase 2.

For the screenshots: the reviewers captured frames at phases 0-3 of a 12-phase cycle. With phases 0 and 1 identical and the race condition preventing phase 2+ from resolving, all frames appeared static.

**Verification step:** Run the following check to confirm that the label voxel counts differ between phases:

```bash
# Quick check: file sizes already differ (330K vs 340K), confirming
# different compressed VTI content. But verify label voxel distributions
# differ by examining the raw voxel data in a test.
```

### Files to Change

| File | Change |
|------|--------|
| `src/store.ts` | Fix `ensureMotionPhaseLoaded` to always update resolvedPhase; add prefetch(+2) |
| `src/App.tsx` | Add explicit re-render effect on `resolvedCardiacPhase` change |
| Pipeline (offline) | Investigate why phase 0 and 1 are identical; ensure ED-to-ES motion is present |

### Expected Result

- Advancing through cardiac phases loads different label volumes
- The pseudo-TEE pane re-renders with the new label data, showing different tissue boundaries
- The oblique pane re-renders with the new label overlay
- Ventricular wall positions change between ED and ES phases (visible as chamber size variation)
- Motion is visible starting from at least phase 2 (first frame with actual displacement)

---

## Summary of All Changes

### Priority Order

1. **Issue 1** (easiest, highest visual impact): One-line change to disable label overlay on pseudo-TEE pane. Instant improvement to echo-like appearance.

2. **Issue 2** (medium effort, high visual impact): Per-structure coloring, lighting, valve mesh loading. Transforms the 3D pane from unrecognizable to pedagogically useful.

3. **Issue 3** (needs both code fix and pipeline verification): Race condition in phase resolution plus prefetch strategy. Also needs pipeline investigation for phases 0-1 being identical.

### Files Modified (Sorted by Priority)

| File | Issues | Changes |
|------|--------|---------|
| `src/App.tsx` | 1, 3 | Hardcode `labelsVisible={false}` on PseudoTeePane; add resolvedPhase re-render effect |
| `src/renderer/Scene3DPane.tsx` | 2 | Add `styleMeshActors()` for per-structure coloring |
| `src/renderer/vtk-helpers.ts` | 2 | Improve lighting setup; fix placeholder to surface mode |
| `src/store.ts` | 3 | Fix resolvedPhase race condition; more aggressive prefetching |
| `src/assets/loader.ts` | 2 | Load `valveMeshesGlb` |
| `src/assets/types.ts` | 2 | Add `valveMeshesGlb` to asset interface |
| `public/cases/0.1.0/lctsc_s1_006/case_manifest.json` | 2 | Add valve mesh asset entry |
| `src/renderer/label-colors.ts` | -- | No changes needed (already has correct color table) |
| `src/renderer/echo-appearance.ts` | -- | No changes needed (grayscale output is correct) |

### Files NOT Modified (Confirmed Working)

- `echo-appearance.ts` -- the grayscale echo renderer is correct; tissue table, speckle, boundary boost, attenuation all work as designed
- `label-colors.ts` -- the color table is correct and will be reused for 3D mesh coloring
- `SyncManager.ts` -- correctly handles probe-pose-driven sync; cardiac phase sync is handled through React props
