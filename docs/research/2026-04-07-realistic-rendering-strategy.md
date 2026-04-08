# Realistic Cardiac Rendering Strategy

**Date:** 2026-04-07
**Status:** Active research
**Feeds into:** ADR-0003 Phase 0/1, Phase 3 valve/motion roadmap

---

## Problem Statement

A cardiac anesthesiologist tested TeeSim and identified three fundamental deficiencies:

1. **No internal structure** -- Heart chambers look like solid blobs. The non-contrast CT cannot distinguish blood pool from myocardium (HU difference is only ~20-30 HU).
2. **No valve leaflets** -- Mitral valve anterior/posterior leaflets are completely invisible. CT resolution and contrast are insufficient to resolve leaflet tissue (~1 mm thick).
3. **No cardiac motion** -- The heart does not beat. A static image does not convey the dynamic relationships that define TEE interpretation.

These are not rendering bugs. They are fundamental limitations of the data source (non-contrast thoracic CT with whole-heart segmentation). No amount of windowing, color-mapping, or shader work can extract information that is not in the source volume.

---

## How Existing TEE Simulators Solve This

### HeartWorks (Inventive Medical / Surgical Science)

- **Approach:** Hand-crafted 3D polygonal heart model created by visual-effects artists (Glassworks, a VFX studio) from anatomical reference data.
- **Detail level:** 135 individually modeled intracardiac structures including valve leaflets, chordae tendineae, papillary muscles, trabeculae carneae, and coronary arteries.
- **Rendering:** Real-time GPU render engine (powered by NVIDIA Quadro) generates simulated ultrasound images by reslicing through the 3D model. Full cardiac cycle animation with valve opening/closing.
- **Pathology:** Over 30 pathology cases with parametric deformation of the model.
- **Cost:** ~$50K+ per unit (hardware + software).
- **Key insight:** HeartWorks does NOT use patient imaging data at all. The entire heart is a bespoke artist-created model. Ultrasound appearance is synthesized from the model geometry, not from any imaging volume.

### Virtual TEE Toronto (PIE, University of Toronto)

- **Approach:** Custom 3D digital heart model with both exterior and interior surfaces, iteratively validated against real TEE video clips across all 20 standard views.
- **Rendering:** Sectioning/cutaway -- users can remove portions of the model above the echo plane to reveal internal structures. Also shows "luminal casts" of chambers.
- **Motion:** Not dynamically animated; static model with selectable views.
- **Interactivity:** NOT continuous probe manipulation. Discrete view selection only.
- **Key insight:** The model was iteratively adjusted until cross-sections matched real TEE images for all 20 standard views. Real TEE video served as ground truth for model validation, not as the rendering source.

### CT2TEE (AGH University, Krakow)

- **Approach:** 3D models created by hand from CT images, with CT greyscale values converted to mimic TEE tissue appearance.
- **Rendering:** CT volume reslicing with ultrasound artifact simulation (noise table in polar coordinates overlaid on the view, sector mask). Ray-tracing considered for advanced effects.
- **Limitation:** Not real-time in the web version; two versions (downloadable with CT data, and web-based).
- **Key insight:** CT2TEE acknowledges that CT and ultrasound are based on different physical phenomena and require explicit greyscale conversion and artifact synthesis.

### Research Systems (Ullrich et al., 2014; Salehi et al., 2015)

- **Approach:** Ray-based ultrasound simulation from segmented CT/MRI volumes. GPU Monte Carlo path tracing through NanoVDB tissue volumes.
- **Rendering:** View-dependent ultrasonic effects (occlusion, large-scale reflections, attenuation) combined with speckle patterns derived from wave-based model of ultrasound propagation. COLE algorithm for Point-Spread-Function convolution with scatterer distributions. Tissue boundaries represented via signed distance functions.
- **Performance:** >10,000 synthetic images per hour on NVIDIA Quadro K5000.
- **Key insight:** Physically-based ultrasound simulation from segmentation labels is feasible in real-time, but requires per-label acoustic property tables and sophisticated GPU implementations.

### Summary of Industry Approaches

| System | Data Source | Model Type | Motion | Valve Detail | Ultrasound Appearance |
|--------|-----------|-----------|--------|-------------|---------------------|
| HeartWorks | None (artist-created) | Bespoke polygonal model (135 structures) | Full cardiac cycle | Leaflets, chordae, papillary muscles | Synthesized from model geometry |
| Virtual TEE Toronto | None (validated against TEE clips) | Custom 3D model | Static | Interior surfaces modeled | Sectioned model display |
| CT2TEE | ECG-gated cardiac CT | Hand-refined from CT | Limited | Not explicit | CT reslice + artifact overlay |
| Ullrich et al. | Segmented CT/MRI | Label volume + SDF | Optional | If segmented | GPU Monte Carlo path tracing |

**Universal pattern:** Every successful TEE simulator either uses a purpose-built 3D model or requires contrast-enhanced cardiac CT with extensive post-processing. None renders non-contrast thoracic CT directly.

---

## Approach Evaluation

### APPROACH A: Better Source Data (Contrast-Enhanced Cardiac CTA)

**Concept:** Replace the non-contrast LCTSC thoracic CT with an ECG-gated, contrast-enhanced cardiac CTA. IV contrast raises blood pool HU to 300-500 (vs myocardium ~100), making chambers clearly visible.

**Data sources:**

| Dataset | Size | Format | License | Chambers Visible? |
|---------|------|--------|---------|------------------|
| TotalSegmentator CT (selected CTA cases) | ~1500 CT total, subset are CTA | NIfTI | CC BY 4.0 (base task) | Yes, if CTA case selected |
| ImageCAS | 1000 CCTA | DICOM/NIfTI | Verify (research) | Yes (coronary-focused but whole heart visible) |
| MM-WHS | 60 CT + 60 MRI | NIfTI | Challenge-only, no redistribution | Yes (7 substructure labels) |
| WHS++ (CARE 2024) | 104 CT/CTA + 102 MRI | NIfTI | Registration-gated challenge | Yes |
| Public Cardiac CT (LAA) | 1000 CCTA (ImageCAS-derived) | NIfTI | MIT (code), verify volumes | Yes + LAA, PV, coronary detail |
| PROMISE trial 4D CT | 32 patients, 10 phases | DICOM | Via TCIA | Yes, ECG-gated with motion |

**TotalSegmentator heartchambers_highres:** Segments LV, RV, LA, RA, myocardium, aorta, PA individually at sub-millimeter resolution. However, non-commercial license restriction applies. The base TotalSegmentator "total" task (CC BY 4.0) includes coarser heart chamber labels that may be sufficient for MVP.

**What the user would see:** CT reslice where blood pool is bright and myocardium is darker, with clear chamber delineation. With label overlay, four chambers are color-coded. Still no valve leaflets (CTA resolution ~0.5mm is borderline for leaflets). No motion unless 4D CTA is used.

| Criterion | Score |
|-----------|-------|
| Feasibility | **5/5** -- Straightforward pipeline change; swap input volume |
| Time to implement | **1-2 weeks** -- Find suitable CTA, run TotalSegmentator, generate VTI + label VTI |
| Clinical accuracy for TEE training | **3/5** -- Chambers clearly visible, great vessels excellent. No valves, no motion. Not echo appearance |
| Data availability | **4/5** -- Multiple public CTA datasets exist. Bundle-safe options require careful license verification |
| Licensing risk | **Medium** -- heartchambers_highres is non-commercial; base task labels are CC BY 4.0 |

### APPROACH B: Synthetic/Atlas Heart Model

**Concept:** Replace or augment the CT-derived rendering with a pre-built 3D anatomical heart model that includes chambers, valves, chordae, and papillary muscles.

**Model sources:**

| Model | Detail Level | Valve Leaflets | Motion | License | Cost |
|-------|-------------|---------------|--------|---------|------|
| Zygote 3D Heart | Very high (AV valves with cusps, chordae tendineae, trabeculae, papillary muscles) | Yes | Optional animation cycle | Commercial license, call for pricing | ~$500-5000 estimated |
| HRA (Human Reference Atlas) | Moderate (chambers, septa, some internal detail) | Limited | No | CC BY 4.0 | Free |
| BodyParts3D | Coarse (organ-level) | No | No | CC BY 4.0 | Free |
| Open Anatomy Thorax | Moderate (labeled surfaces) | No | No | 3D Slicer License section B | Free |
| DocJana Animated Heart | Moderate (13K polys, 25 morphs, corrected valves) | Basic | Yes (cardiac cycle morph targets) | Commercial (model), CC (renders) | ~$50-200 |
| Sketchfab community models | Variable | Variable | Some | Various (CC, paid) | Free to ~$100 |
| XCAT Phantom | Very high (NURBS, chambers, valves, coronaries, chordae, papillary muscles) | Yes | Full 4D cardiac cycle, respiratory | Licensed (request from Duke CVIT) | Free for academic |

**What the user would see:** A 3D polygonal heart model rendered in the browser. When resliced along the imaging plane, the cross-section reveals chamber walls, septal structures, and (if the model has them) valve leaflets. This is what HeartWorks and Virtual TEE Toronto do.

| Criterion | Score |
|-----------|-------|
| Feasibility | **3/5** -- Model integration is moderate complexity. Registration to patient anatomy requires ICP/landmark alignment. Reslicing a polygonal model to produce echo-like 2D views requires custom rendering (not just vtkImageReslice). |
| Time to implement | **4-8 weeks** -- GLB loading (1w), model-to-patient registration (2-3w), cross-section rendering pipeline (2-3w), valve geometry authoring/tuning (1-2w) |
| Clinical accuracy for TEE training | **4/5** -- With a high-quality model (Zygote or XCAT), valve leaflets and chordae are visible. Anatomy is idealized/atlas-based, not patient-specific |
| Data availability | **3/5** -- HRA is free/CC BY 4.0. Zygote requires commercial license. XCAT requires academic request from Duke |
| Licensing risk | **Low-Medium** -- HRA is clean. Zygote is proprietary. XCAT requires license agreement |

### APPROACH C: Hybrid CT + Parametric Heart Model

**Concept:** Use the CT volume for thorax context (esophagus, aorta, lungs, spine -- all things the probe must navigate past) and overlay a parametric heart model at the heart location to provide intracardiac detail.

**How it works:**
1. CT-derived VTI for the thoracic envelope and probe path context
2. A 3D heart model (HRA, Zygote, or custom) registered to the CT heart centroid and oriented to match cardiac axis
3. For the pseudo-TEE view: reslice both the CT volume AND the heart model at the imaging plane, then composite them
4. CT provides the "where am I in the chest" spatial context; model provides "what cardiac structures does this plane cut through"

**Registration approach:** Landmark-based affine registration using 4-6 cardiac landmarks (LV apex, mitral annulus centroid, aortic root, RV insertion points) derived from TotalSegmentator chamber labels on the CT.

**What the user would see:** The 3D scene shows the CT-derived thorax with a detailed heart model nested inside. The pseudo-TEE pane shows a composite: CT-derived tissue texture in the background with model-derived chamber boundaries, valve structures, and structural annotations overlaid. This is essentially what TeeSim already does with label overlay, but with a much richer underlying model.

| Criterion | Score |
|-----------|-------|
| Feasibility | **4/5** -- Most complex approach, but builds incrementally on existing infrastructure |
| Time to implement | **6-10 weeks** -- CTA integration (2w) + model loading (1w) + registration (2-3w) + composite rendering (2-3w) + tuning (1w) |
| Clinical accuracy for TEE training | **5/5** -- Best of both worlds: patient-specific thorax geometry for spatial reasoning, model-derived intracardiac detail for structure recognition |
| Data availability | **3/5** -- Depends on model source (same as Approach B) |
| Licensing risk | **Medium** -- Same as Approach B |

### APPROACH D: Direct 3D/4D TEE Data

**Concept:** Skip the CT-derived pipeline entirely. Load real 3D TEE DICOM volumes and render them directly using vtkImageData reslicing.

**How it works:**
1. Import 3D TEE DICOM (e.g., Philips iE33/EPIQ X-Matrix probe, 3D volume datasets)
2. Convert to vtkImageData (dcmjs or Cornerstone3D)
3. Reslice at arbitrary planes -- this is actual echo data, so appearance is inherently realistic
4. The probe model still applies, but the "heart" is the echo volume, not a CT volume

**Data availability:**
- MITEA dataset (CC BY-NC-SA 4.0, no redistribution without consent) -- 3D echocardiography
- MVSeg2023 (CC BY-NC-ND 4.0) -- 3D TEE with mitral valve annotations
- CETUS (registration-gated) -- 3D ultrasound volumes
- Own clinical 3D TEE data (if available)
- None of these are bundle-safe for a public web app

**What the user would see:** Actual echocardiographic images with real speckle patterns, real valve motion (if 4D), real chamber appearance. This is the gold standard for visual realism -- but it abandons the CT-derived spatial training concept.

| Criterion | Score |
|-----------|-------|
| Feasibility | **3/5** -- DICOM 3D echo parsing is complex (vendor-specific formats). 4D temporal handling adds significant complexity |
| Time to implement | **8-14 weeks** -- dcmjs/Cornerstone3D integration (3-4w), vendor-specific DICOM handling (2-3w), 4D temporal sync (2-3w), new probe model for echo-based navigation (2-3w) |
| Clinical accuracy for TEE training | **5/5** -- It IS real echo data. Maximum visual realism |
| Data availability | **1/5** -- No bundle-safe public 3D TEE datasets exist. All available datasets have non-commercial or no-redistribution terms |
| Licensing risk | **High** -- Cannot ship any public 3D TEE data in the web bundle |

---

## Approach Comparison Matrix

| | A: Better CT | B: Atlas Model | C: Hybrid CT+Model | D: Direct 3D TEE |
|---|---|---|---|---|
| **Feasibility** | 5 | 3 | 4 | 3 |
| **Time (weeks)** | 1-2 | 4-8 | 6-10 | 8-14 |
| **Chamber visibility** | Excellent (CTA) | Excellent | Excellent | Excellent |
| **Valve leaflets** | None | Yes (if model has them) | Yes (from model) | Yes (real echo) |
| **Cardiac motion** | Only with 4D CTA | With animated model | With animated model | Yes (if 4D data) |
| **Echo appearance** | CT appearance (not echo) | Sectioned model (not echo) | Composite (not echo) | Real echo |
| **Spatial training value** | High (real patient anatomy) | Medium (idealized atlas) | High (patient thorax + detailed model) | Medium (echo-only, no CT context) |
| **Data licensing** | Moderate risk | Low-Medium | Low-Medium | High risk |
| **Incremental from current** | Very easy | Moderate | Moderate-Hard | Hard (architectural pivot) |

---

## Cardiac Motion: Cross-Cutting Concern

All approaches except D require explicit motion modeling. Available options:

### Option M1: ED/ES Blendshape (Simplest)

- Segment cardiac structures at end-diastole (ED) and end-systole (ES) from 4D data
- Generate two mesh states per chamber
- Interpolate vertex positions with a sinusoidal cardiac cycle curve
- Source: Sunnybrook (CC0/public domain) provides ED/ES pairs for LV
- Effort: 2-3 weeks
- Result: Coarse systolic contraction visible. Not physiologically accurate for valve motion

### Option M2: LDDMM Deformation Fields (Moderate)

- Use Large Deformation Diffeomorphic Metric Mapping from 4D cardiac CT
- Malin et al. (2025) created 32 4D beating heart models from PROMISE trial data using MC-LDDMM with cubic spline interpolation
- Per-vertex displacement fields across 10+ cardiac phases
- These models will be publicly available via the XCAT phantom distribution
- Effort: 4-6 weeks (if pre-computed fields available)
- Result: Realistic wall motion. Valve motion requires additional modeling

### Option M3: HEARTBEAT4D Pipeline (Moderate-High)

- Open-source 3D Slicer module that propagates segmentation across all cardiac phases of 4D CT
- Exports per-phase OBJ meshes for Unity/web
- Requires 4D cardiac CT input (PROMISE, own data)
- Effort: 4-8 weeks
- Result: Per-phase cardiac meshes that can be loaded as morph targets

### Option M4: Parametric Valve Animation (for Model-Based Approaches)

- For atlas/model-based approaches (B, C), valve motion can be driven by parametric curves
- Mitral valve: leaflet opening angle driven by E-wave/A-wave timing from Wiggers diagram
- Aortic valve: leaflet opening driven by systolic ejection phase
- Source: Published hemodynamic timing data; DocJana's 25-morph cardiac cycle as reference
- Effort: 3-5 weeks
- Result: Visually convincing valve motion synchronized to cardiac phase

---

## Recommended Strategy: Phased Hybrid Approach (A then C)

The recommendation is a two-phase strategy that delivers immediate improvement (Phase 0) and builds toward full realism (Phase 1-2):

### Phase 0 (Weeks 1-3): APPROACH A -- Better Source Data

**Goal:** Make chambers visible immediately.

**Actions:**
1. **Select a contrast-enhanced CTA case from TotalSegmentator's public dataset.** The TotalSegmentator CT dataset (CC BY 4.0) includes ~1500 cases; a subset are contrast-enhanced CTA. Identify 1-3 CTA cases with clear cardiac contrast.
2. **Run TotalSegmentator "total" task** (CC BY 4.0, no commercial restriction) to segment LV, RV, LA, RA, aorta, PA, esophagus, spine, lungs. The base "total" task already includes heart chamber labels.
3. **Generate new VTI + label VTI** using the existing pipeline for the selected CTA case.
4. **Tune pseudo-TEE windowing** for CTA contrast levels (window center ~200 HU, width ~600 HU for blood-myocardium contrast).
5. **Validate:** Show the ME 4C view to a cardiac anesthesiologist. The four chambers should be clearly distinguishable.

**Exit criteria:** A clinician can identify LV, RV, LA, RA in the ME 4C pseudo-TEE view.

**Effort:** 1-2 weeks.

### Phase 1 (Weeks 4-8): Structure-Aware Pseudo-Echo Rendering

**Goal:** Make the pseudo-TEE look more like echocardiography.

**Actions:**
1. **Structure-aware speckle synthesis** from label VTI: assign per-label acoustic properties (echogenicity, scatterer density) and generate speckle patterns. Blood pool = low echogenicity (dark with fine speckle), myocardium = moderate echogenicity (brighter, coarser speckle), pericardium = high echogenicity (bright line).
2. **Boundary enhancement:** Compute signed distance fields from label boundaries; render bright specular reflection at tissue interfaces (mimics acoustic impedance mismatch).
3. **Depth-dependent attenuation:** Exponential decay with depth, tissue-type-dependent attenuation coefficients.
4. **Sector geometry refinement:** Near-field clutter, lateral resolution degradation with depth, time-gain compensation curve.
5. **ED/ES cardiac motion** using Sunnybrook data: two-state blendshape for LV, coarser motion for other chambers.

**Exit criteria:** A clinician says the pseudo-TEE "looks somewhat like echo" rather than "looks like a CT slice."

**Effort:** 4-6 weeks.

### Phase 2 (Weeks 9-16): APPROACH C -- Hybrid CT + Heart Model

**Goal:** Add valve leaflets and realistic cardiac motion.

**Actions:**
1. **Integrate a detailed heart model.** Candidate: HRA 3D heart (CC BY 4.0, free) as baseline. If valve detail is insufficient, evaluate Zygote (commercial) or request XCAT academic license.
2. **Landmark-based registration** of the heart model to the CTA anatomy using chamber centroids from TotalSegmentator labels.
3. **Composite rendering pipeline:** CT-derived background texture + model-derived structural overlay in the pseudo-TEE pane.
4. **Parametric valve animation:** Mitral and aortic valve leaflet motion driven by cardiac phase timing curves.
5. **Multi-phase cardiac motion:** Either LDDMM fields from published 4D models, or HEARTBEAT4D pipeline applied to a 4D CTA case.

**Exit criteria:** Valve leaflets visible in ME 4C, ME 2C, ME LAX, and ME AV SAX views. Cardiac cycle animation at ~1 Hz cycle rate.

**Effort:** 6-10 weeks.

### Phase 3 (Weeks 17+): Optional -- Direct 3D TEE Route (APPROACH D)

**Goal:** Support real echo data for institutions that have 3D TEE DICOM.

**Actions:**
1. DICOM 3D/4D echo import via dcmjs or Cornerstone3D.
2. Dual-mode rendering: CT-derived spatial trainer (default) OR echo-derived realism mode.
3. This is a product differentiation feature, not a prerequisite.

---

## Concrete Next Steps (This Week)

### Step 1: Find a Bundle-Safe CTA Case

Search the TotalSegmentator CT dataset on Zenodo for a contrast-enhanced cardiac CTA case:
- Download the dataset index / metadata
- Filter for "contrast" or high mean HU in the heart ROI
- Select 1 case with good cardiac contrast (blood pool HU > 200)
- Verify CC BY 4.0 license covers this specific case

### Step 2: Run Segmentation Pipeline

```bash
# Run TotalSegmentator base "total" task (CC BY 4.0)
TotalSegmentator -i case.nii.gz -o segmentations/ --task total

# Key output labels:
# heart_atrium_left, heart_atrium_right
# heart_ventricle_left, heart_ventricle_right
# heart_myocardium, aorta, pulmonary_artery
# esophagus, stomach, vertebrae, ribs, lungs
```

### Step 3: Generate VTI Assets

Use the existing NIfTI-to-VTI pipeline to produce:
- `heart_roi.vti` -- CTA intensity volume (heart ROI)
- `heart_labels.vti` -- Label volume with chamber segmentation
- Update `probe_path.json` and `views.json` if anatomy differs significantly

### Step 4: Update Pseudo-TEE Rendering Parameters

In `PseudoTeePane.tsx`, update `DEFAULT_APPEARANCE`:
```typescript
// CTA contrast: blood ~300-500 HU, myocardium ~100-150 HU
// Window to maximize blood-myocardium contrast
windowLow: -100,
windowHigh: 500,
```

### Step 5: Validate with Clinician

Generate ME 4C, ME 2C, ME LAX, and TG SAX screenshots from the new CTA case. Send to the cardiac anesthesiologist for feedback.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| No suitable CTA case in TotalSegmentator open dataset | Medium | High | Fallback: ImageCAS dataset (verify license), or Public Cardiac CT (LAA) dataset |
| TotalSegmentator base "total" task labels too coarse for chambers | Low | Medium | Use heartchambers_highres for internal research (non-commercial OK), ship only base-task labels |
| Heart model registration to CT anatomy is poor | Medium | Medium | Use additional landmarks (valve annulus planes, LV long axis); iterative manual adjustment in 3D Slicer |
| Valve model detail insufficient in free models (HRA) | High | Medium | HRA may lack leaflet-level detail. Mitigation: request XCAT academic license, or author minimal valve geometry in Blender from TEE reference images |
| Performance: composite rendering too slow for real-time | Low | High | Pre-composite label+model at build time; ship pre-blended VTI rather than runtime compositing |

---

## References

- HeartWorks Simulator -- https://surgicalscience.com/simulators/heartworks/
- Virtual TEE Toronto -- http://pie.med.utoronto.ca/TEE/index.htm
- CT2TEE AGH -- https://www.ct2tee.agh.edu.pl/
- TotalSegmentator -- https://github.com/wasserth/TotalSegmentator
- TotalSegmentator heartchambers_highres -- https://www.sciencedirect.com/science/article/pii/S0720048X25000920
- Human Reference Atlas 3D -- https://humanatlas.io/3d-reference-library
- XCAT Phantom -- https://cvit.duke.edu/resource/xcat-phantom-program/
- Malin et al. 2025, "Library of realistic 4D digital beating heart models" -- https://pmc.ncbi.nlm.nih.gov/articles/PMC12409789/
- HEARTBEAT4D -- https://github.com/mikebind/Heartbeat4D
- Cardiac ultrasound simulation (Monte Carlo) -- https://pmc.ncbi.nlm.nih.gov/articles/PMC11347295/
- Ullrich et al. "Real-Time Simulation of Transesophageal Echocardiography" -- https://pubmed.ncbi.nlm.nih.gov/24732551/
- osamamalik TEESimulator -- https://github.com/osamamalik/TEESimulator
- ImageCAS / Public Cardiac CT (LAA) -- https://github.com/Bjonze/Public-Cardiac-CT-Dataset
- 4D CardioSynth (MICCAI 2025) -- https://papers.miccai.org/miccai-2025/0004-Paper2701.html
- Sunnybrook Cardiac Data -- https://www.cardiacatlas.org/sunnybrook-cardiac-data/
- Zygote 3D Heart -- https://www.zygote.com/poly-models/3d-human-circulatory/3d-human-heart
- MVSeg2023 (3D TEE mitral valve) -- https://huggingface.co/datasets/pcarnahan/MVSeg2023
- DocJana animated heart -- https://docjana.com/cardiac-cycle/
- SlicerHeart valve modeling -- https://pmc.ncbi.nlm.nih.gov/articles/PMC9254695/
