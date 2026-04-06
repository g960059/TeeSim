# Data Pipeline Roadmap

**Date:** 2026-04-06  
**Status:** Proposed research note  
**Scope:** TeeSim offline asset pipeline roadmap after the first LCTSC case  
**Inputs:** [`docs/research/2026-04-06-tee-simulator-public-data-survey.md`](./2026-04-06-tee-simulator-public-data-survey.md), [`docs/research/2026-04-06-clinical-validation-v2.md`](./2026-04-06-clinical-validation-v2.md), [`tools/asset-pipeline/process_lctsc_case.py`](../../tools/asset-pipeline/process_lctsc_case.py), [`public/cases/0.1.0/lctsc_s1_006/case_manifest.json`](../../public/cases/0.1.0/lctsc_s1_006/case_manifest.json)

---

## Summary

TeeSim's current pipeline proves that a browser-ready case can be generated from public thoracic CT data, but it is still a one-off demo pipeline rather than a durable case factory.

The biggest current bottlenecks are:

1. the only public case comes from `maybe-verify-first` LCTSC rather than a clearly bundle-safe source
2. RTSTRUCT contour parsing is fill-based and structure-poor
3. the heart is effectively one teaching label, so the pseudo-TEE pane cannot teach chamber-level anatomy
4. the ROI VTI is cropped around the heart centroid, which under-serves TG coverage
5. the probe path and view presets are geometry heuristics rather than anatomy-derived authoring outputs

The clinical review matches the code-level diagnosis. Geometry is often plausible in 3D, but the pseudo-TEE pane does not reliably separate four-chamber, two-chamber, LVOT/aortic, bicaval, or TG SAX anatomy. The roadmap should therefore prioritize anatomy-bearing labels and repeatable multi-case production before chasing higher-fidelity appearance.

---

## Current Pipeline Diagnosis

The current `process_lctsc_case.py` pipeline is useful as a spike, but it hard-codes several assumptions that will not scale:

- RTSTRUCT parsing marks contour vertices in voxel space and then runs 2D `binary_fill_holes()` slice by slice. It is not a true volumetric contour rasterizer.
- Mesh generation runs directly from those masks with fixed smoothing and an 80% decimation target.
- `heart_roi.vti` is a single intensity-only crop centered on the heart centroid with a fixed `200 x 200 x 180 mm` box, then resampled to `0.8 mm` isotropic.
- The probe path is a cubic spline through the esophagus centroid on each axial slice.
- Station ranges are derived from path-length fractions, not anatomy.
- View presets are generated from fixed station heuristics and hard-coded omniplane angles rather than landmarks or valve planes.
- The manifest is case-specific and minimal: no structure inventory, no transforms, no QA metrics, no hashes, and no distinction between intensity and label volumes.

This explains the current failure modes:

- chamber views are not teachable because the pipeline exports no chamber-level label volume
- TG SAX fails because the current crop and preset logic are both biased toward a heart-centered ME use case
- a non-contrast thoracic CT is a weak source for valve-level or LV cavity discrimination unless labels are doing more of the teaching work

---

## Governance Constraint

The public bundle goal in product docs is "bundle-safe open" data only. The current shipped case manifest declares:

- `dataset`: `LCTSC (Lung CT Segmentation Challenge)`
- `bucket`: `maybe-verify-first`
- `license`: `TCIA Data Usage Policy`

That makes the current LCTSC case a valid research/demo case, but not the right foundation for the long-term public default bundle. The safest public-bundle backbone remains the TotalSegmentator CT dataset (`CC BY 4.0`) plus derived assets only.

---

## Effort Scale

Effort below assumes one engineer working in the current repo and existing offline tooling.

- `S`: 1-2 days
- `M`: 3-5 days
- `L`: 1-2 weeks
- `XL`: 2-4 weeks plus clinical or legal dependency

---

## Recommendations

### 1. Add TotalSegmentator chamber-level segmentation

- **Data source:** TotalSegmentator CT dataset (`CC BY 4.0`) for public-bundle cases; optionally run the same segmentation stage on LCTSC or SegTHOR cases for internal comparison after license review.
- **License implications:** Safe for public-bundle use only when the input cases are from the open TotalSegmentator CT dataset and only open-safe tasks/outputs are used. The survey notes that some higher-detail or commercial TotalSegmentator subtasks require separate rights, so TeeSim should not depend on restricted subtasks for the public bundle.
- **Effort:** `L`
- **Pipeline changes needed:** Introduce a normalized NIfTI stage before mesh/volume export, run chamber-level segmentation to produce separate `LV`, `RV`, `LA`, `RA`, `Ao`, and `PA` labels, map those labels onto TeeSim structure IDs, export chamber meshes, and use the same labels to drive a new structure-ID VTI. Add QA checks for missing chambers, disconnected components, and gross volume outliers.

**Recommendation:** Do this early, but not only on the current LCTSC case. Chamber segmentation is the shortest path from "one gray heart label" to teachable chamber anatomy. It should be paired with migration toward TotalSegmentator CT source cases for public release.

### 2. Add a contrast-enhanced CTA lane

- **Data source:** The current survey identifies two concrete public candidates:
  - `Public Cardiac CT Dataset (LAA)`: CCTA-derived segmentations with strong LA/LAA/PV/coronary detail
  - `ImageCAS`: CTA/CCTA source volumes behind much of the public coronary/LAA work
  - `WHS++` can be retained as an internal benchmark only, not as a public-bundle source
- **License implications:** No clearly bundle-safe CTA source was identified in the survey. `Public Cardiac CT Dataset (LAA)` has an MIT-licensed repository, but the upstream raw ImageCAS volumes have separate terms. `ImageCAS` itself is `verify-first` with unclear redistribution surfaced in the survey. That means CTA should enter TeeSim first as an internal/research lane, not as a public default bundle dependency. If CTA becomes product-critical, the cleaner route is licensed or self-collected de-identified CTA.
- **Effort:** `XL`
- **Pipeline changes needed:** Add a separate CTA intake path with dataset-specific provenance metadata, contrast-aware windowing defaults, chamber/vessel harmonization into TeeSim structure IDs, and public-bundle gating that blocks release until license review is complete. Keep raw CTA out of the web bundle and ship only derived meshes, labels, valve planes, and landmarks.

**Recommendation:** Useful for anatomical fidelity, especially aortic root, pulmonary artery, LAA, PV, and coronary-adjacent anatomy, but it should not block the public-bundle roadmap. Treat CTA as a second-lane internal enhancement until governance is clean.

### 3. Generalize to a multi-case batch pipeline

- **Data source:** Start with `3-10` TotalSegmentator CT cases (`CC BY 4.0`) as the bundle-safe public cohort. Keep the existing LCTSC case as a regression or internal QA case, not as the flagship public case.
- **License implications:** Straightforward if the batch stays on TotalSegmentator CT open-safe cases and ships derived assets with attribution in the manifest.
- **Effort:** `L`
- **Pipeline changes needed:** Replace the one-off `process_lctsc_case.py` entry point with a config-driven batch runner. Add per-case config files, deterministic case IDs, structured staging directories, batch summary output, per-case QA reports, and a manifest/index builder that does not hard-code one case ID or source. Split the current script into reusable stages such as `ingest`, `segment`, `build_meshes`, `build_volumes`, `build_centerline`, `build_views`, and `assemble_manifest`.

**Recommendation:** This is core infrastructure, not a convenience feature. Without it, TeeSim cannot reach the documented goal of 3 patient-like public cases.

### 4. Export a separate label VTI with structure IDs per voxel

- **Data source:** Existing segmentation masks from RTSTRUCT, TotalSegmentator, or future CTA labels. No new external dataset is required.
- **License implications:** No new licensing burden. The label VTI is a derived artifact and inherits the governance status of the upstream case.
- **Effort:** `M`
- **Pipeline changes needed:** Export `heart_labels.vti` on the exact same geometry as the intensity VTI, using integer structure IDs rather than grayscale intensities. Add a structure lookup table to the manifest or a small `structures.json` sidecar. Use `uint16` rather than `uint8` so the ID space does not immediately become the next bottleneck. Update the runtime to use labels for pseudo-TEE overlays, stronger structure boundaries, and view-specific highlighting.

**Recommendation:** This is the highest-leverage near-term change. The clinical review explicitly points to "label-guided rendering" as a top priority, and it does not require waiting for CTA.

### 5. Replace centroid-per-slice probe paths with a hybrid centerline workflow

- **Data source:** Esophagus and proximal stomach segmentations from existing CT cases. No new dataset is required, but better stomach coverage improves TG robustness.
- **License implications:** No new data-governance burden. This is a tooling/workflow change, not a source-data change.
- **Effort:** `M`
- **Pipeline changes needed:** Replace the current centroid-per-slice spline with a hybrid workflow:
  - `manual-author-first` for the first few cases using 3D Slicer markups or SlicerHeart/SlicerVMTK review
  - `VMTK-assisted extraction` once esophagus/stomach segmentations are reliable
  - `QA checks` for inside-lumen fraction, tangent flips, station lengths, and point spacing
  - `manual override persistence` so corrected centerlines are first-class artifacts, not ad hoc edits

**Recommendation:** Choose hybrid, not `VMTK`-only and not `manual`-only. The current labels are too crude for blind automation, but centroid-per-slice paths are already a limiting simplification.

### 6. Expand the VTI ROI for TG coverage

- **Data source:** Existing CT plus the same label maps already used for heart and esophagus.
- **License implications:** No additional licensing.
- **Effort:** `S`
- **Pipeline changes needed:** Replace the fixed heart-centered crop with an anatomy-driven crop built from the union of `heart + esophagus + proximal stomach`, then add asymmetric inferior padding so the TG station still sees a meaningful LV short-axis target. If one larger VTI breaks browser budgets, fall back to either:
  - one expanded shared ROI with better compression, or
  - two station-specific ROIs (`ME` and `TG`) with the same schema

**Recommendation:** Do this immediately. It is the cheapest change with a direct path to improving TG SAX, which currently fails even when the 3D station looks correct.

### 7. Estimate valve planes from segmentation

- **Data source:** Chamber and vessel labels from item 1, plus optional manual confirmation in SlicerHeart. CTA improves quality, but coarse valve-plane estimation can start from CT chamber labels.
- **License implications:** No new external source is required if this stays on existing segmented CT cases. If CTA is used to improve annular detail, it inherits CTA's `verify-first` governance.
- **Effort:** `L`
- **Pipeline changes needed:** Derive annulus/valve proxy planes from chamber-vessel interfaces and neighboring landmarks:
  - aortic valve from `LVOT/Ao`
  - pulmonic valve from `RVOT/PA`
  - mitral valve from `LA/LV`
  - tricuspid valve from `RA/RV`
  Export those planes in a dedicated `valves.json` or extend `landmarks.json` with plane center, normal, and radius. Use them later for preset generation and anatomical overlays.

**Recommendation:** This should follow chamber segmentation. Non-contrast CT will not give leaflet realism, but annular plane estimates are still useful for basal view targeting and teaching geometry.

### 8. Generate view presets automatically from anatomy

- **Data source:** Existing case anatomy only: centerline, chamber labels, vessel labels, valve planes, and landmarks. No new external dataset is required.
- **License implications:** No new licensing burden beyond the upstream case source.
- **Effort:** `L`
- **Pipeline changes needed:** Replace the current "station midpoint plus fixed angles" approach with anatomy-seeded preset generation. A practical workflow is:
  - generate candidate probe poses from valve planes and chamber centroids
  - score candidates against desired view anatomy and sector orientation
  - emit `views.auto.json` with confidence and target-structure metadata
  - require manual or clinical approval before promoting candidates into release `views.json`

**Recommendation:** Do not automate this until items 1, 5, and 7 exist. Preset generation is only as good as the anatomy and centerline it is optimizing over.

---

## Priority Order

### Public-bundle path

1. **Label VTI generation**
2. **ROI expansion for TG coverage**
3. **Batch multi-case pipeline**
4. **TotalSegmentator chamber segmentation**
5. **Hybrid centerline workflow**
6. **Valve plane estimation**
7. **Automated view presets**

### Internal/research path

8. **CTA intake lane**, kept internal until source terms are explicitly cleared

This order reflects two constraints:

- the pseudo-TEE pane needs stronger anatomy signal before more cases will matter
- the public bundle should move toward TotalSegmentator CT, not deeper into `verify-first` LCTSC dependency

---

## Recommended 3-Phase Roadmap

### Phase 1: Fix the current teaching bottlenecks

- add `heart_labels.vti`
- expand the ROI for TG coverage
- keep LCTSC as a research regression case until license status is confirmed
- extend `case_manifest.json` with structure inventory, source bucket, and QA metrics

**Expected result:** better pseudo-TEE differentiation on the current case, especially for TG and basal views.

### Phase 2: Build a real public-bundle factory

- move the public cohort to `3-5` TotalSegmentator CT cases
- add chamber segmentation
- convert the pipeline from one-off script to batch processing
- replace centroid-per-slice paths with reviewed centerlines

**Expected result:** repeatable public-bundle case production aligned with product goals and governance rules.

### Phase 3: Add anatomy-driven authoring and high-detail internal data

- derive valve planes
- auto-seed view presets from anatomy
- add a CTA research lane for higher-fidelity left atrial, aortic-root, and great-vessel anatomy

**Expected result:** better standard-view authoring quality and a path toward more realistic valve-level teaching.

---

## Bottom Line

The right next step is not "find one better CT." It is to turn TeeSim's current spike into a two-lane pipeline:

- a **public-bundle lane** built on TotalSegmentator CT plus chamber labels, label VTIs, reviewed centerlines, and batch QA
- an **internal CTA lane** for higher-detail anatomy that is explicitly separated until license and redistribution questions are resolved

If only two changes happen next, they should be:

1. ship a separate structure-ID label VTI
2. replace the one-off script with a multi-case TotalSegmentator-based factory

Those two changes address the current educational failures more directly than any single new dataset.

---

## Related

- [`docs/product/background.md`](../product/background.md)
- [`docs/decisions/ADR-0001-mvp-architecture.md`](../decisions/ADR-0001-mvp-architecture.md)
- [`docs/research/2026-04-06-mvp-proposal-data-pipeline.md`](./2026-04-06-mvp-proposal-data-pipeline.md)
- [`docs/research/2026-04-06-tee-simulator-public-data-survey.md`](./2026-04-06-tee-simulator-public-data-survey.md)
- [`docs/research/2026-04-06-clinical-validation-v2.md`](./2026-04-06-clinical-validation-v2.md)
