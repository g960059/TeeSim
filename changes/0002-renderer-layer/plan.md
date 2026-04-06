# Plan

1. Add a short change pack for the renderer layer.
2. Create shared renderer types and VTK helper utilities.
3. Implement the 3D pane with mesh actors, probe glyph, sector fan, and placeholder fallback.
4. Implement pseudo-TEE and oblique slice panes on top of `vtkImageReslice`.
5. Add the sync manager hook and renderer barrel exports.
6. Run `npx tsc --noEmit` and fix typing/integration issues.
