# Design

## Chosen Approach

Build the renderer as a small `src/renderer/` module with one VTK.js render window per pane and imperative pane handles for low-latency updates. React owns mount/unmount and initial props; the sync manager owns high-frequency probe updates by writing directly to pane handles inside one `requestAnimationFrame`.

The pseudo-TEE and oblique panes both use `vtkImageReslice`. The pseudo-TEE pane follows the spike's proven path: reslice to a 2D image, then apply the 90-degree fan mask and attenuation on the CPU before displaying the processed image through `vtkImageSlice`.

## Boundaries

- Changes:
  - new `src/renderer/` module
  - new change pack for renderer implementation
- Stays unchanged:
  - `src/core/`
  - `src/ui/`
  - `spike/`
  - `index.html`

## Failure Modes

- Missing volume or plane input keeps slice panes in a visible loading state instead of silently rendering stale images.
- Missing meshes falls back to a placeholder box so the 3D pane stays usable before asset loading is wired in.
- Sync manager only depends on explicit pane handles and subscribed probe pose updates; if a pane ref is absent, that pane is skipped rather than crashing the frame loop.
