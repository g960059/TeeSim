# Echo-Like Appearance Rendering: Implementation Plan

**Date:** 2026-04-07  
**Author:** Claude Opus (cardiac imaging physicist perspective)  
**Status:** Proposed  
**Scope:** Replace CT-windowed sector display with label-driven ultrasound appearance synthesis in `PseudoTeePane`  
**Critical constraint:** Rendering must be ENTIRELY label-driven. No CT HU dependency. When cardiac motion is added, labels animate and the image must follow.

---

## Physics Rationale

Real ultrasound image formation depends on acoustic impedance mismatches at tissue interfaces, backscatter from sub-resolution heterogeneity (speckle), and cumulative attenuation along the beam path. A CT reslice inverts the physics: CT measures X-ray attenuation, not acoustic reflectivity. Blood is intermediate density on CT but nearly anechoic on echo. Myocardium is similar to blood on non-contrast CT but moderately echogenic on ultrasound.

For educational simulation, we do not need ray-based acoustic propagation. We need label-semantic brightness assignment, Rayleigh-distributed speckle texture, specular interface reflections at tissue boundaries, and depth-dependent gain compensation. This is the minimum stack that makes a sector image "read" as echo rather than CT to a trained sonographer.

The label-driven design is not merely convenient -- it is architecturally required. When phase-resolved cardiac motion is added (Challenge 2 in the remaining-challenges plan), the label volume will be swapped per cardiac phase. If the echo appearance depended on CT HU values, the CT volume would remain static while labels moved, producing an uncanny visual mismatch where anatomy drifts away from its rendered brightness. Label-driven rendering guarantees that when labels change, the image changes.

---

## Acoustic Property Table

Each label maps to a set of tissue acoustic properties. All values are unitless (0-255 scale for brightness, relative scales for speckle and attenuation).

| Label ID | Structure | Base Brightness | Speckle Sigma | Speckle Grain | Atten. Coeff | Notes |
|----------|-----------|----------------|---------------|---------------|-------------|-------|
| 0 | Background (air/outside) | 0 | 0 | -- | 1.0 | Black outside sector |
| 1 | Aorta (total seg) | 12 | 6 | fine | 0.15 | Lumen, same as blood |
| 2 | Pulmonary vein | 12 | 6 | fine | 0.15 | Lumen |
| 3 | SVC | 12 | 6 | fine | 0.15 | Lumen |
| 4 | IVC | 12 | 6 | fine | 0.15 | Lumen |
| 5 | Esophagus | 100 | 20 | medium | 0.45 | Near-field, often clipped |
| 6 | Lung | 8 | 40 | very coarse | 0.95 | Air-filled, near-total reflection |
| 7 | Heart (coarse) | 140 | 28 | coarse | 0.40 | Fallback if highres missing |
| 11 | LV cavity (blood) | 15 | 8 | fine | 0.12 | Nearly anechoic |
| 12 | RV cavity (blood) | 15 | 8 | fine | 0.12 | Nearly anechoic |
| 13 | LA cavity (blood) | 15 | 8 | fine | 0.12 | Nearly anechoic |
| 14 | RA cavity (blood) | 15 | 8 | fine | 0.12 | Nearly anechoic |
| 15 | Myocardium | 160 | 30 | coarse | 0.40 | Moderately echogenic |
| 16 | Aorta (highres) | 12 | 6 | fine | 0.15 | Lumen |
| 17 | Pulmonary artery | 12 | 6 | fine | 0.15 | Lumen |
| 20 | Mitral valve | 230 | 5 | minimal | 0.10 | Highly echogenic, thin |
| 21 | Aortic valve | 230 | 5 | minimal | 0.10 | Highly echogenic, thin |
| 22 | Tricuspid valve | 230 | 5 | minimal | 0.10 | Highly echogenic, thin |
| 23 | Pulmonic valve | 230 | 5 | minimal | 0.10 | Highly echogenic, thin |

**Speckle grain mapping** (pixel radius for spatial coherence of the noise pattern):
- `fine` = 1 px (blood pool: fine swirling texture)
- `medium` = 2 px (soft tissue: visible but not dominant)
- `coarse` = 3 px (myocardium: clearly textured)
- `very coarse` = 5 px (lung: large speckle blobs before attenuation kills signal)
- `minimal` = 0.5 px (valves: nearly smooth, brightness dominates)

---

## Rendering Pipeline: Per-Pixel Algorithm

### Overview

The pipeline replaces the body of `applySectorMask()` in `PseudoTeePane.tsx`. The sector geometry test (is this pixel inside the fan?) stays identical. Everything after the `withinSector` check changes.

### Pseudocode

```typescript
// --- New module: src/renderer/echo-appearance.ts ---

// Deterministic hash for reproducible speckle
function hashPixel(col: number, row: number, seed: number): number {
  // Fast integer hash (e.g. triple32 or xxhash-style)
  let h = (col * 374761393 + row * 668265263 + seed) | 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return (h ^ (h >>> 16)) >>> 0;
}

// Rayleigh-distributed noise from uniform hash
// Rayleigh PDF models the envelope of complex backscatter (physics-correct for speckle)
function rayleighSample(uniformRand: number, sigma: number): number {
  // Inverse CDF of Rayleigh: x = sigma * sqrt(-2 * ln(1 - u))
  const u = Math.max(uniformRand / 4294967295, 1e-10); // normalize uint32 -> (0,1]
  return sigma * Math.sqrt(-2 * Math.log(1 - u));
}

// Spatial coherence: quantize pixel coords to grain size before hashing
function speckleNoise(
  col: number, row: number,
  grainPx: number, sigma: number, seed: number
): number {
  const qCol = Math.floor(col / Math.max(grainPx, 1));
  const qRow = Math.floor(row / Math.max(grainPx, 1));
  const h = hashPixel(qCol, qRow, seed);
  return rayleighSample(h, sigma);
}

// --- Main pixel loop (replaces applySectorMask body) ---

const SPECKLE_SEED = 42;

for (let row = 0; row < heightPx; row++) {
  const axialDepthMm = (row + 0.5) * spacingMm;

  for (let col = 0; col < widthPx; col++, flatIndex++) {
    // ---------- Step 0: Sector geometry (unchanged) ----------
    const lateralMm = (col + 0.5 - centerX) * spacingMm;
    const radiusMm = Math.hypot(lateralMm, axialDepthMm);
    const angularOffset = Math.abs(Math.atan2(lateralMm, Math.max(axialDepthMm, 1e-4)));

    if (!withinSector(axialDepthMm, radiusMm, angularOffset)) {
      outputValues[flatIndex] = 0;
      continue;
    }

    // ---------- Step 1: Read label ----------
    const labelId = labelValues[flatIndex]; // nearest-neighbor reslice, already done

    // ---------- Step 2: Look up acoustic properties ----------
    const props = ACOUSTIC_TABLE[labelId] ?? ACOUSTIC_TABLE[0];
    // props = { baseBrightness, speckleSigma, grainPx, attenCoeff }

    // ---------- Step 3: Base brightness + speckle ----------
    const speckle = speckleNoise(col, row, props.grainPx, props.speckleSigma, SPECKLE_SEED);
    let pixel = props.baseBrightness + speckle;

    // ---------- Step 4: Boundary detection (interface reflection) ----------
    // Sample 4 cardinal neighbors in the label reslice.
    // If any neighbor has a different label -> specular reflection boost.
    const centerLabel = labelId;
    let isBoundary = false;
    if (col > 0 && labelValues[flatIndex - 1] !== centerLabel) isBoundary = true;
    if (col < widthPx - 1 && labelValues[flatIndex + 1] !== centerLabel) isBoundary = true;
    if (row > 0 && labelValues[flatIndex - widthPx] !== centerLabel) isBoundary = true;
    if (row < heightPx - 1 && labelValues[flatIndex + widthPx] !== centerLabel) isBoundary = true;

    if (isBoundary) {
      // Specular reflection: tissue interfaces produce bright lines in echo.
      // Impedance mismatch at blood-myocardium (~endocardium) or
      // myocardium-pericardium is the dominant diagnostic feature.
      // Valve boundaries get an extra boost since they are thin and bright.
      const isValveBoundary = (centerLabel >= 20 && centerLabel <= 23);
      const boundaryBoost = isValveBoundary ? 120 : 90;
      pixel += boundaryBoost;
    }

    // ---------- Step 5: Time Gain Compensation (TGC) ----------
    // Real echo applies increasing gain with depth to compensate for
    // cumulative attenuation. Without TGC, far-field structures disappear.
    // Model: exponential gain increase, partially offset by tissue attenuation.
    const depthNorm = axialDepthMm / depthMm; // 0..1
    const tgcGain = 1.0 + 1.2 * depthNorm;    // linear ramp, 1x at top -> 2.2x at bottom
    pixel *= tgcGain;

    // ---------- Step 6: Cumulative attenuation along the beam ----------
    // Simplified: use label attenuation coefficient * depth.
    // A full model would integrate attenuation along the beam path (ray-sum).
    // For v0.2, per-pixel depth * local attenuation is sufficient.
    const attenuation = Math.exp(-props.attenCoeff * depthNorm * 2.5);
    pixel *= attenuation;

    // ---------- Step 7: Near-field clutter ----------
    // The first few mm near the probe are noisy in real echo due to
    // reverberations in the esophageal wall and probe-tissue interface.
    if (axialDepthMm < nearFieldMm + 8) {
      const clutterFade = smoothstep(nearFieldMm, nearFieldMm + 8, axialDepthMm);
      const clutterNoise = speckleNoise(col, row, 2, 35, SPECKLE_SEED + 7);
      pixel = pixel * clutterFade + clutterNoise * (1 - clutterFade);
    }

    // ---------- Step 8: Sector edge feather (unchanged from current code) ----------
    const angleNorm = angularOffset / halfSectorRad;
    const radialNorm = radiusMm / depthMm;
    const edgeFeather = 1 - smoothstep(0.86, 1.0, Math.max(angleNorm, radialNorm));
    pixel *= edgeFeather;

    // ---------- Step 9: Lateral resolution degradation ----------
    // Real echo has poorer lateral resolution far from the beam axis.
    // Subtle brightness reduction at extreme angles mimics this.
    const lateralFalloff = 1.0 - 0.15 * angleNorm * angleNorm;
    pixel *= lateralFalloff;

    // ---------- Step 10: Clamp and write ----------
    outputValues[flatIndex] = clampToByte(pixel);
  }
}
```

---

## Boundary Detection: Detail

The 4-neighbor cardinal check is deliberately simple. It operates on the already-resliced 2D label image, so it costs zero additional VTK calls. The boundary set this produces includes:

- **Endocardial borders** (blood labels 11-14 adjacent to myocardium 15): the most important diagnostic contour in clinical echo.
- **Epicardial/pericardial borders** (myocardium 15 adjacent to lung 6 or background 0): makes pericardium visible.
- **Valve leaflet edges** (valve labels 20-23 adjacent to blood or myocardium): reinforces leaflet visibility.
- **Great vessel walls** (aorta/PA lumen 16-17 adjacent to myocardium or background): makes aortic and PA walls visible.

**Why not 8-neighbor or Sobel?** Four-neighbor produces single-pixel-wide boundaries that match the thin specular reflections seen in real echo. Eight-neighbor or gradient-based methods would produce thicker boundaries that look more like CT edge enhancement than echo interface reflections. If the 4-neighbor result looks too thin at higher resolutions, a simple dilation of the boundary mask by 1 pixel (marking pixels within 1px of a label transition) would be the correct fix, not switching to a gradient operator.

**Boundary brightness boost values (90 for tissue, 120 for valves):** These are intentionally high because specular reflection at tissue interfaces is the dominant brightness source in real echo -- often brighter than the underlying tissue's backscatter. The values were chosen so that:
- Blood-myocardium interfaces reach ~250 (near-white): matches real endocardial border appearance.
- Myocardium-lung interfaces reach ~230: matches pericardial line appearance.
- Valve-blood interfaces reach ~240+: valves are the brightest structures in a normal echo.

---

## TGC Curve: Detail

The Time Gain Compensation model has two components that partially cancel:

1. **TGC gain ramp** (user-controllable in real machines, fixed for v0.2): `1.0 + 1.2 * depthNorm`. This linearly increases gain from 1x at the probe face to 2.2x at maximum depth. On a real machine this would be a slider bank; for v0.2, a single linear ramp is sufficient.

2. **Per-tissue attenuation** applied as `exp(-attenCoeff * depthNorm * 2.5)`. Blood attenuates very little (0.12), so blood pools stay dark but visible across the full sector. Myocardium attenuates moderately (0.40), so distant myocardium is dimmer. Lung attenuates almost completely (0.95), so lung tissue behind a few centimeters is effectively black -- matching real echo's inability to image through air.

The net effect:
- Near-field (0-20mm): TGC is ~1.0-1.2x, attenuation negligible. Near-field clutter dominates.
- Mid-field (20-80mm): TGC compensates attenuation for blood/myocardium. Diagnostic zone.
- Far-field (80-140mm): TGC gain is high but tissue attenuation wins for muscle. Blood pools remain visible. This correctly reproduces the far-field dropout seen in real TEE.

---

## Near-Field Clutter: Detail

The first 4-12mm of the sector (probe face region) is filled with structured noise in real TEE, caused by:
- Reverberations between the probe crystal and the esophageal wall
- Ring-down artifacts from the coupling medium
- Side lobe clutter from the near-field beam pattern

The implementation crossfades between clutter noise and the diagnostic image using `smoothstep(nearFieldMm, nearFieldMm + 8, depth)`. At `nearFieldMm` (default 4mm), the image is 100% clutter. At `nearFieldMm + 8` (12mm), the image is 100% diagnostic. The clutter itself uses the same `speckleNoise` function but with a different seed and higher sigma (35), producing bright noisy texture that looks like the characteristic "dirty" near-field of real echo.

---

## Specific File Changes

### 1. New file: `src/renderer/echo-appearance.ts`

This module contains:

- `AcousticProperties` interface: `{ baseBrightness: number; speckleSigma: number; grainPx: number; attenCoeff: number }`
- `ACOUSTIC_TABLE`: `Record<number, AcousticProperties>` -- the table from above
- `hashPixel()`: deterministic integer hash
- `rayleighSample()`: inverse CDF Rayleigh from uniform random
- `speckleNoise()`: spatially coherent speckle generator
- `isBoundaryPixel()`: 4-neighbor label boundary test
- `getBoundaryBoost()`: returns boost value based on label category

Approximate size: ~120 lines.

### 2. Modified: `src/renderer/PseudoTeePane.tsx`

**What changes:**

- `applySectorMask()` function body is rewritten. The sector geometry test (lines 107-130 in current code) stays. Everything after `withinSector` is replaced with the echo synthesis pipeline.
- The function signature gains no new parameters -- it already receives `labelSource` and `labelValues`.
- The CT reslice output (`sourceValues` from `reslice.getOutputData()`) is **no longer used for pixel brightness**. The reslice still executes (it drives the geometry), but pixel values come from label lookup, not HU windowing.
- `remapToByte()` usage is removed from this code path.
- The `windowLow` / `windowHigh` appearance fields become unused in the echo path but are kept for potential "CT mode" toggle.
- The label overlay (RGBA color overlay for educator mode) continues to work unchanged, composited on top.

**What stays the same:**

- `ensureOutputRuntime()`, `ensureLabelOverlayRuntime()`: unchanged
- VTK reslice pipeline setup in `flush()`: unchanged (both CT reslice and label reslice still run)
- Label overlay RGBA path: unchanged
- Canvas / VTK rendering setup in `useEffect`: unchanged
- `buildResliceAxes`, camera fitting, etc.: unchanged

**Estimated diff:** ~80 lines removed (current CT-window mapping), ~60 lines added (echo synthesis call + imports). Net: ~140 line change in this file.

### 3. Modified: `src/renderer/types.ts`

Extend `PseudoTeeAppearance`:

```typescript
export interface PseudoTeeAppearance {
  depthMm?: number;
  nearFieldMm?: number;
  outputSpacingMm?: number;
  sectorAngleDeg?: number;
  slabThicknessMm?: number;
  // Legacy CT mode (kept for potential toggle)
  windowHigh?: number;
  windowLow?: number;
  // Echo appearance controls (new)
  tgcSlope?: number;          // default 1.2
  clutterSigma?: number;      // default 35
  speckleSeed?: number;       // default 42
  boundaryBoost?: number;     // default 90
  valveBoundaryBoost?: number; // default 120
}
```

Estimated diff: ~8 lines.

### 4. Modified: `src/renderer/label-colors.ts`

No structural change needed. The echo appearance table lives in the new `echo-appearance.ts` module. The existing color table continues to serve the educator-mode label overlay. A comment is added noting the separation of concerns:

```typescript
// Label colors are for the educator overlay (RGBA).
// Echo-mode acoustic properties (brightness, speckle, attenuation) live in echo-appearance.ts.
```

Estimated diff: ~2 lines (comment only).

### 5. New file: `src/renderer/__tests__/echo-appearance.test.ts`

Unit tests:

- `hashPixel` produces deterministic output for the same inputs
- `hashPixel` produces different output for adjacent pixels
- `rayleighSample` returns values in expected range for known sigma
- `speckleNoise` with grain > 1 produces identical values for quantized-same pixels
- `ACOUSTIC_TABLE` covers all label IDs from `LABEL_COLOR_TABLE`
- Blood labels have low brightness, myocardium has high brightness
- Valve labels have highest brightness and lowest speckle
- `isBoundaryPixel` returns true at label transitions
- `isBoundaryPixel` returns false in homogeneous regions
- Full pixel pipeline produces values in 0-255 range

Estimated size: ~100 lines.

### 6. Optional new file: `public/cases/0.1.0/<case>/appearance.json`

Per-case appearance overrides. Not required for v0.2 first pass but useful for tuning:

```json
{
  "version": 1,
  "tgcSlope": 1.2,
  "clutterSigma": 35,
  "overrides": {
    "15": { "baseBrightness": 150, "speckleSigma": 35, "note": "thicker myocardium for this case" }
  }
}
```

### Summary of files

| File | Action | Lines changed (est.) |
|------|--------|---------------------|
| `src/renderer/echo-appearance.ts` | **Create** | ~120 |
| `src/renderer/PseudoTeePane.tsx` | **Modify** | ~140 |
| `src/renderer/types.ts` | **Modify** | ~8 |
| `src/renderer/label-colors.ts` | **Modify** | ~2 |
| `src/renderer/__tests__/echo-appearance.test.ts` | **Create** | ~100 |
| `public/cases/.../appearance.json` | **Create (optional)** | ~15 |

---

## Performance Analysis

### Current cost

The current `applySectorMask()` iterates every pixel once. At 600x600 output (typical), that is 360,000 pixels. Per pixel: one sector test (~5 math ops), one `remapToByte` (3 ops), one depth attenuation (exp + multiply), one edge feather (smoothstep), one label color lookup (if overlay active). Total: ~15-20 ops/pixel.

### New cost

Per pixel: same sector test, one `ACOUSTIC_TABLE` lookup (hash map, ~3 ops), one `speckleNoise` call (~15 ops for hash + sqrt + log), one 4-neighbor boundary check (4 comparisons), one TGC multiply, one attenuation exp, one near-field blend (conditional, ~30% of pixels), one edge feather. Total: ~35-40 ops/pixel.

### Impact

Roughly **2x** the per-pixel compute. At 360K pixels this is ~14M ops, which takes **<3ms on any modern CPU** in a tight typed-array loop. The VTK reslice itself takes 5-15ms. Total frame time stays well under 20ms. **No GPU involvement, no WebGL shader needed, no additional texture uploads.**

If performance becomes a concern at higher resolutions (e.g., 1024x1024 = 1M pixels), the speckle hash can be SIMD-ified or moved to a Web Worker. But this is unlikely to be needed for v0.2.

---

## What the CT Reslice Is Still Used For

Even though pixel brightness no longer comes from CT HU values, the CT reslice continues to serve two purposes:

1. **Geometry definition**: The reslice output grid defines the pixel coordinate system. The label reslice outputs to the same grid, so they are pixel-aligned.
2. **Fallback mode**: If a user (educator) wants to see the underlying CT anatomy, a toggle can switch back to CT-windowed display. This is useful for teaching "what does the anatomy actually look like vs. what echo shows you."

The CT volume remains loaded. The label volume is the primary rendering driver.

---

## What the User Will See

### Before (current)

The pseudo-TEE pane shows a sector-shaped region with CT Hounsfield Unit windowing. Blood pools appear medium-gray (30-50 HU mapped to ~half brightness). Myocardium appears nearly the same gray (50-80 HU). Chambers are hard to distinguish from walls. The image reads unmistakably as "CT slice with a fan mask." There is no speckle, no interface reflection, no TGC, no near-field clutter. A sonographer would not recognize this as echo.

### After (this plan)

- **Blood pools (LV, RV, LA, RA):** Nearly black with fine, faint speckle. Chambers are immediately identifiable as the dark spaces within the heart, exactly as they appear in real echo.
- **Myocardium:** Bright gray with visible coarse speckle texture. Wall motion will be visible because the bright tissue contrasts with the dark blood.
- **Endocardial borders:** Crisp bright lines where blood meets myocardium. These are the lines that cardiologists trace for ejection fraction.
- **Valve leaflets:** The brightest structures in the image, with minimal speckle. Thin bright lines that open and close (once motion is added).
- **Aorta/PA lumen:** Dark (blood-filled), distinguishable from chambers by location.
- **Pericardium:** Bright line at the myocardium-lung interface.
- **Lung:** Near-black with large speckle blobs, rapidly attenuating to nothing -- matching the "acoustic shadow" behind air-filled lung.
- **Near field:** A band of noisy texture in the first ~12mm, fading into the diagnostic image. This is a signature feature of esophageal echo.
- **Depth behavior:** Far-field structures are slightly dimmer but still visible for blood, while myocardium shows natural dropout at maximum depth. This replaces the current uniform CT fade.
- **Sector edges:** Smooth feathering (unchanged).

The overall impression should be: "This looks like a teaching-quality echo, not a clinical echo." It will not fool an expert into thinking it is real ultrasound, but it will train the correct visual pattern recognition: dark blood, bright walls, bright valves, bright interfaces, textured tissue, depth-dependent brightness.

---

## Effort Estimate

| Task | Estimate |
|------|----------|
| Write `echo-appearance.ts` (acoustic table, speckle, boundary) | 0.5 day |
| Rewrite `applySectorMask()` in `PseudoTeePane.tsx` | 0.5 day |
| Update `types.ts` with new appearance fields | 0.25 day |
| Write unit tests for `echo-appearance.ts` | 0.5 day |
| Visual tuning pass (adjust table values against clinical echo reference images) | 1 day |
| Optional: `appearance.json` loader + per-case overrides | 0.5 day |
| **Total** | **2.5-3.5 days** |

The visual tuning pass is the largest variable. The acoustic property values in the table above are educated starting points based on ultrasound physics, but they will need empirical adjustment against reference echo screenshots to achieve the right "feel."

---

## Dependencies and Sequencing

- **No external dependency needed.** Pure TypeScript math in the existing CPU pixel loop.
- **Does not require valve labels to exist first.** The current label set (chambers + myocardium + vessels) already contains enough boundaries for a convincing echo appearance. Valve labels (20-23) will simply "light up" when added.
- **Does not require cardiac motion.** The renderer works on a single label frame. When multi-phase labels are added, the renderer will animate automatically because it reads labels, not CT.
- **Can be developed in parallel with valve geometry work** (Challenge 1 from remaining-challenges-plan.md).

---

## Verification Criteria

The implementation is considered correct when:

1. Blood pools (labels 11-14) appear dark with fine speckle. Mean brightness < 30/255.
2. Myocardium (label 15) appears bright with coarse speckle. Mean brightness 120-180/255 in mid-field.
3. Endocardial borders (blood-myocardium transitions) produce visible bright lines. Peak brightness > 200/255 at boundaries.
4. Valve labels (20-23), when present, are the brightest non-boundary structures. Base brightness > 220/255.
5. Lung (label 6) attenuates to near-black within 20mm of its boundary.
6. Near-field clutter is visible in the first ~12mm and fades smoothly.
7. Far-field myocardium is dimmer than mid-field myocardium, but far-field blood pools remain visible.
8. The speckle pattern is deterministic: same probe position produces same texture.
9. The speckle pattern is spatially coherent: adjacent pixels within one grain cell share the same noise value.
10. Sector edge feathering is indistinguishable from the current implementation.
11. Frame time remains under 20ms at 600x600 resolution.
12. Existing label overlay (educator mode RGBA colors) composites correctly on top of the echo image.
13. When `labelValues` is unavailable (no label volume loaded), the renderer falls back gracefully (black sector or CT-windowed display).

---

## Future Extensions (Out of Scope for This Plan)

- **Acoustic shadowing**: Calcified structures (not yet labeled) should cast dark shadows behind them. Requires a per-column attenuation accumulator (ray-marching in the depth direction). Straightforward but adds ~50% to per-pixel cost.
- **Side lobe artifacts**: Bright structures produce lateral ghost echoes. Requires lateral convolution pass. Educational value is low for TEE training.
- **Harmonic imaging mode**: Second-harmonic rendering reduces clutter and improves contrast. Could be simulated by reducing speckle sigma and increasing boundary boost. Good for a "mode selector" UI.
- **Color Doppler overlay**: Velocity-encoded color map in blood regions. Requires motion data. Major feature, not part of echo appearance rendering.
- **User-adjustable TGC sliders**: Per-depth-zone gain knobs matching real machine UI. Educational for understanding gain artifacts. Simple to add once the base TGC model exists.
