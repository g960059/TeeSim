# Rendering Diagnosis

**Date:** 2026-04-06  
**Status:** Completed  
**Scope:** pseudo-TEE and oblique slice rendering on `lctsc_s1_006`

## Summary

The broken views were not caused by preset clicks failing, store state failing to update, or `buildResliceAxes()` using the wrong VTK matrix layout.

The main bug was in `src/core/probe-model.ts`:

- the renderer was given an imaging plane with `up = transducerFrame.tangent`
- the pseudo-TEE and oblique panes treat `plane.up` as image depth
- across ME presets, the shaft tangent changes only slightly, so image depth stayed almost fixed
- omniplane mostly rotated the other in-plane axis, which made the panes look only marginally different
- the plane basis was also left-handed because `normal` was computed as `cross(up, right)` while the reslice matrix uses `right` as x and `up` as y

That combination explains the screenshots:

- pseudo-TEE showed the same bright fan because the sector mask kept sampling forward along the shaft instead of into the heart
- oblique slice showed a similar brown slab because the rectangular reslice used the same near-vertical depth axis for most ME presets

## File-by-file Diagnosis

### 1. `src/renderer/PseudoTeePane.tsx`

`vtkImageReslice` is driven by `buildResliceAxes(nextImagingPlane)`. The pane assumes:

- `plane.right` = lateral image axis
- `plane.up` = depth axis

The pane itself was behaving as designed. The bad input basis made the reslice wrong.

### 2. `src/renderer/ObliqueSlicePane.tsx`

Same as pseudo-TEE: it reslices with `buildResliceAxes(nextImagingPlane)` and uses the plane x/y axes exactly as supplied. No missing update logic here.

### 3. `src/renderer/SyncManager.ts`

The imaging plane is recomputed on every probe-pose change:

- it subscribes to `selectProbePose`
- it calls `computeImagingPlane(path, probePose, probeModelOptions)`
- it pushes the new plane into all pane handles inside one `requestAnimationFrame`

This part is healthy.

### 4. `src/renderer/vtk-helpers.ts`

`buildResliceAxes()` matches VTK.js column ordering:

- column 0 = x axis
- column 1 = y axis
- column 2 = z axis
- column 3 = origin

This matches `vtk.js` `ResliceCursorWidget.getResliceAxes()`. The helper layout was correct.

The invalid part was upstream: the supplied `ImagingPlane` basis was semantically wrong for TEE depth and mathematically left-handed.

### 5. `src/store.ts`

Preset clicks do change probe state:

- `snapToView(preset)` copies `preset.probePose` into `state.probe`
- `ViewPicker` calls `snapToView` directly on button click
- keyboard shortcuts do the same for keys `1-8`

This was not the failure.

### 6. `src/core/probe-model.ts`

Before the fix, `computeImagingPlane()` did this:

- rotated a transverse vector by omniplane into `right`
- used the shaft tangent as `up`
- computed `normal = cross(up, right)`

That meant:

- ME 4C vs ME 2C did produce different planes
- but the image depth axis stayed almost the same, because the tangent barely changed
- the 3x3 basis had determinant `-1`

The fix now does this:

- `right = transducerFrame.tangent`
- `up = beamDirection` where `beamDirection` is the omniplane-rotated side-firing direction
- `normal = cross(right, up)`

This makes the plane right-handed and aligns image depth with the beam.

### 7. `public/cases/0.1.0/lctsc_s1_006/probe_path.json`

The centerline data looks plausible, not random:

- `244` points
- total authored length `243 mm`
- closest point to the esophagus centroid is about `9.0 mm`
- mean distance from the ME station segment to the esophagus centroid is about `25.7 mm`

One caveat:

- the path extends superior to the heart ROI volume
- the TG preset at `sMm = 166` samples from a shaft position above the ROI's superior z bound

So the path itself is plausible, but TG coverage is weaker than ME coverage for the current ROI.

### 8. `public/cases/0.1.0/lctsc_s1_006/views.json`

The authored presets are genuinely different:

- `8` presets loaded
- distinct `sMm` values: `97`, `166`, `83`, `92`
- distinct omniplane values: `0`, `10`, `40`, `65`, `75`, `95`, `130`

ME 4C and ME 2C intentionally share `sMm = 97` and differ by omniplane (`0` vs `65`), which is expected.

## Key Answers

### When ME 4C vs ME 2C is clicked, does `ImagingPlane.normal` change?

Yes.

Probe state changes, `SyncManager` recomputes the plane, and the resulting plane normal differs substantially between those presets. The problem was not a frozen normal. The problem was that the renderer was using the nearly unchanged shaft tangent as image depth.

### Is `buildResliceAxes()` producing a valid 4x4 VTK reslice matrix?

The matrix layout is correct for VTK.js.

What was invalid was the handedness and semantic meaning of the input basis coming from `computeImagingPlane()`. After the fix, the basis is right-handed and suitable for VTK reslicing.

### Is the VTI ROI centered on the heart?

Yes.

From the VTI header:

- ROI bounds are approximately `x=-63..135`, `y=-336..-138`, `z=-576..-397`
- the heart centroid from `landmarks.json` is `[37.1, -235.8, -485.2]`

That centroid is near the ROI center, so the ROI is heart-centered.

### Is the probe path inside the esophagus or somewhere random?

It looks like a plausible esophageal path near the heart, not a random curve. The esophagus-centroid proximity and the smooth 243 mm authored length support that.

## Changes Made

- Fixed `computeImagingPlane()` in `src/core/probe-model.ts` so image depth follows the omniplane-rotated beam direction and the plane basis is right-handed.
- Added regression tests for:
  - different probe poses producing different imaging planes
  - public probe-path validity against the case geometry/landmarks
  - public `views.json` presets loading with distinct authored pose targets

## Residual Risk

`tg-mid-sax` is still near or beyond the superior edge of `heart_roi.vti` for its shaft position. The main rendering bug is fixed, but TG views may still want either:

- a larger ROI volume, or
- retuned TG preset authoring
