# MVP Proposal: Web-Rendering-First

**Date:** 2026-04-06  
**Status:** Proposed - input to ADR-0001  
**Perspective:** Web-rendering-first  
**Related artifacts:** [`docs/product/overview.md`](../product/overview.md), [`docs/product/goals-non-goals.md`](../product/goals-non-goals.md), [`docs/research/2026-04-06-tee-simulator-public-data-survey.md`](./2026-04-06-tee-simulator-public-data-survey.md)

---

## 1. Executive Summary

The MVP browser runtime should standardize on **VTK.js as the only rendering engine**, **React + TypeScript + Vite as the application shell**, and **WebGL2 as the baseline graphics target**. This is the simplest stack that can natively handle synchronized medical reslicing, volume-backed slice views, and a 3D anatomical scene without building custom imaging infrastructure from scratch.

The decisive architectural rule is: **one world coordinate system, one rendering engine, one source of truth for probe pose**. All runtime assets should arrive in the browser already aligned in millimeter-space from the offline 3D Slicer / SlicerHeart pipeline. The browser should not solve registration problems. It should only load assets, compute the current probe pose, derive a scan plane, and render three synchronized views.

The UI should be **desktop-first and education-first**, with a stable 3-pane layout:

- Left: pseudo-TEE image
- Center: 3D anatomy view with probe and sector plane
- Right: oblique slice

Probe manipulation should be **constrained, explicit, and preset-first**. Do not make freehand 3D dragging the primary interaction. The main control surface should be a probe control dock with direct controls for `s`, roll, ante/retro flex, lateral flex, and omniplane angle, plus one-click preset jumps for the anchor ASE views.

For MVP, the product should ship **8 exact anchor views**, **1 canonical case**, and **3 patient-like cases** using only bundle-safe open data. Performance should target **45-60 FPS typical, never below 30 FPS on a 2020-era MacBook**, with a full selected case kept under a **256 MB runtime GPU memory ceiling**. WebGPU should stay a future optimization path, not an MVP dependency.

The core recommendation is intentionally narrow: **do not split the MVP between VTK.js and Three.js/R3F, and do not chase WebGPU-first rendering yet**. The bottleneck is not visual polish. The bottleneck is correct, synchronized, anatomically faithful rendering in the browser.

---

## 2. Architecture Diagram (ASCII)

```text
Offline Asset Factory
3D Slicer + SlicerHeart
        |
        | exports GLB + VTI + JSON + motion.bin
        v
public/cases/<case-id>/
        |
        v
+--------------------------------------------------------------------+
| Browser App                                                        |
| React + TypeScript + Vite                                          |
|                                                                    |
|  +-------------------- UI Shell --------------------------------+  |
|  | Case selector | Preset list | Probe controls | Labels | HUD  |  |
|  +-----------------------------+-----------------------------+---+  |
|                                |                                 |  |
|                                v                                 |  |
|  +---------------- State and Coordination ---------------------+  |  |
|  | CaseStore | ProbeStore | ViewMatcher | PerformanceManager   |  |  |
|  +----------------------+----------------+---------------------+  |  |
|                         |                |                        |  |
|                         v                v                        |  |
|               +----------------+   +-------------------------+    |  |
|               | Probe Kinematics|   | Asset Loader + Cache    |   |  |
|               | pose -> plane   |   | manifest -> typed data  |   |  |
|               +--------+--------+   +-----------+-------------+   |  |
|                        |                        |                 |  |
|                        +------------+-----------+                 |  |
|                                     |                             |  |
|                    +----------------v----------------+            |  |
|                    | Render Coordinator              |            |  |
|                    | single world frame of truth     |            |  |
|                    +-----------+-----------+---------+            |  |
|                                |           |                      |  |
|               +----------------v-+   +-----v---------------+      |  |
|               | 3D Anatomy Pane  |   | Pseudo-TEE Pane     |      |  |
|               | VTK.js renderer  |   | reslice + wedge     |      |  |
|               | probe + sector   |   | shader postprocess  |      |  |
|               +------------------+   +---------------------+      |  |
|                                |                                  |  |
|                          +-----v---------------+                  |  |
|                          | Oblique Slice Pane  |                  |  |
|                          | VTK.js image view   |                  |  |
|                          +---------------------+                  |  |
+--------------------------------------------------------------------+
```

---

## 3. Component Breakdown

The runtime should revolve around a small set of explicit interfaces:

```ts
type ProbePose = {
  s: number
  rollDeg: number
  anteDeg: number
  lateralDeg: number
  omniplaneDeg: number
}

type ImagingPlane = {
  originMm: [number, number, number]
  normal: [number, number, number]
  up: [number, number, number]
  sectorAngleDeg: number
  depthMm: number
}

type ViewPreset = {
  id: string
  label: string
  pose: ProbePose
  tolerance: {
    sMm: number
    angleDeg: number
  }
}

type CaseManifest = {
  id: string
  coordinateSystem: "RAS-mm"
  criticalAssets: string[]
  lazyAssets: string[]
  defaultViewId: string
}
```

| Component | Responsibility | Interface |
|-----------|----------------|-----------|
| `AppShell` | Owns page layout, routing, panel visibility, and global keyboard shortcuts. Keeps the UI desktop-first with responsive collapse below laptop widths. | Inputs: selected case ID, active preset ID, panel state. Outputs: case change events, layout resize events, shortcut actions. |
| `CaseCatalog` | Lists available cases and exposes bundle-safe metadata without loading full geometry. | `listCases(): Promise<CaseSummary[]>`, `selectCase(caseId)` |
| `CaseAssetLoader` | Loads `case_manifest.json`, GLB, VTI, JSON, and `motion.bin` in staged order. Normalizes all loaded assets into a typed runtime bundle. | `loadCritical(caseId)`, `loadLazy(caseId)`, `disposeCase(caseId)` |
| `RuntimeAssetCache` | Prevents duplicate fetches, retains only the selected case in memory, and releases GPU/CPU buffers on case change. | `get(key)`, `put(key, value)`, `evict(key)` |
| `ProbeKinematicsEngine` | Converts `{s, roll, ante, lateral, omniplane}` into probe shaft transform, tip transform, and imaging plane. All math is in world millimeters. | `computePose(probePose, probePath, landmarks): { probeTransform, imagingPlane }` |
| `ViewPresetService` | Resolves preset jumps and finds the nearest authored view to the current pose. This powers the "current view" overlay. | `jumpToPreset(id)`, `matchCurrentPose(probePose): ViewMatch` |
| `ProbeInputController` | Maps dock controls, keyboard shortcuts, mouse wheel, and optional touch gestures into bounded DOF updates. Prevents illegal states and clamps omniplane and flex ranges. | Inputs: UI events. Outputs: partial `ProbePose` updates. |
| `RenderCoordinator` | The runtime hub. Pushes the current `ImagingPlane`, visible structures, and quality settings into the three panes together. | `render(frameState)`, `setQuality(level)` |
| `AnatomyViewport3D` | Renders coarse thorax, heart detail mesh, probe, centerline, and imaging sector plane. Handles orbit camera and structure highlighting. | Inputs: meshes, `probeTransform`, `imagingPlane`, overlay selections. |
| `PseudoTeeViewport` | Produces the pseudo-TEE image from the current plane. Applies wedge masking, depth gain, edge emphasis, and anatomy-dependent echogenicity. | Inputs: `heart_roi.vti`, `appearance.json`, `imagingPlane`. Output: grayscale image plus label anchors. |
| `ObliqueSliceViewport` | Shows the same plane as a diagnostic oblique slice. Prioritizes accurate anatomy over ultrasound styling. | Inputs: `heart_roi.vti`, `imagingPlane`. Output: grayscale or label-aware slice image. |
| `OverlaySystem` | Renders all labels, orientation markers, preset name/status, and HUD text in screen space. Uses HTML/CSS overlay layers, not 3D text meshes. | Inputs: projected landmarks, `ViewMatch`, panel bounds. |
| `CardiacMotionController` | Plays or pauses cardiac phase motion. Motion is off by default in MVP and only loaded when enabled. | `setPhase(t)`, `play()`, `pause()` |
| `PerformanceManager` | Monitors frame time and enforces quality degradation rules: lower DPR, hide low-value labels, reduce panel resolution, disable optional volume overlay. | Inputs: frame timing, device profile. Outputs: quality tier changes. |

Two design rules matter here:

1. `RenderCoordinator` is the only place allowed to synchronize the three panes.
2. `OverlaySystem` stays in the DOM layer, because web overlays are easier to read, easier to localize, and cheaper to update than in-scene text.

---

## 4. Data Flow (from static assets to rendered output)

1. **App boot**
   - Load the app shell, `cases/index.json`, and minimal case summaries.
   - Do not preload full cases.

2. **Case selection**
   - Fetch `case_manifest.json`.
   - Immediately load critical assets only:
     - `scene.glb`
     - `probe_path.json`
     - `views.json`
     - `landmarks.json`
     - minimal metadata from `appearance.json`

3. **Coordinate normalization**
   - Assert every asset is already in a single exported coordinate system: `RAS-mm`.
   - Reject or log any case whose GLB, VTI, and JSON bounds do not align. Silent spatial correction in the browser is a bug, not a feature.

4. **First meaningful render**
   - Render the center 3D anatomy pane first using `scene.glb`, probe path, and default preset.
   - Show a coarse probe and sector plane immediately.
   - Left and right panes can display loading skeletons for a short period.

5. **Lazy render asset load**
   - Load:
     - `heart_detail.glb`
     - `heart_roi.vti`
   - Defer `motion.bin` until the user enables heartbeat animation.

6. **Probe pose update**
   - `ProbeInputController` emits a partial `ProbePose`.
   - `ProbeKinematicsEngine` samples the centerline at `s`, applies roll, flex, and omniplane rotation, then derives the scan plane.

7. **Synchronized rendering**
   - `RenderCoordinator` pushes the same `ImagingPlane` to:
     - 3D anatomy pane for probe and sector visualization
     - pseudo-TEE pane for reslice + shader styling
     - oblique slice pane for anatomically accurate reformat

8. **Overlay pass**
   - `ViewPresetService` compares the current pose against authored presets.
   - `OverlaySystem` shows:
     - closest preset name
     - in-tolerance / near / unmatched status
     - orientation markers
     - optional anatomy labels from `landmarks.json`

9. **Performance adaptation**
   - If frame time exceeds budget, `PerformanceManager` degrades quality in a fixed order:
     1. cap device pixel ratio
     2. reduce pseudo-TEE and oblique buffer sizes
     3. hide low-priority labels
     4. reduce optional mesh detail
     5. disable optional motion or center-pane volume overlay

This flow keeps the browser runtime read-only, deterministic, and explainable.

---

## 5. Tech Stack Choices

### Rendering Engine

| Option | Decision | Rationale |
|--------|----------|-----------|
| **VTK.js** | **Choose for MVP** | Best fit for medical imaging. Native concepts for image data, volume-backed reslicing, clipping planes, world-space transforms, and synchronized slice/volume workflows. The product needs reslicing more than it needs game-engine ergonomics. |
| Three.js + React Three Fiber | Reject for MVP core rendering | Excellent for general 3D scenes and UI-driven interaction, but weak for medical reslice workflows. Recreating `vtkImageReslice`-class behavior in custom shaders is a large detour. R3F also adds a second abstraction layer the team does not need. |
| Babylon.js | Reject for MVP core rendering | Strong engine, good tooling, solid performance, but the same mismatch remains: TeeSim is a medical reslice application with a 3D teaching scene, not a game scene with some imaging features. |
| Direct WebGPU | Reject for MVP baseline | This is not a library choice; it is a low-level graphics API choice. Going WebGPU-first means building rendering infrastructure instead of shipping the simulator. Browser support is better than before, but the repo already states WebGL2 baseline. Respect that constraint. |

**Recommendation:** use **VTK.js only** for MVP rendering. Do not mix VTK.js for slices and Three.js for the center pane. Dual-engine synchronization is integration tax with little user value.

### Framework Shell

| Option | Decision | Rationale |
|--------|----------|-----------|
| **React + TypeScript + Vite** | **Choose for MVP** | The simulator needs structured UI state, reusable controls, overlays, keyboard shortcuts, case/preset panels, and future educator workflows. React is the simplest mainstream answer as long as rendering stays imperative at the edge. Vite keeps the build static and fast. |
| Vanilla TypeScript | Reject for MVP app shell | Viable for a prototype, but not for a product that must coordinate three synchronized panes, multiple overlay layers, keyboard shortcuts, and future scoring/admin surfaces. It will turn into a hand-rolled framework. |
| Next.js / SSR framework | Reject for MVP | No backend runtime is a product constraint. SSR adds complexity without helping the rendering problem. |

**Recommendation:** React should own layout and controls, but **React must not sit in the frame loop**. Renderer instances subscribe to external state and update imperatively.

### State Management

Use a **small external store** such as `Zustand` with selector subscriptions.

Rationale:

- render panes can subscribe without causing React rerenders on every probe update
- easier to keep one canonical `ProbePose`
- simpler than Redux for MVP

### Graphics Backend

- **Baseline:** WebGL2
- **Not required in MVP:** WebGPU
- **Optional future path:** if VTK.js or a custom pseudo-TEE pass gains a stable WebGPU backend later, the app can adopt it behind the same component interfaces

### Asset Formats

- **Meshes:** `scene.glb`, `heart_detail.glb`
- **Volume payload:** `heart_roi.vti` as an ROI-cropped scalar volume, with the option to encode both intensity and label-aligned channels in the same export
- **Metadata:** `case_manifest.json`, `landmarks.json`, `probe_path.json`, `views.json`, `appearance.json`
- **Motion:** `motion.bin`

The browser should consume these formats directly. No runtime DICOM parsing belongs in MVP.

### Shader Considerations for Pseudo-TEE Rendering

The pseudo-TEE pane should be deliberately **stylized but anatomically anchored**. The goal is educational consistency, not ultrasound physics.

Recommended pipeline:

1. Use the current `ImagingPlane` to reslice the ROI volume into a rectangular 2D texture.
2. Apply a sector wedge mask in shader space.
3. Map label/intensity content through structure-specific echogenicity parameters from `appearance.json`.
4. Apply lightweight postprocessing:
   - depth gain compensation
   - boundary enhancement from local intensity gradient
   - low-amplitude speckle noise
   - mild posterior shadowing for highly attenuating structures
   - vignette and far-field attenuation
5. Output an 8-bit grayscale image to the pseudo-TEE panel.

Explicitly out of scope for MVP:

- beamforming simulation
- reverberation modeling
- Doppler
- physically accurate scattering
- vendor-specific ultrasound appearance emulation

This is the right compromise. It gives a stable, teachable image that reacts correctly to anatomy and probe pose without pretending to be a diagnostic ultrasound console.

---

## 6. MVP Scope

### Exact View List

The MVP should ship exactly **8** anchor views, not 10. Eight is enough to validate the rendering model and probe interaction model without diluting authoring effort.

1. ME Four-Chamber (`ME 4C`)
2. ME Two-Chamber (`ME 2C`)
3. ME Long-Axis (`ME LAX`)
4. Transgastric Mid Short-Axis (`TG mid-SAX`)
5. ME Aortic Valve Short-Axis (`ME AV SAX`)
6. ME RV Inflow-Outflow
7. ME Bicaval
8. ME Aortic Arch Long-Axis

Stretch views such as mitral commissural or right pulmonary vein should wait until the first 8 are validated by an echocardiographer.

### Datasets Used in the Public MVP

- **Canonical case:** Open Anatomy Thorax Atlas + HRA 3D organs + SIO / Visible Human-derived thoracic context
- **Patient-like cases:** 3 cases derived from TotalSegmentator CT open-safe tasks only
- **Motion prior:** Sunnybrook Cardiac Data
- **Authoring toolchain:** 3D Slicer + SlicerHeart

Explicit exclusions from the public MVP bundle:

- MM-WHS
- MITEA
- EchoNet-Dynamic
- MVSeg2023
- TotalSegmentator restricted commercial subtasks
- Any dataset still in "verify-first" status

### 3-Pane Layout

Desktop layout should be fixed around the teaching task:

- **Left pane, 28% width:** pseudo-TEE image, closest-view label, orientation markers, optional anatomy labels
- **Center pane, 44% width:** 3D anatomy scene, probe, centerline, sector plane, structure highlight
- **Right pane, 28% width:** oblique slice aligned to the same plane

Additional layout rules:

- Bottom dock: probe controls and preset list
- Top bar: case selector, label toggles, quality toggle, reset actions
- Minimum pane width: `280 px`
- Below `1180 px` viewport width, collapse left/right panes into tabs while keeping the center pane primary

This keeps the 3D anatomical relationship central without hiding the imaging outputs that the learner is trying to understand.

### Interaction Model for Probe DOF

The interaction model should be **preset-first, then fine-tune**.

Primary controls:

| Control | UI | Notes |
|---------|----|-------|
| `s` | vertical scrubber with station markers (`UE`, `ME`, `TG`, `DTG`) | Primary way to advance or withdraw the probe. |
| Roll | rotary dial or horizontal slider | Display signed degrees. |
| Ante / Retro | vertical axis of a 2D flex pad | Center snaps to neutral. |
| Lateral flex | horizontal axis of a 2D flex pad | Center snaps to neutral. |
| Omniplane | 0-180 degree slider with tick marks | Must always show current angle numerically. |

Keyboard shortcuts:

- `1..8`: jump to preset views
- `ArrowUp` / `ArrowDown`: adjust `s`
- `Q` / `E`: roll
- `W` / `S`: ante / retro
- `A` / `D`: lateral flex
- `[` / `]`: omniplane
- `R`: reset current flex to neutral

Mouse and trackpad:

- 3D pane left-drag: orbit camera
- 3D pane scroll: zoom camera
- `Shift` + scroll: advance or withdraw along `s`
- Double-click structure: focus highlight in 3D pane

What not to do:

- no free 6-DOF probe dragging in 3D
- no unconstrained fly camera
- no hidden gesture mappings for clinically important DOFs

The probe must always remain on the authored centerline. Flex and roll operate relative to the local probe frame, not global scene axes.

### Camera Controls

Camera behavior should support teaching, not cinematic exploration.

- Default camera: left-posterior oblique teaching view centered on the heart and esophagus
- Orbit: allowed only in the center pane
- Pan: disabled by default; enable only while holding `Space`
- Zoom: clamped to keep the heart and probe visible
- Quick camera presets: `Teaching`, `Anterior`, `Left`, `Posterior`, `Probe-follow`
- Reset camera: always one click away

The pseudo-TEE and oblique slice panes should not rotate freely. They may allow zoom, but their orientation should stay locked to the probe-derived imaging frame.

### View Label Overlay

The overlay model should be simple and legible:

- top-left of pseudo-TEE pane: `Closest preset: ME 4C`
- status pill: `Matched`, `Near`, or `Exploring`
- anatomy labels: screen-space callouts to up to 5 high-priority structures
- orientation markers: `A/P/L/R/S/I` where relevant
- omniplane angle, depth, and station always visible

Use tolerance-based view matching:

- green when current pose is within preset tolerance
- amber when near
- gray when unmatched

This delivers immediate educational feedback without committing the MVP to a formal scoring system.

### Performance Budgets

| Budget Area | Target | Hard Cap | Notes |
|-------------|--------|----------|-------|
| Frame rate | 45-60 FPS | 30 FPS floor | Measured on 2020-era MacBook-class hardware |
| App shell JS/CSS | < 500 KB gzipped | 700 KB | Split by route and vendor chunk |
| Critical case payload | < 12 MB gzipped | 18 MB | `scene.glb` + critical JSON only |
| Full selected case payload | < 45 MB gzipped | 60 MB | Includes `heart_detail.glb` and `heart_roi.vti` |
| Visible triangle count | < 450k | 600k | All currently drawn geometry |
| `scene.glb` | 100k-150k tris | 200k tris | Thorax, vessels, coarse organs |
| `heart_detail.glb` | 200k-250k tris | 300k tris | Chambers and great vessels |
| Probe + sector geometry | < 20k tris | 30k tris | Do not overspend on the tool itself |
| Loaded volume payload | < 48 MB uncompressed | 64 MB | ROI-cropped VTI only, not full thorax |
| GPU memory in use | < 220 MB | 256 MB | Includes geometry, textures, render targets |
| Pseudo-TEE / oblique buffers | 768x768 each | 1024x1024 each | Cap device pixel ratio at `1.5` on integrated GPUs |

### Progressive Loading Strategy

Load in four stages:

1. **Shell**
   - app code
   - case catalog
2. **Critical case stage**
   - `case_manifest.json`
   - `scene.glb`
   - `probe_path.json`
   - `views.json`
   - `landmarks.json`
3. **Diagnostic stage**
   - `heart_detail.glb`
   - `heart_roi.vti`
4. **Optional stage**
   - `motion.bin`
   - any optional center-pane volume overlay

Rules:

- only one full case stays resident in memory
- preload the next stage only after first meaningful paint
- if bandwidth is poor, the 3D pane may become interactive before the pseudo-TEE pane finishes loading
- motion remains off until explicitly enabled

---

## 7. Directory Structure

```text
docs/
  research/
    2026-04-06-mvp-proposal-web-rendering.md

public/
  cases/
    index.json
    adult_canonical_f01/
      case_manifest.json
      scene.glb
      heart_detail.glb
      heart_roi.vti
      probe_path.json
      landmarks.json
      views.json
      appearance.json
      motion.bin
    adult_patient_001/
      ...
    adult_patient_002/
      ...
    adult_patient_003/
      ...

src/
  app/
    App.tsx
    routes.ts
  components/
    layout/
      ThreePaneLayout.tsx
      TopBar.tsx
      ProbeDock.tsx
    overlays/
      HudOverlay.tsx
      AnatomyLabels.tsx
  features/
    cases/
      caseCatalog.ts
      caseAssetLoader.ts
      runtimeAssetCache.ts
      types.ts
    probe/
      probeStore.ts
      probeKinematics.ts
      probeInputController.ts
      __tests__/
    views/
      presetService.ts
      viewMatcher.ts
      __tests__/
    rendering/
      renderCoordinator.ts
      performanceManager.ts
      vtk/
        anatomyViewport.ts
        obliqueSliceViewport.ts
      pseudoTee/
        pseudoTeeViewport.ts
        shaders.ts
      __tests__/
  lib/
    math/
    geometry/
    performance/
  styles/
    tokens.css
```

Key structural choice: keep rendering code under `features/rendering/`, not inside generic React components. The React tree should assemble the app, not own imaging math.

---

## 8. Risks & Mitigations

| Risk | Why It Matters | Mitigation |
|------|----------------|------------|
| VTK.js is less ergonomic than scene-first engines | Team velocity may slow if the codebase becomes renderer-centric everywhere | Isolate VTK.js inside viewport adapters and `RenderCoordinator`. Keep UI and state engine-agnostic. |
| Pseudo-TEE may look "not real enough" | Users will judge quality from the left pane first | Be explicit that MVP is pseudo-TEE, not diagnostic ultrasound. Tune appearance with `appearance.json`, validate with an echocardiographer, and privilege anatomical correctness over texture realism. |
| GPU memory pressure on integrated hardware | Volume textures and three panes can exceed budget quickly | ROI-crop the VTI, cap DPR, keep one case resident, lazy-load motion, and degrade buffer sizes before dropping anatomy. |
| React rerender loops can tank interaction | Probe motion is continuous and high-frequency | Keep the frame loop outside React. Use selector-based subscriptions from an external store. |
| Multi-pane synchronization drift | Even small transform mismatches break trust in the simulator | Enforce one `ProbePose`, one `ImagingPlane`, one coordinate system. Reject misregistered assets instead of compensating silently. |
| Label clutter obscures learning | Too many labels destroy readability | Limit simultaneous labels, prioritize contextually relevant structures, and use hover/toggle modes for secondary labels. |
| The team may over-invest in 3D visual polish | Beautiful rendering can hide a weak teaching interaction model | Make presets, overlays, and probe controls first-class deliverables. Treat fancy lighting and non-essential shaders as optional. |
| WebGPU temptation causes schedule slip | Engineers may chase future-facing tech instead of shipping | Freeze MVP on WebGL2. Revisit WebGPU only after shipping a stable VTK.js baseline and collecting real performance data. |

---

## 9. Effort Estimate (T-shirt Sizes per Component)

| Component | Size | Rationale |
|-----------|------|-----------|
| App shell + 3-pane layout | `M` | Standard React work, but requires careful responsive behavior and keyboard handling. |
| Case catalog + staged asset loader | `M` | Straightforward, but needs disciplined loading order and disposal. |
| Probe kinematics engine | `L` | Domain-critical math. Needs correctness, tests, and stable coordinate handling. |
| View preset service + tolerance matching | `M` | Moderate complexity, high educational value. |
| 3D anatomy viewport | `L` | Probe visualization, sector plane, highlighting, camera presets, and mesh management. |
| Pseudo-TEE viewport + shader pass | `XL` | Highest novelty area. Needs reslice coordination, wedge rendering, and credible ultrasound-like styling without overshooting scope. |
| Oblique slice viewport | `M` | Technically simpler than pseudo-TEE once plane sync is solved. |
| Overlay system | `M` | Requires label placement, collision handling, and clear visual hierarchy. |
| Performance manager + quality tiers | `M` | Essential for stable laptop performance and graceful degradation. |
| Motion controller | `S` | Small if phase playback stays simple and optional. |
| Testing and visual validation harness | `L` | Needed for probe math regression checks and anchor-view snapshots. |

Overall MVP rendering effort: **L to XL**, dominated by the probe math, synchronized multi-pane rendering, and the pseudo-TEE image pipeline.

The highest-leverage sequence is:

1. probe kinematics + preset jumps
2. 3D anatomy pane
3. oblique slice pane
4. pseudo-TEE pane
5. overlays and performance tuning

That order gets the anatomically correct core working before spending time on ultrasound-like appearance.
