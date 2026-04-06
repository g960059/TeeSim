# Requirements

## Problem

ADR-0001 makes the pseudo-TEE rendering spike the first and highest-priority deliverable. The repo currently has no standalone spike that proves VTK.js can generate an oblique anatomical slice, apply a sector presentation, and exercise thick-slab behavior before broader implementation begins.

## Goals

- Provide a standalone page under `spike/pseudo-tee/` that runs outside the main Vite app.
- Generate a synthetic 256x256x256 cardiac-like volume in code and load it into `vtkImageData`.
- Exercise both `vtkImageReslice` and `vtkImageResliceMapper` on the same synthetic dataset.
- Show a sectorized CT-derived anatomical slice with configurable plane angle, depth, sector angle, interpolation mode, and slab thickness.
- Surface concrete findings in the spike UI for interpolation behavior, slab support, and update timings.

## Non-Goals

- Integrating the spike into the main React app.
- Matching real TEE probe kinematics or clinical assets.
- Implementing ultrasound effects beyond basic sector masking and depth attenuation.

## Acceptance

- [ ] `cd spike/pseudo-tee && npx vite` serves a standalone page.
- [ ] The page renders a synthetic `vtkImageData` volume and a CPU reslice result.
- [ ] The page also exercises `vtkImageResliceMapper` with `vtkImageProperty`.
- [ ] The page applies a fan-shaped sector mask and depth attenuation to the CPU output.
- [ ] The page reports interpolation/slab findings and timing data.
