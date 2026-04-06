# Wave 1 Review

Reviewed `src/core/` and `spike/pseudo-tee/` against [ADR-0001](../decisions/ADR-0001-mvp-architecture.md).

## Verdicts

- `src/core/types.ts` — PASS. `ProbePose` uses `sMm` and the preset contract now includes ADR-required view validation metadata.
- `src/core/math.ts` — PASS. `vec3` and `mat4` operations are internally consistent with the column-major transform convention used by the probe model and tests.
- `src/core/probe-model.ts` — PASS. The implementation matches the ADR shape: shaft frame from authored path frames, constant-curvature distal bend, roll at the bent tip, proximal transducer offset, and omniplane rotation about the transducer axis. Review fixes hardened degenerate frame handling and now reject malformed centerlines with decreasing arc length or non-finite inputs instead of silently emitting zero vectors.
- `src/core/view-matcher.ts` — PASS. Thresholds match the ADR contract (`match >= 0.85`, `near >= 0.60`). Review fixes made omniplane comparison periodic over `180°`, which is required for multiplane angles near the `0°/180°` seam, and added validation for invalid range/weight inputs.
- `src/core/__tests__/` — WARN. Coverage now exercises degenerate frame repair, malformed centerlines, omniplane seam handling, invalid preset ranges, and inclusive status thresholds. Remaining gap: there is still no regression fixture based on a curved authored `probe_path` with real parallel-transport frames. A TODO comment was added to track that.
- `spike/pseudo-tee/main.ts` — PASS. The spike exercises `vtkImageReslice` and `vtkImageResliceMapper` on the same plane, applies sector masking and attenuation on the CPU path, and now benchmarks thick-slab output explicitly instead of only reporting the configured slab thickness.

## Resolved During Review

- `src/core/types.ts`: added `ViewValidation` / `ViewValidationStatus` so the runtime preset type can represent the ADR release-gate metadata.
- `src/core/probe-model.ts`: fixed frame orthonormalization so degenerate authored inputs are repaired from available basis vectors or rejected explicitly; added centerline input validation.
- `src/core/view-matcher.ts`: fixed omniplane distance handling at the `0°/180°` boundary and reject invalid preset metric parameters.
- `spike/pseudo-tee/main.ts`: added an in-page single-slice vs slab benchmark so thick-slab behavior is demonstrated, not just configured.

## Verification

- `npm test`
- `npm run typecheck`
- `npx vite build --config spike/pseudo-tee/vite.config.ts`
