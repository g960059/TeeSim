# Technical Architecture Roadmap

Date: 2026-04-06
Status: Proposal
Author: Architecture review (synthesized from codebase analysis)

---

## Baseline Assessment

TeeSim is a browser-based 3D TEE simulator at early MVP stage. The codebase is approximately 5,000 lines of application TypeScript across ~35 source files, organized in a single `src/` directory with clean folder conventions (`core/`, `renderer/`, `assets/`, `ui/`, `education/`). Dependencies are minimal: React 19, Zustand 5, VTK.js 35, and Vite 8. The project has 23 unit tests and 25 E2E tests via Playwright.

Key architectural characteristics observed in the code:

- **3 separate WebGL contexts** (PseudoTeePane, Scene3DPane, ObliqueSlicePane), each creating its own `vtkGenericRenderWindow`. This is the most significant performance constraint.
- **Synchronous main-thread reslice**: `vtkImageReslice` runs in the main thread inside `PseudoTeePane.flush()` and `ObliqueSlicePane.flush()`. For large VTI volumes, this blocks the UI during probe manipulation.
- **Imperative rendering via SyncManager**: Probe pose changes are batched through `requestAnimationFrame` and pushed to pane refs imperatively. This is the correct architecture and should be preserved.
- **Simple `fetch()` asset loading** with no caching layer, no streaming, no progress indicators beyond a boolean loading state.
- **Pure-function probe model** in `src/core/probe-model.ts` with zero external dependencies. Clean separation. The 5-DOF kinematics (shaft frame, distal flex, roll, omniplane) are well-tested.
- **View matcher** uses weighted Euclidean distance in normalized pose space. No structure-visibility or image-quality heuristics.
- **No build-time code splitting**: VTK.js geometry and volume profiles are imported eagerly in `runtime-loaders.ts` and `vtk-helpers.ts`.
- **No deployment configuration**: local dev only. No CI/CD pipeline.

---

## Roadmap Items

### 1. Performance: Code Splitting, Lazy Loading, WebWorker Reslice

**Priority:** P0
**Effort:** L (2-3 weeks)
**Dependencies:** None (can start immediately)
**Timing:** Weeks 1-3 after MVP feature-complete

#### Problem

VTK.js is a large library. The current code imports both `Rendering/Profiles/Geometry` and `Rendering/Profiles/Volume` eagerly at the top of `runtime-loaders.ts` and `vtk-helpers.ts`. This means the full VTK.js WebGL rendering pipeline loads before the user sees anything. Additionally, `vtkImageReslice` runs synchronously on the main thread during every probe pose change, which will become a bottleneck with larger VTI volumes or when cardiac motion data is added.

#### Plan

**1a. Vite manual chunks for VTK.js (week 1)**

```typescript
// vite.config.ts
build: {
  target: 'es2022',
  rollupOptions: {
    output: {
      manualChunks: {
        'vtk-core': [
          '@kitware/vtk.js/Common/Core/DataArray',
          '@kitware/vtk.js/Common/DataModel/ImageData',
          '@kitware/vtk.js/Common/DataModel/PolyData',
        ],
        'vtk-geometry': [
          '@kitware/vtk.js/Rendering/Profiles/Geometry',
          '@kitware/vtk.js/Rendering/Core/Mapper',
          '@kitware/vtk.js/Rendering/Core/Actor',
          '@kitware/vtk.js/IO/Geometry/GLTFImporter',
        ],
        'vtk-volume': [
          '@kitware/vtk.js/Rendering/Profiles/Volume',
          '@kitware/vtk.js/Imaging/Core/ImageReslice',
          '@kitware/vtk.js/IO/XML/XMLImageDataReader',
        ],
      },
    },
  },
},
```

Measure bundle size before and after. Target: initial JS payload under 500 KB gzipped; VTK volume chunk loaded on demand when a case with a VTI is selected.

**1b. Lazy-load volume panes (week 1)**

`PseudoTeePane` and `ObliqueSlicePane` should be loaded via `React.lazy()`. The 3D scene pane can load eagerly since it is always visible and uses only the geometry profile.

```typescript
const PseudoTeePane = lazy(() =>
  import('./renderer/PseudoTeePane').then(m => ({ default: m.PseudoTeePane }))
);
const ObliqueSlicePane = lazy(() =>
  import('./renderer/ObliqueSlicePane').then(m => ({ default: m.ObliqueSlicePane }))
);
```

**1c. WebWorker for reslice computation (weeks 2-3)**

Move `vtkImageReslice` computation to a dedicated Web Worker. The main thread sends the volume data (via `SharedArrayBuffer` if available, otherwise `transferable ArrayBuffer`) and the reslice axes matrix. The worker returns the resliced image data. `PseudoTeePane.flush()` currently calls `reslice.setInputData()`, `reslice.update()`, then `applySectorMask()` synchronously. The sector mask pixel loop (lines 74-125 of PseudoTeePane) is also CPU-intensive and should move to the worker.

Architecture:

```
Main thread                          Worker
  |                                    |
  |-- postMessage(volume, axes) -----> |
  |                                    | vtkImageReslice.update()
  |                                    | applySectorMask()
  | <-- postMessage(Uint8Array) ------ |
  |                                    |
  | update output vtkImageData         |
  | render()                           |
```

Risk: VTK.js internals may not be fully Worker-compatible. If `vtkImageReslice` cannot run in a Worker, fall back to running only the sector mask loop in a Worker and keeping reslice on the main thread with a debounce.

**1d. Reduce WebGL contexts from 3 to 2 (stretch)**

Chrome enforces a per-page limit of ~16 WebGL contexts, but each context consumes significant GPU memory. The oblique slice pane and pseudo-TEE pane both render 2D images with `vtkImageMapper`. These could share a single `vtkGenericRenderWindow` with two viewports, or the 2D panes could use Canvas2D with `ImageData` from the reslice output (since the sector mask in PseudoTeePane already produces a `Uint8Array`). This would reduce GPU memory and improve mobile device compatibility.

---

### 2. Deployment: Vercel/Cloudflare Pages + Asset CDN

**Priority:** P0
**Effort:** M (1 week)
**Dependencies:** None
**Timing:** Weeks 1-2 (can be done in parallel with performance work)

#### Plan

**2a. Static host setup (days 1-2)**

Cloudflare Pages is recommended over Vercel for this project:

- Better global edge distribution for an international audience (Japan, US, EU).
- No serverless function cold starts needed for a static app.
- Free tier includes generous bandwidth.
- Native `_headers` file for fine-grained cache control.

```
# public/_headers
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/cases/*
  Cache-Control: public, max-age=604800
  Content-Type: application/octet-stream

/*.js
  Cache-Control: public, max-age=31536000, immutable

/index.html
  Cache-Control: no-cache
```

**2b. Asset CDN for case bundles (days 3-5)**

Case bundles (VTI volumes, GLB meshes, JSON manifests) are large. For 4 cases:

- `heart_roi.vti`: 10-50 MB each (int16 volume)
- `scene.glb` + `heart_detail.glb`: 1-10 MB each
- JSON files: < 100 KB total

Options ranked by simplicity:

1. **Same-origin `/cases/` directory** -- ship with the app. Adequate for 4 cases. ADR-0001 chose this.
2. **Cloudflare R2 + custom domain** -- when case count exceeds 10 or total assets exceed 200 MB. R2 has zero egress fees.
3. **Cloudflare R2 + Workers for signed URLs** -- when auth is added and cases need access control.

Recommendation: start with option 1. Switch to option 2 when case count exceeds 10 or when the VTI files are too large for the git-deployable bundle.

**2c. Compression**

Enable Brotli pre-compression for VTI files in the build step:

```json
// package.json scripts
"build:compress": "vite build && find dist/cases -name '*.vti' -exec brotli {} \\;"
```

Configure the CDN to serve `.vti.br` with `Content-Encoding: br`. VTI files (XML + base64-encoded binary) compress well: expect 60-70% size reduction.

**2d. Preview deployments**

Set up Cloudflare Pages to deploy preview URLs for every pull request. This enables clinical validators to review changes without running the dev server.

---

### 3. DICOM Route: Cornerstone3D / OHIF Integration

**Priority:** P1
**Effort:** XL (4-6 weeks)
**Dependencies:** Performance work (item 1) must be complete. Backend (item 6) should be started.
**Timing:** Phase 1.5 (after MVP launch, ~months 2-3)

#### Context

The current pipeline converts DICOM to VTI offline via 3D Slicer. A DICOM route would allow users to load their own DICOM studies directly in the browser, skipping the offline pipeline. This is essential for educational institutions that want to use their own case libraries.

#### Architecture Decision: VTK.js vs Cornerstone3D

Two approaches:

**Option A: Stay on VTK.js, add DICOM parsing only**

- Add `@cornerstonejs/dicom-parser` (or `dcmjs`) for DICOM file parsing.
- Convert DICOM pixel data to `vtkImageData` in-browser.
- All rendering stays on VTK.js.
- Pros: no rendering engine switch, smaller bundle, simpler integration.
- Cons: no DICOM viewport features (annotations, measurements, hanging protocols).

**Option B: Add Cornerstone3D as a parallel rendering path**

- Use `@cornerstonejs/core` + `@cornerstonejs/streaming-image-volume-loader` for DICOM loading and rendering.
- Cornerstone3D renders the 2D panes (pseudo-TEE, oblique slice); VTK.js renders the 3D scene.
- Pros: native DICOM viewport, WADO-RS streaming, measurement tools, OHIF viewer embedding.
- Cons: two rendering engines in one app, Cornerstone3D and VTK.js share underlying vtk.js (version conflicts possible), significantly larger bundle.

**Recommendation: Option A for Phase 1.5, Option B deferred to Phase 2+ when real-time DICOM is needed.**

#### Phase 1.5 Plan (Option A)

1. Add `dcmjs` for DICOM parsing (it has no rendering dependencies).
2. Create `src/assets/dicom-loader.ts` that converts a DICOM series to `vtkImageData`.
3. Add a file-drop zone or DICOM upload dialog in the UI.
4. The existing rendering pipeline (PseudoTeePane, ObliqueSlicePane, Scene3DPane) works unchanged because it already operates on `vtkImageData`.
5. Centerline must still be manually authored or auto-detected (see item 11, AI integration).

#### Phase 2+ Plan (Option B)

Only pursue if:

- WADO-RS streaming from a PACS is required.
- Measurement/annotation tools are needed.
- OHIF viewer embedding is requested by institutional users.

At that point, introduce Cornerstone3D for the 2D panes and keep VTK.js for the 3D scene. Define a `VolumeSource` abstraction (deferred from ADR-0001) so both rendering paths consume a common interface.

---

### 4. Real-Time 3D/4D TEE DICOM Support

**Priority:** P2
**Effort:** XXL (8-12 weeks)
**Dependencies:** DICOM route (item 3), WebWorker reslice (item 1c), backend (item 6)
**Timing:** Phase 2+ (months 4-6)

#### Problem

Real TEE probes produce 3D/4D DICOM data (multi-frame, gated to cardiac cycle). Supporting this requires:

1. **4D volume loading**: multi-frame DICOM with temporal dimension. Data sizes: 50-200 MB per study.
2. **Temporal interpolation**: smooth playback between cardiac phases.
3. **Real-time reslice at interactive framerates**: the current synchronous reslice cannot keep up with 4D volume updates at 30 fps.

#### Architecture

```
DICOM 4D study
  |
  v
dcmjs / cornerstonejs parser
  |
  v
Array of vtkImageData (one per temporal frame)
  |
  v
TemporalVolumeManager (new module)
  - Preloads N frames ahead
  - Interpolates between frames
  - Exposes current frame as vtkImageData
  |
  v
Existing SyncManager + reslice pipeline
```

Key technical decisions:

- **GPU-side reslice**: When VTK.js WebGPU support is available (item 5), reslice can move to a compute shader. Until then, use the WebWorker approach from item 1c with double-buffering: while the worker reslices frame N+1, the main thread displays frame N.
- **Memory management**: 4D volumes are too large to hold entirely in RAM. Implement a sliding window of 3-5 frames, loading from IndexedDB or streaming from server.
- **Cardiac gating**: Use DICOM trigger time tags to synchronize playback. Expose a timeline scrubber in the UI.

This is the hardest technical challenge in the roadmap. Do not start until the 2D reslice pipeline is performant with static volumes.

---

### 5. WebGPU Migration Path

**Priority:** P3
**Effort:** L (2-3 weeks when available)
**Dependencies:** VTK.js WebGPU support reaching stable release
**Timing:** Opportunistic (estimated: late 2026 or 2027)

#### Current State

VTK.js has experimental WebGPU support in the `vtk.js` repository (`Rendering/WebGPU/`), but it is not production-ready. The TeeSim codebase uses `WebGL2` exclusively through `vtkGenericRenderWindow`.

#### Migration Strategy

1. **Monitor VTK.js releases** for WebGPU backend stability. Track the `kitware/vtk-js` GitHub repository and their WebGPU milestone.
2. **Abstract the render window creation** now. The current `createRenderWindow()` in `vtk-helpers.ts` is already a good abstraction point. When WebGPU is ready:

```typescript
export const createRenderWindow = (
  container: HTMLElement,
  background: RGBColor = DEFAULT_BACKGROUND,
  preferWebGPU = false,
): VtkGenericRenderWindow => {
  if (preferWebGPU && navigator.gpu) {
    // VTK.js WebGPU path (future)
    return createWebGPURenderWindow(container, background);
  }
  // Existing WebGL2 path
  return createWebGL2RenderWindow(container, background);
};
```

3. **WebGPU compute shaders for reslice**: The biggest win from WebGPU is not rendering (WebGL2 is adequate) but compute. `vtkImageReslice` and the sector mask could run as GPU compute passes, eliminating the need for the WebWorker approach entirely. This is the primary motivator for WebGPU migration.

4. **Feature-detect and fall back**: WebGPU is not available in all browsers. Safari support is partial. Always maintain the WebGL2 path as fallback.

#### Do Not Do Now

- Do not introduce a WebGPU abstraction layer today. The VTK.js API surface for WebGPU is not stable and any abstraction written now would need to be rewritten.
- Do not switch to Three.js or Babylon.js for WebGPU access. The probe model and reslice pipeline are deeply integrated with VTK.js data structures.

---

### 6. Backend Addition: Auth, Scoring, Educator Dashboard

**Priority:** P1
**Effort:** XL (6-8 weeks total, phased)
**Dependencies:** Deployment (item 2) must be complete
**Timing:** Phase 1.5+ (begin month 2, iterate through months 3-6)

#### Phasing

**Phase 6a: Anonymous analytics (P1, S, week 1)**

Before adding auth, ship anonymous usage analytics to understand how the simulator is used:

- Probe pose history per session (sampled at 2 Hz, not every frame).
- View match events (when a preset is reached).
- Session duration, case switches, error events.
- Use a lightweight event collector (Plausible, PostHog, or a simple Cloudflare Worker that appends to R2).

**Phase 6b: Authentication (P1, L, weeks 2-4)**

- Use a managed auth provider: **Clerk** or **Auth0**. Do not build custom auth.
- Social login (Google) + institutional SSO (SAML) for medical schools.
- JWT tokens stored in `httpOnly` cookies, not `localStorage`.
- The app remains fully functional without login. Auth unlocks scoring persistence and educator features.

Technology stack for the backend:

- **Cloudflare Workers + D1 (SQLite)** for the API. No traditional server. Keeps the deployment model serverless and globally distributed.
- Alternative: **Supabase** if PostgreSQL features are needed (row-level security, real-time subscriptions).

**Phase 6c: Scoring persistence (P1, M, weeks 3-5)**

- Store per-user, per-case, per-view attempt history.
- Schema: `user_id, case_id, view_id, probe_pose, score, timestamp, session_id`.
- The current `matchViews()` function in `view-matcher.ts` already returns the data needed. Add a `recordAttempt()` call when a view match transitions to `match` status.
- Display personal progress: "You have found 6/8 views on this case."

**Phase 6d: Educator dashboard (P2, L, weeks 5-8)**

- Requires auth and scoring persistence.
- Educator creates a "class" and invites students via link.
- Dashboard shows per-student progress across cases and views.
- Aggregate analytics: time-to-find per view, common exploration paths, failure modes.
- This is a standard CRUD application. Build it as a separate route (`/educator/`) that lazy-loads its own React subtree.

---

### 7. Testing: Visual Regression, CI/CD Pipeline

**Priority:** P0
**Effort:** M (1-2 weeks)
**Dependencies:** Deployment (item 2)
**Timing:** Weeks 1-2 (in parallel with deployment)

#### Plan

**7a. CI pipeline with GitHub Actions (days 1-2)**

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  lint-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm test

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - run: npm run e2e
```

**7b. Playwright visual regression (days 3-5)**

ADR-0001 deferred visual regression until "rendering stabilizes." The 3-pane layout and pseudo-TEE rendering are now stable enough. Add screenshot comparison tests for:

- Pseudo-TEE pane at each of the 8 anchor views.
- 3D scene at default camera position with case loaded.
- Oblique slice at ME 4C view.

Use Playwright's built-in `toHaveScreenshot()`. Store golden screenshots in the repository. Accept 0.5% pixel difference threshold for WebGL rendering variance across CI environments.

```typescript
test('pseudo-tee renders ME 4C view', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'ME 4C' }).click();
  await page.waitForSelector('[data-render-state="ready"]');
  await expect(page.locator('[data-testid="pseudo-tee-canvas"]'))
    .toHaveScreenshot('pseudo-tee-me-4c.png', { maxDiffPixelRatio: 0.005 });
});
```

**7c. Bundle size tracking (day 5)**

Add `vite-plugin-bundle-analyzer` or a custom CI step that records bundle sizes and fails the build if the main chunk exceeds a threshold (e.g., 300 KB gzipped).

**7d. Test coverage targets**

- `src/core/`: 95%+ line coverage (pure math, easy to test). Currently well-covered.
- `src/assets/`: 80%+ for loader logic. Currently has 2 test files.
- `src/renderer/`: visual regression only (WebGL testing in unit tests is not practical).
- `src/ui/`: component smoke tests via Playwright, not unit tests for DOM structure.

---

### 8. Package Extraction: @teesim/core etc.

**Priority:** P3
**Effort:** M (1 week when triggered)
**Dependencies:** A real second consumer of the package
**Timing:** Not before Phase 2 (months 4+). Trigger: second app or library needs `src/core/`.

#### Decision Framework

ADR-0001 correctly chose a single `src/` directory with ESLint import boundary enforcement over a monorepo. Extract packages only when:

1. **A second consumer exists.** For example: a standalone CLI tool for validating case bundles, or a separate educator dashboard app that needs the view-matcher.
2. **The interface is stable.** `ProbePose`, `CenterlinePath`, `ViewPreset`, and the probe model API have not changed since initial implementation. They are candidates.
3. **The extraction cost is justified.** Each extracted package adds build configuration, version management, and publish workflow overhead.

#### Extraction Candidates (ordered by stability)

| Package | Contents | Trigger |
|---------|----------|---------|
| `@teesim/core` | `probe-model.ts`, `view-matcher.ts`, `math.ts`, `types.ts` | CLI validation tool or second app |
| `@teesim/assets` | `loader.ts`, `types.ts`, case manifest schema | Asset pipeline needs browser-independent loading |
| `@teesim/renderer` | VTK.js panes, SyncManager, vtk-helpers | Never extract; too coupled to React and VTK.js internals |

#### How To Extract

When the trigger fires:

1. Create a `packages/` directory. Use `pnpm` workspaces (not Turborepo; the overhead is not justified for 2-3 packages).
2. Move `src/core/` to `packages/core/src/`. Keep `src/core/` as a re-export (`export * from '@teesim/core'`) for backward compatibility.
3. Publish to npm under the `@teesim` scope (private or public based on licensing decision).
4. The main app imports `@teesim/core` from the workspace.

Do not over-prepare. The current ESLint `import/no-restricted-paths` rules (enforcing that `core/` has no external deps) provide the same boundary guarantees as a separate package.

---

### 9. Internationalization (i18n)

**Priority:** P2
**Effort:** M (1-2 weeks for infrastructure + first translation)
**Dependencies:** UI/UX improvements (from the engineering proposal) should land first to stabilize string locations
**Timing:** Phase 1.5 (month 3)

#### Plan

**9a. i18n library: `react-i18next` (recommended)**

- Mature, widely used, good TypeScript support.
- Supports lazy-loading translation files per locale.
- Namespace support for separating UI strings from medical terminology.
- Alternative: `lingui` is lighter but less ecosystem support.

**9b. String extraction strategy**

The current codebase has relatively few user-facing strings (estimated 50-80 total):

- UI labels: "CT-derived anatomical slice", "Depth", "Ante / Retro", "Lateral", etc.
- View preset labels: "ME 4C", "ME Two-Chamber", etc.
- Status messages: "Loading case...", "Case not loaded", etc.
- Error messages.

Medical terminology should be in a separate namespace (`medical`) from UI chrome (`ui`). View preset labels and ASE codes are standardized English terms that should not be translated; they should remain in English with optional localized descriptions.

**9c. Translation files**

```
src/
  i18n/
    en.json          # English (default, source of truth)
    ja.json          # Japanese
    index.ts         # i18next initialization
```

**9d. Japanese as first target**

Given the repository owner and the Japanese cardiology education market, Japanese is the natural first translation target. Key considerations:

- Medical terminology in Japanese uses a mix of kanji compounds and katakana transliterations of English terms.
- ASE standard view names have established Japanese equivalents in echocardiography textbooks.
- The UI layout must handle longer Japanese strings (especially in compact mode).
- Right-to-left is not a concern for Japanese, but vertical text direction should be tested for any future CJK locale.

**9e. Locale detection**

```typescript
i18n.init({
  fallbackLng: 'en',
  detection: {
    order: ['querystring', 'navigator'],
    lookupQuerystring: 'lang',
  },
});
```

Users can override via `?lang=ja` or a language picker in the top bar.

---

### 10. Accessibility Improvements

**Priority:** P1
**Effort:** M (1-2 weeks)
**Dependencies:** UI/UX improvements from the engineering proposal
**Timing:** Concurrent with UI/UX work (Phase 1, weeks 2-4)

#### Current Issues (from UI/UX engineering review)

The engineering review identified specific violations:

1. `ThreePaneLayout.tsx` uses `role="tablist"` but buttons use `aria-pressed` instead of `role="tab"` + `aria-selected`.
2. No `tabpanel` roles or `aria-controls`/`aria-labelledby` relationships.
3. No roving focus (arrow key navigation) on the tab row.
4. `CaseSelector.tsx` uses a `listbox` container with button children (incorrect pattern).
5. No `:focus-visible` styles.
6. Slider accessible names do not expose units or keyboard hints.
7. The match indicator says "quality" instead of "preset alignment."

#### Plan

**10a. Semantic HTML fixes (days 1-2)**

- Implement correct tab semantics (the engineering review provides exact code).
- Fix CaseSelector to use a real popover menu or native `<select>`.
- Add `aria-live="polite"` to the match indicator.

**10b. Focus management (days 2-3)**

- Add global `:focus-visible` styles (the engineering review provides CSS).
- Implement roving focus on tab rows and preset grids.
- Ensure keyboard shortcuts do not conflict with screen reader shortcuts.

**10c. Screen reader experience (days 3-5)**

- Add `aria-describedby` for probe controls with units and keyboard hints.
- Ensure the 2D bend pad (from the UI/UX proposal) always has paired accessible range inputs.
- Add landmark roles: `<main>` for the simulator viewport, `<nav>` for the control dock.
- Test with VoiceOver (macOS) and NVDA (Windows).

**10d. Reduced motion**

```css
@media (prefers-reduced-motion: reduce) {
  .transition-all,
  .animate-pulse {
    transition: none !important;
    animation: none !important;
  }
}
```

The VTK.js canvases themselves do not animate (static anatomy, no cardiac motion yet), so reduced-motion primarily affects UI transitions.

**10e. Color contrast**

Verify all text meets WCAG 2.1 AA contrast ratios (4.5:1 for normal text, 3:1 for large text) against the dark background. The current `--color-text-muted: #b7c6db` on `--color-bg: #07111f` is borderline and may need brightening, as noted in the engineering review.

---

### 11. AI Integration: Auto-View-Detection, Anatomy Labeling

**Priority:** P2
**Effort:** XL (6-10 weeks)
**Dependencies:** DICOM route (item 3) for real clinical data, backend (item 6) for model serving
**Timing:** Phase 2+ (months 4-8)

#### Scope

Two distinct AI features:

**11a. Auto-view detection ("What view am I looking at?")**

Given a pseudo-TEE image (the sector-masked anatomical slice), classify it into one of the standard TEE views. This replaces or augments the current 5-DOF distance metric with an image-based classifier.

Architecture:

```
Pseudo-TEE pixel output (Uint8Array from PseudoTeePane)
  |
  v
TensorFlow.js / ONNX Runtime Web (client-side inference)
  |
  v
View classification: { viewId: 'me-4c', confidence: 0.94 }
  |
  v
Scoring engine: combine pose-distance score with image-classification score
```

Model approach:

- Train a lightweight CNN (MobileNetV3 or EfficientNet-Lite) on labeled TEE view images.
- Training data: published TEE datasets (ASE/EACVI view classification datasets exist) plus synthetic images from the simulator itself.
- Target model size: < 5 MB (quantized).
- Inference time: < 50 ms per frame on a mid-range laptop GPU via WebGL backend.

**11b. Anatomy labeling ("What structures are visible?")**

Given the imaging plane, identify which cardiac structures intersect the slice. This enables structure-visibility scoring (deferred from ADR-0001).

Two approaches:

1. **Geometry-based (no ML)**: Use the segmentation label map from the VTI volume. At the current imaging plane, sample the label values in the resliced output. Map label IDs to structure names. This does not require ML and should be implemented first.

2. **ML-based segmentation**: Use a U-Net or similar model to segment the pseudo-TEE image into anatomical regions. This produces better boundaries than the voxel-based approach, especially for structures not well-captured in CT (e.g., valve leaflets).

**Recommendation: Implement geometry-based structure detection first (P1, M effort, Phase 1.5). ML-based segmentation is Phase 2+.**

#### Model Serving

- Client-side inference for small models (< 10 MB). Use ONNX Runtime Web or TensorFlow.js.
- Server-side inference for larger models. Use a Cloudflare Workers AI endpoint or a lightweight FastAPI service.
- Models should be versioned and served from the asset CDN, not bundled in the app.

#### Centerline Auto-Detection

ADR-0001 notes that esophageal centerline is manually authored for MVP, with VMTK automated extraction deferred. An ML approach:

- Use a 3D segmentation model (nnU-Net) to segment the esophagus from the CT volume.
- Extract the centerline from the segmentation using skeletonization.
- This runs offline in the asset pipeline (Python), not in the browser.
- Effort: L. This should be prioritized as part of the asset pipeline improvements in Phase 1.5.

---

### 12. Plugin System for Community Contributions

**Priority:** P3
**Effort:** XL (4-6 weeks)
**Dependencies:** Package extraction (item 8), backend (item 6), stable public API
**Timing:** Phase 3 (months 6-9, after the core product is stable)

#### Rationale

A plugin system enables:

- Community-contributed case bundles (with validation).
- Custom scoring algorithms.
- Alternative rendering modes (e.g., Doppler simulation, contrast echo).
- Integration with institutional LMS (Learning Management Systems).

#### Architecture

**12a. Plugin manifest and loading**

```typescript
interface TeeSimPlugin {
  id: string;
  version: string;
  name: string;
  description: string;

  // Lifecycle hooks
  onActivate?: (context: PluginContext) => void | Promise<void>;
  onDeactivate?: () => void;

  // Extension points
  renderingModes?: RenderingModeExtension[];
  scoringAlgorithms?: ScoringExtension[];
  uiPanels?: UIPanelExtension[];
  caseLoaders?: CaseLoaderExtension[];
}

interface PluginContext {
  store: TeeSimStoreApi;       // Read-only store access
  registerCommand: (id: string, handler: () => void) => void;
  registerPanel: (position: 'dock' | 'sidebar', component: ComponentType) => void;
}
```

**12b. Extension points (ordered by implementation priority)**

1. **Case loaders**: Allow plugins to provide cases from external sources (institutional PACS, cloud storage). This is the highest-value extension point.
2. **Scoring algorithms**: Allow plugins to define custom view scoring beyond the 5-DOF distance metric.
3. **UI panels**: Allow plugins to add panels to the dock (e.g., a quiz panel, a progress tracker, LMS integration).
4. **Rendering modes**: Allow plugins to provide alternative pseudo-TEE rendering (e.g., with Doppler overlay, contrast enhancement). This is the most complex extension point and should wait until the rendering pipeline is abstracted.

**12c. Security and sandboxing**

- Plugins run in the main thread (not iframes or Workers) for performance.
- Plugin code is reviewed before inclusion in the official registry.
- Plugins cannot access raw DOM; they interact through the `PluginContext` API.
- Community case bundles must pass the same validation CI as first-party bundles (SHA-256 hashes, schema version checks, clinical validation metadata).

**12d. Distribution**

- Start with a curated plugin list in the repository (no runtime plugin loading).
- Phase 3+: plugin registry (npm packages under `@teesim-plugins/` scope or a custom registry).

Do not build plugin infrastructure until the core API surface is stable and at least one external contributor is actively requesting it.

---

## Priority and Timing Summary

| # | Item | Priority | Effort | Timing | Dependencies |
|---|------|----------|--------|--------|--------------|
| 2 | Deployment (Cloudflare Pages) | P0 | M | Weeks 1-2 | None |
| 7 | CI/CD pipeline | P0 | M | Weeks 1-2 | None |
| 1 | Performance (code split, lazy load) | P0 | L | Weeks 1-3 | None |
| 10 | Accessibility | P1 | M | Weeks 2-4 | UI/UX work |
| 1c | WebWorker reslice | P1 | L | Weeks 3-5 | Item 1a/1b |
| 6a | Anonymous analytics | P1 | S | Week 3 | Item 2 |
| 6b | Authentication | P1 | L | Weeks 4-7 | Item 2 |
| 6c | Scoring persistence | P1 | M | Weeks 6-8 | Item 6b |
| 9 | Internationalization | P2 | M | Month 3 | UI/UX stable |
| 3 | DICOM route (Phase 1.5) | P1 | XL | Months 2-3 | Items 1, 6 |
| 11a | Geometry-based structure detection | P1 | M | Month 3 | None (uses existing VTI) |
| 6d | Educator dashboard | P2 | L | Months 3-4 | Item 6c |
| 4 | 3D/4D TEE DICOM | P2 | XXL | Months 4-6 | Items 1c, 3 |
| 11b | ML auto-view detection | P2 | XL | Months 4-8 | Items 3, 6 |
| 8 | Package extraction | P3 | M | When triggered | Second consumer |
| 5 | WebGPU migration | P3 | L | When VTK.js stable | VTK.js release |
| 12 | Plugin system | P3 | XL | Months 6-9 | Items 6, 8 |

---

## Critical Path

The critical path to a publicly useful product is:

```
Week 1-2: Deployment + CI/CD (P0)
    |
    v
Week 1-3: Code splitting + lazy loading (P0)
    |
    v
Week 2-4: Accessibility fixes (P1)
    |
    v
Week 3-5: WebWorker reslice (P1)
    |
    v
Week 4-7: Auth + scoring persistence (P1)
    |
    v
Month 3: i18n (Japanese) + structure detection (P1/P2)
    |
    v
Months 2-3: DICOM route (P1) -- can overlap with auth work
    |
    v
PUBLIC LAUNCH with user accounts, scoring, Japanese support
```

Everything after this point (4D DICOM, ML features, WebGPU, plugins) is Phase 2+ and depends on user feedback and institutional partnerships.

---

## Architectural Principles

These principles should guide implementation decisions across all roadmap items:

1. **Preserve the imperative rendering bridge.** The `SyncManager` pattern (store subscription -> requestAnimationFrame -> imperative pane updates) is the right architecture. Do not let React re-renders drive VTK.js rendering.

2. **Keep `src/core/` pure.** No DOM, no React, no VTK.js dependencies. This is the most portable and testable code in the project.

3. **Defer abstractions until forced.** Do not add `VolumeSource`, `ScoringSink`, or `PluginContext` interfaces until there is a concrete second implementation that needs them.

4. **Measure before optimizing.** Before any performance work, add bundle size tracking and frame time measurement. The WebWorker reslice may not be needed if VTI volumes stay under 20 MB.

5. **Cloudflare-first infrastructure.** Pages, Workers, R2, D1. Avoid introducing a traditional server. The app should remain deployable from a single `wrangler deploy` command.

6. **Clinical validation is a hard gate.** No feature ships to the public bundle without clinical validation of affected views. This applies to rendering changes, new cases, and ML-derived scoring.

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| VTK.js WebWorker incompatibility | Medium | High | Fall back to debounced main-thread reslice + Canvas2D output |
| 3 WebGL contexts hit mobile GPU limits | High | Medium | Reduce to 2 contexts (shared 2D pane context) or use Canvas2D for slice panes |
| Cornerstone3D + VTK.js version conflict | Medium | High | Delay Cornerstone3D until a concrete DICOM viewport requirement exists |
| VTI volume sizes exceed CDN budget | Low | Medium | Brotli compression, R2 zero-egress pricing, lazy per-case loading |
| ML model accuracy insufficient for clinical use | Medium | High | Always pair ML predictions with disclaimer; use as assist, not replacement for 5-DOF scoring |
| i18n medical terminology errors | Medium | High | Have Japanese cardiologist review all medical term translations |
| Plugin security vulnerabilities | Low | High | Curated plugin list only; no runtime loading from untrusted sources |
