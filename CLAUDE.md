# CLAUDE.md — TeeSim Agent Guidance

## Domain Glossary

| Term | Meaning |
|------|---------|
| TEE | Transesophageal Echocardiography — ultrasound probe placed in the esophagus |
| TTE | Transthoracic Echocardiography — external chest probe |
| ME | Mid-Esophageal probe station |
| UE | Upper Esophageal probe station |
| TG | Transgastric probe station (probe advanced into the stomach) |
| DTG | Deep Transgastric probe station |
| ME 4C | Mid-Esophageal Four-Chamber view |
| ME 2C | Mid-Esophageal Two-Chamber view |
| TG SAX | Transgastric Short-Axis view |
| ASE 28 views | The 28 standard TEE views defined by the American Society of Echocardiography comprehensive adult TEE guidelines |
| Probe DOF | Probe degrees of freedom: position `s` on esophageal centerline + axial roll + ante/retro flex + lateral flex + omniplane angle |
| LV / RV | Left / Right Ventricle |
| LA / RA | Left / Right Atrium |
| LAA | Left Atrial Appendage |
| PV | Pulmonary Vein |
| AO | Aorta |
| PA | Pulmonary Artery |
| GLB | Binary glTF (browser-ready 3D mesh format) |
| VTI | VTK Image Data (volume format for oblique reslicing) |
| NIfTI | Neuroimaging Informatics Technology Initiative format — internal pipeline format |
| DICOM | Digital Imaging and Communications in Medicine — clinical standard |
| ED / ES | End-Diastole / End-Systole |

## Tech Stack

- **Browser rendering**: VTK.js (primary), Three.js/R3F (candidate for lightweight mode), WebGPU (future)
- **Offline asset factory**: 3D Slicer + SlicerHeart (case preparation, standard view authoring, mesh/label export)
- **State management**: TBD (see ADR-0001)
- **Framework**: TBD (see ADR-0001)

## Data Formats

| Context | Format |
|---------|--------|
| Web — 3D meshes | GLB/glTF |
| Web — volume reslicing | VTI |
| Web — metadata, views, landmarks | JSON |
| Internal pipeline — images | DICOM, NIfTI/NRRD |
| Internal pipeline — segmentations | NIfTI label maps |
| Motion curves | Binary float32 arrays or JSON |

## Document Surfaces

| Surface | Purpose |
|---------|---------|
| `docs/product/` | Stable product intent — overview, personas, goals, principles |
| `docs/decisions/` | ADRs — long-lived architecture decisions, format `ADR-NNNN-slug.md` |
| `docs/research/` | Dated exploratory notes, format `YYYY-MM-DD-slug.md` |
| `docs/runbooks/` | Repeatable operating procedures |
| `changes/<id>-slug/` | Active multi-step work; removed from default branch after merge |

## Data Governance

All datasets are classified into four buckets:

| Bucket | Definition | Examples |
|--------|-----------|---------|
| **Bundle-safe open** | License clearly permits redistribution/reuse or public domain | Open Anatomy Thorax, HRA 3D organs, SIO, TotalSegmentator CT, Sunnybrook |
| **Maybe / verify-first** | Public download, but bundling/commercial terms unclear | BodyParts3D (version mix), LCTSC, SegTHOR, HVSMR-2.0, ACDC, CAMUS |
| **Internal research only** | Explicit non-commercial, no-distribution, challenge-only terms | MM-WHS, MITEA, EchoNet-Dynamic, MVSeg2023, TotalSegmentator restricted subtasks |
| **Licensed / owned** | Contract, license, or self-collected de-identified data | XCAT, own CT/MR/3D/4D TEE cohort |

Never put Internal-research-only or unverified datasets into the public web bundle. Ship derived meshes, labels, motion tracks, and landmarks — not raw volumes.

## Workflow

1. Read `changes/` before starting any non-trivial work.
2. For non-trivial changes: create `changes/<issue-id>-slug/` and fill requirements, design, plan, tasks before implementing.
3. Write an ADR in `docs/decisions/` for any architecture choice that is hard to reverse.
4. Promote durable knowledge before merge; remove change pack in the final PR.

## Testing Expectations

- Probe model: unit tests for 5-DOF kinematics, esophageal centerline sampling, view angle computation
- Rendering: visual snapshot tests for anchor views
- Data pipeline: integration tests for NIfTI → GLB conversion, mesh decimation, landmark placement
- Browser: no backend dependency in MVP; all assets served statically
