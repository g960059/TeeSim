# Goals and Non-Goals

## MVP Goals

- **1 canonical case** derived from Open Anatomy / HRA / SIO public atlas data
- **3 patient-like cases** derived from TotalSegmentator CT open dataset
- **8–10 anchor TEE views** authored as presets (subset of ASE 28 views; ME 4C, ME 2C, ME LAX, TG SAX, ME AV SAX, ME RV inflow-outflow, ME bicaval, ME aortic arch LAX)
- **5-DOF probe model** on esophageal centerline: position `s`, axial roll, anteflexion/retroflexion, lateral flex, omniplane angle
- **Pseudo-TEE slice rendering** — 2D fan-shaped cross-section derived from anatomy labels/volume
- **Synchronized 3D view** — thoracic scene with probe and imaging sector plane
- **Oblique slice** — arbitrary reformat at probe plane
- **Browser-only delivery** — static assets, no backend runtime
- **Open-licensed asset bundle** — only bundle-safe data in public release

## Phase 2 Goals (not in MVP)

- All 28 ASE standard views authored
- Pathology cases (LV dysfunction, mitral regurgitation, aortic stenosis)
- Trainee scoring and progress tracking
- DICOM route — ingest real 3D/4D TEE DICOM via Orthanc + DICOMweb
- Valve-level detail (leaflets, annuli, chordae, papillary muscles)
- LAA/PV/coronary anatomy for LAAO and AF ablation workflows
- Mobile-optimized UI

## Explicit Non-Goals (v1)

- Real-time Doppler simulation (color flow, spectral Doppler)
- Hemodynamic modeling
- Multiplayer or collaborative mode
- AI-assisted diagnosis or auto-labeling during use
- DICOM viewer or PACS integration
- Native mobile app
- Haptic feedback or physical probe simulation
- Pediatric / congenital TEE views
