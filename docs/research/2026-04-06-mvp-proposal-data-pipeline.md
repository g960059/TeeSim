# MVP Proposal: Data-Pipeline-First Architecture

**Date:** 2026-04-06  
**Status:** Proposed research note  
**Perspective:** Data-pipeline-first  
**Related:** [`docs/product/background.md`](../product/background.md), [`docs/product/goals-non-goals.md`](../product/goals-non-goals.md), [`docs/research/2026-04-06-tee-simulator-public-data-survey.md`](./2026-04-06-tee-simulator-public-data-survey.md)

---

## 1. Executive Summary

The MVP should be built around a strict offline asset factory, not around browser-side improvisation. The browser runtime is intentionally simple: it only loads pre-built `GLB + VTI + JSON + motion.bin` assets and never touches DICOM, segmentation logic, or registration. All anatomy preparation, view authoring, centerline extraction, mesh cleanup, motion retargeting, and bundle validation happen before deployment.

The recommended factory is:

1. Use **3D Slicer + SlicerHeart** as the authoring environment for case review, segmentation cleanup, probe-path QA, and anchor-view authoring.
2. Use **NIfTI label maps** as the internal canonical intermediate, even when the raw source arrives as DICOM.
3. Export browser meshes as **two GLBs per case**:
   - `scene.glb` for coarse thorax context
   - `heart_detail.glb` for motion-enabled cardiac anatomy
4. Export browser volumes as **two VTIs per case**:
   - `heart_intensity.vti` for grayscale oblique reslicing
   - `heart_labels.vti` for pseudo-TEE structure lookup
5. Store probe path, landmarks, and authored views as explicit JSON sidecars instead of hiding them inside mesh metadata.
6. Derive a simplified cardiac motion prior from **Sunnybrook cine MRI**, retarget it to each case, and ship it as `motion.bin`.
7. Validate every public bundle in CI against hard rules: schema validity, file presence, polygon budgets, volume dimensions, centerline QA, motion vertex counts, and license provenance.
8. Publish cases as immutable static assets on a CDN under versioned paths. Do not overwrite case files in place.

This design is opinionated in one important way: the MVP should optimize for **repeatable asset production** and **browser predictability**, not for maximum anatomical detail. The pipeline should produce 1 canonical atlas case and 3 patient-like CT-derived cases reliably before it tries to solve valve leaflets, TEE texture realism, or DICOM runtime ingestion.

---

## 2. Architecture Diagram (ASCII)

```text
                           INTERNAL OFFLINE ASSET FACTORY

 Bundle-safe raw data
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ Open Anatomy Thorax  HRA  SIO  TotalSegmentator CT  Sunnybrook Cine MRI │
 └──────────────────────────────────────────────────────────────────────────┘
                 | ingest + classify + provenance manifest
                 v
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ Normalized internal workspace                                            │
 │ - raw/ copies or pointers                                                │
 │ - NIfTI intensity volumes                                                │
 │ - NIfTI label maps                                                       │
 │ - MRML scene files                                                       │
 │ - dataset provenance JSON                                                │
 └──────────────────────────────────────────────────────────────────────────┘
                 | 3D Slicer + SlicerHeart authoring
                 | segmentation cleanup, registration, landmarks, views
                 v
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ Structured intermediates                                                 │
 │ - cleaned label maps                                                     │
 │ - authored landmarks                                                     │
 │ - esophagus/stomach mask                                                 │
 │ - probe centerline                                                       │
 │ - cardiac ROI crop                                                       │
 │ - chamber/base meshes                                                    │
 └──────────────────────────────────────────────────────────────────────────┘
          |                         |                         |
          |                         |                         |
          v                         v                         v
 ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────────┐
 │ Mesh pipeline    │     │ Volume pipeline  │     │ Motion pipeline      │
 │ VTP -> decimate  │     │ crop/resample    │     │ Sunnybrook ED/ES     │
 │ -> GLB           │     │ -> VTI           │     │ -> retarget -> BIN   │
 └──────────────────┘     └──────────────────┘     └──────────────────────┘
          \                         |                         /
           \                        |                        /
            \                       |                       /
             v                      v                      v
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ Bundle assembly                                                          │
 │ case_manifest.json  landmarks.json  probe_path.json  views.json         │
 │ scene.glb  heart_detail.glb  heart_intensity.vti  heart_labels.vti      │
 │ motion.bin  appearance.json                                               │
 └──────────────────────────────────────────────────────────────────────────┘
                 | validation + hashes + version stamping
                 v
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ Versioned public bundle                                                  │
 │ /cases/<bundle-version>/<case-id>/...                                    │
 └──────────────────────────────────────────────────────────────────────────┘
                 | static sync
                 v
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ CDN / object storage                                                     │
 │ immutable assets, short-TTL manifest, Brotli/gzip, no raw datasets       │
 └──────────────────────────────────────────────────────────────────────────┘
                 | HTTP GET
                 v
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ Browser app                                                              │
 │ VTK.js reslice + 3D scene + pseudo-TEE lookup from labels                │
 └──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Breakdown

| Stage | Inputs | Processing | Outputs | Primary tools |
|------|--------|------------|---------|---------------|
| 0. Intake and governance | Raw dataset files, license notes, case-selection list | Classify each source as bundle-safe / verify-first / internal / licensed. Record attribution and raw file fingerprints before any build starts. | `provenance.json`, case registry entry | Python scripts, manual review |
| 1. Normalize imaging inputs | DICOM CT, NIfTI CT, atlas meshes, SIO labels, Sunnybrook cine MRI | Convert DICOM to NIfTI when needed, normalize orientation to RAS, preserve original spacing in metadata, resample only when a downstream stage requires it. | `intensity.nii.gz`, `labels_raw.nii.gz`, `source_meta.json` | 3D Slicer, SimpleITK |
| 2. Segmentation cleanup | Raw or imported segmentations | Merge stray fragments, fill small holes, enforce one connected component per expected structure when appropriate, align label IDs to TeeSim structure map. | `labels_clean.nii.gz` | 3D Slicer Segment Editor |
| 3. Canonical scene authoring | Clean labels, atlas meshes, HRA meshes | Assemble case scene in MRML, register atlas meshes for canonical case, verify structure names/colors, define hidden/internal-only layers. | `.mrml`, authored structure map | 3D Slicer, SlicerHeart |
| 4. Esophageal centerline extraction | `esophagus` and proximal `stomach` labels | Create lumen mask, smooth, extract centerline, resample by arc length, compute stable frames, mark UE/ME/TG/DTG station ranges. Build must fail if QA thresholds are not met. | `probe_path.json` | SlicerVMTK or VMTK CLI, Python |
| 5. Landmark authoring | Clean labels, 3D scene, probe path | Mark valve centroids, chamber centroids, aortic arch anchors, bicaval anchors, transgastric landmarks, and any view-specific targets used for QA. | `landmarks.json` | 3D Slicer markups, SlicerHeart |
| 6. View authoring | Probe path, landmarks, anatomy scene | Author the 8 MVP views as explicit `{s, roll, ante, lateral, omniplane}` tuples. Attach target structures and optional phase hints. | `views.json` | 3D Slicer + SlicerHeart |
| 7. Mesh generation and decimation | Clean label maps or imported atlas meshes | Convert structures to closed surfaces, clean topology, smooth lightly, decimate to budget, split into `scene.glb` and `heart_detail.glb`, add stable node names. | `scene.glb`, `heart_detail.glb` | VTK/PyVista, trimesh |
| 8. ROI volume generation | CT intensity, clean labels, landmarks | Crop a cardiac ROI around the heart and posterior mediastinum, resample to fixed isotropic spacing, export intensity and label volumes separately as VTI. | `heart_intensity.vti`, `heart_labels.vti` | 3D Slicer, VTK |
| 9. Motion extraction and retargeting | Sunnybrook cine MRI + contours, target heart mesh | Estimate normalized cardiac phase curve, compute ED->ES displacement prior, retarget chamber-wise displacements to each case mesh, serialize compact float32 field. | `motion.bin`, motion metadata in manifest | SimpleITK/Elastix, NumPy |
| 10. Bundle assembly | All case assets and metadata | Emit manifest, hashes, byte sizes, triangle counts, structure table, compatible app range, and generator commit. | `case_manifest.json`, `appearance.json` | Python |
| 11. Validation and publishing | Completed case bundle | Validate schema, geometry, volumes, budgets, motion alignment, centerline QA, and license fields. Publish only immutable versioned output. | `bundle_manifest.json`, CDN upload | GitHub Actions, internal runner, object storage CLI |

### Mesh decimation strategy and polygon budgets

Use two mesh quality tiers. The coarse scene should carry orientation and teaching context; the heart mesh should carry the anatomy that actually matters for TEE views.

| Asset group | Target triangles | Hard cap | Notes |
|------------|------------------|----------|-------|
| `scene.glb` total | 400k | 500k | Coarse thorax context only |
| Rib cage + sternum + vertebrae | 120k | 150k | Merge bones aggressively |
| Lungs | 60k | 80k | Smooth surfaces tolerate strong decimation |
| Esophagus + stomach | 40k | 50k | Preserve probe corridor shape |
| Liver + body hull + diaphragm proxy | 60k | 80k | Context, not diagnostic detail |
| Arch / descending AO / SVC / IVC / extra-thoracic vessels | 80k | 100k | Keep major teaching vessels only |
| `heart_detail.glb` total | 230k | 300k | Motion-enabled cardiac anatomy |
| LA / RA / LV / RV cavities | 120k | 160k | Chamber silhouettes matter most |
| Myocardium | 60k | 80k | Preserve LV wall thickness and apex shape |
| Aortic root + proximal ascending AO + PA trunk + branch PA | 50k | 60k | Required for AV SAX and RV inflow-outflow views |
| Whole case total | 630k | 800k | Upper bound for 30+ FPS target with volume active |

Decimation rules:

1. Preserve topology before reducing counts. No non-manifold meshes in public output.
2. Decimate bones and coarse organs harder than chambers.
3. Never decimate the esophagus so aggressively that the centerline exits the lumen.
4. Run smoothing before decimation only when it removes segmentation stair-step artifacts; do not erase anatomical landmarks.
5. Do not use Draco or other geometry compression in MVP unless the runtime loader is proven against all target browsers. Prefer plain GLB plus CDN compression first.

### VTI generation targets

The original proposal sketch used one generic `heart_roi.vti`. The MVP should instead emit two VTIs with identical grid geometry:

| File | Scalar type | Purpose | Target geometry | Budget |
|------|-------------|---------|-----------------|--------|
| `heart_intensity.vti` | `int16` | Grayscale oblique slice | `0.8 mm` isotropic, max `250 x 250 x 224` voxels | <= 28 MB uncompressed |
| `heart_labels.vti` | `uint8` | Pseudo-TEE structure lookup | same as intensity volume | <= 14 MB uncompressed |

This split is worth it. Intensity data and discrete labels have different scalar types, different filtering rules, and different runtime consumers.

---

## 4. Data Flow

### 4.1 Raw data to normalized internal intermediates

The pipeline should accept mixed raw sources, but it should not stay mixed internally.

1. **Raw intake**
   - DICOM CT from public/open cases, or prepackaged NIfTI from TotalSegmentator-based sources
   - Atlas meshes and labels from Open Anatomy, HRA, and SIO
   - Sunnybrook cine MRI for motion prior derivation
2. **Canonical internal form**
   - Intensity volumes: `NIfTI` in `RAS`, millimeter units
   - Segmentations: `NIfTI` integer label maps with TeeSim structure IDs
   - Authored scenes: `.mrml`
3. **Why normalize this early**
   - DICOM metadata handling is too variable to keep alive throughout the full build
   - Browser outputs do not benefit from preserving raw DICOM organization
   - Case reproducibility is easier when all downstream scripts read one internal format

### 4.2 Segmentation and authored anatomy

For **patient-like cases**, TotalSegmentator provides the base thorax labels. These are cleaned in Slicer, split into TeeSim structures, and promoted into surfaces plus ROI volumes.

For the **canonical case**, the pipeline is assembly-driven:

1. Open Anatomy Thorax provides the reference thorax frame.
2. HRA meshes provide polished reference organs when the atlas surface quality is better.
3. SIO provides voxel-backed torso and posterior mediastinal label context.
4. A curated manual pass aligns all canonical structures into one consistent RAS scene.

The output of this stage is not yet browser-ready. It is a reproducible authored scene plus cleaned label maps.

### 4.3 Esophageal centerline extraction

The probe path must come from anatomy, not hand-authored eyeballing.

Recommended algorithm:

1. Build a binary lumen corridor from `esophagus + proximal stomach`.
2. Apply binary closing with a small radius to remove segmentation pinholes.
3. Keep the largest connected component.
4. Define one inlet seed near the upper thoracic esophagus and one outlet seed near the gastric cardia.
5. Extract a centerline with VMTK.
6. Resample at `1.0 mm` arc-length spacing.
7. Smooth with a cubic spline constrained to stay inside the lumen.
8. Compute orientation frames with **parallel transport**, not naive Frenet frames, to avoid frame flips in low-curvature segments.
9. Annotate station intervals:
   - `UE`
   - `ME`
   - `TG`
   - `DTG`
10. Run QA:
   - inside-lumen fraction >= `0.97`
   - no negative arc-length steps
   - no local tangent flips > `120 deg` between adjacent samples

If any QA check fails, the build should stop and require a manual correction in Slicer. Do not silently fall back to a guessed spline.

### 4.4 Mesh and volume outputs

Mesh export path:

1. `labels_clean.nii.gz`
2. closed surfaces per structure (`.vtp`)
3. topology cleanup and smoothing
4. decimation to structure budget
5. assembly into:
   - `scene.glb`
   - `heart_detail.glb`

Volume export path:

1. crop a cardiac ROI centered on heart + posterior esophagus corridor
2. resample intensity CT to fixed isotropic spacing
3. crop and resample label map to the exact same geometry
4. export as:
   - `heart_intensity.vti`
   - `heart_labels.vti`

### 4.5 Motion extraction from Sunnybrook cine MRI

The MVP should not attempt patient-specific 4D motion from CT. Use Sunnybrook as a public-domain motion prior and keep the result simple.

Recommended motion build:

1. Select a representative normal cine MRI case with clean contours.
2. Use provided contours to identify ED and ES.
3. Compute a normalized LV volume curve across the cardiac cycle.
4. Register ED to ES with a smooth non-rigid transform.
5. Split the resulting displacement field into chamber-local priors:
   - LV cavity
   - RV cavity
   - LA
   - RA
   - myocardium
6. Retarget these priors onto the static TeeSim heart mesh by chamber label and local coordinate frame.
7. Generate `10` normalized phases across one cardiac cycle.
8. Store displacements as little-endian `float32[phase][vertex][xyz]` in millimeters.

This gives visible chamber contraction without pretending to be a physiologic simulator.

### 4.6 Browser asset schema examples

#### `case_manifest.json`

```json
{
  "schemaVersion": "1.0.0",
  "caseId": "adult_normal_f01",
  "caseVersion": "0.1.0",
  "coordinateSystem": "RAS",
  "units": "mm",
  "bundleVersion": "0.1.0",
  "generator": {
    "pipelineVersion": "0.1.0",
    "gitCommit": "abc1234",
    "generatedAt": "2026-04-06T12:00:00Z"
  },
  "sources": [
    {
      "dataset": "Open Anatomy Thorax Atlas",
      "bucket": "bundle-safe-open",
      "license": "3D Slicer License Section B",
      "artifact": "atlas-thorax-v1"
    },
    {
      "dataset": "Human Reference Atlas 3D",
      "bucket": "bundle-safe-open",
      "license": "CC BY 4.0",
      "artifact": "hra-female-v1.2"
    },
    {
      "dataset": "SIO",
      "bucket": "bundle-safe-open",
      "license": "CC BY 4.0",
      "artifact": "sio-visible-human-male-v1"
    },
    {
      "dataset": "Sunnybrook Cardiac Data",
      "bucket": "bundle-safe-open",
      "license": "CC0",
      "artifact": "sunnybrook-normal-case-07"
    }
  ],
  "assets": {
    "sceneGlb": {
      "path": "scene.glb",
      "triangles": 392144,
      "bytes": 12600482
    },
    "heartDetailGlb": {
      "path": "heart_detail.glb",
      "triangles": 228310,
      "bytes": 8421120,
      "motionTarget": true
    },
    "heartIntensityVti": {
      "path": "heart_intensity.vti",
      "dimensions": [250, 250, 224],
      "spacing": [0.8, 0.8, 0.8],
      "scalarType": "int16"
    },
    "heartLabelsVti": {
      "path": "heart_labels.vti",
      "dimensions": [250, 250, 224],
      "spacing": [0.8, 0.8, 0.8],
      "scalarType": "uint8"
    },
    "motionBin": {
      "path": "motion.bin",
      "phaseCount": 10,
      "vertexCount": 151204,
      "layout": "float32[phase][vertex][xyz]"
    }
  },
  "metadata": {
    "landmarks": "landmarks.json",
    "probePath": "probe_path.json",
    "views": "views.json",
    "appearance": "appearance.json"
  }
}
```

#### `landmarks.json`

```json
{
  "schemaVersion": "1.0.0",
  "coordinateSystem": "RAS",
  "units": "mm",
  "points": [
    { "id": "la-centroid", "structureId": "la", "position": [12.4, -38.1, 66.2] },
    { "id": "lv-centroid", "structureId": "lv", "position": [18.6, -22.4, 34.9] },
    { "id": "mv-center", "structureId": "mitral-plane", "position": [16.1, -30.7, 49.2] },
    { "id": "av-center", "structureId": "aortic-root", "position": [8.2, -44.0, 58.8] },
    { "id": "bicaval-anchor", "structureId": "svc-ivc-axis", "position": [-10.4, -51.0, 70.1] }
  ]
}
```

#### `views.json`

```json
[
  {
    "id": "me-4c",
    "label": "ME Four-Chamber",
    "aseCode": "ME_4C",
    "station": "ME",
    "probePose": {
      "s": 134.0,
      "rollDeg": 8.0,
      "anteDeg": 12.0,
      "lateralDeg": -2.0,
      "omniDeg": 0.0
    },
    "targetStructures": ["la", "ra", "lv", "rv", "mv", "tv"],
    "defaultPhase": 0.2
  }
]
```

#### `probe_path.json`

```json
{
  "schemaVersion": "1.0.0",
  "coordinateSystem": "RAS",
  "units": "mm",
  "sampleSpacingMm": 1.0,
  "points": [
    [5.2, -112.1, 142.3],
    [5.3, -111.4, 141.4],
    [5.4, -110.7, 140.5]
  ],
  "arcLengthMm": [0.0, 1.0, 2.0],
  "frames": [
    {
      "tangent": [0.08, 0.70, -0.71],
      "normal": [0.99, -0.10, 0.03],
      "binormal": [-0.05, -0.71, -0.70]
    }
  ],
  "stations": [
    { "id": "UE", "sRange": [0.0, 70.0] },
    { "id": "ME", "sRange": [70.0, 150.0] },
    { "id": "TG", "sRange": [150.0, 230.0] },
    { "id": "DTG", "sRange": [230.0, 280.0] }
  ],
  "qa": {
    "insideLumenFraction": 0.99,
    "manualCorrection": false
  }
}
```

### 4.7 CDN and static serving strategy

Serve the app shell and the case bundle separately.

Recommended publication layout:

```text
/cases/0.1.0/bundle_manifest.json
/cases/0.1.0/adult_normal_f01/...
/cases/0.1.0/adult_ct_001/...
/cases/0.1.0/adult_ct_002/...
/cases/0.1.0/adult_ct_003/...
```

Rules:

1. Asset URLs are immutable and versioned.
2. `bundle_manifest.json` has a short TTL.
3. Per-case files get long-lived immutable cache headers.
4. Use Brotli or gzip at the CDN level for `JSON`, `GLB`, and `VTI`.
5. Do not publish raw NIfTI, DICOM, MRML, or intermediate segmentations.

Recommended split:

- **App shell**: GitHub Pages, Vercel, or similar static host
- **Case assets**: object storage + CDN

Bundling large case assets directly into every web-app deployment is the wrong default for MVP. It makes releases heavy and obscures asset provenance.

### 4.8 Data versioning

Use three version layers:

1. **Schema version**
   - version of JSON and binary layout contracts
   - bump `MAJOR` when schema changes incompatibly
2. **Bundle version**
   - version of the released public case collection
   - example: `0.1.0`
3. **Case version**
   - version of one case within a bundle
   - allows a corrected case to move from `0.1.0` to `0.1.1` without redefining the entire schema

Every manifest should include:

- pipeline git commit
- generation timestamp
- source dataset list
- source artifact IDs
- file byte counts
- `sha256` per asset in `bundle_manifest.json`

For MVP, keep versioning simple:

- **Git** for code, schemas, and docs
- **Immutable bundle directories** for published assets
- **No DVC or lakeFS yet**

That is the right tradeoff for 4 public cases. Introduce heavier data-versioning tools only after the case library becomes genuinely operationally complex.

---

## 5. Tech Stack Choices

| Concern | Selected choice | Alternatives considered | Rationale |
|--------|------------------|-------------------------|-----------|
| Offline authoring | 3D Slicer + SlicerHeart | pure Python/VTK scripts, ITK-SNAP, commercial planning tools | Slicer is already the project's chosen medical authoring environment and is better for manual QA, markups, and view authoring than a headless-only pipeline |
| Internal image intermediate | `NIfTI` in `RAS` | DICOM-only, NRRD-only | DICOM is essential at intake but too awkward as the universal downstream format. NIfTI is simpler for scripts and label alignment |
| Browser mesh format | `GLB` | OBJ, STL, VTP, PLY | GLB is the right web-facing artifact: compact, single-file, material-capable, CDN-friendly |
| Browser volume format | `VTI` | NIfTI, NRRD | VTI maps directly to VTK.js data structures and avoids repeated browser-side medical-format conversion |
| Mesh packaging | Python VTK/PyVista + `trimesh` scene export | Blender headless export, direct OBJ export from Slicer | Keep the medical geometry logic in Python, not in a DCC tool. Blender adds complexity without solving the core medical-data problems |
| Centerline extraction | VMTK inside or adjacent to Slicer | manual markup spline only, skeletonization only | Probe path quality matters enough that a true centerline method is worth using. Manual spline should be explicit correction, not the default |
| Motion prior | Sunnybrook-based ED->ES retargeted displacement field | static anatomy only, ACDC-based motion, full 4D deformable simulation | Sunnybrook is bundle-safe and good enough for subtle chamber motion. Full physiologic simulation is out of MVP scope |
| Metadata storage | JSON sidecars | embed everything inside GLB extras, custom binary blobs | Probe path and views are first-class educational assets and deserve explicit readable files |
| CDN strategy | object storage + immutable versioned paths | app-host-only static folder, Git LFS | Cases are too large and too separate from the app shell to treat as ordinary web-app source files |
| Data versioning | Git + manifest hashes + immutable bundles | DVC, lakeFS, Pachyderm | Four MVP cases do not justify a heavier data platform yet |

One hard line is worth calling out: do not build the browser around parsing arbitrary DICOM, NRRD, or half-cleaned segmentation exports. The runtime should assume the bundle is already valid and normalized.

---

## 6. MVP Scope

### 6.1 Included datasets

Use exactly these bundle-safe datasets for the public MVP:

| Role | Dataset | MVP use |
|------|---------|---------|
| Canonical thorax frame | Open Anatomy Thorax Atlas | Canonical case thorax layout and baseline labeled anatomy |
| Reference organ meshes | HRA 3D Reference Objects | Canonical case reference lungs and coarse organs where mesh quality is better |
| Voxel torso context | SIO | Canonical posterior mediastinum and torso label context |
| Patient-like anatomy | TotalSegmentator CT dataset | 3 patient-like thorax and cardiac cases from open-safe CT cases only |
| Motion prior | Sunnybrook Cardiac Data | Generic cardiac phase timing and chamber contraction prior |

Do **not** use in the public MVP bundle:

- BodyParts3D
- SegTHOR
- LCTSC
- ACDC
- CAMUS
- MM-WHS
- MITEA
- EchoNet-Dynamic
- MVSeg2023
- XCAT

Some of these may be useful later, but not in the public MVP bundle.

### 6.2 Included structures

The MVP public bundle should include these structures and nothing more ambitious:

| Group | Structures |
|------|------------|
| Probe corridor | esophagus, proximal stomach |
| Thorax context | lungs, liver, rib cage, sternum, thoracic vertebrae, body hull proxy |
| Cardiac chambers | LA, RA, LV cavity, RV cavity, myocardium |
| Great vessels | ascending AO, aortic arch, descending AO, pulmonary trunk, proximal L/R PA, SVC, IVC |

Explicitly out of MVP:

- valve leaflets
- chordae
- papillary muscles
- LAA fine detail
- coronary arteries
- pulmonary veins beyond coarse proximal context
- Doppler or flow fields

### 6.3 Included views

Author exactly these 8 views in `views.json`:

1. ME Four-Chamber
2. ME Two-Chamber
3. ME Long-Axis
4. TG Mid Short-Axis
5. ME Aortic Valve Short-Axis
6. ME RV Inflow-Outflow
7. ME Bicaval
8. ME Aortic Arch Long-Axis

### 6.4 Included processing steps

For each case, run exactly this MVP build sequence:

1. ingest and provenance capture
2. intensity normalization to NIfTI
3. segmentation cleanup and TeeSim structure remapping
4. esophagus/stomach corridor QA
5. centerline extraction and station annotation
6. landmark authoring
7. view authoring
8. mesh export and decimation
9. cardiac ROI crop and VTI export
10. Sunnybrook motion retargeting
11. manifest assembly
12. validation and publishing

The pipeline should not include:

- automatic ASE-28 generation
- pathology-specific geometry synthesis
- runtime DICOM ingestion
- valve-specific motion
- ultrasound appearance learning from restricted datasets

---

## 7. Directory Structure

Recommended repo-side structure:

```text
pipeline/
  README.md
  configs/
    cases.yaml
    structures.yaml
    budgets.yaml
    views_mvp.yaml
  schemas/
    case_manifest.schema.json
    landmarks.schema.json
    probe_path.schema.json
    views.schema.json
    bundle_manifest.schema.json
  slicer/
    import_case.py
    clean_segmentations.py
    author_landmarks.py
    export_surfaces.py
    export_roi_volumes.py
  python/
    build_case.py
    extract_centerline.py
    build_glb.py
    build_motion.py
    assemble_bundle.py
    validate_bundle.py
  fixtures/
    mini_case/
      case_manifest.json
      probe_path.json
      views.json

data/
  raw/                # not committed; local or internal storage mount
  normalized/         # NIfTI, label maps, MRML scenes
  staging/            # temporary VTP, uncropped ROI, debug outputs
  bundles/            # versioned bundle outputs before publish

public/
  cases/
    dev/
      bundle_manifest.json
      adult_normal_f01/
        case_manifest.json
        scene.glb
        heart_detail.glb
        heart_intensity.vti
        heart_labels.vti
        landmarks.json
        probe_path.json
        views.json
        motion.bin
        appearance.json
```

Recommended published CDN structure:

```text
cases/
  0.1.0/
    bundle_manifest.json
    adult_normal_f01/
    adult_ct_001/
    adult_ct_002/
    adult_ct_003/
```

Important boundary:

- `pipeline/`, schemas, configs, and fixtures belong in git
- `data/raw/` and `data/normalized/` do not
- production bundles may be copied into `public/cases/` for local dev, but the source of truth for released assets should be the versioned bundle artifact

---

## 8. Risks & Mitigations

| Risk | Why it matters | Mitigation |
|------|----------------|-----------|
| Esophagus labels are noisy or incomplete | Probe path becomes anatomically wrong and invalidates the core interaction model | Make corridor QA explicit, require inside-lumen fraction threshold, allow manual correction only as a visible authored step |
| Total triangle count grows beyond browser budget | FPS collapses when volume rendering and 3D mesh are shown together | Enforce hard caps in validation, split scene into coarse and detailed GLBs, decimate bones and coarse organs aggressively |
| VTI volumes become too large | GPU memory pressure and slow startup | Fix ROI spacing and maximum dimensions, crop tightly around heart plus posterior mediastinum, validate byte budgets |
| Sunnybrook motion prior looks anatomically mismatched on CT cases | Motion appears fake or distracting | Keep motion subtle, chamber-wise, and educational. Avoid full-surface wobble or valve motion claims |
| Canonical atlas case becomes an inconsistent mesh collage | Mixed sources can look spatially incoherent | Require a curated MRML scene and a single manual canonical alignment pass. Treat the canonical case as authored reference content |
| Public bundle accidentally includes non-public data | Severe governance failure | Every manifest must declare source datasets and license bucket. CI should reject unknown or forbidden buckets |
| Authoring views becomes irreproducible | View presets drift or cannot be regenerated | Store view tuples explicitly in JSON, keep named landmarks, and version the authoring scripts/configs |
| Static hosting hides broken assets until runtime | Users see late failures instead of controlled release failures | Validate GLB loadability, VTI dimensions, manifest references, hashes, and motion sizes before publish |
| Repo CI cannot access raw data | Public CI cannot rebuild full cases end to end | Split build from validation: internal runner builds bundles, public CI validates the produced public artifact and fixture cases |

---

## 9. Effort Estimate

| Pipeline stage | Estimate | Notes |
|---------------|----------|-------|
| Governance intake and provenance manifest | S | Mostly process and schema work |
| DICOM/NIfTI normalization lane | M | Straightforward but needs reproducibility |
| Segmentation cleanup scripts and structure remap | M | Depends on how clean TotalSegmentator case picks are |
| Canonical case assembly from Open Anatomy + HRA + SIO | L | Manual alignment and QA heavy |
| Esophageal centerline extraction and station labeling | M | Moderate implementation complexity, high correctness sensitivity |
| Landmark and view authoring workflow | M | Tooling plus expert review loop |
| Mesh export, cleanup, and GLB packing | M | Mostly engineering detail and budget tuning |
| VTI ROI generation and validation | S | Clear technical path once case geometry is stable |
| Sunnybrook motion extraction and retargeting | L | Highest algorithmic uncertainty in MVP |
| Bundle schema, assembly, and manifest hashing | S | Deterministic engineering work |
| CI validation and CDN publication pipeline | M | Requires split between internal build and public validation |
| End-to-end first-case production | L | First case pays the integration tax for the whole stack |

Overall MVP pipeline effort: **L**.

The long pole is not mesh export or file conversion. It is the combination of:

1. anatomically defensible probe corridor extraction
2. canonical case authoring from mixed public sources
3. motion prior retargeting that is simple enough for MVP but not visually broken

That is exactly why the MVP should be data-pipeline-first. If these three pieces are weak, the browser can be polished forever and still fail as a TEE simulator.
