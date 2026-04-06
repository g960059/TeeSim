# Design

## Chosen Approach

Use a single app-level Zustand store in `src/store.ts` with small explicit slices and one internal recomputation step for view matches. The UI layer consumes that store through selector hooks and stays renderer-agnostic, so placeholder panes can later be replaced by renderer-owned components without moving the surrounding shell.

Preset metadata and the stub case index are kept simple and local to the UI/runtime layer. The store treats view matching as derived application state from the current `ProbePose`, avoiding duplicate matching logic inside components.

## Boundaries

- Changes: app entry files, store, CSS tokens, responsive shell, controls, preset picker, match indicator, case selector, keyboard hook, and a stub `cases/index.json`
- Unchanged: `src/core/`, `spike/`, rendering implementation, asset pipeline, and ADRs

## Failure Modes

- Missing or malformed case index data falls back to an error `loadPhase` instead of silently hiding the selector state.
- Keyboard shortcuts ignore focused text/select controls so they do not hijack standard form input behavior.
- Probe values are clamped at the store boundary so UI controls and shortcuts cannot push the pose outside expected slider ranges.
