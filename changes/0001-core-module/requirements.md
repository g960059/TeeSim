# Requirements

## Problem

ADR-0001 makes `src/core/` the first mainline runtime module after the pseudo-TEE spike. The repo currently has no source tree for probe geometry, imaging-plane math, or preset matching, so later rendering and UI work have no normative implementation to build against.

## Goals

- Add zero-dependency core types for probe pose, centerline data, imaging plane data, and view matching.
- Implement basic vector and matrix math in TypeScript without external libraries.
- Implement probe centerline sampling, shaft/tip/transducer transforms, distal flex, roll, and omniplane plane derivation.
- Implement weighted 5-DOF nearest-preset matching with the ADR thresholds.
- Add unit tests that exercise the math, probe model, and view matcher.
- Add `vitest.config.ts` if needed and verify `npx vitest run` passes.

## Non-Goals

- Parsing case manifests or JSON files.
- Rendering, React UI, or VTK integration.
- Structure-visibility scoring or image-quality heuristics.

## Acceptance

- [ ] `src/core/types.ts`, `math.ts`, `probe-model.ts`, `view-matcher.ts`, and `index.ts` exist and compile.
- [ ] `src/core/__tests__/math.test.ts`, `probe-model.test.ts`, and `view-matcher.test.ts` cover the new module.
- [ ] `vitest.config.ts` exists at repo root if it was previously missing.
- [ ] `npx vitest run` passes.
