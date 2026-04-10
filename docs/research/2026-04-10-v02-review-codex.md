# 2026-04-10 TeeSim v0.2 Review (Codex)

## Scope

- Reviewed all screenshots in `screenshots/review-v02/`
- 8 anchor views x 4 images each:
  - `*-full.png`
  - `*-tee.png`
  - `*-3d.png`
  - `*-oblique.png`
- 4 motion frames:
  - `motion-frame-0.png` through `motion-frame-3.png`
- Context reviewed:
  - `README.md`
  - `docs/product/*`
  - `docs/decisions/ADR-0001-mvp-architecture.md`
  - `docs/decisions/ADR-0002-uiux-redesign.md`
  - `docs/decisions/ADR-0003-roadmap.md`
  - `docs/runbooks/*`
  - active change packs `0003`, `0004`, `0005`

## Executive Summary

TeeSim v0.2 has a usable shell, correct preset wiring, and a helpful oblique pane, but it is not yet a credible clinical teaching view simulator.

The main problems are visual, not structural:

1. The pseudo-TEE pane does not read as echocardiography. It looks like a dark sector with coarse label-colored blobs overlaid on a flat gray wedge.
2. The 3D anatomy pane is not recognizable as a standard heart model. It looks wireframe-like, contour-like, and unlabeled rather than like solid cardiac chambers and great vessels.
3. The motion frames do not show visible cardiac contraction. The phase indicator changes, but the rendered panes are visually unchanged.

Relative to `ADR-0001`, the project still has value as a probe-plane / spatial reasoning prototype. Relative to the current UI wording, especially "Label-driven echo appearance", the screenshots do not yet meet the bar implied by the interface.

## Important Context

Two context points matter when judging these screenshots:

1. `ADR-0001` explicitly frames the MVP pseudo-TEE output as a "sectorized anatomical slice", not diagnostic ultrasound.
2. The current v0.2 UI and active change pack `0004-echo-appearance` now push the output toward an echo-like appearance, so echo-likeness is now a fair review criterion.

Also, every screenshot appears to have label overlays enabled because the UI button says `Hide labels`. That makes the oblique pane easier to interpret, but it also makes the pseudo-TEE pane look less like real echo. Even with that caveat, the underlying grayscale still does not look convincingly echo-like.

## Per-View Review

| View | Pseudo-TEE | 3D pane | Oblique pane | Overall teaching utility |
|------|------------|---------|--------------|--------------------------|
| **ME Four-Chamber** | Does not show four dark chambers, septal crux, or AV valve plane in a recognizable way. | White contour/wireframe mass; not recognizable as atria, ventricles, or great vessels. | Best clue to anatomy in this view; chamber labels help, but it reads like a debug slice, not a teaching image. | **2/5** |
| **ME Two-Chamber** | Expected LV + LA long-axis silhouette is not identifiable; colored patches dominate. | Same unrecognizable wireframe-like heart mass. | Reasonably separable labeled structures, but not intuitive for a trainee without prior anatomy knowledge. | **2/5** |
| **ME Long-Axis** | Expected LVOT / aortic continuity is not visually taught. | Same rendering failure; chamber relationships are not legible. | Oblique pane is interpretable by a trained eye and is the strongest cue here. | **2/5** |
| **TG Mid Short-Axis** | Fails the expected short-axis teaching target. No obvious round LV cavity or papillary-level ring pattern. | Static white contour stack, not a ventricular short-axis heart model. | Only limited utility; the slice does not clearly teach a TG SAX target. | **1/5** |
| **ME AV Short-Axis** | Does not show a recognizable aortic short-axis pattern or valve-centered anatomy. | Not recognizable as aortic root / surrounding structures in 3D. | Helpful labeled cross-section, but still more segmentation map than anatomical teaching image. | **2/5** |
| **ME AV Long-Axis** | Does not clearly show LVOT, aortic valve, and ascending aorta continuity. | Same wireframe-like center pane. | One of the better oblique views; still dependent on labels rather than shape language. | **2/5** |
| **ME RV Inflow-Outflow** | Does not teach RV inflow + RVOT continuity; image is too abstract. | Same 3D failure mode. | Some right-heart structures are present in the oblique slice, but not clearly instructional. | **1/5** |
| **ME Bicaval** | Does not clearly teach the bicaval relationship of SVC/IVC into RA. | Same unrecognizable white contour mass. | Oblique pane is interpretable after effort, but not quickly or intuitively. | **2/5** |

## 1. Pseudo-TEE Review

### Bottom line

The pseudo-TEE pane does **not** look echo-like.

### Specific questions

| Question | Verdict | Notes |
|----------|---------|-------|
| Does it look echo-like? | **No** | It reads as a label-driven debug rendering, not as grayscale ultrasound. |
| Are blood pools dark? | **Mostly no** | Blood pools are frequently represented by colored overlays or flat mid/dark tones rather than clean anechoic cavities. |
| Is myocardium bright? | **No** | Myocardium is generally a dull dark-gray slab, not a bright echogenic wall. |
| Are boundaries visible? | **Partially** | Boundaries are helped by color labels, but intrinsic grayscale tissue interfaces are weak. |
| Are valves visible? | **Not in a clinically recognizable way** | At most there are tiny colored slivers in a few views; they do not read as valve leaflets in the pseudo-TEE pane. |

### Detailed observations

- The sector geometry itself is correct enough for a TEE-like presentation.
- The actual image content is too coarse and too flat.
- The grayscale dynamic range is compressed into "black background + dark gray wedge + colored islands".
- The label overlay dominates the image semantics. A trainee would learn label colors, not echo anatomy.
- The expected echo teaching cues are missing:
  - anechoic blood cavities
  - bright myocardial interfaces
  - visible septa
  - valve-plane echogenicity
  - recognizable chamber geometry per standard view

### View-specific misses

- **ME 4C:** no four-chamber pattern, no central crux
- **ME 2C:** no clear LA-LV long-axis silhouette
- **ME LAX:** no clear LVOT-aortic continuity
- **TG SAX:** no obvious circular LV short-axis target
- **ME AV SAX:** no recognizable aortic short-axis valve-centered view
- **ME AV LAX:** no clear AV long-axis geometry
- **ME RV inflow-outflow:** no teachable RV inflow / outflow relationship
- **ME Bicaval:** no strong bicaval venous-to-RA teaching image

### Assessment

As a clinical-teaching pseudo-TEE image, this is **1/5**.

If judged only as "proof that the probe plane is reslicing anatomy", it scores higher. But that is not the bar the screenshots are inviting.

## 2. 3D Anatomy Model Review

### Bottom line

The user complaint is correct. The `*-3d.png` screenshots look very different from standard 3D heart models, and not in a good way.

### Are the meshes recognizable as cardiac anatomy?

**Not reliably.**

The center pane does not read as a heart with recognizable chambers and great vessels. It reads as an abstract white contour cloud with a probe and sector wedge.

### What looks wrong

1. **Wireframe-like / contour-stack appearance**
   - The anatomy looks like thin white rings, edges, or sparse contour slices rather than closed shaded surfaces.
2. **No chamber identity**
   - There is no visual separation of LV, RV, LA, RA, aorta, and pulmonary artery.
3. **Wrong material language**
   - Standard teaching 3D heart models use solid shaded surfaces, distinct colors, translucency hierarchy, and visible external morphology.
   - Here the model is nearly monochrome and visually noisy.
4. **Poor silhouette readability**
   - Even the outer shape of the heart is hard to parse.
5. **Missing teaching hierarchy**
   - Everything in the heart mass has nearly the same visual treatment.
   - No structure is highlighted as the important one for the current view.
6. **Topology / rendering presentation feels broken**
   - The screenshots suggest either over-decimated geometry, poor normals/material handling, or a renderer/import path that is not producing solid surfaces.

### What standard 3D teaching models usually provide

- Solid closed surfaces
- Clear chamber volumes
- Distinct vessel trunks
- Predictable colors
- Some translucency, but not so much that shape disappears
- A visible outer cardiac form even before labels are added

### How the 3D model should be improved

#### Short-term, highest-value fixes

1. Render the anatomy as **solid shaded surfaces**, not contour-like linework.
2. Apply **stable per-structure colors**:
   - LV / LA one family
   - RV / RA another family
   - aorta distinct
   - pulmonary artery distinct
3. Use **opacity hierarchy**:
   - target structure opaque
   - adjacent structures semi-transparent
   - background thoracic context more subdued
4. Add **structure highlighting for the current preset** so the active teaching anatomy stands out.
5. Improve **lighting and normals** so the outer cardiac silhouette is readable.

#### Structural fixes likely needed

1. Validate the exported GLB meshes as real triangle surfaces with correct normals.
2. Revisit mesh decimation and smoothing so the heart remains recognizably cardiac after simplification.
3. Separate scene-context meshes from heart-detail meshes and render them with different styles.
4. If the current VTK GLTF import path cannot produce good surface rendering, use the fallback already allowed by `ADR-0001`: keep VTK for slices and move the center pane to R3F / Three.js.

### Likely technical cause visible in the current code

The runtime loads GLB actors through `vtkGLTFImporter` and adds them directly to the scene, but there is no anatomy-specific post-load styling in the center pane. The center-pane code in `src/assets/runtime-loaders.ts` and `src/renderer/Scene3DPane.tsx` does not assign clinically meaningful colors, opacities, or highlight rules to the imported heart actors. Even if the source meshes are decent, the presentation layer is currently too weak.

### Assessment

As a clinical-teaching 3D anatomy model, this is **1/5**.

## 3. Motion Review

### Bottom line

The 4 motion frames do **not** show visible cardiac contraction.

### Visual review

Across `motion-frame-0.png` through `motion-frame-3.png`:

- the phase label changes
- the phase scrubber position changes
- the rendered pseudo-TEE pane appears unchanged
- the rendered 3D pane appears unchanged
- the rendered oblique pane appears unchanged

I cannot identify:

- ventricular cavity reduction
- systolic thickening
- atrial filling/emptying
- valve opening/closing
- any phase-specific deformation that a trainee could learn from

### Objective check

I additionally compared the rendered-pane pixel regions across the four motion frames.

- **Pseudo-TEE pane:** pixel-identical across frames
- **3D pane:** pixel-identical across frames
- **Oblique pane:** pixel-identical across frames

Only a tiny fraction of full-screen pixels changed, consistent with the phase text / scrubber UI rather than anatomy.

### Important nuance

Per active change pack `0005-cardiac-motion`, the 3D scene is intentionally still static. That explains why the center pane does not move.

It does **not** explain why the pseudo-TEE and oblique panes appear unchanged, because that same change pack explicitly intends those panes to render from the active motion-phase label volume.

### Assessment

As a cardiac-cycle teaching feature, this is **1/5**.

## 4. Component Ratings (1-5 Clinical Teaching Utility)

| Component | Rating | Rationale |
|-----------|--------|-----------|
| **Pseudo-TEE pane** | **1/5** | Correct general fan layout, but not an echo-like image and not sufficient for view-learning. |
| **3D anatomy pane** | **1/5** | Probe and sector are visible, but cardiac anatomy is not recognizably presented. |
| **Oblique slice pane** | **3/5** | Strongest current pane. Labeled anatomy can be interpreted by a trained eye, but it still feels like a debug slice more than a teaching visualization. |
| **Motion** | **1/5** | Phase UI changes without visible anatomical deformation. |
| **Overall v0.2** | **2/5** | Useful as a technical spatial prototype, not yet strong enough as a fellow-facing clinical teaching tool. |

## Highest-Priority Improvements

### P0

1. Fix the 3D pane so it renders solid, recognizable cardiac anatomy.
2. Make motion visibly change the pseudo-TEE and oblique panes before claiming cardiac animation.
3. Tune the pseudo-TEE so blood is dark, myocardium is brighter, and chamber shapes become recognizable in the 8 anchor views.

### P1

1. Capture screenshots with labels hidden for true pseudo-TEE evaluation.
2. Add current-view structure highlighting in the 3D pane.
3. Increase pseudo-TEE resolution and reduce the coarse blocky label look.

### P2

1. Introduce recognizable valve-plane echogenicity.
2. Add limited speckle / boundary enhancement only after chamber geometry is already readable.
3. Add 3D motion later, once the static 3D anatomy pane is trustworthy.

## Final Verdict

TeeSim v0.2 is promising as a probe-geometry and synchronized-reslice prototype, but the screenshots do not yet support confident clinical teaching.

- The pseudo-TEE pane is not echo-like enough to teach view recognition.
- The 3D anatomy pane is the weakest major component and needs a rendering rethink.
- The motion system is not visually demonstrated in the screenshots.
- The oblique pane is currently carrying most of the educational value.

If only one thing is fixed next, it should be the **3D anatomy presentation**, because that is the main spatial-teaching differentiator of the product and the main element users currently find untrustworthy.
