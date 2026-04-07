# Probe Model Fix Plan

**Date:** 2026-04-07
**Based on:** Clinical feedback from cardiac anesthesiologist + TEE probe mechanics research

---

## Problems Identified

### 1. Omniplane rotation axis is wrong (CRITICAL)

**Current (wrong):**
```
beamDirection = rotate(transducerFrame.normal, around shaft tangent, omniplaneAngle)
right = shaft tangent
up = beamDirection (changes with omniplane!)
```

**Correct:**
```
up = transducerFrame.normal  // beam direction, always anterior, FIXED regardless of omniplane
right = rotate(transducerFrame.binormal, around transducerFrame.normal, omniplaneAngle)
normal = cross(right, up)
```

The beam always fires anteriorly. Omniplane only rotates the scan line around the beam axis.

### 2. Centerline normal discontinuities (CRITICAL)

27/243 frame transitions have 180° normal flips because the post-transport "flip toward heart" algorithm makes independent decisions per frame.

**Fix:** Propagate flip state — if frame i is flipped, frame i+1 should also be flipped unless the un-flipped version already faces the heart. This maintains parallel transport smoothness while globally orienting toward the heart.

### 3. Roll vs Omniplane confusion (UX)

- **Roll (shaft rotation):** Physically turning the entire probe clockwise/counterclockwise around its long axis. Changes which direction the beam points (redirects where the transducer faces).
- **Omniplane:** Electronically rotating the scan line 0-180° without moving the probe. Changes which cross-section is sampled, but the beam direction stays the same.

Both should be present, but their effect must be correct:
- Roll rotates the transducer frame (normal + binormal) around the shaft tangent
- Omniplane rotates the scan line (right) around the beam direction (normal)

### 4. Screen depth control (missing feature)

The sector display needs a configurable depth:
- ME views: typically 12-16 cm
- TG views: typically 6-12 cm
- Deeper views (aorta): up to 20 cm

---

## Implementation Plan

### Fix 1: Correct `computeImagingPlane()` in `src/core/probe-model.ts`

```typescript
function computeImagingPlane(path, pose, options): ImagingPlane {
  // 1. Get transducer frame (after flex + roll)
  const frame = getTransducerFrame(path, pose, options);
  
  // 2. Beam direction = transducer normal (FIXED, always anterior)
  const up = frame.normal;
  
  // 3. Scan line = binormal rotated around normal by omniplane angle
  const omniplaneRad = degToRad(pose.omniplaneDeg);
  const right = rotateVectorAroundAxis(
    frame.binormal,   // scan line at omniplane=0
    frame.normal,     // rotation axis = beam direction
    omniplaneRad
  );
  
  // 4. Plane normal
  const planeNormal = vec3.cross(right, up);
  
  return {
    origin: frame.origin,
    right,
    up,
    normal: planeNormal,
    worldFromPlane: buildWorldFromPlane(frame.origin, right, up, planeNormal),
  };
}
```

### Fix 2: Continuous normal propagation in pipeline

Replace the independent flip algorithm in `generate_probe_path()`:

```python
# After parallel transport, propagate flip decisions continuously
if heart_center is not None:
    # Determine initial flip: check if first normal faces heart
    to_heart = heart_center - resampled[0]
    to_heart_perp = to_heart - np.dot(to_heart, tangents[0]) * tangents[0]
    if np.linalg.norm(to_heart_perp) > 1e-6:
        to_heart_perp /= np.linalg.norm(to_heart_perp)
        if np.dot(normals[0], to_heart_perp) < 0:
            normals[0] = -normals[0]
            binormals[0] = -binormals[0]
    
    # Propagate: each frame inherits flip state from previous
    for i in range(1, len(normals)):
        # If current normal faces AWAY from previous (dot < 0), flip it
        if np.dot(normals[i], normals[i-1]) < 0:
            normals[i] = -normals[i]
            binormals[i] = -binormals[i]
```

This guarantees:
- No 180° discontinuities between adjacent frames
- Global orientation toward heart (set by first frame)
- Smooth parallel transport is preserved

### Fix 3: Roll implementation

Roll should rotate the transducer frame (normal + binormal) around the shaft tangent:

```typescript
// In getTransducerFrame():
// After applying flex, apply roll
const rollRad = degToRad(pose.rollDeg);
const rolledNormal = rotateVectorAroundAxis(tipNormal, tipTangent, rollRad);
const rolledBinormal = rotateVectorAroundAxis(tipBinormal, tipTangent, rollRad);
```

### Fix 4: Depth control

Add `depthCm` to `PseudoTeeAppearance`:
```typescript
type PseudoTeeAppearance = {
  depthMm: number;     // display depth in mm (rename from depthMm to be explicit)
  sectorAngleDeg: number;
  // ... other params
};
```

Add depth slider to UI (default: 140mm for ME, 80mm for TG).

---

## Files to Modify

| File | Change |
|------|--------|
| `src/core/probe-model.ts` | Fix `computeImagingPlane()`: omniplane rotates scan line around beam direction, not beam around shaft |
| `src/core/__tests__/probe-model.test.ts` | Update tests: verify beam direction is fixed, scan line rotates |
| `tools/asset-pipeline/process_lctsc_case.py` | Fix normal propagation: continuous flip, not independent |
| `public/cases/0.1.0/lctsc_s1_006/probe_path.json` | Regenerated with continuous normals |
| `src/ui/ProbeHUD.tsx` | Add depth slider |
| `src/renderer/PseudoTeePane.tsx` | Wire depth from appearance prop |
| `src/renderer/types.ts` | Ensure depthMm is in PseudoTeeAppearance |

---

## Verification

After fixes:
1. Advancing probe should produce smooth, continuous orientation changes
2. ME 4C (omni=0) → ME LAX (omni=130): beam direction stays the same, only scan line rotates
3. Roll: physically redirects where the beam points
4. Depth slider: adjusts how much of the sector is visible
5. No 180° normal flips in probe_path.json (check dot products of consecutive normals)
6. All existing unit tests updated and passing
7. E2E 25/25 green
