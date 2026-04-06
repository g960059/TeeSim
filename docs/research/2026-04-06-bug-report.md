# 2026-04-06 Bug Report

Wave 2 bug hunt for the browser-based TEE simulator runtime.

## Diagnostics

### Initial run

- `npx tsc --noEmit`: 0 type errors
- `npx vitest run`: 3 test files passed, 18 tests passed
- `npx vite build`: build succeeded; Vite reported a large-chunk warning for the main JS bundle

### File checks

- `index.html` points at the correct entry module: `src/main.tsx` (`index.html:10`)
- Zustand probe-to-renderer sync is structurally correct through `useSyncManager`; the real breakage was upstream in case loading and asset normalization, which prevented `probePath` and real bundle assets from ever reaching the renderer
- `src/assets/loader.ts` did **not** actually load the real `public/cases/lctsc_s1_006` payload before this fix sweep; it only fetched JSON metadata and the app always rendered a synthetic volume plus placeholder 3D scene

## Prioritized bug list

### 1. CRITICAL: case catalog contract mismatch prevented the app from loading a real case

- Severity: `CRITICAL`
- Root cause: the public case index shipped `caseId` records without `id`, `bundleVersion`, or `caseVersion`, while the runtime expected `id` and the versioned `/cases/<bundle>/<case>` layout. The default auto-load path in `App.tsx` (`caseIndex[0].id`) therefore resolved to `undefined`, and `loadCaseBundle()` fetched `/cases/undefined/undefined/case_manifest.json`.
- Suggested fix:
  - Normalize legacy index records in `src/assets/loader.ts:44`
  - Keep the catalog in the versioned runtime shape in `public/cases/index.json:1`
  - Ensure the public LCTSC bundle exists at `/cases/0.1.0/lctsc_s1_006/...`
- Status: fixed

### 2. HIGH: the runtime never loaded the real GLB or VTI assets

- Severity: `HIGH`
- Root cause: `loadCaseBundle()` only fetched `case_manifest.json`, `probe_path.json`, and `views.json`. It ignored `manifest.assets.sceneGlb`, `manifest.assets.heartDetailGlb`, and `manifest.assets.heartRoiVti`. On top of that, `App.tsx` always fed `PseudoTeePane` and `ObliqueSlicePane` a synthetic teaching volume and never passed any meshes into `Scene3DPane`.
- Suggested fix:
  - Add real asset readers in `src/assets/runtime-loaders.ts:1`
  - Load GLB/VTI assets inside `src/assets/loader.ts:177`
  - Store `meshes` and `volume` in Zustand at `src/store.ts:19`
  - Bind those assets into the panes from `src/App.tsx:111`
- Status: fixed

### 3. HIGH: the public probe-path and view assets were incompatible with the core runtime contracts

- Severity: `HIGH`
- Root cause: the authored `probe_path.json` uses parallel arrays (`points`, `arcLengthMm`, `frames`, `stations.sRangeMm`), but `@teesim/core` expects an array of per-sample frame objects with `position`, `arcLengthMm`, `tangent`, `normal`, and `binormal`. The authored `views.json` uses `tolerance`, while the matcher expects `ranges`. Passing those raw assets through would have broken probe transform/imaging-plane generation and ignored authored view tolerances.
- Suggested fix:
  - Normalize probe-path assets in `src/assets/loader.ts:92`
  - Normalize authored view tolerances into matcher ranges in `src/assets/loader.ts:137`
- Status: fixed

### 4. HIGH: real-case manifest omissions would have left the structures panel in an invalid state

- Severity: `HIGH`
- Root cause: the public `lctsc_s1_006` manifest omits `structures` and some metadata fields that the app treated as required. Once real case loading worked, the right-hand structures panel would have attempted `structures.map(...)` against an invalid value.
- Suggested fix:
  - Normalize manifest defaults and derive structures from views/landmarks in `src/assets/loader.ts:59`
  - Persist normalized structures in `src/store.ts:308`
  - Render against the normalized list in `src/App.tsx:199`
- Status: fixed

### 5. LOW: production build still emits a large-chunk warning

- Severity: `LOW`
- Root cause: VTK rendering code and app shell code are bundled into a single large client chunk.
- Suggested fix:
  - Code-split the renderer panes with `dynamic import()` or lazy route/module boundaries
  - Alternatively raise `build.chunkSizeWarningLimit` if the bundle shape is intentional
- Status: not fixed

## Verification after fixes

- `npx vitest run`: 4 test files passed, 20 tests passed
- `npx tsc --noEmit`: 0 type errors
- `npx vite build`: build succeeded; large-chunk warning remains
