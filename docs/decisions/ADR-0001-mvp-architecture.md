# ADR-0001: MVP Architecture

**Date:** 2026-04-06
**Status:** Proposed
**Synthesized from:** 4 independent proposals (Web-rendering, Data-pipeline, Medical-education, Platform-architecture)

---

## Context

TeeSim is a browser-based 3D TEE simulator for cardiology education. The repository was bootstrapped with product docs, data governance rules, and a public dataset survey. Four independent architecture proposals were generated in parallel from different perspectives:

1. [Web-rendering-first](../research/2026-04-06-mvp-proposal-web-rendering.md) — Codex gpt-5.4
2. [Data-pipeline-first](../research/2026-04-06-mvp-proposal-data-pipeline.md) — Codex gpt-5.4
3. [Medical-education-first](../research/2026-04-06-mvp-proposal-medical-education.md) — Claude opus
4. [Platform-architecture-first](../research/2026-04-06-mvp-proposal-platform-architecture.md) — Claude opus

This ADR synthesizes the four into a unified architecture, resolving conflicts explicitly.

---

## Decision

### 1. Rendering Engine: VTK.js-primary, R3F optional for 3D scene

**Conflict:** Web-rendering recommends VTK.js-only ("dual-engine synchronization is integration tax"). Platform-architecture recommends VTK.js + Three.js/R3F hybrid ("R3F is 3-5x more productive for mesh-only rendering").

**Resolution:** Start with VTK.js as the sole renderer. All components interface through a `RenderCoordinator` abstraction. If 3D scene development velocity is too slow after the first 2 weeks, introduce R3F for the 3D anatomy pane only — behind the same coordinator interface, in a separate canvas. The key constraint is: **never share a WebGL context between VTK.js and Three.js**.

**Rationale:** The web-rendering proposal correctly identifies that the bottleneck is correct synchronized medical reslicing, not visual polish. Starting single-engine avoids integration risk. But the escape hatch to R3F exists cleanly.

### 2. Framework: React 18 + TypeScript + Vite + Zustand

**All proposals agree.** React as the UI shell. Zustand for state (fine-grained subscriptions, synchronous `getState()` in the rAF loop, < 2 KB). Vite for build. WebGL2 baseline, WebGPU deferred.

### 3. State Architecture: Single `ProbePose` as source of truth

**All proposals agree** on the core data model:

```typescript
type ProbePose = {
  s: number;             // position on esophageal centerline
  rollDeg: number;       // axial rotation
  anteDeg: number;       // anteflexion / retroflexion
  lateralDeg: number;    // lateral flex
  omniplaneDeg: number;  // imaging plane angle [0, 180]
};
```

Zustand store holds `ProbePose`. `RenderCoordinator` derives `ImagingPlane` from it and pushes to all three panes synchronously in a single `requestAnimationFrame`. React never sits in the frame loop — UI components use selector subscriptions.

### 4. Anchor Views: 10, with pedagogical ordering

**Conflict:** Web-rendering and Data-pipeline say 8. Medical-education says 10.

**Resolution:** 10 views. Medical-education provides a compelling pedagogical progression:

| Order | View | Station | Key DOF Introduced |
|-------|------|---------|-------------------|
| 1 | ME Four-Chamber | ME | Position, slight retroflexion |
| 2 | ME Two-Chamber | ME | Omniplane (60-70°) |
| 3 | ME Long-Axis | ME | Omniplane (120-140°) — completes "omniplane triad" |
| 4 | TG Mid Short-Axis | TG | Station change, anteflexion |
| 5 | ME AV Short-Axis | ME | Position + omniplane combo |
| 6 | ME AV Long-Axis | ME | Paired SAX/LAX concept |
| 7 | ME RV Inflow-Outflow | ME | Lateral flex, right heart |
| 8 | ME Bicaval | ME | Roll DOF |
| 9 | ME Asc Aortic SAX | UE-ME | Upper esophageal, great vessels |
| 10 | Desc Aortic SAX/LAX | ME | Posterior anatomy, omniplane toggle |

Views 1-3 form a "beginner triad" from one probe position. Views 5-6 teach paired SAX/LAX. Views 9-10 extend to great vessel assessment. This covers all 5 DOFs and all major structures.

### 5. Asset Format: Two VTIs, not one

**Conflict:** Web-rendering proposes one `heart_roi.vti`. Data-pipeline proposes two: `heart_intensity.vti` (int16) + `heart_labels.vti` (uint8).

**Resolution:** Two VTIs. Data-pipeline's rationale is correct: intensity and labels have different scalar types, different filtering rules (interpolation vs nearest-neighbor), and different runtime consumers (oblique slice vs pseudo-TEE structure lookup). Same grid geometry for both.

### 6. Asset Pipeline: 3D Slicer + SlicerHeart offline factory

**All proposals agree.** The pipeline is:

1. Ingest raw data → normalize to NIfTI RAS-mm
2. Segmentation cleanup in 3D Slicer Segment Editor
3. Esophageal centerline extraction via VMTK (QA: ≥ 97% inside-lumen fraction)
4. Landmark and view authoring in SlicerHeart
5. Mesh export: `scene.glb` (coarse thorax, ≤ 500K tris) + `heart_detail.glb` (cardiac, ≤ 300K tris)
6. Volume export: `heart_intensity.vti` + `heart_labels.vti` (0.8 mm isotropic, ≤ 250³ voxels)
7. Motion: Sunnybrook ED→ES displacement, 10 phases, retargeted per case → `motion.bin`
8. Bundle assembly + CI validation (schema, budgets, license provenance)

See Data-pipeline proposal for full JSON schema examples (`case_manifest.json`, `landmarks.json`, `views.json`, `probe_path.json`).

### 7. Data Governance

**All proposals agree.** Only bundle-safe open datasets in public release:

| MVP Bundle | Internal Only |
|-----------|--------------|
| Open Anatomy Thorax Atlas | MM-WHS |
| HRA 3D Reference Objects | MITEA |
| SIO (Visible Human) | EchoNet-Dynamic |
| TotalSegmentator CT (open tasks) | MVSeg2023 |
| Sunnybrook Cardiac Data | TotalSegmentator restricted subtasks |
| SlicerHeart (tooling) | XCAT (licensed) |

Every `case_manifest.json` declares source datasets and license bucket. CI rejects unknown or non-bundle-safe sources.

### 8. Cases: 1 canonical + 3 patient-like

**All proposals agree.**

- Canonical case: Open Anatomy + HRA + SIO assembly
- Patient-like cases: 3 TotalSegmentator CT open-task cases
- Start with TotalSegmentator 102-case small subset for pipeline bring-up

### 9. 3-Pane Layout

**All proposals agree** on the layout:

- Left (28%): pseudo-TEE image (sector wedge, grayscale LUT, depth attenuation)
- Center (44%): 3D anatomy scene (probe, centerline, sector plane, mesh highlighting)
- Right (28%): oblique slice (same plane, label-colormap)
- Bottom dock: probe controls (5 DOF sliders) + view preset list
- Collapse below 1180 px to tabbed panes

### 10. Probe Interaction: Preset-first, then fine-tune

**All proposals agree** on constrained interaction:

- Primary: DOF sliders + keyboard shortcuts (`1-0` for view presets, arrow keys for probe)
- Probe always stays on esophageal centerline
- No free 6-DOF dragging, no unconstrained camera
- Camera: orbit in 3D pane only, left-posterior oblique teaching default
- View matching: weighted 5-DOF distance with per-view tolerance windows → green (≥ 0.85), amber (0.60-0.84), gray (< 0.60)

### 11. Repo Structure: Monorepo with package boundaries

**Resolution:** Adopt Platform-architecture's monorepo design. The package isolation it proposes — especially `@teesim/core` with zero dependencies — is architecturally sound and protects the probe math from rendering coupling.

```
teesim/
  packages/
    core/         # probe model, transforms, view matcher — zero deps, pure TS
    assets/       # loader, cache, GPU budget tracker
    renderer/     # VTK.js panes, sync manager, perf monitor
    ui/           # React UI: probe HUD, view picker, labels, layout
  apps/
    web/          # Vite entry, Zustand store, service worker, PWA
  tools/
    asset-pipeline/  # Python scripts for 3D Slicer automation
  cases/          # git-ignored; output from pipeline, served statically
  docs/           # existing governance structure
  changes/        # active work
```

Build: pnpm workspaces + Turborepo. CI: Vitest (unit) + Playwright (E2E) + visual regression screenshots of all 10 anchor views.

### 12. Deployment: Cloudflare Pages + R2

App shell on Cloudflare Pages, case assets on R2 (zero egress, range requests). Immutable versioned asset paths. Brotli/gzip at CDN level.

### 13. Education Layer: Scoring in MVP, Tutorial in Phase 1.5

**Resolution:** Medical-education's full design is excellent but exceeds MVP scope. Phasing:

| Phase | Education Feature |
|-------|------------------|
| **MVP** | View scoring engine (pure function, runs every frame), passive view-match overlay (green/amber/gray), view catalog with one-click snap-to-preset |
| **Phase 1.5** | Tutorial engine (JSON-driven step sequencer), guided mode, progress tracker (localStorage), competency dashboard |
| **Phase 2** | Assessment mode, educator dashboard, session replay, JSON export |

The scoring engine and view tolerance data model from Medical-education are adopted in MVP. Tutorial JSON schema and content authoring are deferred.

### 14. Performance Budgets

| Budget | Target | Hard Cap |
|--------|--------|----------|
| Frame rate | 45-60 FPS | 30 FPS floor |
| App shell JS/CSS | < 500 KB gzipped | 700 KB |
| Critical case payload | < 12 MB gzipped | 18 MB |
| Full case payload | < 45 MB gzipped | 60 MB |
| Visible triangles | < 450K | 600K |
| `scene.glb` | 100K-150K tris | 200K |
| `heart_detail.glb` | 200K-250K tris | 300K |
| VTI (each) | ≤ 28 MB uncompressed | 40 MB |
| GPU memory per scene | < 220 MB | 256 MB |
| Pseudo-TEE / oblique buffers | 768×768 | 1024×1024 |

### 15. Phase 2 Extension Points

Define these interfaces in `@teesim/core/types.ts` from day one (Platform-architecture proposal):

- `VolumeSource` — MVP: static VTI. Phase 2: DICOMweb via Cornerstone3D
- `ScoringSink` — MVP: no-op. Phase 2: backend persistence
- `CaseSource` — MVP: static `index.json`. Phase 2: Orthanc DICOM server

These cost nothing to ship but force the renderer to be volume-source-agnostic, enabling the DICOM route without refactoring.

---

## Implementation Priority

Based on all four proposals' convergence on what is highest-risk:

1. **`@teesim/core` probe kinematics + view matcher** — "the intellectual core" (L)
2. **Pseudo-TEE pane** — "the product's reason to exist" (XL)
3. **3D anatomy pane** (L)
4. **Oblique slice pane** (M)
5. **Asset pipeline: first case end-to-end** — "first case pays the integration tax" (L)
6. **UI shell + probe controls** (L)
7. **View scoring + overlay** (M)
8. **Performance tuning + visual regression tests** (M)

The highest-leverage sequence: get probe kinematics + pseudo-TEE working first. If those are wrong, everything else is wasted.

---

## Effort Estimate

| Component | Size |
|-----------|------|
| Monorepo setup + CI | S |
| `@teesim/core` + tests | L |
| `@teesim/assets` (loader, cache, budget) | M |
| Pseudo-TEE pane | XL |
| 3D scene pane | L |
| Oblique slice pane | M |
| Sync manager | M |
| UI (all components) | L |
| App shell + PWA | M |
| Asset pipeline scripts | L |
| Asset authoring (4 cases) | XL (calendar-bound) |
| Testing suite | L |
| **Total (single dev)** | **10-14 weeks** |

Critical path: pseudo-TEE pane + asset authoring (clinical expert dependency).

---

## Consequences

**Positive:**
- Single rendering engine minimizes integration risk
- Package boundaries (core with zero deps) enable exhaustive unit testing of probe math
- Two VTIs prevent type confusion between intensity and labels
- Extension point interfaces allow Phase 2 DICOM route without refactoring
- Data governance baked into CI from day one

**Negative:**
- VTK.js has a steeper learning curve than Three.js for the 3D scene
- VTK.js bundle size requires careful tree-shaking (~200-300 KB gzipped)
- 10 views require more clinical expert authoring time than 8
- Monorepo setup overhead for a single developer (offset by Turborepo caching)

**Risks:**
- GPU memory pressure on integrated GPUs (mitigated by hard budget enforcement + progressive quality degradation)
- Pseudo-TEE may not look realistic enough (mitigated by explicit "CT-derived cross-section" framing, not claiming diagnostic ultrasound)
- Clinical expert availability is a hard external dependency for view authoring/validation

---

## Related Artifacts

- [Web-rendering-first proposal](../research/2026-04-06-mvp-proposal-web-rendering.md)
- [Data-pipeline-first proposal](../research/2026-04-06-mvp-proposal-data-pipeline.md)
- [Medical-education-first proposal](../research/2026-04-06-mvp-proposal-medical-education.md)
- [Platform-architecture-first proposal](../research/2026-04-06-mvp-proposal-platform-architecture.md)
- [Public data survey](../research/2026-04-06-tee-simulator-public-data-survey.md)
- [Product goals and non-goals](../product/goals-non-goals.md)
