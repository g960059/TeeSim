# Pseudo-TEE Rendering Spike

Standalone VTK.js spike for ADR-0001's go/no-go rendering gate.

## Run

- From repo root: `npm run spike:tee`
- From the spike directory: `cd spike/pseudo-tee && npx vite`

## What It Exercises

- Synthetic 256x256x256 `vtkImageData` volume generated in code with chamber, myocardium, atrial, and aortic intensity regions
- Oblique reslice via `vtkImageReslice`
- Sector wedge mask and depth-dependent attenuation applied to the CPU reslice output
- Thick-slab reslice on the CPU path via `setSlabNumberOfSlices()`
- Alternate GPU slice path via `vtkImageResliceMapper` + `vtkImageProperty`
- Live controls for plane angle, depth, sector angle, slab thickness, and interpolation mode

## Current Findings

- `vtkImageReslice` works for the standalone spike and supports thick slabs through `setSlabNumberOfSlices()`.
- The installed `@kitware/vtk.js@35.5.2` package exposes `NEAREST`, `LINEAR`, and `CUBIC` interpolation modes in JS even though the TypeScript comment still says "only NEAREST supported so far".
- A direct Node-side VTK.js check on an oblique synthetic reslice produced a mean absolute delta of `1.1555` between nearest and linear, with max delta `10`, so linear interpolation is observably active in this package version.
- The same Node-side check produced a mean absolute delta of `1.4136` between a linear single-slice reslice and a 4-slice mean slab, so thick-slab composition is also observably active.
- `vtkImageResliceMapper` accepts the same slice plane plus slab thickness and `vtkImageProperty` interpolation settings, which makes it a viable alternative path for raw oblique slicing even though the sector fan effect in this spike is still CPU-side.
- Sector masking and attenuation are currently implemented as a CPU post-process over the reslice output in this spike. The GPU comparison path intentionally remains a raw slice viewer.

## Verification Performed

- `npx vite build --config spike/pseudo-tee/vite.config.ts`
- `npx tsc --noEmit`
- Node-side VTK.js probe for nearest vs linear deltas, slab deltas, and `vtkImageResliceMapper` property/slab configuration

The sandbox blocked binding a local port, so `npx vite` could not be kept running here even though the isolated build and typecheck both passed.
