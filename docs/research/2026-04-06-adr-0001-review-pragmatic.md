# ADR-0001 Review: Pragmatic Shipping Perspective

**Date:** 2026-04-06
**Reviewer:** Engineering lead review (pragmatic shipping lens)
**Status:** Review of ADR-0001 (Proposed)

---

## 1. Overall Assessment

This ADR is the product of a thorough synthesis process, and the technical judgment on the core rendering stack (VTK.js primary, React + Zustand, WebGL2 baseline) is sound. The probe-kinematics-first priority ordering is correct. However, the ADR reads like architecture for a five-person team, not a solo developer on a 10-14 week clock. The monorepo with four packages, the two-VTI split, the 10-view scope, the IndexedDB two-tier cache, the PWA service worker, the Playwright visual regression suite, the CI-enforced data governance pipeline, the Cloudflare R2 deployment -- every one of these is individually defensible, but collectively they represent death by a thousand reasonable decisions. The 10-14 week estimate has nearly zero margin. The critical path (pseudo-TEE rendering + asset authoring with clinical expert dependency) is the slowest path, and the ADR does not address what happens when the expert is unavailable for two weeks. I would greenlight this for implementation only with significant scope cuts described below.

---

## 2. Over-engineering Warnings

### 2.1 Monorepo with 4 packages is premature

The ADR proposes `@teesim/core`, `@teesim/assets`, `@teesim/renderer`, `@teesim/ui` plus `apps/web` plus `tools/asset-pipeline`. For a solo developer, pnpm workspaces + Turborepo configuration, per-package `tsconfig.json`, per-package `vitest.config.ts`, cross-package type resolution, and build ordering is real overhead. The "zero-dependency core" argument is architecturally beautiful but practically irrelevant until there is a second consumer of `@teesim/core` (there is not one on the roadmap until a hypothetical native/VR port in Phase 2+).

**Recommendation:** Single `src/` directory with folder boundaries (`src/core/`, `src/assets/`, `src/renderer/`, `src/ui/`). Enforce the no-import rules with ESLint `import/no-restricted-paths` rules instead of package.json boundaries. Extract packages later when there is a real consumer. This saves 1-2 weeks of yak-shaving on build tooling.

### 2.2 Two VTIs instead of one

The rationale (different scalar types, different interpolation modes) is technically correct. But for MVP with 4 cases and one developer, shipping two VTI files per case doubles the volume pipeline complexity, doubles the browser asset loading work, and doubles the GPU memory accounting. The labels VTI (uint8 at 250^3 = ~15 MB) is used only for pseudo-TEE structure lookup, which could be done by sampling the label volume on the same reslice plane as the intensity volume.

**Recommendation:** Ship one VTI with both channels packed, or ship only the intensity VTI and use the mesh-based structure identity for pseudo-TEE coloring in MVP. Split to two VTIs only if the single-VTI approach causes a measurable visual quality problem during implementation.

### 2.3 IndexedDB two-tier cache + GPU memory budget tracker + range-request streaming

The `@teesim/assets` package specification describes an L1 memory LRU, L2 IndexedDB cache, GPU budget tracker, priority queue loader, and range-request streaming stub. For an MVP that loads exactly one case at a time from 4 available cases, the user flow is: click case, fetch files, render. A simple `fetch()` with browser-native HTTP caching (`Cache-Control: immutable`) achieves 90% of the benefit at 5% of the implementation cost.

**Recommendation:** Use raw `fetch()` with appropriate cache headers. No IndexedDB. No GPU budget tracker. No priority queue. One case in memory, `dispose()` on case switch. Add caching sophistication when there is evidence of a performance problem.

### 2.4 Cloudflare Pages + R2 deployment

For 4 cases totaling perhaps 200 MB of static assets, this is operationally more complex than necessary. Vercel or Netlify or even GitHub Pages with assets on a simple S3 bucket works fine. Cloudflare R2 is the right call at scale, but "zero egress fees" matters when you have thousands of users, not dozens during an MVP validation phase.

**Recommendation:** Deploy on Vercel (zero config for Vite) or Cloudflare Pages. Serve case assets from the same origin or a simple object store. Migrate to R2 when bandwidth costs become a real line item.

### 2.5 PWA / Service Worker in MVP

No user has asked for offline mode. The service worker adds testing surface (cache invalidation bugs are notoriously hard to diagnose) and development friction (stale cached assets during iteration). It adds nothing to the core value proposition of "can I learn TEE views in a browser."

**Recommendation:** Cut PWA entirely from MVP. Add it post-launch if users report wanting offline access.

### 2.6 Visual regression test suite with Playwright + Percy/Argos

Screenshot diffing of 10 anchor views across 4 cases is 40 baseline images. Setting up headless WebGL rendering in CI (SwiftShader), writing Playwright test fixtures that load a full case and manipulate the probe to each preset, and managing baseline image updates is easily 1-2 weeks of work. For a solo developer who can visually inspect the 10 views in 5 minutes, this is premature.

**Recommendation:** Unit test the probe kinematics and view matcher exhaustively (these are pure math, cheap to test). Manual visual QA for rendered output in MVP. Add visual regression tests only after the rendering pipeline stabilizes.

---

## 3. Under-specification Warnings

### 3.1 Pseudo-TEE shader pipeline is critically under-specified

The ADR says "reslice the ROI volume into a rectangular 2D texture, apply a sector wedge mask, map through structure-specific echogenicity parameters, apply depth gain / boundary enhancement / speckle / shadowing / vignette." This is the single hardest piece of the entire MVP (sized XL), and the specification is a bullet-point list. There is no detail on:

- How to implement the sector wedge mask in VTK.js (it is not a built-in feature)
- Whether to use a custom GLSL shader or VTK.js's built-in rendering pipeline with post-processing
- How `appearance.json` maps structure label IDs to echogenicity values at the shader level
- Whether the reslice output is a CPU-side buffer that gets uploaded to a 2D texture, or if VTK.js handles it on the GPU
- What the minimal viable pseudo-TEE looks like (is a flat grayscale reslice with a wedge mask sufficient for week 3, or does it need all the postprocessing effects to be "shippable"?)

This will cause thrashing. The developer will spend days exploring VTK.js internals before they know whether the approach works.

**Recommendation:** Before writing a line of application code, do a 2-3 day spike that produces a sector-masked oblique reslice from a VTI volume in VTK.js on a standalone HTML page. Define "minimum viable pseudo-TEE" explicitly: a grayscale sector wedge reslice with depth attenuation. All other effects (speckle, boundary enhancement, shadowing) are stretch goals.

### 3.2 Esophageal centerline extraction has no fallback

The pipeline requires VMTK centerline extraction with a QA threshold of 97% inside-lumen fraction. If the esophagus segmentation from TotalSegmentator is noisy (which it frequently is, especially at the gastroesophageal junction), the build fails and requires manual correction in 3D Slicer. The ADR does not describe what that manual correction looks like, how long it takes, or whether the developer has the clinical expertise to do it.

**Recommendation:** For MVP, author the centerline manually for all 4 cases using 3D Slicer markup tools, then fit a smoothed spline. The VMTK-automated extraction is a nice-to-have optimization for when the case count grows beyond what manual authoring supports. This removes a hard dependency on VMTK setup, esophagus segmentation quality, and automated QA.

### 3.3 Cardiac motion retargeting is described but not scoped as deferrable

The ADR lists motion as step 7 in the asset pipeline and includes `motion.bin` in every case bundle. The Sunnybrook motion retargeting (register ED to ES with non-rigid transform, split into chamber-local priors, retarget per-case) is a research-grade image registration problem. The platform-architecture proposal correctly defers motion animation rendering to a "fast-follow," but the data pipeline proposal includes motion generation as a required pipeline step.

**Recommendation:** Cut motion entirely from MVP scope. No `motion.bin` generation, no motion loading in the browser. Static anatomy is sufficient for learning view-finding (the core value prop). Motion is a Phase 1.5 feature. This removes the Sunnybrook registration dependency and simplifies the pipeline.

### 3.4 "Canonical case" assembly from 3 different atlas sources is under-scoped

The canonical case merges Open Anatomy Thorax, HRA 3D Reference Objects, and SIO Visible Human into a single coherent scene. These are three different spatial coordinate systems, three different mesh resolutions, and three different segmentation conventions. The data pipeline proposal says "a curated manual pass aligns all canonical structures into one consistent RAS scene" without estimating how long that manual pass takes. Based on experience with multi-atlas registration, this is 1-3 weeks of work by someone who knows both 3D Slicer and thoracic anatomy.

**Recommendation:** Start with a single TotalSegmentator CT case as the canonical case. It gives you a consistent coordinate system, consistent mesh quality, and a working pipeline end-to-end. Replace it with the atlas-assembled canonical case only after the pipeline is proven on real patient CT data.

---

## 4. Risk Assessment

### Risk 1: Pseudo-TEE rendering does not work as designed (Likelihood: HIGH, Impact: CRITICAL)

The entire product's visual identity depends on producing a convincing sector-shaped pseudo-ultrasound image from a CT-derived volume using VTK.js in the browser. VTK.js's `vtkImageReslice` is designed for rectangular image reformats, not fan-shaped sector displays. Getting from a rectangular reslice to a sector-masked, depth-attenuated, speckle-textured image that looks like an ultrasound view is a custom rendering problem. If this takes 6 weeks instead of the estimated 3-4 (plausible given the under-specification), the entire timeline collapses.

**Mitigation:** Do the pseudo-TEE spike first, before any other work. Accept a minimal "CT cross-section in a sector shape" as the MVP visual and iterate from there.

### Risk 2: Clinical expert availability blocks asset validation (Likelihood: HIGH, Impact: HIGH)

The ADR correctly identifies clinical expert availability as a hard dependency. Ten anchor views across 4 cases = 40 view presets that need clinical validation. The tolerance windows for view scoring need expert calibration. The ADR does not name a specific clinical advisor, define their availability commitment, or describe the validation workflow in enough detail to estimate calendar time.

**Mitigation:** Identify the clinical advisor now. Define a validation protocol that can be done asynchronously (shared screen recordings, annotated screenshots). Reduce to 1 case and 5 views for initial clinical validation, then expand.

### Risk 3: Pipeline integration tax consumes the timeline (Likelihood: MEDIUM-HIGH, Impact: HIGH)

The asset pipeline has 12 distinct stages, uses 3D Slicer, VMTK, Python scripts, and JSON schema validation. The first end-to-end case run will surface issues at every stage boundary: wrong coordinate systems, unexpected mesh topology, VTI dimension mismatches, centerline extraction failures. The ADR correctly notes that "the first case pays the integration tax," but the estimate (L = roughly 2-3 weeks) may be optimistic given the number of tools involved.

**Mitigation:** Get the first case through the pipeline to browser render within the first 3 weeks. Cut every pipeline feature that is not strictly necessary for this milestone (motion, automated QA, CI validation, schema enforcement). Harden the pipeline after it works once.

---

## 5. Recommended Cuts

Priority-ordered list of what to remove from MVP to maximize the probability of shipping:

| Cut | Effort saved | Risk removed |
|-----|-------------|-------------|
| Monorepo packages -> single `src/` with folder conventions | 1-2 weeks | Build tooling yak-shaving |
| 10 views -> 5 views (ME 4C, ME 2C, ME LAX, TG mid-SAX, ME AV SAX) | 1 week authoring + validation | Clinical expert bottleneck |
| `motion.bin` and cardiac animation -> cut entirely | 2-3 weeks pipeline + rendering | Sunnybrook registration, motion rendering bugs |
| Canonical atlas-assembled case -> use TotalSegmentator CT as canonical | 1-2 weeks | Multi-atlas registration |
| IndexedDB cache + GPU budget tracker + priority queue -> raw `fetch()` | 1 week | Cache invalidation bugs |
| PWA / service worker -> cut | 3-5 days | Stale cache debugging |
| Playwright visual regression suite -> manual QA | 1-2 weeks | CI WebGL environment setup |
| Two VTIs -> one VTI (intensity only, derive structure ID from mesh) | 3-5 days | Double pipeline complexity |
| Cloudflare R2 -> simple static host | 2-3 days | Deployment complexity |
| View scoring with landmark visibility check + image quality heuristic -> simple 5-DOF distance only | 3-5 days | Over-engineering the scoring function |

**Total estimated savings:** 8-12 weeks of effort, bringing the project from "razor-thin margins" to "shippable with contingency."

**After cuts, the MVP is:**

- One Vite + React + Zustand app in a single `src/` directory
- VTK.js rendering: 3D anatomy pane, oblique slice pane, pseudo-TEE pane (sector-masked grayscale reslice)
- 5-DOF probe on esophageal centerline (manually authored spline)
- 5 anchor views with simple 5-DOF distance scoring
- 4 cases (all from TotalSegmentator CT), static anatomy (no motion)
- Probe controls (sliders + keyboard shortcuts), view presets, green/amber/gray match overlay
- Deployed on Vercel or Cloudflare Pages, assets served from same origin
- Unit tests for probe math and view matching, manual visual QA

This is shippable in 8-10 weeks by one developer. It validates the core hypothesis (browser-based TEE view-finding trainer) without the infrastructure overhead.

---

## 6. Verdict

**Accept-with-changes.**

The technical architecture is sound. The rendering stack choice, the state management approach, the offline-first asset pipeline, and the probe-kinematics-first priority are all correct decisions. The problem is scope, not direction.

Implement the cuts described in section 5. Ship the minimal version. Then layer on the deferred features (motion, more views, caching, PWA, monorepo extraction, visual regression tests) in subsequent iterations when each feature is justified by real user feedback rather than anticipated future needs.

The single most important action before starting implementation: complete the pseudo-TEE rendering spike (2-3 days, standalone HTML page, sector-masked VTK.js oblique reslice from a test VTI). If this spike fails or takes longer than 5 days, the entire project timeline needs to be re-evaluated, because everything else depends on this rendering primitive working.
