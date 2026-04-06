# Requirements

## Problem

The repo has probe math in `src/core/` and a validated standalone pseudo-TEE spike, but it does not yet have reusable browser rendering components for the MVP 3-pane simulator.

## Goals

- Add `src/renderer/` components that create independent VTK.js render windows for the 3D scene, pseudo-TEE pane, and oblique slice pane.
- Reuse the pseudo-TEE spike's validated `vtkImageReslice` path with linear interpolation, mean thick slab, and CPU-side sector masking.
- Provide a sync hook that subscribes to external Zustand probe state and pushes plane/transform updates to pane handles in a single animation frame.

## Non-Goals

- Integrating the renderer into `src/ui/` in this change.
- Modifying probe math in `src/core/`.
- Adding non-MVP ultrasound effects beyond attenuation and thick slab.

## Acceptance

- [ ] `src/renderer/` exports typed React components for the 3 panes plus helper utilities and sync hook.
- [ ] The pseudo-TEE pane labels itself as CT-derived anatomy and uses `vtkImageReslice` with linear interpolation plus thick-slab support.
- [ ] The 3D pane renders loaded mesh actors when available and a placeholder box otherwise, plus a probe glyph and sector fan.
- [ ] `npx tsc --noEmit` passes.
