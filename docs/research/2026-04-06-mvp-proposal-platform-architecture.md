# MVP Architecture Proposal: Platform-Architecture-First

**Date:** 2026-04-06
**Status:** Draft
**Author:** Architecture Review
**Feeds into:** ADR-0001

---

## 1. Executive Summary

TeeSim is a browser-only 3D TEE simulator built on static assets with no backend runtime. The core engineering challenge is not web-app plumbing -- it is **real-time GPU rendering of anatomical volumes synchronized with a kinematic probe model, all within browser memory and GPU constraints**. Every architecture decision flows from this constraint.

**Key decisions made in this document:**

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Repo structure | **Monorepo** (pnpm workspaces) | Single team, shared types, coordinated releases, one CI pipeline |
| UI framework | **React 18+** with Vite | Ecosystem depth for medical UI, R3F integration path, VTK.js React wrappers exist |
| State management | **Zustand** with subscriptions | Minimal boilerplate, fine-grained subscriptions for 60 Hz render loop, no provider hell |
| 3D renderer | **VTK.js** (primary) + Three.js/R3F (scene chrome) | VTK.js is the only browser library with production `vtkImageReslice` for arbitrary oblique volume slicing |
| Bundler | **Vite 6** (Rollup under the hood) | Fast dev, mature code splitting, WASM support for VTK.js codecs |
| Testing | Vitest (unit) + Playwright (E2E) + Percy/Argos (visual regression) | Single test runner for unit/integration; Playwright for WebGL screenshot diffing |
| Hosting | **Cloudflare Pages** + R2 (assets) | Edge-cached static hosting, R2 for large GLB/VTI with range-request support, no server |
| PWA | **Workbox** service worker, asset-tier caching | Offline-first for the app shell; lazy-cache for case assets on first use |

**What this proposal does NOT decide:** VTK.js vs Cornerstone3D for the Phase 2 DICOM route (deferred to ADR-0002), specific UI component library, and authentication provider for Phase 2 educator features.

---

## 2. Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                              BROWSER (Client-Only MVP)                            |
|                                                                                   |
|  +------------------+    +------------------+    +--------------------+            |
|  |   App Shell      |    |  Asset Loader    |    |  Service Worker    |            |
|  |  (React + Vite)  |    |  (Priority Queue)|    |  (Workbox/PWA)     |            |
|  +--------+---------+    +--------+---------+    +--------+-----------+            |
|           |                       |                       |                        |
|           v                       v                       v                        |
|  +--------+----------+   +-------+--------+    +---------+----------+             |
|  |   UI Layer        |   | Asset Cache    |    | Cache Storage      |             |
|  | +--------------+  |   | (IndexedDB +   |    | (Cache API for     |             |
|  | | Probe HUD    |  |   |  Memory LRU)   |    |  app shell + CDN   |             |
|  | +--------------+  |   +-------+--------+    |  asset responses)  |             |
|  | | View Picker  |  |           |             +--------------------+             |
|  | +--------------+  |           |                                                |
|  | | Anatomy      |  |           v                                                |
|  | | Labels       |  |   +------+-------+                                         |
|  | +--------------+  |   | Asset Types  |                                         |
|  | | Exercise     |  |   | .glb (mesh)  |                                         |
|  | | Panel (Ph2)  |  |   | .vti (volume)|                                         |
|  | +--------------+  |   | .json (meta) |                                         |
|  +---------+---------+   | .bin (motion)|                                         |
|            |              +------+-------+                                         |
|            v                     |                                                 |
|  +---------+---------+          |                                                  |
|  |  State Store      |          |                                                  |
|  |  (Zustand)        +<---------+                                                  |
|  |                   |                                                             |
|  | +-------------+   |                                                             |
|  | | ProbeState  |   |   probe.s, roll, ante, lateral, omniplane                   |
|  | +-------------+   |                                                             |
|  | | SceneState  |   |   loaded case, active structures, visibility                |
|  | +-------------+   |                                                             |
|  | | ViewState   |   |   camera, zoom, 3D view orientation                         |
|  | +-------------+   |                                                             |
|  | | UIState     |   |   selected panel, labels on/off, exercise mode              |
|  | +-------------+   |                                                             |
|  +--------+----------+                                                             |
|           |                                                                        |
|           v                                                                        |
|  +--------+-------------------------------------------------------------------+    |
|  |                         Rendering Engine                                   |    |
|  |                                                                            |    |
|  |  +------------------+  +-------------------+  +------------------------+   |    |
|  |  | 3D Scene Pane    |  | Pseudo-TEE Pane   |  | Oblique Slice Pane     |   |    |
|  |  | (VTK.js /        |  | (VTK.js           |  | (VTK.js                |   |    |
|  |  |  Three.js hybrid)|  |  vtkImageReslice  |  |  vtkImageReslice +     |   |    |
|  |  |                  |  |  + sector mask +   |  |  label colormap)       |   |    |
|  |  | - GLB meshes     |  |  pseudo-US LUT)   |  |                        |   |    |
|  |  | - Probe glyph    |  |                   |  |                        |   |    |
|  |  | - Sector plane   |  |                   |  |                        |   |    |
|  |  | - Labels         |  |                   |  |                        |   |    |
|  |  +------------------+  +-------------------+  +------------------------+   |    |
|  +------------------------------------------------------------------------+   |    |
+-----------------------------------------------------------------------------------+
         |                             |
         v                             v
+------------------+         +-------------------+
| CDN / R2 Bucket  |         | Static Host       |
| (GLB, VTI, BIN)  |         | (HTML, JS, CSS)   |
| Range requests   |         | Cloudflare Pages  |
| Cache-Control:   |         | or Vercel/Netlify |
|  immutable, 1yr  |         +-------------------+
+------------------+

                    OFFLINE PIPELINE (not in browser)
+------------------------------------------------------------------+
|  3D Slicer + SlicerHeart                                         |
|  DICOM/NIfTI --> segment --> decimate --> export GLB/VTI/JSON    |
|  Author anchor views --> views.json                               |
|  Extract esophageal centerline --> probe_path.json                |
|  Generate motion tracks --> motion.bin                            |
+------------------------------------------------------------------+
```

### Phase 2 Extension Points (shown as dashed boundaries)

```
                          Phase 2 Additions
                     (do not build in MVP)

+- - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
:                                                            :
:  +------------------+     +-------------------+            :
:  | Orthanc DICOM    |---->| DICOMweb Proxy    |            :
:  | Server (Docker)  |     | (WADO-RS/STOW-RS) |           :
:  +------------------+     +--------+----------+            :
:                                    |                       :
:                                    v                       :
:                           +--------+----------+            :
:                           | Cornerstone3D     |            :
:                           | DICOM Loader      |            :
:                           | (replaces static  |            :
:                           |  VTI for DICOM    |            :
:                           |  cases only)      |            :
:                           +-------------------+            :
:                                                            :
:  +------------------+     +-------------------+            :
:  | Auth Provider    |---->| Scoring/Progress  |            :
:  | (Clerk/Auth0)    |     | (Supabase or      |            :
:  +------------------+     |  Cloudflare D1)   |            :
:                           +-------------------+            :
:                                                            :
+- - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
```

---

## 3. Component Breakdown

### 3.1 `packages/core` -- Simulator Core (pure TypeScript, no DOM)

**Responsibility:** Probe kinematics, coordinate transforms, view matching, case manifest parsing. This is the domain logic that must be testable without a browser.

| Module | Description |
|--------|-------------|
| `probe-model.ts` | 5-DOF probe state, esophageal centerline interpolation (cubic spline on `probe_path.json`), tip position/orientation matrix computation |
| `view-matcher.ts` | Given current probe state and a `views.json` preset, compute angular distance to each anchor view. Emit "view identified" events when within threshold |
| `case-manifest.ts` | Parse and validate `case_manifest.json`. Enumerate required assets. Compute bounding box, structure list, license metadata |
| `transforms.ts` | Imaging plane computation from probe state: sector origin, sector normal, fan geometry. Omniplane rotation matrix. Oblique slice plane equation |
| `types.ts` | Shared TypeScript types: `ProbeState`, `CaseManifest`, `AnchorView`, `AssetRef`, `LabelMap` |

**Interface:**
```typescript
// All functions are pure -- no side effects, no DOM, no GPU
interface SimulatorCore {
  createProbeState(path: CenterlinePath): ProbeState;
  advanceProbe(state: ProbeState, delta: ProbeDelta): ProbeState;
  getImagingPlane(state: ProbeState): Plane;
  getSectorGeometry(state: ProbeState, config: SectorConfig): SectorMesh;
  matchView(state: ProbeState, views: AnchorView[]): ViewMatch[];
  parseManifest(json: unknown): CaseManifest;
}
```

**Dependencies:** None (zero external deps). Ships as ESM.

**Why isolated:** Probe kinematics is the single hardest piece to get right. Bugs here produce wrong images everywhere. It must be exhaustively unit-tested without spinning up WebGL. It is also the most reusable piece -- a future native app or VR version would reuse this package wholesale.

---

### 3.2 `packages/assets` -- Asset Pipeline & Loader

**Responsibility:** Fetching, caching, decoding, and memory-managing all binary assets (GLB, VTI, motion.bin). Enforces the GPU memory budget.

| Module | Description |
|--------|-------------|
| `loader.ts` | Priority-queue asset loader. GLB via Three.js GLTFLoader or VTK.js, VTI via vtk.js `vtkXMLImageDataReader`, JSON via fetch. Supports `AbortController` for cancellation on case switch |
| `cache.ts` | Two-tier cache: L1 = in-memory LRU (decoded GPU-ready objects, capped at ~512 MB), L2 = IndexedDB (raw bytes, persisted across sessions). Cache key = `{caseId}/{filename}@{contentHash}` |
| `budget.ts` | GPU memory budget tracker. Before loading a new case, estimate total GPU memory (mesh vertex count * stride + volume dimensions * bytes-per-voxel). Reject or evict if over budget |
| `priority.ts` | Asset priority queue: (1) case_manifest.json, (2) probe_path.json + views.json, (3) heart_detail.glb + heart_roi.vti, (4) scene.glb, (5) motion.bin, (6) appearance.json. Priority 1-2 block UI; 3-6 show progressive loading |
| `streaming.ts` | Range-request support for large VTI files. Stream first 64 KB to read VTI header and compute dimensions before committing to full download |

**Interface:**
```typescript
interface AssetLoader {
  loadCase(caseId: string, onProgress: (phase: LoadPhase, pct: number) => void): Promise<LoadedCase>;
  preloadCase(caseId: string): void; // background, low priority
  evictCase(caseId: string): void;
  getMemoryUsage(): MemoryReport;
}
```

**Dependencies:** `@packages/core` (for `CaseManifest` types), `idb-keyval` (IndexedDB wrapper, ~600 B).

---

### 3.3 `packages/renderer` -- VTK.js + Three.js Rendering

**Responsibility:** All GPU rendering. Owns the three panes (3D scene, pseudo-TEE, oblique slice). Translates `ProbeState` + loaded assets into rendered frames.

| Module | Description |
|--------|-------------|
| `scene-3d.ts` | Three.js/R3F scene for the 3D anatomy view. Renders GLB meshes, probe glyph, sector plane visualization, label overlays. Chosen over VTK.js for this pane because R3F's declarative scene graph is faster to develop for mesh-only rendering |
| `pseudo-tee.ts` | VTK.js rendering pipeline: `vtkImageReslice` to extract oblique slice from `heart_roi.vti` at the imaging plane, then apply sector mask (fan shape) and pseudo-ultrasound LUT (grayscale with depth-dependent attenuation). This is the core differentiator |
| `oblique-slice.ts` | VTK.js `vtkImageReslice` with anatomy label colormap overlay. Simpler than pseudo-TEE (no sector mask, no US appearance) |
| `sync-manager.ts` | Listens to Zustand probe state. On every state change, recomputes imaging plane (via `@packages/core`), then updates all three panes in a single `requestAnimationFrame`. Batches updates to avoid triple-rendering |
| `perf-monitor.ts` | FPS counter, render-time histogram, GPU memory estimate. Exposed as a React component overlay and as a telemetry hook |

**Interface:**
```typescript
interface Renderer {
  // React components
  Scene3DPane: React.FC<{ width: number; height: number }>;
  PseudoTEEPane: React.FC<{ width: number; height: number }>;
  ObliqueSlicePane: React.FC<{ width: number; height: number }>;
  PerfOverlay: React.FC;
}
```

**Dependencies:** `@packages/core`, `vtk.js`, `three`, `@react-three/fiber`, `@react-three/drei`.

**Design constraint -- hybrid renderer rationale:** VTK.js is essential for `vtkImageReslice` (volume oblique slicing) and the pseudo-TEE pipeline. But VTK.js's scene graph API is imperative and verbose for mesh-only rendering. Three.js/R3F is far more productive for the 3D anatomy scene (declarative, huge ecosystem of helpers). The two renderers live in separate canvases. They share state via Zustand subscriptions, not by sharing a WebGL context. This avoids the painful VTK.js + Three.js context-sharing bugs. The cost is two WebGL contexts, which is fine on modern hardware (Chrome supports 16+).

---

### 3.4 `packages/ui` -- React UI Components

**Responsibility:** All non-3D UI: probe control HUD, view picker sidebar, anatomy label panel, case selector, settings, layout management.

| Module | Description |
|--------|-------------|
| `ProbeHUD` | Displays current probe DOF values. Slider/knob controls for each DOF. Keyboard shortcut bindings |
| `ViewPicker` | List of anchor views with thumbnails. Click to snap probe to preset. Shows "match %" when close to a view |
| `AnatomyLabels` | Toggle anatomical structure labels on/off. Highlight structure on hover. List derived from `case_manifest.json` structure list |
| `CaseSelector` | Grid of available cases with thumbnails and license badges. Triggers `AssetLoader.loadCase()` |
| `Layout` | Three-pane responsive layout. Desktop: side-by-side. Tablet: stacked. Uses CSS Grid, not a layout library |
| `SettingsPanel` | Render quality (low/med/high), label density, keyboard mapping |
| `ExercisePanel` | (Phase 2 stub) Empty shell component with defined props interface. Wired to `UIState.exerciseMode` flag |

**Dependencies:** `@packages/core` (types), `@packages/renderer` (pane components), Zustand store.

**No component library in MVP.** Headless UI primitives (Radix or Ariakit) will be added if/when the UI grows beyond 15-20 components. For MVP, raw HTML + Tailwind CSS keeps the bundle small and avoids fighting a component library's opinions about medical UI layouts.

---

### 3.5 `apps/web` -- Application Shell

**Responsibility:** Vite entry point, route definitions (just `/` for MVP), Zustand store instantiation, service worker registration, HTML shell.

This is intentionally thin. It composes packages but contains almost no logic of its own.

| File | Description |
|------|-------------|
| `main.tsx` | React root, Zustand provider (actually just module-level store -- Zustand needs no provider), mount point |
| `store.ts` | Zustand store definition. Imports slice creators from packages. Single store, multiple slices |
| `sw.ts` | Workbox service worker configuration |
| `index.html` | HTML shell with loading skeleton, Open Graph meta, PWA manifest link |
| `vite.config.ts` | Vite config: chunk splitting strategy, WASM loader for VTK.js, PWA plugin |

---

### 3.6 `tools/asset-pipeline` -- Offline Asset Factory Scripts

**Responsibility:** CLI scripts that automate the 3D Slicer/SlicerHeart pipeline. Not shipped to the browser.

| Script | Description |
|--------|-------------|
| `ingest-case.py` | Orchestrate: DICOM/NIfTI input --> segment (TotalSegmentator) --> decimate --> export GLB/VTI/JSON |
| `author-views.py` | 3D Slicer script to interactively place anchor views, export `views.json` |
| `extract-centerline.py` | Extract esophageal centerline from segmentation, export `probe_path.json` |
| `validate-case.sh` | Validate a case directory: check all required files exist, mesh triangle counts within budget, VTI dimensions within GPU budget, JSON schema validation |
| `build-case-index.ts` | Generate `cases/index.json` from all case directories for the web app's case selector |

**Dependencies:** Python 3.10+, 3D Slicer (CLI mode), TotalSegmentator, Node.js (for JSON schema validation).

---

## 4. Data Flow

### 4.1 Asset Loading Pipeline

```
User selects case
       |
       v
[1] Fetch case_manifest.json (< 1 KB, blocks render)
       |
       v
[2] Parse manifest, compute required assets and total estimated GPU memory
       |
       +---> If over budget: show warning, offer to unload current case
       |
       v
[3] Fetch probe_path.json + views.json in parallel (< 10 KB each, blocks probe controls)
       |
       v
[4] Initialize probe state on centerline. UI becomes interactive (probe controls enabled).
    Show "Loading anatomy..." skeleton in 3D panes.
       |
       v
[5] Fetch heart_detail.glb + heart_roi.vti in parallel (10-50 MB combined)
    Progress bar visible. VTI uses range-request streaming if supported.
       |
       +---> heart_detail.glb decoded --> 3D scene pane renders mesh
       +---> heart_roi.vti decoded --> pseudo-TEE + oblique slice panes render
       |
       v
[6] Fetch scene.glb (thorax, lungs, ribs -- 5-20 MB). Non-blocking.
    3D scene progressively adds structures as they decode.
       |
       v
[7] Fetch motion.bin (2-10 MB). Non-blocking.
    Once loaded, cardiac animation begins.
       |
       v
[8] Fetch appearance.json (< 5 KB). Non-blocking.
    Pseudo-TEE pane applies structure-specific rendering parameters.
       |
       v
[DONE] All assets loaded. Full scene interactive.
```

**Cache behavior:** On repeat visits, steps 5-8 hit IndexedDB L2 cache and skip network entirely. Steps 1-3 always revalidate (ETag/304) to pick up view preset updates.

### 4.2 State Propagation (per frame)

```
User input (slider drag, keyboard, touch)
       |
       v
Zustand store: update ProbeState
  {s, roll, ante, lateral, omniplane}
       |
       +---> ProbeState subscription in sync-manager.ts
       |         |
       |         v
       |    core.getImagingPlane(probeState)
       |         |
       |         +---> Update pseudo-TEE pane (vtkImageReslice origin + normal)
       |         +---> Update oblique slice pane (vtkImageReslice origin + normal)
       |         +---> Update 3D scene (probe glyph transform, sector plane geometry)
       |
       +---> ProbeState subscription in ViewMatcher
       |         |
       |         v
       |    core.matchView(probeState, anchorViews)
       |         |
       |         +---> Update ViewPicker UI (highlight matched view, show %)
       |
       +---> ProbeState subscription in ProbeHUD
                 |
                 v
            Update DOF readouts (direct DOM update, no React re-render)
```

**Synchronous vs async boundary:**

| Operation | Timing | Why |
|-----------|--------|-----|
| Probe state update | **Synchronous** (Zustand set) | Must feel instant; any lag in probe response ruins the learning experience |
| Imaging plane computation | **Synchronous** (< 0.1 ms, pure math) | Matrix multiply, no allocation |
| VTK.js reslice update | **Synchronous within rAF** (~2-5 ms) | GPU reslice is fast once volume is in GPU memory. Must complete before paint |
| View matching | **Synchronous** (< 0.5 ms) | Dot products against 8-10 presets |
| Asset loading | **Async** (network + decode) | Obviously cannot block the render loop |
| IndexedDB cache write | **Async** (fire-and-forget) | Write-behind; never blocks rendering |
| Motion animation | **Async** (rAF driven) | Independent heartbeat clock, blended with probe state |

### 4.3 Rendering Pipeline (per frame)

```
requestAnimationFrame
       |
       v
Read ProbeState from Zustand (non-reactive get, not subscribe)
       |
       v
Compute imaging plane (core.getImagingPlane)
       |
       +---> Pseudo-TEE Canvas (VTK.js)
       |     1. Set vtkImageReslice plane to imaging plane
       |     2. Apply sector mask (fan shape from SectorConfig)
       |     3. Apply pseudo-US lookup table (grayscale + depth attenuation)
       |     4. vtk.js renderWindow.render()
       |
       +---> Oblique Slice Canvas (VTK.js)
       |     1. Set vtkImageReslice plane to imaging plane
       |     2. Apply anatomy label colormap
       |     3. vtk.js renderWindow.render()
       |
       +---> 3D Scene Canvas (Three.js / R3F)
             1. Update probe glyph transform (position + orientation matrix)
             2. Update sector plane mesh (position + normal + fan extent)
             3. If motion loaded: interpolate blendshape weights for current cardiac phase
             4. three.js renderer.render()
```

---

## 5. Tech Stack Choices

### 5.1 UI Framework: React 18+

| Alternative | Rejected because |
|-------------|-----------------|
| Svelte/SvelteKit | Smaller ecosystem for 3D medical rendering. No mature VTK.js or R3F bindings. Would require writing all integrations from scratch |
| Vue 3 | TresJS (Vue R3F equivalent) is less mature. VTK.js Vue wrappers are community-maintained, not official |
| Solid.js | Fine-grained reactivity is appealing for render loops, but ecosystem is too young for medical/3D. No VTK.js integration |
| Vanilla (no framework) | VTK.js examples are vanilla, but UI complexity (panels, settings, exercise mode) will grow. Framework pays for itself by Phase 2 |

**React wins because:** VTK.js has official React examples. R3F is the best declarative 3D scene graph in any framework. The medical imaging ecosystem (OHIF, Cornerstone3D) is React-based, which matters for Phase 2 DICOM integration.

### 5.2 State Management: Zustand

| Alternative | Rejected because |
|-------------|-----------------|
| Redux Toolkit | Too much ceremony for this app. Actions/reducers/selectors overhead is not justified when the core state is a 5-number probe tuple |
| Jotai | Atom-based model is elegant but makes it harder to snapshot the full probe state for view matching (need to compose atoms) |
| Valtio | Proxy-based reactivity has edge cases with TypedArrays and WebGL buffer objects |
| MobX | Decorator-heavy API adds cognitive load. Observable arrays interact poorly with VTK.js data structures |
| React context + useReducer | Fine for UI state, but context triggers full subtree re-renders on every probe movement. Unacceptable at 30-60 Hz |

**Zustand wins because:**
- `subscribe` with selector lets the render loop read state changes without triggering React re-renders
- `getState()` gives synchronous non-reactive access in the rAF loop (critical for render pipeline)
- Tiny bundle (< 2 KB)
- Middleware for devtools, persist (IndexedDB for user preferences), and immer (for nested UI state)
- Multiple slices in one store, or multiple stores -- flexible as complexity grows

### 5.3 3D Rendering: VTK.js (primary) + Three.js/R3F (scene chrome)

| Alternative | Rejected because |
|-------------|-----------------|
| VTK.js only | VTK.js scene graph is imperative and painful for UI-heavy 3D (labels, gizmos, glow effects). Development velocity for the 3D anatomy pane would be 3-5x slower |
| Three.js only | No `vtkImageReslice` equivalent. Writing arbitrary oblique volume slicing in raw Three.js shaders is a multi-month effort and the core blocker |
| Cornerstone3D | Designed for DICOM viewing, not general 3D scene rendering. Overkill for MVP (huge dependency tree). Perfect for Phase 2 DICOM route, wrong for MVP |
| Babylon.js | Volume slicing support is experimental. Medical imaging ecosystem is thinner than VTK.js |
| WebGPU-native | Not baseline yet (Safari support incomplete as of early 2026). Future upgrade path, not MVP |

**Hybrid approach:** Two separate canvases, two WebGL contexts. State synchronized via Zustand subscriptions. No shared WebGL resources. This is the only approach that avoids context-fighting bugs between VTK.js and Three.js.

### 5.4 Bundler: Vite 6

| Alternative | Rejected because |
|-------------|-----------------|
| Webpack 5 | Slower dev server, more config. VTK.js works with Webpack but Vite's ESM-first approach is cleaner |
| esbuild (direct) | No mature code splitting. VTK.js WASM codecs need Rollup/Vite plugin support |
| Turbopack | Still experimental in production builds. Not worth the risk for a project with heavy WASM dependencies |
| Rspack | Promising but VTK.js + WASM interop is not battle-tested |

**Vite wins because:** Fast HMR for React development. Rollup-based production builds with mature code splitting. `vite-plugin-wasm` for VTK.js codec loading. `vite-plugin-pwa` for Workbox service worker generation. Large community solving VTK.js + Vite issues.

### 5.5 Testing

| Layer | Tool | What it tests |
|-------|------|--------------|
| Unit | **Vitest** | `@packages/core` probe kinematics, coordinate transforms, view matching. Pure functions, fast, no browser needed. Target: 100% branch coverage on core |
| Integration | **Vitest + jsdom** | Asset loader cache logic, manifest parsing, priority queue ordering. Mock fetch, test IndexedDB via fake-indexeddb |
| Visual regression | **Playwright + Percy** (or Argos CI) | Screenshot each of the 8-10 anchor views after loading the canonical case. Detect regressions in reslice output, label placement, sector geometry. Run in CI on headless Chrome with WebGL (SwiftShader) |
| E2E | **Playwright** | Full user flows: load app, select case, wait for assets, manipulate probe, verify view match triggers. Test on Chrome + Firefox + Safari (WebKit) |
| Performance | **Lighthouse CI** + custom | Core Web Vitals in CI. Custom: measure FPS over a scripted probe sweep, fail if < 30 FPS on SwiftShader |

### 5.6 Deployment: Cloudflare Pages + R2

| Alternative | Rejected because |
|-------------|-----------------|
| Vercel | Good for SSR apps but TeeSim is fully static. Vercel's free tier has stricter bandwidth limits. No native object storage for large assets |
| Netlify | Similar to Vercel: great DX but no integrated object storage. Large GLB/VTI files would need a separate CDN |
| AWS S3 + CloudFront | More infra to manage. Overkill for a static app. Higher operational complexity for a small team |
| GitHub Pages | 1 GB repo size limit is too small for anatomical assets. No range-request support |

**Cloudflare wins because:**
- Pages: free static hosting with global edge CDN, automatic HTTPS, preview deploys per PR
- R2: S3-compatible object storage with zero egress fees. Perfect for large GLB/VTI files. Supports range requests for streaming VTI headers
- Workers (Phase 2): edge compute for lightweight API (scoring, progress tracking) without a traditional backend
- Single platform for everything: avoids multi-vendor complexity

---

## 6. MVP Scope

### What gets built

| Package | MVP Deliverable |
|---------|----------------|
| `@teesim/core` | Full 5-DOF probe model, imaging plane computation, view matcher for 8-10 anchor views, case manifest parser |
| `@teesim/assets` | Priority-queue loader, IndexedDB cache, GPU memory budget tracker. No streaming (full download only in MVP) |
| `@teesim/renderer` | 3D scene pane (Three.js/R3F), pseudo-TEE pane (VTK.js reslice + sector mask + basic grayscale LUT), oblique slice pane (VTK.js reslice + label colormap). No motion animation in MVP render (motion.bin loaded but blendshapes deferred to fast-follow) |
| `@teesim/ui` | Probe HUD with sliders, view picker sidebar, anatomy label toggle, case selector, three-pane layout, settings panel |
| `apps/web` | Vite app shell, Zustand store, service worker (app shell caching only; asset caching in fast-follow), PWA manifest |
| `tools/asset-pipeline` | `ingest-case.py`, `author-views.py`, `extract-centerline.py`, `validate-case.sh`, `build-case-index.ts` |

### What is deferred

| Feature | Deferred to | Why |
|---------|-------------|-----|
| Cardiac motion animation | Fast-follow (2 weeks post-MVP) | Blendshape rendering works but requires tuning per case. MVP can ship with static anatomy and still be useful for view finding |
| VTI streaming (range requests) | Fast-follow | Full download works for cases < 50 MB. Streaming is an optimization |
| Exercise mode | Phase 2 | Requires scoring logic, possibly a backend. Stub component ships in MVP |
| DICOM route | Phase 2 | Orthanc + Cornerstone3D is a separate architecture spike |
| Trainee scoring/progress | Phase 2 | Requires authentication and persistence |
| Mobile-optimized UI | Phase 2 | Desktop-first for MVP. CSS Grid layout will reflow on tablet but touch controls need dedicated work |

### Package boundaries -- what crosses them

```
@teesim/core  <---types-only---  @teesim/assets
     |                                |
     | (pure functions)               | (loaded data)
     v                                v
@teesim/renderer  <---React components + hooks--->  @teesim/ui
     |                                                  |
     +------------------+  +----------------------------+
                        |  |
                        v  v
                     apps/web (composition root)
```

**Boundary rules:**
1. `@teesim/core` has ZERO runtime dependencies. It does not import from any other package.
2. `@teesim/assets` imports types from `@teesim/core` (CaseManifest, AssetRef). It does not import rendering or UI code.
3. `@teesim/renderer` imports from `@teesim/core` (probe math) and receives loaded data from `@teesim/assets` via Zustand store (not direct import).
4. `@teesim/ui` imports React components from `@teesim/renderer` and types from `@teesim/core`. It does not directly call asset loading functions (goes through store actions).
5. `apps/web` is the only package that wires everything together. It instantiates the Zustand store, registers the service worker, and mounts the React tree.

---

## 7. Directory Structure

```
teesim/
|-- .github/
|   |-- workflows/
|   |   |-- ci.yml                    # lint + typecheck + unit tests + visual regression
|   |   |-- deploy-preview.yml        # deploy PR preview to Cloudflare Pages
|   |   |-- deploy-production.yml     # deploy main to production
|   |   |-- docs-validate.yml         # existing
|   |-- ISSUE_TEMPLATE/               # existing
|   |-- PULL_REQUEST_TEMPLATE.md      # existing
|   |-- CODEOWNERS                    # existing
|
|-- packages/
|   |-- core/
|   |   |-- src/
|   |   |   |-- probe-model.ts
|   |   |   |-- transforms.ts
|   |   |   |-- view-matcher.ts
|   |   |   |-- case-manifest.ts
|   |   |   |-- types.ts
|   |   |   |-- index.ts
|   |   |-- tests/
|   |   |   |-- probe-model.test.ts
|   |   |   |-- transforms.test.ts
|   |   |   |-- view-matcher.test.ts
|   |   |   |-- case-manifest.test.ts
|   |   |   |-- fixtures/
|   |   |       |-- canonical-probe-path.json
|   |   |       |-- anchor-views-me4c.json
|   |   |-- package.json              # name: @teesim/core, zero deps
|   |   |-- tsconfig.json
|   |   |-- vitest.config.ts
|   |
|   |-- assets/
|   |   |-- src/
|   |   |   |-- loader.ts
|   |   |   |-- cache.ts
|   |   |   |-- budget.ts
|   |   |   |-- priority.ts
|   |   |   |-- streaming.ts          # stub in MVP
|   |   |   |-- index.ts
|   |   |-- tests/
|   |   |   |-- loader.test.ts
|   |   |   |-- cache.test.ts
|   |   |   |-- budget.test.ts
|   |   |   |-- priority.test.ts
|   |   |-- package.json              # name: @teesim/assets
|   |   |-- tsconfig.json
|   |   |-- vitest.config.ts
|   |
|   |-- renderer/
|   |   |-- src/
|   |   |   |-- scene-3d/
|   |   |   |   |-- Scene3DPane.tsx
|   |   |   |   |-- ProbeGlyph.tsx
|   |   |   |   |-- SectorPlane.tsx
|   |   |   |   |-- AnatomyMeshes.tsx
|   |   |   |   |-- StructureLabels3D.tsx
|   |   |   |-- pseudo-tee/
|   |   |   |   |-- PseudoTEEPane.tsx
|   |   |   |   |-- sector-mask.ts
|   |   |   |   |-- us-lookup-table.ts
|   |   |   |-- oblique-slice/
|   |   |   |   |-- ObliqueSlicePane.tsx
|   |   |   |   |-- label-colormap.ts
|   |   |   |-- sync-manager.ts
|   |   |   |-- perf-monitor.ts
|   |   |   |-- index.ts
|   |   |-- tests/
|   |   |   |-- visual/
|   |   |   |   |-- anchor-views.spec.ts     # Playwright visual regression
|   |   |   |   |-- snapshots/               # baseline screenshots
|   |   |   |-- sync-manager.test.ts
|   |   |-- package.json              # name: @teesim/renderer
|   |   |-- tsconfig.json
|   |   |-- vitest.config.ts
|   |
|   |-- ui/
|   |   |-- src/
|   |   |   |-- components/
|   |   |   |   |-- ProbeHUD.tsx
|   |   |   |   |-- ViewPicker.tsx
|   |   |   |   |-- AnatomyLabels.tsx
|   |   |   |   |-- CaseSelector.tsx
|   |   |   |   |-- SettingsPanel.tsx
|   |   |   |   |-- ExercisePanel.tsx       # Phase 2 stub
|   |   |   |-- layouts/
|   |   |   |   |-- ThreePaneLayout.tsx
|   |   |   |   |-- LoadingScreen.tsx
|   |   |   |-- hooks/
|   |   |   |   |-- useProbeControls.ts
|   |   |   |   |-- useKeyboardShortcuts.ts
|   |   |   |   |-- useCaseLoader.ts
|   |   |   |-- index.ts
|   |   |-- package.json              # name: @teesim/ui
|   |   |-- tsconfig.json
|
|-- apps/
|   |-- web/
|   |   |-- src/
|   |   |   |-- main.tsx
|   |   |   |-- App.tsx
|   |   |   |-- store.ts              # Zustand store with slices
|   |   |   |-- store/
|   |   |   |   |-- probe-slice.ts
|   |   |   |   |-- scene-slice.ts
|   |   |   |   |-- view-slice.ts
|   |   |   |   |-- ui-slice.ts
|   |   |-- public/
|   |   |   |-- manifest.json         # PWA manifest
|   |   |   |-- icons/                # PWA icons
|   |   |   |-- favicon.ico
|   |   |-- sw.ts                     # Workbox service worker source
|   |   |-- index.html
|   |   |-- vite.config.ts
|   |   |-- tailwind.config.ts
|   |   |-- package.json              # name: @teesim/web
|   |   |-- tsconfig.json
|   |
|   |-- web/e2e/
|       |-- case-load.spec.ts
|       |-- probe-manipulation.spec.ts
|       |-- view-finding.spec.ts
|       |-- playwright.config.ts
|
|-- tools/
|   |-- asset-pipeline/
|   |   |-- ingest-case.py
|   |   |-- author-views.py
|   |   |-- extract-centerline.py
|   |   |-- validate-case.sh
|   |   |-- build-case-index.ts
|   |   |-- schemas/
|   |   |   |-- case-manifest.schema.json
|   |   |   |-- views.schema.json
|   |   |   |-- probe-path.schema.json
|   |   |-- requirements.txt          # Python deps
|   |   |-- README.md
|
|-- cases/                            # git-ignored in main repo; synced to R2
|   |-- index.json                    # generated by build-case-index.ts
|   |-- adult_normal_f01/
|   |   |-- case_manifest.json
|   |   |-- scene.glb
|   |   |-- heart_detail.glb
|   |   |-- heart_roi.vti
|   |   |-- landmarks.json
|   |   |-- probe_path.json
|   |   |-- views.json
|   |   |-- motion.bin
|   |   |-- appearance.json
|   |-- ts_case_001/                  # TotalSegmentator-derived
|   |-- ts_case_002/
|   |-- ts_case_003/
|
|-- docs/                             # existing structure
|   |-- product/
|   |-- decisions/
|   |-- research/
|   |-- runbooks/
|
|-- changes/                          # existing structure
|
|-- CLAUDE.md
|-- AGENTS.md
|-- README.md
|-- package.json                      # root: pnpm workspace config
|-- pnpm-workspace.yaml
|-- pnpm-lock.yaml
|-- tsconfig.base.json                # shared TS config
|-- .eslintrc.cjs
|-- .prettierrc
|-- .gitignore
|-- turbo.json                        # Turborepo for task orchestration
```

---

## 8. Deep-Dive: Key Architecture Decisions

### 8.1 Monorepo vs Polyrepo

**Decision: Monorepo with pnpm workspaces + Turborepo.**

Rationale specific to TeeSim:

1. **Single developer or very small team.** Polyrepo overhead (cross-repo PRs, version matrix, publish cycles) is pure tax with no benefit when 1-3 people work on the project.

2. **Tight coupling between probe math and rendering.** A change to `getImagingPlane()` in `@teesim/core` immediately affects what `@teesim/renderer` displays. In a polyrepo, you would need to publish core, bump the version in renderer, test, and then discover the regression. In a monorepo, the CI catches it in one PR.

3. **Shared TypeScript types.** `ProbeState`, `CaseManifest`, `AnchorView` are used by every package. In a polyrepo, these types would drift or require a separate `@teesim/types` package with its own publish cycle.

4. **Asset pipeline scripts need access to the same JSON schemas as the web app.** Monorepo lets `tools/asset-pipeline` and `packages/core` share schema definitions.

5. **Cases directory is adjacent.** The `cases/` directory is git-ignored but lives in the repo root for local development. Asset pipeline scripts output directly into it. The web app reads from it via Vite's `publicDir` or a dev proxy.

**When to split:** If Phase 2 introduces a backend service (scoring, progress tracking), it could live in `apps/api/` within the monorepo initially and split to a separate repo only if it needs independent deploy cycles or a different language runtime.

### 8.2 Offline / PWA Strategy

**Three-tier caching:**

| Tier | What | Cache Strategy | Storage |
|------|------|---------------|---------|
| App shell | HTML, JS, CSS, PWA manifest, icons | **Precache** (Workbox InjectManifest). Versioned by build hash. Available offline immediately after first visit | Cache API via service worker |
| Case metadata | `index.json`, `case_manifest.json`, `views.json`, `probe_path.json` | **Stale-while-revalidate**. Serve cached version instantly, update in background. Small files (< 50 KB total) | Cache API via service worker |
| Case assets | `.glb`, `.vti`, `.bin` | **Cache-first with IndexedDB fallback**. On first load, fetch from CDN and write to IndexedDB. On subsequent loads, read from IndexedDB (no network). Evict LRU when IndexedDB exceeds 500 MB | IndexedDB (via `@teesim/assets` cache module) |

**Why IndexedDB for large assets instead of Cache API:**
- Cache API stores Response objects. For VTI files that need to be parsed into `vtkImageData`, we would fetch, parse, and then have both the raw Response and the parsed object in memory. Wasteful.
- IndexedDB lets us store the parsed/decoded representation directly (ArrayBuffer of the VTI, or even the decoded vtkImageData serialized form).
- IndexedDB has no per-origin storage limit in practice (browsers grant ~10% of disk on user gesture).

**Offline-first user experience:**
- First visit: app shell loads instantly from CDN. Case list appears. User selects a case. Assets download with progress bar. App is fully functional.
- Second visit: app shell from service worker cache (0 ms network). Case metadata from stale-while-revalidate (instant). Case assets from IndexedDB (no network). Fully offline.
- No network required after first successful case load.

### 8.3 Plugin / Extensibility Architecture for Phase 2

Rather than building a formal plugin system (over-engineering for a small team), define **extension points** -- well-typed interfaces at package boundaries that Phase 2 features plug into.

**Extension Point 1: Volume Source**

MVP: VTI files loaded statically from CDN.
Phase 2 (DICOM route): Cornerstone3D loads DICOM via DICOMweb, produces an `vtkImageData`-compatible volume.

```typescript
// @teesim/core/types.ts -- defined in MVP, implemented by Phase 2
interface VolumeSource {
  type: 'static-vti' | 'dicomweb';
  load(caseId: string): Promise<VolumeData>;
  getSlice(plane: Plane): SliceImageData;
}
```

The renderer consumes `VolumeSource` without knowing whether the data came from a VTI file or a DICOM server. MVP ships only the `static-vti` implementation.

**Extension Point 2: Scoring Sink**

MVP: View matching results are displayed in the UI. No persistence.
Phase 2: View matching results are also sent to a scoring backend.

```typescript
// @teesim/core/types.ts
interface ScoringSink {
  recordViewMatch(userId: string, viewId: string, matchQuality: number, timestamp: number): void;
  recordProbeTrace(userId: string, trace: ProbeState[]): void;
}

// MVP: no-op implementation
const nullScoringSink: ScoringSink = {
  recordViewMatch: () => {},
  recordProbeTrace: () => {},
};
```

**Extension Point 3: Case Source**

MVP: Cases listed in a static `index.json` on CDN.
Phase 2: Cases also discoverable via Orthanc DICOM server.

```typescript
interface CaseSource {
  type: 'static' | 'orthanc';
  listCases(): Promise<CaseSummary[]>;
  getCaseManifest(caseId: string): Promise<CaseManifest>;
}
```

**Why this works:** These interfaces are tiny (3-5 methods each) and defined in `@teesim/core/types.ts` from day one. They cost nothing to ship. But they force the renderer and UI to be decoupled from the specific data source, which is exactly what Phase 2 needs.

### 8.4 Phase 2 DICOM Route -- How to Add Without Breaking MVP

The DICOM route (Orthanc + DICOMweb + Cornerstone3D) is the highest-risk Phase 2 addition. Here is the integration path:

**Step 1: Add Cornerstone3D as a peer dependency of `@teesim/renderer`**

Cornerstone3D is large (~2 MB minified). It must be code-split and lazy-loaded only when a DICOM case is opened. It is never in the MVP bundle.

```typescript
// @teesim/renderer/src/volume-sources/dicomweb-source.ts
// This file is only imported via dynamic import when a DICOM case is selected
const cs = await import('@cornerstonejs/core');
const csTools = await import('@cornerstonejs/tools');
const csDICOM = await import('@cornerstonejs/dicom-image-loader');
```

**Step 2: Implement `VolumeSource` for DICOMweb**

```typescript
class DICOMwebVolumeSource implements VolumeSource {
  type = 'dicomweb' as const;

  constructor(private wadoRsRoot: string) {}

  async load(studyInstanceUID: string): Promise<VolumeData> {
    // Use Cornerstone3D streaming volume loader
    // Convert to VolumeData interface that renderer already consumes
  }

  getSlice(plane: Plane): SliceImageData {
    // Use Cornerstone3D CPU reslice or delegate to VTK.js vtkImageReslice
    // (Cornerstone3D uses VTK.js internally, so the reslice path is the same)
  }
}
```

**Step 3: Orthanc runs as a Docker container**

Orthanc is not in the browser. It runs on the educator's machine or a shared server. The browser talks to it via DICOMweb (WADO-RS for retrieval, STOW-RS for upload). This means:

- MVP deployment (Cloudflare Pages) is unchanged
- DICOM route requires an Orthanc server URL in the app configuration
- If no Orthanc URL is configured, DICOM features are hidden. MVP behavior is preserved

**Step 4: UI extension**

`CaseSelector` gains a second tab: "DICOM Server" (only visible when `orthanc.url` is configured). This tab uses Cornerstone3D's DICOMweb client to list studies/series.

**What must NOT change:** The probe model, view matcher, pseudo-TEE rendering pipeline, and oblique slice rendering are all volume-source-agnostic. They receive a `VolumeData` object and do not care where it came from.

### 8.5 Security Considerations

| Concern | Mitigation |
|---------|-----------|
| **Asset integrity** | All case assets served with `Content-Type` headers and `Subresource Integrity` (SRI) hashes in the case manifest. Prevent tampered anatomy data from being rendered as educational content |
| **Data governance enforcement** | The `case_manifest.json` includes a `license` field and a `dataTier` field (`bundle-safe`, `internal`, `licensed`). The asset pipeline's `validate-case.sh` rejects any case with `dataTier !== 'bundle-safe'` from the public build. CI enforces this |
| **No PHI in MVP** | MVP uses only public atlas and TotalSegmentator data (already de-identified). No DICOM with patient metadata touches the browser. Phase 2 DICOM route must strip all PHI before browser delivery (Orthanc anonymization pipeline) |
| **CSP headers** | Strict Content-Security-Policy: `default-src 'self'; script-src 'self'; worker-src 'self'; connect-src 'self' https://*.r2.cloudflarestorage.com; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'`. No inline scripts, no eval |
| **CORS on R2** | R2 bucket configured with CORS allowing only the production and preview domains. Prevents hot-linking of anatomical assets |
| **Service worker scope** | Service worker registered at `/` with `updateViaCache: 'none'`. Automatic update on new deploy. No stale code served |
| **Phase 2: auth** | When trainee scoring is added, use a third-party auth provider (Clerk, Auth0) with PKCE flow. No session cookies to manage. Store JWT in memory (not localStorage) to avoid XSS exfiltration |

### 8.6 Performance Monitoring

**Build-time:**
- **Lighthouse CI** in GitHub Actions on every PR. Fail if Performance score < 90, LCP > 2.5 s, CLS > 0.1.
- **Bundle size tracking** via `vite-bundle-visualizer`. Alert if total JS exceeds 500 KB (gzipped, excluding lazy-loaded Cornerstone3D).

**Runtime (production):**
- **Core Web Vitals** reported via `web-vitals` library to a lightweight analytics endpoint (Cloudflare Analytics or Plausible). No Google Analytics -- unnecessary for a medical education tool and raises privacy concerns.
- **Custom metrics** collected by `@teesim/renderer/perf-monitor.ts`:

| Metric | Target | Collection |
|--------|--------|-----------|
| FPS (frames per second) | >= 30 sustained | Rolling 60-frame window, reported as P50/P95 |
| Render time per frame | < 16 ms P95 | `performance.now()` around each rAF callback |
| Time to interactive (case loaded) | < 5 s on 50 Mbps | Measured from case selection to first rendered frame |
| GPU memory estimate | < 256 MB per scene | Tracked by `@teesim/assets/budget.ts` |
| Asset load waterfall | Visualized in dev overlay | Priority queue timing per asset |
| Reslice time (VTK.js) | < 5 ms per slice | `performance.now()` around `vtkImageReslice` execution |

**Dev overlay:** In development mode, a `PerfOverlay` component (toggled by `Shift+P`) displays FPS, render time histogram, GPU memory, and asset load waterfall in real-time. This overlay is tree-shaken out of production builds.

---

## 9. Risks and Mitigations

### 9.1 Architectural Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **VTK.js bundle size blows up** | High | Medium | VTK.js is modular. Import only the classes needed: `vtkImageReslice`, `vtkXMLImageDataReader`, `vtkRenderWindow`, `vtkRenderer`, `vtkActor`, `vtkMapper`. Tree-shaking works if imports are specific. Measure bundle size in CI. Target < 300 KB gzipped for VTK.js portion |
| **Two WebGL contexts hit device limits** | Medium | High | Test on low-end devices (2020 MacBook Air with Intel Iris). Fallback: collapse to single VTK.js context and render all three panes with VTK.js (lose R3F convenience but preserve function). Detection: check `gl.getParameter(gl.MAX_TEXTURE_SIZE)` at startup |
| **VTI files too large for browser memory** | Medium | High | Budget enforced by `@teesim/assets/budget.ts`. MVP target: < 128 MB per VTI. Asset pipeline must decimate. If a case exceeds budget, offer a "low-res" variant (2x downsampled VTI, half memory) |
| **VTK.js reslice performance too slow** | Low | Critical | Profile early on target hardware. If > 5 ms per reslice, options: (a) reduce VTI resolution, (b) pre-compute reslice on a Web Worker using OffscreenCanvas, (c) switch to GPU-compute reslice via custom shader. This is the one area where a wrong bet is costly to fix -- **build the pseudo-TEE pane first** in the implementation schedule |
| **Three.js + VTK.js version conflicts** | Low | Medium | Pin exact versions. Both use WebGL2 but do not share contexts. Risk is indirect: if both depend on conflicting versions of `gl-matrix` or similar. Mitigation: check `pnpm ls --depth 3` for duplication in CI |

### 9.2 Performance Traps

| Trap | Description | Prevention |
|------|------------|-----------|
| **React re-renders on probe move** | Probe state changes 30-60 times/sec. If React re-renders the entire component tree on each change, FPS drops | Use Zustand `subscribe` with selector in `sync-manager.ts`. Render loop reads via `getState()`, never via React hooks in the render-critical path. UI components (ProbeHUD) use `useStore(s => s.probe.s)` with fine-grained selectors |
| **GC pauses from allocation in rAF** | Creating new `Float32Array`, `Matrix4`, or `Vector3` objects every frame triggers GC pauses | Pre-allocate reusable math objects in `@teesim/core/transforms.ts`. Use a pool of scratch matrices. Never allocate in the hot path |
| **IndexedDB blocking the main thread** | Large VTI writes to IndexedDB can block for 100+ ms | All IndexedDB writes happen in a Web Worker (`@teesim/assets/cache.ts` delegates to a worker). Reads use the structured clone algorithm which is fast for ArrayBuffers |
| **CSS layout thrashing in three-pane** | Resizing panes triggers layout recalculation which triggers WebGL context resize | Use `ResizeObserver` with debounce (100 ms). Resize WebGL canvases only after resize settles |

### 9.3 Scope Creep Vectors

| Vector | Why it is tempting | Why it is dangerous | Defense |
|--------|-------------------|-------------------|---------|
| **Adding Doppler simulation** | Users will ask for color flow | Requires hemodynamic modeling, which is a PhD-level effort. Not solvable with reslicing | Explicit non-goal in `goals-non-goals.md`. Redirect to Phase 3+ |
| **Adding more cases before core is solid** | Easy to run TotalSegmentator on more CTs | Each case needs manual view authoring, centerline validation, and QA by an echocardiographer. 4 cases is plenty for MVP. More cases without core polish = more technical debt |
| **Premature mobile optimization** | Phones are the most common student device | Touch controls for 5-DOF probe manipulation require a dedicated UX design effort. CSS responsive layout is trivial; probe touch controls are not. Ship desktop, validate the core experience, then invest in mobile |
| **Building a custom DICOM viewer** | Phase 2 mentions DICOM route | Cornerstone3D + OHIF already exist and are maintained by a funded team. Build the integration, not the viewer |
| **Custom ultrasound appearance model** | Pseudo-TEE with a simple LUT looks "fake" | An ML-based or physics-based ultrasound appearance model is a research project. The MVP value is spatial understanding (probe position vs image plane), not ultrasound realism. A grayscale LUT with depth attenuation is good enough for view-finding education |

---

## 10. Effort Estimates

T-shirt sizes: **S** (1-2 days), **M** (3-5 days), **L** (1-2 weeks), **XL** (2-4 weeks).

Estimates assume a single full-stack developer working alone.

### MVP Build

| Package / System | Size | Notes |
|-----------------|------|-------|
| **Monorepo setup** (pnpm, Turborepo, TS configs, ESLint, Prettier, CI skeleton) | S | Boilerplate but must be done right. Use `create-turbo` as starting point |
| **@teesim/core** (probe model + transforms + view matcher) | L | Math-heavy. Needs research into cubic spline interpolation on the centerline. View matching threshold tuning. This is the intellectual core of the product |
| **@teesim/core** unit tests | M | 100% branch coverage on probe model. Fixture-heavy: need reference probe positions and expected imaging planes from an echocardiographer |
| **@teesim/assets** (loader + cache + budget) | M | Priority queue is straightforward. IndexedDB cache with Web Worker delegation is the hard part |
| **@teesim/renderer -- pseudo-TEE pane** | XL | **Highest risk, build first.** VTK.js `vtkImageReslice` integration. Sector mask geometry. Pseudo-US lookup table tuning. This pane is the product's reason to exist |
| **@teesim/renderer -- 3D scene pane** | L | R3F scene with GLB loading, probe glyph, sector plane visualization. Moderate complexity; R3F makes this easier |
| **@teesim/renderer -- oblique slice pane** | M | Same VTK.js reslice as pseudo-TEE, simpler appearance (label colormap, no sector mask) |
| **@teesim/renderer -- sync manager** | M | Zustand subscription wiring. rAF loop. Batched updates. Performance-sensitive |
| **@teesim/ui** (all components) | L | ProbeHUD sliders, ViewPicker, CaseSelector, AnatomyLabels, layout. Standard React UI work |
| **apps/web** (app shell, store, PWA) | M | Composition root. Vite config with VTK.js WASM. Workbox service worker |
| **tools/asset-pipeline** | L | Python scripts for 3D Slicer automation. JSON schema validation. Case index builder. Requires 3D Slicer expertise |
| **Asset authoring** (4 cases x views/landmarks/centerline) | XL | **Not code, but calendar time.** Each case needs: TotalSegmentator segmentation, mesh decimation, VTI export, centerline extraction, anchor view placement, QA by echocardiographer. Rate-limited by clinical expert availability |
| **Visual regression test suite** | M | Playwright + Percy/Argos setup. Screenshot each anchor view. Baseline generation |
| **E2E test suite** | M | Playwright flows: load case, manipulate probe, verify view match. 3 browsers |
| **CI/CD pipeline** | M | GitHub Actions: lint, typecheck, unit tests, visual regression, Lighthouse CI, deploy preview, deploy production |
| **Deployment setup** (Cloudflare Pages + R2) | S | One-time setup. R2 bucket, Pages project, CORS config, custom domain |

### Total MVP Estimate

| Category | Effort |
|----------|--------|
| Code (all packages + tests + CI) | **8-12 weeks** (single developer) |
| Asset authoring (4 cases) | **4-6 weeks** (parallel with code, but needs clinical expert) |
| **Total calendar time** | **10-14 weeks** (with some parallelism between code and asset work) |

### Phase 2 Increments (after MVP)

| Feature | Size | Dependency |
|---------|------|-----------|
| Cardiac motion animation (blendshapes) | L | Requires motion.bin format finalization and per-case tuning |
| VTI streaming (range requests) | M | Requires R2 range-request testing |
| DICOM route (Orthanc + Cornerstone3D) | XL | Requires Orthanc deployment, DICOMweb proxy, Cornerstone3D integration spike |
| Trainee scoring + progress | L | Requires auth provider + database (Supabase or Cloudflare D1) |
| Exercise mode (educator assignments) | L | Depends on scoring backend |
| Mobile-optimized touch controls | L | Dedicated UX design for 5-DOF touch interaction |
| All 28 ASE views | XL | 20 additional views x clinical expert authoring time |
| Pathology cases | XL | Requires licensed or self-collected data. Separate data pipeline work |

---

## Appendix A: Key npm Packages and Versions

| Package | Version (target) | Purpose | Bundle impact |
|---------|-----------------|---------|--------------|
| `react` | ^18.3 | UI framework | ~40 KB gzip |
| `react-dom` | ^18.3 | React DOM renderer | ~40 KB gzip |
| `zustand` | ^5.0 | State management | ~2 KB gzip |
| `@kitware/vtk.js` | ^30.x | Volume rendering + reslice | ~200-300 KB gzip (tree-shaken) |
| `three` | ^0.170 | 3D scene rendering | ~150 KB gzip |
| `@react-three/fiber` | ^8.x | React declarative Three.js | ~40 KB gzip |
| `@react-three/drei` | ^9.x | R3F helpers (GLTFLoader, etc.) | ~20 KB gzip (tree-shaken) |
| `idb-keyval` | ^6.x | IndexedDB wrapper | < 1 KB gzip |
| `workbox-precaching` | ^7.x | Service worker precaching | ~5 KB gzip (SW only) |
| `workbox-strategies` | ^7.x | SW caching strategies | ~3 KB gzip (SW only) |
| `tailwindcss` | ^4.x | Utility CSS | 0 KB runtime (build-time only) |

**Total estimated main bundle:** ~500-600 KB gzipped (before code splitting).
**After code splitting:** Initial load ~300 KB (React + Zustand + UI shell). VTK.js and Three.js lazy-loaded when first pane mounts.

## Appendix B: Vite Code Splitting Strategy

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate heavy 3D libraries into their own chunks
          'vtk': ['@kitware/vtk.js'],
          'three': ['three', '@react-three/fiber', '@react-three/drei'],
          // React in its own chunk (shared across all lazy routes)
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
  },
});
```

Pseudo-TEE and oblique slice panes dynamically import the VTK.js chunk. 3D scene pane dynamically imports the Three.js chunk. Neither loads until the first case is selected. This means the initial page load (case selector) is fast.

## Appendix C: Zustand Store Shape

```typescript
interface TeesimStore {
  // Probe state (updated 30-60 Hz during manipulation)
  probe: {
    s: number;           // position on centerline [0, 1]
    roll: number;        // axial rotation, radians
    ante: number;        // anteflexion, radians
    lateral: number;     // lateral flexion, radians
    omniplane: number;   // imaging plane angle, degrees [0, 180]
  };
  setProbe: (delta: Partial<ProbeState>) => void;
  snapToView: (view: AnchorView) => void;

  // Scene state (updated on case load)
  scene: {
    currentCaseId: string | null;
    manifest: CaseManifest | null;
    loadPhase: 'idle' | 'metadata' | 'geometry' | 'volume' | 'ready';
    loadProgress: number; // 0-1
    structures: Map<string, { visible: boolean; color: string }>;
  };
  loadCase: (caseId: string) => Promise<void>;
  setStructureVisibility: (id: string, visible: boolean) => void;

  // View matching state (derived, updated synchronously with probe)
  viewMatch: {
    matches: Array<{ viewId: string; quality: number }>; // sorted by quality desc
    bestMatch: { viewId: string; quality: number } | null;
  };

  // UI state (updated on user interaction, low frequency)
  ui: {
    labelsVisible: boolean;
    perfOverlayVisible: boolean;
    selectedPanel: 'views' | 'anatomy' | 'settings';
    exerciseMode: boolean; // Phase 2 flag
  };
  toggleLabels: () => void;
  setSelectedPanel: (panel: string) => void;
}
```

## Appendix D: Asset Budget Constraints

| Asset Type | Per-case budget | Rationale |
|-----------|----------------|-----------|
| `scene.glb` | < 15 MB, < 500K triangles | Thorax meshes must be decimated. 500K tris renders comfortably at 30 FPS on Intel Iris |
| `heart_detail.glb` | < 10 MB, < 300K triangles | Higher detail on cardiac structures, but still budget-constrained |
| `heart_roi.vti` | < 128 MB uncompressed, < 30 MB compressed | VTI in memory = dimensions * bytes_per_voxel. Target: 256x256x256 uint8 = 16 MB, or 256x256x256 int16 = 32 MB. zlib-compressed on disk < 30 MB |
| `motion.bin` | < 10 MB | Per-vertex displacement * N_phases * N_vertices. With 100K vertices * 20 phases * 12 bytes = 24 MB uncompressed. Quantize to int8 or reduce vertex count |
| `probe_path.json` | < 100 KB | Centerline = ~200 control points * 3 floats = trivial |
| `views.json` | < 10 KB | 8-10 presets * 5 floats = trivial |
| **Total per case** | < 200 MB uncompressed in GPU/CPU memory | Fits within the 256 MB scene budget from background.md. Leaves headroom for WebGL context overhead |

---

## Related Documents

- Product overview: [`docs/product/overview.md`](../product/overview.md)
- Goals and non-goals: [`docs/product/goals-non-goals.md`](../product/goals-non-goals.md)
- Data survey: [`docs/research/2026-04-06-tee-simulator-public-data-survey.md`](2026-04-06-tee-simulator-public-data-survey.md)
- ADR-0001 (pending): [`docs/decisions/ADR-0001-mvp-architecture.md`](../decisions/ADR-0001-mvp-architecture.md)
