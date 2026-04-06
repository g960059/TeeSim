# Design

## Chosen Approach

Implement `src/core/` as pure TypeScript with no browser or rendering dependencies.

- `types.ts` defines the runtime-facing data contracts for probe pose, centerline samples, imaging planes, presets, and matches.
- `math.ts` provides a minimal `vec3` and `mat4` toolkit using a simple column-major transform convention.
- `probe-model.ts` samples the centerline by arc length, rebuilds an orthonormal shaft frame from the authored tangent/normal/binormal triad, applies a constant-curvature distal bend over a configurable section length, applies roll at the tip, offsets the transducer origin proximally from the tip, and derives the omniplane imaging plane about the transducer axis.
- `view-matcher.ts` computes normalized weighted 5-DOF distance and maps it to the ADR score bands (`match`, `near`, `exploring`).

## Boundaries

- The implementation uses linear interpolation between authored centerline samples rather than cubic spline fitting.
- The probe remains constrained to the centerline and does not model radial offset or wall contact.
- View matching is preset-distance-only; no anatomy visibility logic is added.

## Failure Modes

- Empty or malformed centerlines throw explicit errors instead of guessing defaults.
- Degenerate frame vectors are orthonormalized from the available basis inputs; if that still fails, the functions throw.
- View scoring clamps to `[0, 1]` and reports the closest preset without silently widening thresholds.
