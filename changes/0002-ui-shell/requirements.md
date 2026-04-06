# Requirements

## Problem

The repository has the core probe model and view matcher, but it does not yet have a React entry point, app shell, UI components, or browser state layer for controlling the probe and selecting cases/views.

## Goals

- Create the Vite React entry files and top-level app composition.
- Add a single Zustand store that owns probe state, case-selection state, UI state, and derived nearest-view matches.
- Ship the 3-pane layout and bottom control dock from ADR-0001 with responsive tab collapse below `1180px`.
- Provide probe sliders, view presets, a view-match indicator, keyboard shortcuts, and a stub case selector wired through the store.
- Match the `data-testid` contract already defined in `e2e/fixtures/teesim-page.ts`.

## Non-Goals

- Implement real VTK.js renderers or asset loaders.
- Change anything under `src/core/` or `spike/`.
- Introduce new architecture decisions beyond the accepted ADR.

## Acceptance

- [ ] App mounts through `index.html`, `src/main.tsx`, and `src/App.tsx`.
- [ ] All required UI components render with the requested `data-testid` hooks.
- [ ] All probe updates flow through the Zustand store.
- [ ] View matching is derived from `matchViews` and highlights the best preset.
- [ ] Responsive layout collapses to tabbed panes below `1180px`.
- [ ] `npx tsc --noEmit` passes.
