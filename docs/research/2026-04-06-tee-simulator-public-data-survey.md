# TEE Simulator Public Data Survey

**Date:** 2026-04-06  
**Status:** Complete — feeds into ADR-0001  
**Source:** ChatGPT research session + dataset design table (`tee_anatomical_data_design_table.xlsx`)

---

## Summary

The public and open-access data landscape for a TEE web simulator has been thoroughly assessed. **Conclusion:** The thoracic geometry, probe corridor, and basic cardiac motion can be built strongly from publicly available, bundle-safe data alone. However, intracardiac detail at the level required for valve-level TEE realism, and TEE-like ultrasound appearance, are not yet well-served by bundle-safe public data and will require licensed or self-collected sources for production quality.

Data must be managed in three tiers from the start:
1. **Bundle-safe open** — can ship in the public web app
2. **Internal research only** — used internally for priors/validation, never shipped raw
3. **Licensed / owned** — contract or self-collected clinical data

---

## 1. Dataset Master Table

Full classification of 25 evaluated datasets and tools.

| Priority | Layer | Dataset / Tool | Modality | License | Public Bundle? | Recommended Role | Source URL |
|----------|-------|----------------|----------|---------|---------------|-----------------|-----------|
| P1 | Canonical atlas | Open Anatomy Thorax Atlas | CT-derived atlas | 3D Slicer License section B | Yes | Default labeled chest scene; probe corridor demo; no-patient fallback geometry | https://www.openanatomy.org/atlas-pages/atlas-mauritania-thorax.html |
| P2 | Canonical atlas | BodyParts3D | Polygonal anatomy model | CC BY 4.0 (current archive; legacy site was CC BY-SA 2.1 JP — do not mix versions) | Yes* | Coarse whole-body context, educational labels, fallback organs outside the heart | https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html |
| P1 | Canonical atlas | Human Reference Atlas (HRA) 3D Reference Objects | 3D organ meshes / GLB | CC BY 4.0 | Yes | Sex-specific reference organs; semantic alignment; polished educational anatomy in public build | https://humanatlas.io/3d-reference-library |
| P2 | Canonical atlas | Visible Human Project | Cryosection + CT + MRI | Public domain | Yes | Custom canonical slice generation; cross-sectional anatomy validation; texture reference | https://www.nlm.nih.gov/research/visible/visible_human.html |
| P1 | Canonical atlas | SIO (Segmented Internal Organs of Visible Human Male) | Visible Human-derived 3D voxel model | CC BY 4.0 (review FAQ before redistributing modified versions) | Yes* | High-detail torso labels and canonical slice viewer; useful for posterior mediastinum and organ boundaries | https://www.virtual-body.org/segmented-internal-organs/ |
| P1 | Patient-like thorax backbone | TotalSegmentator CT dataset | CT | CC BY 4.0 (dataset); some higher-detail model outputs have extra commercial restrictions | Yes | Main source for patient-like thorax variability, probe corridor, mediastinum, great vessels, rib cage, stomach/esophagus context | https://doi.org/10.5281/zenodo.10047292 |
| P3 | Patient-like thorax backbone | TotalSegmentator MRI dataset | MRI | CC BY-NC-SA 2.0 (non-commercial) | Maybe | Research-only MR-specific shape prior | https://doi.org/10.5281/zenodo.14710732 |
| P2 | Probe corridor / mediastinum | SegTHOR | CT | Public via challenge materials; redistribution terms not clearly surfaced — verify before bundling | Maybe | Tune esophagus geometry and posterior mediastinum around the probe path | https://competitions.codalab.org/competitions/21145 |
| P2 | Probe corridor / mediastinum | LCTSC | CT | Public TCIA collection; reportedly CC BY 3.0 in publications — verify directly | Maybe | Secondary esophagus/heart geometry for probe corridor validation and thorax diversity | https://www.cancerimagingarchive.net/collection/lctsc/ |
| P2 | Detailed heart morphology | MM-WHS | CT + MRI | Challenge-only; no third-party dissemination; delete within 24 months | **No** | Internal topology prior for chambers/great vessels; benchmarking only | https://zmiclab.github.io/zxh/0/mmwhs/ |
| P3 | Detailed heart morphology | WHS++ (CARE 2024 Track 5) | CT/CTA + MRI | Registration-gated challenge; verify redistribution terms | **No** | Internal robustness benchmarking across centers and modalities | https://www.zmic.org.cn/care_2024/track5/ |
| P2 | Detailed heart morphology | HVSMR-2.0 | CMR | Freely released on figshare; exact bundling license should be confirmed | Maybe | Additional chamber/great-vessel prior; congenital pathology library | https://figshare.com/collections/HVSMR-2_0_A_3D_cardiovascular_MR_dataset_for_whole-heart_segmentation_in_congenital_heart_disease/7074755 |
| P1 | Motion prior | ACDC | Cine MRI | Publicly downloadable; non-commercial use only | Maybe | Derive cardiac motion fields, ED/ES timing, coarse beating-heart templates | https://www.creatis.insa-lyon.fr/Challenge/acdc/databases.html |
| P1 | Motion prior | Sunnybrook Cardiac Data | Cine MRI | Public domain / CC0 | **Yes** | Safe public source for motion priors, LV sanity checks, basic beat-cycle timing | https://www.cardiacatlas.org/sunnybrook-cardiac-data/ |
| P2 | Ultrasound appearance prior | MITEA | 3DE | CC BY-NC-SA 4.0; no copying/distribution without consent | **No** | Internal 3DE appearance prior; LV scan-rescan robustness; pseudo-echo calibration | https://www.cardiacatlas.org/mitea/ |
| P2 | Ultrasound appearance prior | CAMUS | 2D ultrasound | Public download; explicit bundling/commercial terms not clearly surfaced — verify | Maybe | 2D ultrasound appearance prior, segmentation pretraining, pseudo-TEE texture experiments | https://www.creatis.insa-lyon.fr/Challenge/camus/ |
| P2 | Ultrasound appearance prior | EchoNet-Dynamic | 2D ultrasound video | Personal non-commercial research only; no redistribution, no derivatives | **No** | Internal temporal/appearance prior; do not package any raw or derived content | https://echonet.github.io/dynamic/ |
| P2 | Ultrasound appearance prior | CETUS | 3D ultrasound | Registration-based; explicit redistribution license not surfaced | Maybe | 3D ultrasound volume handling, vendor diversity, 3D appearance priors | https://www.creatis.insa-lyon.fr/Challenge/CETUS/databases.html |
| P1 | TEE-specific / valve realism | MVSeg2023 | 3D TEE | CC BY-NC-ND 4.0 | **No** | Internal valve-level realism and view validation for ME mitral views | https://huggingface.co/datasets/pcarnahan/MVSeg2023 |
| P2 | Cross-modal motion validation | Cardiac Atlas Motion Tracking Challenge (2011) | Cine MRI / tagged MRI / 3D US | Open access by attribution; bundling terms worth reviewing | Maybe | Cross-modal motion sanity checks; deformation benchmarking | https://www.cardiacatlas.org/motion-tracking-2011-challenge/ |
| P1 | LA/LAA/PV/coronary detail | Public Cardiac CT Dataset (LAA) | CCTA-derived segmentations | Repo: MIT; raw ImageCAS volumes: separate terms — verify before bundling volumes | Maybe | Excellent for LAA, PV, coronary and interventional LA detail (mTEER/LAAO/AF) | https://github.com/Bjonze/Public-Cardiac-CT-Dataset |
| P2 | LA/LAA/PV/coronary detail | ImageCAS | CTA / CCTA | Clear redistribution license not surfaced — treat as verify-first | **No*** | Raw volume source only after terms review; useful for coronary detail behind segmentation repos | https://github.com/XiaoweiXu/ImageCAS-A-Large-Scale-Dataset-and-Benchmark-for-Coronary-Artery-Segmentation-based-on-CT |
| P1 | Licensed synthetic generator | XCAT Phantom Program | Synthetic anatomical model | Licensed / request-based — not open data | **No** | Fast route to diverse synthetic cohorts, controlled motion, respiratory variation, pathology knobs | https://cvit.duke.edu/resource/xcat-phantom-program/ |
| P1 | Tooling / authoring | SlicerHeart | CT / MRI / 3D/4D US | BSD-3-Clause | Tooling (not data) | Offline asset factory for case preparation, standard view definition, valve analysis, ultrasound import | https://github.com/SlicerHeart/SlicerHeart |
| P1 | Licensed add-on for cardiac detail | TotalSegmentator commercial subtasks | CT/MR segmentation models | Website: commercial use requires explicit rights | **No** | Shortcut to finer chamber/coronary detail under proper license; do not rely on for commercial app without licensing | https://totalsegmentator.com/ |

> **Public Bundle? key:** Yes = bundle-safe. Yes* = usable with attribution/version caveats. Maybe = verify redistribution/commercial terms before bundling. No = keep internal or licensed only. Tooling = authoring tool, not data.

---

## 2. Recommended Stack by Phase

### Public-Bundle MVP

**Must-have:**
- Open Anatomy Thorax Atlas
- HRA 3D organs
- SIO (or Visible Human-derived thorax slices)
- TotalSegmentator CT-derived meshes from open-safe cases (open tasks only)
- Sunnybrook motion prior
- SlicerHeart as asset factory

**Optional:**
- BodyParts3D for broader educational labels
- LCTSC/SegTHOR for extra esophagus QA (after verifying terms)

**Keep out:**
- MM-WHS, MITEA, EchoNet-Dynamic, MVSeg2023, XCAT-licensed content, TotalSegmentator restricted subtasks

**What you ship:** Derived meshes, label volumes, motion curves, landmarks, and a small canonical case library — not the full raw research datasets.

### Research Prototype

Everything in MVP plus: HVSMR-2.0, ACDC, CAMUS, CETUS, Motion Tracking Challenge, Public Cardiac CT (LAA/PV/coronary). MM-WHS and WHS++ as internal-only benchmarking/topology priors if your institution can accept their terms. Still ship only open-safe derived assets.

### Commercial / Product Route

Open-safe public anatomy + your own de-identified CT/MR/3D/4D TEE cohort and/or licensed XCAT. Keep any raw dataset whose terms do not clearly permit redistribution/commercial use out of the bundle.

---

## 3. Data Governance Rules

### Four Buckets

| Bucket | Definition | Storage / Workflow | Ship Raw Data? |
|--------|-----------|-------------------|---------------|
| **Bundle-safe open** | License clearly permits redistribution/reuse, or public domain | May enter public asset build after attribution and provenance tracking | Usually no — prefer derived meshes/labels |
| **Maybe / verify-first** | Publicly downloadable, but bundling/commercial/redistribution terms unclear or mixed | Internal review lane until legal terms confirmed | No |
| **Internal research only** | Terms explicitly restrict use (challenge-only, non-commercial, no-distribution, no-derivatives) | Isolated internal asset factory; access logging; no raw export to app bundle | No |
| **Licensed / owned private** | Contract, license, or self-collected clinical data | Production-grade source of truth for fine detail and final appearance | Only if contract/consent explicitly allows |

### Gap Analysis

| Gap | Why It Matters | Best Current Source | Recommendation |
|-----|---------------|--------------------|----|
| Valve leaflets / annuli / chordae / papillary muscles | Critical for TEE realism and device guidance views | Not well covered by bundle-safe public data | Use internal 3D/4D TEE + CT or licensed data; MVSeg2023 helps only for mitral leaflets and only internally |
| TEE-specific image appearance | Users judge realism from the ultrasound pane | MITEA/CETUS/CAMUS/EchoNet for internal appearance priors | Start with pseudo-TEE rendering from anatomy labels, then learn appearance internally from restricted datasets or own TEE data |
| Adult normal + pathology diversity | Simulator feels repetitive if anatomy never varies | TotalSegmentator CT + Sunnybrook + HVSMR-2.0 + XCAT/private data | Build a small public canonical library now and grow a licensed/private cohort later |
| LAA / PV / coronary detail | Essential for LAAO, AF, mTEER-adjacent left atrial understanding | Public Cardiac CT (LAA) + ImageCAS chain, or licensed/private CTA | Use as an internal high-detail LA library after verifying raw-volume provenance |

---

## 4. MVP Composition Plan

**Cases:**
- 1 canonical case from Open Anatomy + HRA + SIO/Visible Human
- 3 patient-like cases from TotalSegmentator CT (open tasks only, 102-case small subset first)

**Views (8–10 anchor views for MVP):**
- ME Four-Chamber (ME 4C)
- ME Two-Chamber (ME 2C)
- ME Long-Axis (ME LAX)
- Transgastric Short-Axis at mid-LV (TG mid-SAX)
- ME Aortic Valve Short-Axis (ME AV SAX)
- ME RV Inflow-Outflow
- ME Bicaval
- ME Aortic Arch Long-Axis
- (Optional) ME Mitral Valve Commissural / ME Right pulmonary vein

**Motion:** Sunnybrook as cardiac phase prior; simplified ED→ES blendshape per chamber (not full deformable mesh at MVP).

---

## 5. Tech Stack

**Offline asset factory:** 3D Slicer + SlicerHeart
- Import: DICOM, NIfTI, 3D/4D cardiac ultrasound, CT, MRI
- Capabilities: Echo Volume Render, Valve View, valve segmentation/quantification, Philips 4D US patcher, standard view authoring
- Output: meshes, labels, landmarks, probe path

**Browser runtime (MVP):** VTK.js
- GPU volume rendering in browser
- `vtkImageReslice` for arbitrary oblique slices
- ResliceCursorWidget and VolumeClipPlane for synchronized views
- 3-pane UI: pseudo-TEE (left) + 3D anatomy + probe + sector plane (center) + oblique slice (right)

**Phase 2 addition:** Orthanc + DICOMweb + Cornerstone3D/OHIF for real 3D/4D TEE DICOM route.

---

## 6. Probe Model

5 degrees of freedom on the esophageal centerline:

| DOF | Description |
|-----|-------------|
| `s` | Position along esophageal centerline (continuous, defines UE/ME/TG/DTG stations) |
| Roll | Axial rotation |
| Antero/Retro flex | Anteflexion / retroflexion (tip deflection in sagittal plane) |
| Lateral flex | Tip deflection in coronal plane |
| Omniplane | Imaging plane rotation angle (0°–180°) |

Station definitions: UE (upper esophageal), ME (mid-esophageal), TG (transgastric), DTG (deep transgastric). Anchor view presets stored as `views.json` with `{s, roll, ante, lateral, omniplane}` tuples.

---

## 7. Browser Asset File Format

```
cases/
  adult_normal_f01/
    case_manifest.json       # case ID, license, structure list, bounds
    scene.glb                # coarse thoracic anatomy (skeleton, lungs, vessels)
    heart_detail.glb         # high-detail cardiac mesh (chambers, great vessels)
    heart_roi.vti            # intensity volume for oblique reslice
    landmarks.json           # probe path, cardiac landmarks, valve centroids
    probe_path.json          # esophageal/gastric centerline
    views.json               # anchor view presets (s, roll, ante, lateral, omniplane)
    motion.bin               # float32 array: per-vertex displacement × N_phases
    appearance.json          # pseudo-TEE rendering parameters per structure
```

**Internal pipeline:** DICOM + NIfTI/NRRD (never shipped to browser directly).

---

## Related

- ADR-0001: [`docs/decisions/ADR-0001-mvp-architecture.md`](../decisions/ADR-0001-mvp-architecture.md)
- MVP proposals: [`docs/research/`](./)
