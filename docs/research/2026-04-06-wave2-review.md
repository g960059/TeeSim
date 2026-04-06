# 2026-04-06 Wave 2 Review

Review scope:

1. `src/ui/`
2. `src/store.ts`
3. `src/renderer/`
4. `src/assets/`
5. `src/App.tsx` integration

Contracts reviewed against:

- `docs/decisions/ADR-0001-mvp-architecture.md`
- `e2e/fixtures/teesim-page.ts`

## Verdict

- `src/ui/` — PASS
- `src/store.ts` — PASS
- `src/renderer/` — PASS
- `src/assets/` — WARN
- `src/App.tsx` integration — WARN

## What Failed Initially And Was Fixed

- `src/assets/` did not exist. Added a typed fetch layer for `/cases/index.json`, `case_manifest.json`, `probe_path.json`, and `views.json`.
- `src/App.tsx` was still rendering placeholder divs instead of the VTK pane components. It now mounts `PseudoTeePane`, `Scene3DPane`, and `ObliqueSlicePane`, measures pane size, and wires probe updates through `useSyncManager`.
- `src/ui/ViewMatchIndicator.tsx` did not match the e2e contract. `data-match-level` now exposes `green | amber | gray` as expected by `e2e/fixtures/teesim-page.ts`.
- `src/renderer/Scene3DPane.tsx` exposed `data-testid="three-d-canvas"` on the wrapper div instead of the real canvas. The test id now lands on the VTK canvas.

## Module Notes

### `src/ui/` — PASS

- Required `data-testid` hooks now line up with the Playwright page object.
- Components read and update state through Zustand selectors instead of local duplicated pose state.
- Responsive collapse below `1180px` is implemented in CSS and the selected pane is still store-driven.

### `src/store.ts` — PASS

- `ProbePose` is consistently `sMm`-based and still derives view matching through `matchViews` from `src/core/`.
- The store now uses `subscribeWithSelector`, which matches the renderer sync hook's subscription contract.
- Case loading now resolves typed bundle metadata and authored probe/view JSON instead of a hard-coded timeout.

### `src/renderer/` — PASS

- Panes follow the expected `useRef` / `useEffect` lifecycle and tear down VTK pipelines on unmount.
- `PseudoTeePane` already had the required CPU-side sector mask plus thick-slab reslice behavior.
- The 3D pane now satisfies the canvas test-id contract used by e2e.

### `src/assets/` — WARN

- The typed fetch loader is now present and matches the current `case_manifest.json` / `probe_path.json` / `views.json` contract used by the shell.
- WARN because public Wave 2 bundles still do not ship decoded `heart_roi.vti` / GLB runtime loading.
- TODO is tracked in `src/assets/synthetic-shell-volume.ts` as `TODO(asset-volume)`.

### `src/App.tsx` integration — WARN

- Store -> renderer -> UI wiring is now live: case metadata loads, pane refs sync from the probe store, and the VTK panes mount in the actual layout.
- WARN because the shell currently feeds the slice panes with an explicit synthetic teaching volume until public `heart_roi.vti` assets exist.
- This warning is surfaced in the UI status strip and tied to the same `TODO(asset-volume)` work.

## Verification

- `npx tsc --noEmit` — PASS
- `npx vitest run` — PASS (`3` files, `18` tests)
