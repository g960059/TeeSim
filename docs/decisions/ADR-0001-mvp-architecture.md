# ADR-0001: MVP Architecture

**Date:** 2026-04-06
**Status:** Accepted (revised after review)
**Synthesized from:** 4 independent proposals + 3 critical reviews

---

## Context

TeeSim is a browser-based 3D TEE simulator for cardiology education. Four independent architecture proposals were generated in parallel, then reviewed by 3 independent critics:

**Proposals:**
1. [Web-rendering-first](../research/2026-04-06-mvp-proposal-web-rendering.md) — Codex gpt-5.4
2. [Data-pipeline-first](../research/2026-04-06-mvp-proposal-data-pipeline.md) — Codex gpt-5.4
3. [Medical-education-first](../research/2026-04-06-mvp-proposal-medical-education.md) — Claude opus
4. [Platform-architecture-first](../research/2026-04-06-mvp-proposal-platform-architecture.md) — Claude opus

**Reviews:**
- [Architecture critic](../research/2026-04-06-adr-0001-review-architecture.md) — Verdict: Reject (fixable issues)
- [Domain expert](../research/2026-04-06-adr-0001-review-domain.md) — Verdict: Accept-with-changes
- [Pragmatic shipping lead](../research/2026-04-06-adr-0001-review-pragmatic.md) — Verdict: Accept-with-changes

This revision addresses the reviewers' findings. Changes from the original synthesis are marked with **[REV]**.

---

## Decision

### 0. **[REV]** Mandatory First Action: Pseudo-TEE Rendering Spike

Before any other implementation work, complete a **2-3 day standalone spike**:
- Load a test VTI volume in VTK.js
- Produce a sector-masked oblique reslice on a single HTML page
- Validate `vtkImageReslice` interpolation behavior (nearest-only limitation?)
- Test `vtkImageResliceMapper` + `vtkImageProperty` as alternative path
- Evaluate thick-slab reslice via `setSlabNumberOfSlices()` for elevational thickness

**If this spike takes > 5 days or produces unacceptable results, the entire timeline and rendering stack choice must be re-evaluated.** This is the highest-risk technical bet in the project.

### 1. Rendering Engine: VTK.js-primary, R3F optional for 3D scene

Start with VTK.js as the sole renderer. If 3D scene development velocity is too slow after 2 weeks, introduce R3F for the 3D anatomy pane only in a separate canvas. **Never share a WebGL context between VTK.js and Three.js.**

### 2. Framework: React 18 + TypeScript + Vite + Zustand

All proposals agree. WebGL2 baseline.

### 3. **[REV]** State Architecture: ProbePose with explicit units

```typescript
type ProbePose = {
  sMm: number;            // [REV] arc-length position in millimeters (not normalized)
  rollDeg: number;        // axial rotation, degrees
  anteDeg: number;        // anteflexion (+) / retroflexion (-), degrees
  lateralDeg: number;     // lateral flex, degrees
  omniplaneDeg: number;   // imaging plane angle [0, 180], degrees
};
```

**[REV] Critical fix from architecture review:** `s` is defined as arc-length in millimeters (`sMm`), matching `probe_path.json`'s `arcLengthMm` array. A normalized `u ∈ [0,1]` is derived for UI sliders only. This unit is used consistently in `views.json`, `probe_path.json`, `@teesim/core`, and the scoring engine.

### 4. **[REV]** Probe Mechanical Model

**[REV] Added per domain review.** The 5-DOF `ProbePose` is the user-facing control state. The runtime must also model:

- **Shaft frame:** derived from centerline tangent + parallel-transport normal at `sMm`
- **Distal bending section:** configurable arc length (~3-4 cm), applies ante/lateral flex as rotations over this segment
- **Tip frame:** after flex, roll is applied about the shaft axis at the tip
- **Transducer origin:** offset from the tip along the distal axis (~1 cm proximal to the tip)
- **Imaging plane:** omniplane rotation is applied about the transducer axis, not the shaft centerline

`probe_path.json` must carry **parallel-transport reference frames** (not Frenet frames) to avoid frame flips in low-curvature esophageal segments. The `@teesim/core` probe model is the normative implementation of this geometry.

**MVP simplification acknowledged:** The probe is always constrained to the centerline (no radial offset or wall-apposition model). This is disclosed in the UI.

### 5. **[REV]** Anchor Views: 8 required, 2 stretch

**[REV] Compromise between 10 (medical-education), 8 (web-rendering/data-pipeline), and 5 (pragmatic).** 8 views are hard release blockers. 2 additional views ship only if clinically validated within schedule.

**Required (8):**

| # | View | Station | Key DOF |
|---|------|---------|---------|
| 1 | ME Four-Chamber | ME | Position, slight retroflexion |
| 2 | ME Two-Chamber | ME | Omniplane 60-70° |
| 3 | ME Long-Axis | ME | Omniplane 120-140° |
| 4 | TG Mid Short-Axis | TG | Station change, anteflexion |
| 5 | ME AV Short-Axis | ME | Position + omniplane |
| 6 | ME AV Long-Axis | ME | Paired SAX/LAX concept |
| 7 | ME RV Inflow-Outflow | ME | Lateral flex, right heart |
| 8 | ME Bicaval | ME | Roll DOF |

**Stretch (if validated in time):**

| 9 | ME Asc Aortic SAX | UE-ME | Upper esophageal |
| 10 | Desc Aortic SAX + LAX | ME | Posterior anatomy |

**[REV]** Desc Aortic SAX and LAX are stored as **separate scoring targets** in `views.json` even when taught as a combined unit, per domain review.

### 6. **[REV]** Asset Format: Single VTI for MVP, split later

**[REV] Pragmatic review override.** Ship one `heart_roi.vti` (int16 intensity) for MVP. Derive structure identity from mesh-based spatial lookup or a packed label channel. Split to two VTIs only if the single-VTI approach causes measurable quality problems. This halves volume pipeline complexity.

### 7. **[REV]** Pseudo-TEE: "Sectorized Anatomical Slice", not ultrasound

**[REV] Framing change from domain review.** The MVP pseudo-TEE pane produces a **sectorized anatomical cross-section** derived from CT intensity data, not a simulated ultrasound image. The UI must label it accordingly: "CT-derived anatomical slice" or similar. This sets correct trainee expectations.

Minimum viable rendering:
1. Oblique reslice from `heart_roi.vti` via VTK.js
2. Sector wedge mask (fan shape)
3. Depth-dependent grayscale attenuation
4. **[REV]** Thick-slab reslice (~3-5 mm) to approximate elevational beam thickness

Stretch (not required for ship):
- Speckle noise, boundary enhancement, posterior shadowing

### 8. Asset Pipeline: 3D Slicer + SlicerHeart offline factory

Pipeline stages (unchanged):
1. Ingest → normalize to NIfTI RAS-mm
2. Segmentation cleanup
3. **[REV]** Esophageal centerline: **manually author for MVP** using 3D Slicer markup tools + spline fitting. VMTK automated extraction is Phase 1.5 optimization.
4. Landmark and view authoring
5. Mesh export: `scene.glb` + `heart_detail.glb`
6. Volume export: `heart_roi.vti`
7. **[REV]** ~~Motion: Sunnybrook retargeting~~ → **CUT from MVP.** No `motion.bin`. Static anatomy only. Motion is Phase 1.5.
8. Bundle assembly + validation

**[REV]** Coordinate-system contract: `case_manifest.json` must include `worldFromImage` and `worldFromMesh` affine transforms. CI validates image bounds, landmark positions, and mesh centroids against these affines to prevent left-right mirroring.

### 9. **[REV]** Cases: 4 TotalSegmentator CT cases

**[REV] Per pragmatic review:** Drop the multi-atlas canonical case assembly (Open Anatomy + HRA + SIO) from MVP. Use 4 TotalSegmentator CT cases (all from the same pipeline, consistent coordinates). The atlas-assembled canonical case is Phase 1.5 once the pipeline is proven.

### 10. Data Governance

Only bundle-safe datasets in public release. Every `case_manifest.json` declares source datasets and license bucket. CI rejects non-bundle-safe sources.

### 11. 3-Pane Layout

- Left (28%): pseudo-TEE (sectorized anatomical slice)
- Center (44%): 3D anatomy scene (probe, centerline, sector plane)
- Right (28%): oblique slice
- Bottom dock: probe controls + view presets
- Collapse below 1180 px to tabbed panes

### 12. Probe Interaction: Preset-first, then fine-tune

Constrained to esophageal centerline. 5-DOF sliders + keyboard shortcuts. View matching: weighted 5-DOF distance → green (≥ 0.85) / amber (0.60-0.84) / gray (< 0.60).

**[REV]** MVP scoring is a **"nearest preset indicator"** — simple 5-DOF distance only. Structure-visibility checks and image-quality heuristics are Phase 1.5 (per architecture review: don't call it a scoring engine until it's geometry-aware).

### 13. **[REV]** Repo Structure: Single src/ with folder conventions

**[REV] Per pragmatic review:** Replace the 4-package monorepo with a single `src/` directory. Enforce import boundaries with ESLint `import/no-restricted-paths`. Extract packages when there is a real second consumer.

```
teesim/
  src/
    core/         # probe model, transforms, view matcher — zero external deps
    assets/       # loader (simple fetch)
    renderer/     # VTK.js panes, sync manager
    ui/           # React UI: probe HUD, view picker, labels, layout
    education/    # view scoring, preset indicator
  tools/
    asset-pipeline/  # Python scripts for 3D Slicer
  cases/          # git-ignored; served statically
  docs/
  changes/
```

### 14. **[REV]** Deployment: Simple static host

**[REV]** Vercel or Cloudflare Pages. Serve case assets from same origin. No R2 until bandwidth matters. No PWA. No service worker.

### 15. **[REV]** Clinical Validation as Release Gate

**[REV] Added per architecture review.** `views.json` includes per-view approval metadata:

```json
{
  "id": "me-4c",
  "probePose": { "sMm": 134.0, ... },
  "validation": {
    "approvedBy": null,
    "approvedAt": null,
    "status": "pending"
  }
}
```

**CI for public bundle fails if any required MVP view has `status != "approved"`.**

A board-certified echocardiographer must validate all 8 required views on each case before release. No case ships with unapproved views.

### 16. **[REV]** Asset Versioning

**[REV] Adopted from data-pipeline proposal per architecture review.** Three version layers:

- **Schema version** — JSON/binary layout contracts
- **Bundle version** — released case collection (e.g., `0.1.0`)
- **Case version** — individual case within a bundle

`bundle_manifest.json` includes per-asset SHA-256 hashes, pipeline git commit, generation timestamp, source dataset list. Published at `/cases/<bundleVersion>/<caseId>/...`. Immutable.

---

## Implementation Priority

**[REV] Reordered per architecture review:** First case end-to-end before pseudo-TEE styling.

1. **Pseudo-TEE spike** (2-3 days) — go/no-go gate
2. **`src/core/` probe kinematics + view matcher** (L)
3. **Asset pipeline: first TotalSegmentator CT case end-to-end** (L)
4. **3D anatomy pane** — browser renders authored bundle correctly (L)
5. **Oblique slice pane** (M)
6. **Pseudo-TEE pane** — with validated real assets, not synthetic inputs (XL)
7. **UI shell + probe controls** (L)
8. **View scoring + preset indicator** (M)
9. **Clinical validation of 8 views × 4 cases** (external dependency)

---

## Effort Estimate

**[REV] After scope cuts:**

| Component | Size |
|-----------|------|
| Pseudo-TEE spike | S (go/no-go) |
| `src/core/` + unit tests | L |
| `src/assets/` (simple fetch loader) | S |
| Pseudo-TEE pane | XL |
| 3D scene pane | L |
| Oblique slice pane | M |
| Sync manager | M |
| UI (all components) | L |
| App shell (Vite) | S |
| Asset pipeline scripts | L |
| Asset authoring (4 cases, manual centerline) | L-XL (calendar-bound) |
| Unit tests (probe math, view matching) | M |
| **Total (single dev)** | **8-10 weeks** |

Contingency recovered by cuts: ~4 weeks (motion, monorepo, PWA, visual regression, IndexedDB cache, canonical atlas assembly).

---

## What Was Cut from Original Synthesis

| Cut | Rationale | Deferred To |
|-----|-----------|-------------|
| Cardiac motion (`motion.bin`) | High uncertainty, not needed for view-finding | Phase 1.5 |
| 4-package monorepo (pnpm + Turborepo) | Overhead for solo dev; ESLint rules suffice | When 2nd consumer exists |
| Canonical atlas case (Open Anatomy + HRA + SIO) | Multi-atlas registration is 1-3 weeks | Phase 1.5 |
| PWA / service worker | No user need, stale-cache debugging risk | Post-launch if requested |
| IndexedDB cache + GPU budget tracker | `fetch()` + HTTP caching suffices for 4 cases | When case count > 10 |
| Playwright visual regression | Manual QA faster for solo dev | When rendering stabilizes |
| Two VTIs per case | Single VTI halves pipeline complexity | If quality requires it |
| Phase 2 abstractions (`VolumeSource`, `ScoringSink`, `CaseSource`) | Premature indirection | ADR-0002 with DICOM route |
| Views 9-10 (Asc Aortic, Desc Aortic) | Clinical validation bottleneck | Ship if validated in time |

---

## Consequences

**Positive:**
- Pseudo-TEE spike de-risks the biggest technical bet before investment
- First case end-to-end validates pipeline before rendering investment
- Single `src/` avoids build tooling overhead
- Clinical validation as CI gate prevents shipping incorrect views
- Explicit `sMm` units prevent cross-system unit confusion
- "Sectorized anatomical slice" framing sets correct educational expectations

**Negative:**
- Static anatomy (no motion) is visually less compelling
- 4 TotalSegmentator cases may lack the anatomical polish of a curated atlas case
- Simple 5-DOF scoring may produce false-positive view matches without structure visibility checks

**Known Simplifications (disclosed in UI):**
- Probe constrained to centerline (no wall apposition or radial offset)
- Pseudo-TEE is CT-derived cross-section, not simulated ultrasound
- No native valve tissue, chordae, or papillary muscles in the source CT; v0.2 supplements this with derived parametric leaflet assets

---

## Related Artifacts

**Proposals:**
- [Web-rendering-first](../research/2026-04-06-mvp-proposal-web-rendering.md)
- [Data-pipeline-first](../research/2026-04-06-mvp-proposal-data-pipeline.md)
- [Medical-education-first](../research/2026-04-06-mvp-proposal-medical-education.md)
- [Platform-architecture-first](../research/2026-04-06-mvp-proposal-platform-architecture.md)

**Reviews:**
- [Architecture review](../research/2026-04-06-adr-0001-review-architecture.md) — Reject → addressed
- [Domain review](../research/2026-04-06-adr-0001-review-domain.md) — Accept-with-changes → addressed
- [Pragmatic review](../research/2026-04-06-adr-0001-review-pragmatic.md) — Accept-with-changes → addressed

**Source data:**
- [Public data survey](../research/2026-04-06-tee-simulator-public-data-survey.md)
- [Product goals and non-goals](../product/goals-non-goals.md)
