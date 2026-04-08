# Remaining Challenges Plan: Valves, Motion, Echo Appearance

**Date:** 2026-04-07  
**Status:** Proposed research note  
**Scope:** Concrete v0.2 implementation recommendations for the three remaining clinical gaps after chamber-level segmentation, correct omniplane rotation, anatomical probe pathing, depth control, and oblique label overlays  
**Inputs:** [`docs/research/2026-04-07-chamber-visibility-plan.md`](./2026-04-07-chamber-visibility-plan.md), [`docs/research/2026-04-07-realistic-rendering-strategy.md`](./2026-04-07-realistic-rendering-strategy.md), [`docs/research/2026-04-06-tee-simulator-public-data-survey.md`](./2026-04-06-tee-simulator-public-data-survey.md), [`docs/research/2026-04-06-roadmap-rendering.md`](./2026-04-06-roadmap-rendering.md), current runtime files in `src/renderer/`, `src/assets/`, `src/store.ts`, and `tools/asset-pipeline/process_lctsc_case.py`

---

## Summary Recommendation

For a **v0.2** release, the three challenges should be solved as one coherent stack:

1. **Valve leaflets:** implement **parametric valve models** fitted to annulus positions derived from the current label volume, then rasterize those leaflets back into `heart_labels.vti` and export matching valve meshes for the 3D pane.
2. **Cardiac motion:** implement a **deterministic phase-resolved label animation** by generating 10-12 offline phase volumes from the current chamber labels plus valve opening curves. Do not wait for cine MRI retargeting or 4D CTA.
3. **Echo-like appearance:** implement a **hybrid label-driven pseudo-TEE renderer**: label-based base brightness, interface enhancement, Rayleigh speckle, near-field clutter, and depth-dependent gain.

This is the best v0.2 path because it matches the current architecture:

- the runtime is already **volume-first** in the pseudo-TEE and oblique panes
- the public bundle already carries **`heart_labels.vti`**
- the 3D pane already supports **GLB actors**
- the existing asset pipeline already has the right Python stack for derived geometry and aligned label export

The key design principle is:

> For v0.2, add missing anatomy and behavior explicitly. Do not expect non-contrast CT to reveal them.

---

## Cross-Challenge Design Constraint

The three choices should reinforce each other rather than create three unrelated systems.

- **Valve recommendation** should produce both:
  - thin **3D meshes** for the anatomy pane
  - thin **label IDs** so the pseudo-TEE can show leaflet intersections without a separate mesh-raycaster
- **Motion recommendation** should animate the same labels that drive the pseudo-TEE appearance
- **Echo recommendation** should consume those labels directly, so valves and chambers become visible automatically once their labels exist

That argues against an atlas-only mesh solution for valves and against a mesh-only motion system for v0.2.

---

## Challenge 1: Valve Leaflets

### Option evaluation

| Option | Feasibility | v0.2 fit | Educational value | Main risk | Verdict |
|---|---|---|---|---|---|
| **A. Geometric valve plane estimation** | High | High | Medium | Shows annulus location but not real leaflets | Good fallback, not the recommendation |
| **B. Atlas valve mesh registration** | Medium | Medium-Low | High | Registration/debugging burden; mismatch to current case | Strong v0.3 path, too heavy for v0.2 |
| **C. Parametric valve model** | High | **High** | **High** | Idealized morphology | **Recommended** |
| **D. SlicerHeart valve analysis** | Medium | Low | High | Interactive/manual workflow breaks repeatability | Good QA tool, not the primary pipeline |

### Why option C is the best v0.2 choice

The user specifically wants to see **mitral anterior/posterior leaflets in the pseudo-TEE pane**. Option A cannot do that. Option B can do it, but it introduces a registration problem before it solves the visualization problem. Option D is useful clinically, but it turns an automated browser asset pipeline into a manual Slicer session.

Option C is the right tradeoff:

- uses the current chamber labels already present in the case
- gives explicit **anterior/posterior mitral**, **3 aortic cusps**, and **tricuspid leaflets**
- can be exported as both **mesh** and **label volume**
- stays bundle-safe because it does not depend on restricted datasets
- is simple enough to validate view-by-view with the anesthesiologist

### Recommended implementation path

#### Geometry model

Build each valve as a thin parametric surface attached to an estimated annulus:

- **Mitral valve**
  - annulus: ellipse at the LA/LV interface
  - leaflets: `mitral_anterior`, `mitral_posterior`
  - coaptation line: short central line with slight ventricular bowing
- **Aortic valve**
  - annulus: circle/ellipse at LVOT-aorta junction
  - leaflets: `aortic_left_coronary`, `aortic_right_coronary`, `aortic_noncoronary`
- **Tricuspid valve**
  - annulus: ellipse at RA/RV interface
  - leaflets: `tricuspid_anterior`, `tricuspid_septal`, `tricuspid_posterior`

For v0.2, the pulmonic valve can remain optional unless RV outflow views are a release blocker.

#### Annulus estimation

Derive annulus center and normal from the label volume, not CT intensity:

- mitral: local interface between `LA cavity`, `LV cavity`, and `myocardium`
- aortic: local interface between `LV cavity` and `aorta`
- tricuspid: local interface between `RA cavity`, `RV cavity`, and `myocardium`

Practical fitting method:

1. Dilate the neighboring chamber labels by 1-2 voxels.
2. Extract voxels where the two chambers approach each other across myocardium.
3. Fit a plane by PCA.
4. Estimate annulus ellipse axes from the in-plane spread of those voxels.
5. Orient the leaflet free edge toward the ventricular side.

#### Asset outputs

- Append valve meshes to `heart_detail.glb` or export them as a dedicated `valves.glb`
- Write valve label IDs into `heart_labels.vti`
- Add valve structure names into `case_manifest.json`
- Optionally extend `landmarks.json` with annulus centers and normals for QA

Recommended label IDs:

- `21`: mitral anterior leaflet
- `22`: mitral posterior leaflet
- `23`: aortic left coronary cusp
- `24`: aortic right coronary cusp
- `25`: aortic non-coronary cusp
- `26`: tricuspid anterior leaflet
- `27`: tricuspid septal leaflet
- `28`: tricuspid posterior leaflet

### Files to modify

- `tools/asset-pipeline/process_lctsc_case.py`
  - add annulus estimation
  - add leaflet rasterization into the existing label VTI export path
  - add valve meshes into heart detail export
- `tools/asset-pipeline/valve_geometry.py` (new)
  - annulus fitting
  - parametric leaflet surface generation
  - triangle-to-label-volume rasterization helpers
- `src/renderer/label-colors.ts`
  - add valve label IDs
- `src/renderer/PseudoTeePane.tsx`
  - render valve labels as bright thin interfaces rather than flat color overlay
- `src/renderer/Scene3DPane.tsx`
  - render valve actors with high-contrast white material and current-plane highlight
- `src/assets/__tests__/public-case-assets.test.ts`
  - verify the case bundle exposes valve-bearing labels and mesh assets once the case is updated

### Libraries and data needed

- **No new runtime library required**
- Reuse the current Python pipeline stack:
  - `numpy`
  - `SimpleITK`
  - `vtk`
  - `trimesh`
- Optional helper use in Python:
  - `scipy` for plane fitting utilities if desired
- Optional validation/reference only:
  - **HRA 3D heart** (`CC BY 4.0`) for rough proportions
  - **SlicerHeart** (`BSD-3-Clause`) for manual QA of annulus placement
  - **MVSeg2023** only as internal morphology reference, not as a shipped dependency

### Effort estimate

- **Engineering:** 1.5-2.5 weeks for one case
- **Clinical review:** 0.5 day for mitral/aortic view QA

### What the user will see when done

- In **ME 4C** and **ME LAX**, the mitral valve will no longer be invisible; the pseudo-TEE pane will show thin bright leaflet lines at the correct annulus instead of a blank gap.
- In **ME AV SAX/LAX**, the aortic cusps will appear as recognizable bright arcs.
- In the **3D pane**, the valve leaflets will be visible as explicit intracardiac structures rather than inferred from chamber boundaries.

### Why the other options are not the v0.2 recommendation

- **A** is too crude if the requirement is specifically “show anterior/posterior leaflets.”
- **B** is attractive long-term, but registration complexity is the wrong place to spend v0.2 time.
- **D** is useful as an offline authoring aid, but not as the main repeatable asset path.

---

## Challenge 2: Cardiac Motion

### Option evaluation

| Option | Feasibility | v0.2 fit | Educational value | Main risk | Verdict |
|---|---|---|---|---|---|
| **A. Parametric volume scaling** | **High** | **High** | High | Unrealistic if done as naive dilation/erosion | **Recommended, but precompute offline** |
| **B. Mesh blendshape animation** | Medium | Medium | High | Needs matched ED/ES meshes with stable topology | Good later, not first |
| **C. Displacement field from cine MRI** | Low-Medium | Low | High | Cross-modality retargeting complexity | v0.3+ research lane |
| **D. Simple rigid chamber motion** | High | Medium | Medium | 2D slice and 3D pane drift apart unless separately maintained | Not ideal for current volume-first runtime |
| **E. 4D CTA** | Low | Low | Very high | Public-data and pipeline burden | Internal/high-fidelity lane only |

### Why option A is the best v0.2 choice

The current simulator’s most important learning surface is still the **pseudo-TEE reslice**, not the 3D mesh pane. That means the first motion system should animate the **label volume**, because the label volume is what the renderer already understands.

Option D is easier to fake in the 3D pane, but it does not naturally improve the pseudo-TEE. Option B is attractive only after there is a stable ED/ES asset pair. Option C and E are correct long-term realism paths, but they are too expensive for v0.2.

Therefore the best minimum-effort motion path is:

> Build 10-12 offline phase-resolved label volumes from the current labels using deterministic chamber contraction curves and valve opening angles, then loop or scrub those phases in the runtime.

This is still option A, but implemented in a way that matches the current architecture and avoids expensive per-frame morphology in the browser.

### Recommended implementation path

#### Motion model

Precompute 10-12 phases over a 1-second cycle:

- **LV cavity**
  - 20-30% area/volume reduction from ED to ES
- **RV cavity**
  - 15-20% reduction
- **LA / RA**
  - smaller phased volume change, roughly 8-12%
- **Myocardium**
  - mild wall thickening coupled to ventricular contraction
- **Mitral / tricuspid / aortic valves**
  - simple opening-angle curves synchronized to the phase

Do not implement raw binary dilation/erosion in the browser. Instead:

1. Build a signed distance map for each chamber label offline.
2. Threshold the signed distance map at each phase to produce stable shrink/expand geometry.
3. Rasterize the valve leaflets at each phase.
4. Export one label VTI per phase.

This avoids unstable morphology and keeps the runtime simple.

#### Asset outputs

Recommended new assets:

- `heart_labels_phase_00.vti` ... `heart_labels_phase_11.vti`
- `motion.json`
  - `phaseCount`
  - `fps`
  - `loopSeconds`
  - per-structure scale curves
  - valve opening curves

If bundle size becomes an issue, keep the static `heart_roi.vti` and animate only labels in v0.2. That is acceptable because the pseudo-TEE appearance will already be label-driven in challenge 3.

#### Runtime behavior

- default: slow 1 Hz loop
- controls:
  - play/pause
  - phase slider
  - freeze at ED/ES
- pseudo-TEE and oblique panes:
  - swap the current label volume by phase
- 3D pane:
  - minimum v0.2: animate valve meshes and apply subtle pulsation cue
  - if chamber meshes are exported as separate actors, scale them very slightly around chamber centroids

### Files to modify

- `tools/asset-pipeline/process_lctsc_case.py`
  - generate the phase stack and `motion.json`
- `tools/asset-pipeline/cardiac_motion.py` (new)
  - signed-distance generation
  - phase curve application
  - valve angle curves
- `src/assets/types.ts`
  - add motion metadata and phase volume refs
- `src/assets/loader.ts`
  - load phase-resolved label volumes and motion metadata
- `src/store.ts`
  - add `cardiacPhase`, `isPlaying`, `loopSeconds`, `setCardiacPhase`, `toggleMotion`
- `src/App.tsx`
  - wire motion state into the panes
- `src/ui/ProbeHUD.tsx` or `src/ui/MotionControls.tsx` (new)
  - add play/pause and phase slider
- `src/renderer/PseudoTeePane.tsx`
  - consume phase-resolved label volume
- `src/renderer/ObliqueSlicePane.tsx`
  - consume phase-resolved label volume
- `src/renderer/Scene3DPane.tsx`
  - synchronize valve and optional chamber cues to the same phase
- `src/assets/__tests__/loader.test.ts`
  - cover new motion-manifest fields

### Libraries and data needed

- **No new browser dependency required**
- Reuse current Python stack:
  - `SimpleITK` for signed distance maps
  - `numpy`
  - `vtk`
- Optional reference only:
  - **Sunnybrook Cardiac Data** (`public domain / CC0`) to tune phase timing and LV contraction amplitude

For v0.2, Sunnybrook should be used as a **timing prior**, not as a retargeted deformation source.

### Effort estimate

- **Engineering:** 1.5-2 weeks for label-phase animation on one case
- **Additional 3D cue work:** 2-3 more days if chamber actors are split and lightly animated

### What the user will see when done

- The heart will visibly beat instead of remaining frozen.
- In the pseudo-TEE pane, the LV cavity will narrow during systole, the atrioventricular valves will open and close, and the geometry of standard views will change through the cycle.
- The user will be able to pause at ED and ES for teaching.

### Why the other options are not the v0.2 recommendation

- **B** depends on ED/ES meshes that do not exist yet.
- **C** is too much registration work for the educational gain of a first beat loop.
- **D** is easier in 3D than in 2D, which is the wrong priority for TeeSim.
- **E** is the best realism source, but not the best v0.2 engineering tradeoff.

---

## Challenge 3: Echo-Like Appearance

### Option evaluation

| Option | Feasibility | v0.2 fit | Educational value | Main risk | Verdict |
|---|---|---|---|---|---|
| **A. Label-based echogenicity mapping** | High | High | High | Can look too synthetic if used alone | Necessary component |
| **B. Signed distance field boundary enhancement** | Medium | Medium | High | Extra compute and asset complexity if done in 3D | Useful component, not standalone |
| **C. Full acoustic simulation** | Low | Very low | Very high | Excess complexity | Reject for v0.2 |
| **D. Hybrid: label brightness + boundary enhancement + speckle** | **High** | **High** | **Highest** | Needs careful tuning | **Recommended** |

### Why option D is the best v0.2 choice

The pseudo-TEE pane currently looks like CT because it is still basically a sector-masked CT reslice. The fix is not a full acoustic simulator. The fix is a deliberately educational ultrasound look built from the semantics already present in the label volume.

Option A alone will make the anatomy readable, but it will still look too flat. Option B alone will improve boundaries, but not tissue identity. Option C is the wrong release target.

Option D is the correct compromise:

- label-driven base brightness so chambers and myocardium read correctly
- interface enhancement so tissue transitions look like ultrasound reflections
- Rayleigh speckle and near-field clutter so the image stops reading as CT
- TGC curve so depth behaves like echo instead of linear CT attenuation

### Recommended implementation path

#### Rendering model

Keep the existing VTK reslice, but change the postprocess in `PseudoTeePane.tsx` from “windowed CT” to “echo appearance synthesis.”

Per pixel:

1. **Base intensity from label**
   - blood pool labels: dark, low-contrast speckle
   - myocardium: brighter, denser speckle
   - aortic wall / vessel interfaces: brighter than blood
   - valve labels: very bright, thin interface
2. **Boundary enhancement**
   - compute a local edge term from the resliced label image
   - boost intensity near label boundaries, strongest at valve and pericardial interfaces
3. **Speckle**
   - apply deterministic Rayleigh noise with label-specific amplitude
4. **Near-field clutter**
   - add low-depth haze/noise in the first 5-10 mm
5. **TGC**
   - apply a configurable depth gain curve rather than the current monotonic CT fading

For v0.2, do the boundary term in **2D after reslice**, not by shipping full 3D SDF volumes. This captures most of the educational value with much less complexity.

#### Asset contract

Add an optional `appearance.json` per case:

- label ID -> base brightness
- label ID -> speckle amplitude
- label ID -> boundary gain
- global TGC curve
- near-field clutter settings

That keeps appearance tunable without hardcoding every value in the React component.

### Files to modify

- `src/renderer/PseudoTeePane.tsx`
  - replace CT-window-first mapping with label-first echo synthesis
  - keep sector mask and slab reslice
- `src/renderer/types.ts`
  - extend `PseudoTeeAppearance` with TGC, clutter, and speckle controls
- `src/renderer/echo-appearance.ts` (new)
  - per-label acoustic appearance table
  - deterministic noise functions
  - boundary enhancement utilities
- `src/assets/types.ts`
  - add `appearanceJson` asset ref
- `src/assets/loader.ts`
  - load appearance config when present
- `src/store.ts`
  - add optional educator-facing appearance toggles if needed
- `src/renderer/label-colors.ts`
  - keep educator overlay colors separate from grayscale echo appearance defaults
- `public/cases/0.1.0/<case>/appearance.json`
  - per-case tuning file
- `src/renderer/__tests__/echo-appearance.test.ts` (new)
  - verify deterministic noise and label-property mapping

### Libraries and data needed

- **No new runtime dependency required**
- Reuse the existing VTK.js reslice path
- Use pure TypeScript utilities for:
  - deterministic hash-based noise
  - Rayleigh sampling
  - 2D edge enhancement

No external dataset is required for the first pass. Tuning should be done against clinician screenshots and internal restricted ultrasound references if available, but the shipped appearance model can remain anatomy-driven.

### Effort estimate

- **Engineering:** 1-1.5 weeks for the first convincing pass
- **Clinical tuning:** 0.5 day of iterative screenshot review

### What the user will see when done

- The pseudo-TEE pane will stop looking like a CT slice with a sector mask.
- Blood pools will read as dark cavities.
- Myocardium will read as bright speckled tissue.
- Valve leaflets will read as crisp bright structures.
- Depth will feel more like ultrasound because gain increases with depth instead of simply fading anatomy away.

### Why the other options are not the v0.2 recommendation

- **A** is necessary but insufficient on its own.
- **B** is useful but should remain a component of the hybrid path, not a full 3D SDF asset pipeline yet.
- **C** is not a reasonable v0.2 deliverable.

---

## Recommended Delivery Order

These should not be delivered in the order the user listed them. The lowest-risk order is:

1. **Valve labels and meshes**
   - because the echo renderer and motion system both benefit from them
2. **Echo-like appearance**
   - because once labels exist, the pseudo-TEE pane can improve immediately
3. **Phase-resolved label animation**
   - because motion will be much more convincing after the image already reads as echo

This order also creates useful review checkpoints:

- after step 1: “Can we see the mitral leaflets?”
- after step 2: “Does the pane look like echo instead of CT?”
- after step 3: “Does the cycle teach valve timing and chamber contraction?”

---

## v0.2 Scope Recommendation

### Must ship

- Parametric **mitral**, **aortic**, and **tricuspid** leaflet geometry
- Valve labels baked into `heart_labels.vti`
- Hybrid echo appearance in `PseudoTeePane`
- 10-12 phase deterministic label animation with play/pause/freeze

### Can defer

- Atlas registration of valves
- Cine MRI displacement retargeting
- 4D CTA
- Full acoustic simulation
- Chordae and papillary muscles
- Patient-specific leaflet morphology

---

## Bottom Line

For **v0.2**, the best implementation path is:

- **Valves:** **C. Parametric valve model**
- **Motion:** **A. Parametric volume scaling**, implemented as **offline phase-resolved label volumes**
- **Appearance:** **D. Hybrid label brightness + boundary enhancement + speckle**

This path is specific, shippable, and consistent with the current TeeSim architecture. It gives the anesthesiologist the three clinically visible wins they are asking for:

1. **leaflets become visible**
2. **the heart beats**
3. **the pseudo-TEE pane finally looks like echo rather than CT**
