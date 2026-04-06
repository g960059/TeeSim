# Rendering Roadmap: Next Technical Improvements

**Date:** 2026-04-06  
**Status:** Proposed  
**Scope:** Prioritized rendering roadmap after the omniplane/probe-path fixes and the 2026-04-06 clinical validation pass

## Current read of the system

- The geometry stack is now in a good place: the 8 anchor views are distinct, omniplane rotation is working, and the probe path follows the esophagus with normals pointing toward the heart.
- The main remaining bottleneck is no longer probe math. It is image content. The current public case ships `scene.glb`, `heart_detail.glb`, and `heart_roi.vti`, but no aligned label volume or valve-specific asset.
- [`src/renderer/PseudoTeePane.tsx`](../../src/renderer/PseudoTeePane.tsx) still renders a single CT intensity reslice, then applies a sector mask, windowing, and depth attenuation on the CPU. That is enough for a correct anatomical slice, but not enough for teachable chamber separation on non-contrast CT.
- [`src/renderer/Scene3DPane.tsx`](../../src/renderer/Scene3DPane.tsx) currently renders imported GLB actors plus a translucent sector fan. It does not yet apply structure-aware materials, solid/translucent modes, or intersection-driven highlighting.
- [`src/renderer/vtk-helpers.ts`](../../src/renderer/vtk-helpers.ts) already has the right low-level building blocks for sector-plane geometry and VTK reslicing. The next gains should come from better assets and better semantic rendering, not another round of plane-basis changes.

## Prioritization logic

- First make anatomy separable with the current geometry.
- Then improve the source data so the signal is physically plausible.
- Then add echo-like appearance on top of anatomy that is already correct.
- Defer advanced realism features until chamber-level teaching value is solid.

## Gating issue

Before treating TG SAX as "fixed" in any roadmap phase, enlarge the inferior/superior ROI coverage or re-author the TG preset/path so the transgastric window is actually inside the sampled volume. Otherwise later improvements will still be undercut by a known out-of-bounds failure mode.

## Summary table

Effort assumes one engineer plus offline asset-prep support.

| Priority | Improvement | Effort | Educational value | Why this priority |
|---|---|---:|---|---|
| 1 | Label-based structure coloring | M | High | Fastest path to recognizable chambers on the current geometry stack |
| 2 | Contrast-enhanced CTA data acquisition | L-XL | Very high | Fixes the real blood-pool vs myocardium contrast ceiling and unlocks later steps |
| 3 | Echo-like appearance model | L | Medium-High | Important, but only after anatomy is reliably visible |
| 4 | 3D scene improvements | S-M | High | Low-risk improvement to a pane that already teaches spatial orientation well |
| 5 | Volume rendering in 3D pane | L | Medium | Useful once better source data exists; not a substitute for chamber separation |
| 6 | Valve visualization | XL | High for specific views | Needs higher-resolution assets and better data than the current bundle |
| 7 | Cardiac motion animation | XL | Medium | Valuable later, but moving unclear anatomy is not a good first upgrade |

## 1. Label-based structure coloring

- **Effort:** `M` for a first version on one case. Expect about 1-2 weeks for pipeline + runtime changes if the source segmentation already exists offline.
- **Educational value:** `High`. This is the quickest way to turn the current "gray CT fan" into something a learner can read as `LA`, `LV`, `RA`, `RV`, `AO`, `SVC`, and `IVC`, even before a better CT source is available.
- **Technical approach:** Export an aligned label asset from the Slicer pipeline, preferably `heart_labels.vti` or a second scalar channel registered to `heart_roi.vti`. Extend `case_manifest.json` with label-volume metadata and a stable structure-ID palette. In the runtime, reslice labels alongside intensities in the pseudo-TEE and oblique panes, then apply chamber-specific color or edge overlays in an educator mode. Use the same structure IDs to color the 3D pane and to highlight which structures the current fan intersects. This should also drive a tighter heart-centered crop, which will immediately reduce the "brown background" problem in the oblique pane.

## 2. Contrast-enhanced CTA data acquisition

- **Effort:** `L-XL`. Roughly 2-6 weeks including dataset selection, data-governance review, pipeline adaptation, and one clinically reviewed case.
- **Educational value:** `Very high`. This is the highest-ceiling improvement because it raises the anatomical signal quality across the pseudo-TEE pane, oblique pane, future volume rendering, and future valve work.
- **Technical approach:** Start a parallel asset track for at least one ECG-gated cardiac CTA case with full esophagus-to-stomach coverage. Add hard acceptance criteria before adopting a case: blood pool clearly separated from myocardium, TG window fully covered, aortic root/annulus visible, and license bucket documented. Export a CTA ROI aligned to the current probe-path/world transforms, plus chamber labels and per-structure meshes. The rendering roadmap should treat this as the foundation case for priorities 3-6, not as an optional polish step.

## 3. Echo-like appearance model

- **Effort:** `L`. About 2-3 weeks for a credible first pass once priorities 1 and 2 are in place.
- **Educational value:** `Medium-High`. This is the feature that makes the teaching pane feel like echo instead of CT, but it should not be used to hide weak anatomy.
- **Technical approach:** Keep the current reslice as the anatomical ground truth, then add an explicit postprocess layer for educational ultrasound appearance. Start with: tissue-dependent speckle, edge enhancement at strong gradients or label boundaries, controllable gain/TGC, near-field clutter, and shadow masks from dense structures. Implement it as a shader or fast postprocess rather than a full acoustic simulator. The goal is not diagnostic ultrasound fidelity. The goal is a stable, tunable appearance model that still preserves the underlying anatomy and view identity.

## 4. 3D scene improvements

- **Effort:** `S-M`. About 3-7 days if the current GLB nodes are already separable; closer to `M` if export changes are needed.
- **Educational value:** `High`. The 3D pane already succeeds as a spatial-orientation aid. It is one of the cheapest places to improve learner comprehension immediately.
- **Technical approach:** Move from the current wireframe-like read to a structure-aware scene: force solid shading on imported actors, ensure normals are present, add stronger lighting/specular cues, and introduce per-structure opacity presets. Make the sector fan easier to see with a brighter outline, double-sided rendering, and a slightly thicker visual edge. Add highlighting for structures intersected by the current plane and dim non-target anatomy when a preset is active. If the current GLBs are too monolithic, change the export so chambers and great vessels arrive as separate nodes instead of one undifferentiated heart shell.

## 5. Volume rendering in 3D pane

- **Effort:** `L`. About 2-4 weeks including performance tuning and UI controls.
- **Educational value:** `Medium`. Helpful for demonstrating how the 2D slice arises from volumetric anatomy, but not a first-line fix for the current clinical validation gaps.
- **Technical approach:** Add a VTK volume actor for the heart ROI or CTA ROI with transfer functions tuned for blood pool, myocardium, fat, and bone. Expose `Surface`, `Volume`, and `Hybrid` modes so learners can compare meshes against voxel data. Add crop-box controls and probe-aligned clipping planes so the rendered volume stays focused on the heart instead of the full thoracic background. Do this only after better source data is available; non-contrast CT volume rendering will mostly produce a prettier version of the same ambiguity.

## 6. Valve visualization

- **Effort:** `XL`. Realistically 4+ weeks, mostly driven by asset creation and validation rather than shader work.
- **Educational value:** `High` for valve-focused views such as `me-av-sax`, `me-av-lax`, and `me-lax`, but narrower in scope than chamber-level improvements.
- **Technical approach:** Add dedicated valve assets rather than hoping they emerge from the current thoracic CT. The first milestone should be static, separately addressable structures: aortic cusps, mitral annulus/leaflets, papillary muscles, and key outflow landmarks. These can be exported as meshes, label maps, or both from SlicerHeart/manual annotation. Once they exist, render them as optional highlight layers in 3D and as intersection overlays in pseudo-TEE/oblique panes. Valve work should start only after the CTA/label pipeline proves it can support structure-specific rendering cleanly.

## 7. Cardiac motion animation

- **Effort:** `XL`. About 4-8 weeks depending on whether the source is simple ED/ES interpolation or real 4D data.
- **Educational value:** `Medium` for the current MVP. Motion becomes valuable after static anatomy, valves, and view identity are already teachable.
- **Technical approach:** Start with a phase slider and a simple looping ED-to-ES interpolation on chamber and valve meshes. Keep it deterministic and freezeable so educators can stop the loop at a specific phase. If better data later becomes available, replace simple interpolation with phase-keyed deformation tracks or 4D volumes. Motion should also become part of the validation contract: a view should remain recognizable through the cycle, not just at one static frame.

## Recommended implementation waves

### Wave 1: immediate software wins

- Fix TG SAX volume coverage.
- Add label-volume export and label-guided coloring.
- Upgrade the 3D pane to solid, highlightable structure rendering.

### Wave 2: better anatomical source data

- Acquire and validate one contrast-enhanced CTA foundation case.
- Re-run clinical review on all 8 anchor views before moving on.

### Wave 3: realism on top of correct anatomy

- Add the echo-like appearance model.
- Add optional 3D volume rendering for the CTA case.

### Wave 4: advanced cardiac detail

- Add valve assets and valve-specific teaching overlays.
- Add motion only after the static valve/chamber views are clinically readable.

## Bottom line

The next rendering milestone should not be "make it prettier." It should be "make the chambers unmistakable." In practice that means: label-guided rendering first, CTA acquisition second, echo-like styling third. If TeeSim follows that order, it can move from a correct spatial demo to a genuinely teachable TEE anatomy simulator without throwing away the current geometry work.
