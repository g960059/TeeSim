# Chamber Visibility and Valve Visualization Plan

**Date:** 2026-04-07  
**Status:** Proposed research note  
**Scope:** Response to clinical feedback that TeeSim currently shows a solid heart with invisible mitral leaflets and no cardiac motion  
**Inputs:** [`docs/research/2026-04-06-roadmap-rendering.md`](./2026-04-06-roadmap-rendering.md), [`docs/research/2026-04-06-roadmap-data-pipeline.md`](./2026-04-06-roadmap-data-pipeline.md), [`docs/decisions/ADR-0003-roadmap.md`](../decisions/ADR-0003-roadmap.md), [`docs/research/2026-04-06-clinical-validation-v2.md`](./2026-04-06-clinical-validation-v2.md), [`docs/research/2026-04-06-tee-simulator-public-data-survey.md`](./2026-04-06-tee-simulator-public-data-survey.md)

---

## Summary

The anesthesiologist's feedback is correct. The current asset stack cannot produce a teachable four-chamber view because it is trying to solve **three different problems with one non-contrast CT volume**:

1. **Chamber visibility** is a cavity-versus-wall problem.
2. **Valve visibility** is a thin-surface geometry problem.
3. **Cardiac beating** is a time-varying deformation problem.

These should not be solved with one technique.

**Recommendation:**

- For **chambers**, move to an explicit blood-pool + wall representation. The best anatomical source is **ECG-gated contrast cardiac CTA**. The best near-term public-bundle fallback is a **synthetic or atlas-derived cavity model** registered into the current CT case.
- For **valves**, do not wait for voxel data to reveal leaflets. Model them as **thin meshes** attached to estimated annuli. Use **3D TEE** or **MVSeg2023** only as an internal validation and shape-prior source, not as the public bundle.
- For **motion**, ship a **simple deterministic phase model first**. Use cine MRI or licensed synthetic phantoms to improve deformation later. Do not block chamber/leaflet visibility on 4D data acquisition.
- For **rendering**, stop relying on grayscale CT alone. Add aligned label/cavity channels, boundary enhancement, and educator overlays immediately.

The core design change is:

> TeeSim should render the heart as **myocardial shell + chamber cavities + valve meshes + phase state**, not as a single opaque heart label or one undifferentiated CT blob.

---

## Why the Current Stack Fails

- **LCTSC non-contrast thoracic CT** does not reliably separate blood pool from myocardium in a way that survives oblique pseudo-TEE reslicing.
- **A single heart label** guarantees a solid-looking heart. Simulated contrast enhancement on that label cannot recover missing cavity topology.
- **Valve leaflets are too thin and too mobile** to become reliably visible in routine non-gated thoracic CT. Even gated CTA is much better for annuli and great-vessel interfaces than for leaflet truth.
- **Motion is missing entirely**, so even plausible static geometry reads as dead anatomy rather than a beating heart.

Inference: rendering tweaks can improve readability, but they cannot turn a one-label non-contrast heart into true chamber anatomy or patient-specific leaflet geometry.

---

## Approach 1: Data Source for Visible Chambers

| Approach | Feasibility | Effort | Data availability | Clinical accuracy | Recommendation |
|---|---|---:|---|---|---|
| **ECG-gated contrast cardiac CTA** | High technically, medium on governance | L-XL | Public research CTA exists, but bundle-safe redistribution is still weak; best route is licensed or owned data | **High** for blood pool, myocardium, outflow tracts, annuli, and great vessels | **Best long-term chamber source** |
| **3D/4D TEE DICOM directly** | Medium | L-XL | Public data is scarce; institutional/vendor data is more realistic than public download paths | **Medium-High** for valves, lower for full thoracic/chamber wall modeling | Best internal valve-focused lane, not the sole heart source |
| **Synthetic or atlas-based heart model with explicit cavities** | High | M-L | High; can be built in-house from open-safe atlases or fitted to current case geometry | **Medium**; good educational anatomy, weaker patient specificity | **Best near-term public-bundle fallback** |
| **XCAT phantom** | High if licensed | M-L | Licensed/request-based, not open | **High** for controlled cavity geometry and motion; not patient-specific unless parameterized to match | Strong licensed accelerator, not MVP public dependency |

### Assessment

#### ECG-gated contrast cardiac CTA

- This is the best answer to "how do we make blood-filled cavities visible?"
- It naturally gives the contrast relationship TeeSim needs: bright blood pool, intermediate myocardium, and recognizable LVOT/aortic root geometry.
- It is also the best source for deriving **endocardial surfaces**, which are what the current pipeline is missing.
- Limitation: even good CTA is still not the right place to expect robust patient-specific mitral leaflet truth.

#### 3D/4D TEE DICOM

- This is the best modality for **mitral leaflet morphology and valve motion**, not for whole-heart cavity-wall segmentation.
- SlicerHeart already supports import of 3D/4D ultrasound and includes valve visualization, valve segmentation, leaflet analysis, and annulus tools.
- Public 3D TEE availability is narrow. MVSeg2023 is focused on **single-frame mitral valve volumes**, not whole-heart TEE simulator anatomy.

#### Synthetic or atlas-based cavity model

- This is the fastest way to stop showing a solid heart in the public bundle.
- Build or fit a heart model with explicit `LA`, `LV`, `RA`, `RV`, myocardium, and great-vessel lumen surfaces, then register it to the current CT heart shell.
- This is educationally acceptable if TeeSim is explicit that it is showing a **teaching model fitted to patient-like anatomy**, not a diagnostic reconstruction of that case.

#### XCAT phantom

- XCAT already provides parameterized anatomy plus beating-heart motion.
- It is a good route if TeeSim wants a licensed synthetic cohort with controllable physiology, pathologies, and phase-consistent motion.
- It does not solve the public-bundle constraint.

### Recommendation for chambers

1. **Immediate:** add explicit cavity geometry now, even if synthetic or manually fitted.
2. **Next:** acquire one **internal or licensed ECG-gated contrast CTA** foundation case.
3. **Later:** use CTA-derived cavities as the geometric source of truth and keep synthetic cavity models as the open fallback lane.

---

## Approach 2: Valve Leaflets and Annuli

| Approach | Feasibility | Effort | Data availability | Clinical accuracy | Recommendation |
|---|---|---:|---|---|---|
| **Valve planes from chamber boundaries** | High | M | Works on current or future chamber labels | **Low-Medium** for leaflet visibility; **Medium-High** for view targeting | Do now for authoring and highlighting |
| **Thin-structure mesh modeling** | High | M-L static, L-XL dynamic | No special dataset required if authored in-house | **Medium-High** for visible leaflets in an educational simulator | **Required** for visible mitral/aortic leaflets |
| **Atlas valve geometry registered to patient anatomy** | Medium-High | L | Needs atlas/shape prior; can be built incrementally | **High** for teaching morphology if annulus fit is good | **Best pragmatic valve path** |
| **MVSeg2023 internal validation** | Medium | M | Available with gated access; non-commercial/no-derivatives | **High**, but only for mitral leaflet shape at end-diastole | Use only internally for validation and shape priors |

### Key point

**Visible valve leaflets should be treated as meshes, not voxels.**

Trying to recover mitral or aortic leaflets from current CT intensity data is the wrong problem statement. What TeeSim needs is:

- an **annulus estimate** from chambers and outflow structures
- a **leaflet surface model** attached to that annulus
- optional **papillary/chordal landmarks** in the 3D pane
- a **slice-intersection overlay** so the pseudo-TEE pane can show where the current plane crosses the leaflet mesh

### What to do now

- Estimate **mitral, tricuspid, aortic, and pulmonic annulus planes** from chamber-vessel interfaces and neighboring landmarks.
- Author **static mitral and aortic leaflet meshes** first. These two valves matter most for the current standard views.
- Render valves in two ways:
  - as semi-opaque leaflets in the 3D pane
  - as bright curved intersections in the pseudo-TEE and oblique panes

### Role of MVSeg2023

- Good for internal validation of **mitral anterior/posterior leaflet shape**, thickness, commissural extent, and slice appearance at end-diastole.
- Not suitable as a public-bundle dependency because the dataset is gated-access and `CC BY-NC-ND 4.0`.
- Scope is narrow: mitral only, single-frame, not full whole-heart motion.

### Recommendation for valves

1. Use **annulus planes immediately** for authoring and for 3D overlays.
2. Add **atlas-fitted mesh leaflets** for MV and AV as the first visible leaflet milestone.
3. Use **3D TEE / MVSeg2023** only to validate and tune those meshes internally.

---

## Approach 3: Cardiac Motion

| Approach | Feasibility | Effort | Data availability | Clinical accuracy | Recommendation |
|---|---|---:|---|---|---|
| **Sunnybrook cine MRI** | High | M | Public domain / CC0 | **Medium** for LV timing and gross contraction; weak for atria and valves | Best open-safe source for first motion prior |
| **ACDC cine MRI** | High | M | Publicly downloadable; keep in verify-first/internal lane | **Medium** for LV/RV + myocardium ED/ES deformation; limited for atria/valves | Good internal validation source |
| **Simple parametric contraction model** | Very high | S-M | No external data needed | **Low-Medium**, but enough for a first educational beat loop | **Best first shippable motion** |
| **4D CT** | Low-Medium | XL | Scarce and usually licensed/verify-first | **High** if truly gated and multi-phase, but hard to obtain cleanly | Not the first motion lane |

### What MRI can and cannot do

- **Sunnybrook** is an excellent safe source for **beat timing and LV contraction archetypes**, but it is an LV-focused dataset.
- **ACDC** gives **LV cavity, RV cavity, and myocardium** labels at ED/ES, which is useful for coarse biventricular deformation, but it still does not provide atrial or leaflet motion truth.
- MRI-derived motion fields can drive chamber contraction, but they do not solve the valve problem by themselves.

### Best practical motion plan

1. Ship a **freezeable phase slider** and looping synthetic beat first.
2. Animate:
   - LV and RV cavity shrink/expand
   - annular excursion
   - modest atrial volume change
   - synchronized opening/closing of the mesh valves
3. Retarget MRI- or XCAT-derived phase curves later.

This gives the educator what matters first:

- the heart is visibly alive
- the mitral valve opens and closes
- the core views change through the cycle

without blocking the roadmap on rare 4D cardiac CT.

---

## Approach 4: Rendering Improvements with Current Data

| Approach | Feasibility | Effort | Data availability | Clinical accuracy | Recommendation |
|---|---|---:|---|---|---|
| **Better CT windowing** | Very high | S | Current assets | Low by itself | Do it, but treat as marginal gain |
| **Gradient / edge enhancement** | High | S-M | Current assets | Low-Medium | Useful only as a secondary cue |
| **Aligned intensity + label reslice** | High | M | Needs label or cavity VTI | **High educational value** | **Highest-leverage runtime improvement** |
| **Structure-aware pseudo-TEE shader** | Medium-High | M | Needs chamber/valve semantics | Medium-High | Add after label/cavity data exists |

### Immediate rendering recommendations

- Export and reslice a second aligned volume:
  - `heart_labels.vti` for chamber identity
  - optionally `heart_cavities.vti` for blood-pool confidence
- Apply explicit pseudo-TEE rules:
  - chamber cavities rendered dark/anechoic
  - myocardium brighter with soft attenuation
  - valve intersections rendered as thin bright curves
  - label boundaries lightly enhanced
- In the 3D pane, use:
  - cutaway myocardium
  - cavity fill colors
  - annulus and leaflet overlays
  - intersection highlighting for structures currently inside the sector

### What rendering alone cannot do

- It cannot invent a left ventricular cavity if the asset has only a solid heart label.
- It cannot create visible anterior/posterior mitral leaflets without a valve surface model.
- It cannot make motion clinically believable without some phase-dependent deformation model.

---

## Recommended Architecture Change

### Public-bundle lane

- **Thorax and external context:** open-safe CT / atlas
- **Heart interior:** synthetic or hand-fitted chamber cavity model
- **Valves:** atlas-fitted leaflet meshes
- **Motion:** parametric phase model
- **Runtime contract:** intensity VTI + label/cavity VTI + valve meshes + motion parameters

This gives TeeSim a publishable open bundle that is much more teachable than the current one-label heart.

### Internal / licensed lane

- **Chambers and walls:** gated contrast CTA
- **Valve shape and motion:** 3D/4D TEE DICOM
- **Motion prior:** MRI retargeting and/or XCAT
- **Validation:** MVSeg2023 for mitral leaflet morphology, ACDC/Sunnybrook for ventricular phase behavior

This is the route to clinically stronger chamber and valve realism.

---

## Prioritized Plan

### Phase 0: Stop rendering a solid heart

- Add explicit chamber cavities, even if synthetic or manually fitted.
- Export `heart_labels.vti` aligned to the current `heart_roi.vti`.
- Render cavities separately from myocardium.
- Add annulus-plane overlays in 3D and 2D panes.

**Exit criterion:** ME 4C, ME 2C, and ME LAX no longer look like one solid intracardiac mass.

### Phase 1: Make valves visibly present

- Fit static mitral and aortic leaflet meshes to annuli.
- Show leaflet intersections in pseudo-TEE.
- Add educator toggle for cavity labels and valve labels.

**Exit criterion:** the anesthesiologist can point to anterior/posterior mitral leaflets in at least one ME mitral view.

### Phase 2: Add believable but controlled motion

- Add a deterministic phase slider and looping beat.
- Animate chamber volumes, annular excursion, and leaflet open/close states.
- Keep the motion freezeable for teaching.

**Exit criterion:** the simulator shows a beating heart without losing view identity.

### Phase 3: Acquire a high-fidelity internal case

- Process one gated contrast CTA case.
- If available, pair it with one 3D/4D TEE case from the same anatomy or a matched cohort.
- Use the high-fidelity case to recalibrate the open teaching model.

**Exit criterion:** one internal reference case demonstrates clearly superior chamber interiors and valve context versus the public bundle.

---

## Bottom Line

- **Chambers:** solve with **explicit cavity modeling**, ideally from **gated contrast CTA**, not by more aggressive rendering of a single heart label.
- **Valves:** solve with **mesh leaflets attached to annuli**, validated by **3D TEE**, not by hoping CT voxels will show them.
- **Motion:** solve first with a **simple phase model**, then improve with MRI- or XCAT-derived priors.
- **Rendering:** improve immediately, but only after admitting that the asset model must change.

The fastest clinically credible path is therefore:

1. **Synthetic or manually fitted cavity model now**
2. **Atlas-fitted mitral/aortic leaflet meshes now**
3. **Parametric beat loop now**
4. **Gated CTA and 3D TEE internal lane next**

That sequence directly addresses the three complaints from clinical review instead of trying to squeeze more realism out of the same non-contrast single-label heart.

---

## External References Checked

- TotalSegmentator official repo: `heartchambers_highres` is available only with a license; free licenses are available for non-commercial use, and the task includes myocardium, both atria, both ventricles, aorta, and pulmonary artery.  
  https://github.com/wasserth/TotalSegmentator
- TotalSegmentator CT dataset on Zenodo: 117 structures in 1228 CT images, randomly sampled from clinical routine.  
  https://doi.org/10.5281/zenodo.10047292
- SlicerHeart official repo: supports 3D/4D ultrasound import and includes valve visualization, valve segmentation, and leaflet analysis tools.  
  https://github.com/SlicerHeart/SlicerHeart
- Sunnybrook Cardiac Data official page: public-domain cine MRI; LV-focused segmentation challenge data.  
  https://www.cardiacatlas.org/sunnybrook-cardiac-data/
- ACDC official challenge page: publicly downloadable cine MRI with LV cavity, RV cavity, and myocardium labels at ED/ES.  
  https://www.creatis.insa-lyon.fr/Challenge/acdc/
- XCAT official resource page: parameterized beating-heart and respiratory-motion phantom, available by request.  
  https://cvit.duke.edu/resource/xcat-phantom-program/
- ImageCAS official repo: approximately 1000 CTA images, but access still relies on request/password style distribution.  
  https://github.com/XiaoweiXu/ImageCAS-A-Large-Scale-Dataset-and-Benchmark-for-Coronary-Artery-Segmentation-based-on-CT
- MVSeg2023 dataset card: gated-access 3D TEE mitral leaflet dataset under `CC BY-NC-ND 4.0`.  
  https://huggingface.co/datasets/pcarnahan/MVSeg2023
