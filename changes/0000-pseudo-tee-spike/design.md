# Design

## Chosen Approach

Use one standalone Vite entrypoint under `spike/pseudo-tee/` with two synchronized rendering paths:

- CPU path: `vtkImageReslice` produces a 2D oblique slice, then a small JS post-process applies the sector wedge and depth-dependent attenuation before the result is displayed through `vtkImageMapper` and `vtkImageSlice`.
- GPU path: `vtkImageResliceMapper` plus `vtkImageProperty` renders the same plane directly from the 3D volume for comparison and slab-testing.

This keeps the spike faithful to ADR-0001 while making the rendering behavior inspectable on a single page.

## Boundaries

- Changes are limited to the isolated spike, one npm script, and the active change-pack metadata.
- The main app structure, `src/`, and runtime architecture remain unchanged.

## Failure Modes

- If `vtkImageResliceMapper` fails at runtime, the page keeps the CPU path live and surfaces the GPU error explicitly in the findings panel.
- If interpolation modes behave identically, the findings panel reports that instead of implying unsupported behavior is fixed.
- If thick-slab controls are unavailable or ineffective, the page reports the observed timing and output delta rather than silently ignoring the setting.
