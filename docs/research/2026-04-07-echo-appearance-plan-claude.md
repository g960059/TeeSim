# Echo-Like Appearance Plan (Claude)

**Date:** 2026-04-07
**Author:** Main orchestrator (Claude)

---

## Core Design Principle

> **Label-first rendering:** The pseudo-TEE image is generated ENTIRELY from the label volume. CT intensity is not used. This ensures that when labels animate (cardiac motion), the image changes naturally.

## Architecture Change

**Before:** `applySectorMask()` reads CT HU → window → depth attenuation → output grayscale
**After:** `renderEchoSector()` reads label ID → tissue properties → speckle → boundary → TGC → output grayscale

The CT intensity reslice becomes optional (used only when labels are unavailable).

## Rendering Algorithm

For each pixel `(col, row)` inside the sector:

```
1. Read labelId from resliced label volume (nearest-neighbor, slab=MAX over 3.2mm)
2. If labelId == 0 (outside body): output black, continue

3. Look up tissue properties from TISSUE_TABLE[labelId]:
   - baseBrightness: uint8 (0-255)
   - speckleSigma: float (Rayleigh distribution parameter)
   - speckleScale: float (spatial frequency of speckle pattern)
   - attenuationCoeff: float (dB/cm/MHz equivalent)

4. Generate speckle:
   - seed = hash(col, row, labelId) for deterministic spatial pattern
   - speckle = rayleigh(speckleSigma) using seeded RNG
   - brightness = baseBrightness + speckle

5. Boundary detection (4-neighbor):
   - Read labels at (col±1, row) and (col, row±1)
   - If any neighbor != labelId AND neighbor != 0:
     → This is a tissue interface
     → boundary_boost = 80 + 40 * random()  (specular reflection)
     → brightness += boundary_boost

6. Depth effects:
   - depthMm = row * spacingMm
   - tgc = 1.0 + tgcSlope * depthMm  (time-gain compensation, linear ramp)
   - attenuation = exp(-attenuationCoeff * depthMm / 100)
   - brightness = brightness * tgc * attenuation

7. Near-field clutter:
   - If depthMm < nearFieldMm: add bright noise (clutter artifact)

8. Sector geometry:
   - Apply existing sector mask (fan shape, edge feathering)
   - Lateral resolution degradation: slight blur at sector edges

9. Clamp to [0, 255], write to output
```

## Tissue Property Table

```typescript
type TissueProperties = {
  baseBrightness: number;  // 0-255
  speckleSigma: number;    // Rayleigh parameter
  speckleScale: number;    // spatial frequency
  attenuationCoeff: number; // relative attenuation
};

const TISSUE_TABLE: Record<number, TissueProperties> = {
  // Blood pools — anechoic (dark with fine speckle)
  11: { baseBrightness: 12, speckleSigma: 6, speckleScale: 1, attenuationCoeff: 0.1 },  // LV
  12: { baseBrightness: 12, speckleSigma: 6, speckleScale: 1, attenuationCoeff: 0.1 },  // RV
  13: { baseBrightness: 12, speckleSigma: 6, speckleScale: 1, attenuationCoeff: 0.1 },  // LA
  14: { baseBrightness: 12, speckleSigma: 6, speckleScale: 1, attenuationCoeff: 0.1 },  // RA
  16: { baseBrightness: 10, speckleSigma: 5, speckleScale: 1, attenuationCoeff: 0.08 }, // Aorta
  17: { baseBrightness: 10, speckleSigma: 5, speckleScale: 1, attenuationCoeff: 0.08 }, // PA

  // Myocardium — echogenic (bright, coarse speckle)
  15: { baseBrightness: 150, speckleSigma: 25, speckleScale: 3, attenuationCoeff: 0.5 },
  7:  { baseBrightness: 130, speckleSigma: 20, speckleScale: 2, attenuationCoeff: 0.4 },  // heart coarse

  // Valves — very bright (high impedance interface)
  20: { baseBrightness: 220, speckleSigma: 5, speckleScale: 1, attenuationCoeff: 0.3 },  // MV
  21: { baseBrightness: 220, speckleSigma: 5, speckleScale: 1, attenuationCoeff: 0.3 },  // AV
  22: { baseBrightness: 220, speckleSigma: 5, speckleScale: 1, attenuationCoeff: 0.3 },  // TV
  23: { baseBrightness: 220, speckleSigma: 5, speckleScale: 1, attenuationCoeff: 0.3 },  // PV

  // Other structures
  1:  { baseBrightness: 10, speckleSigma: 5, speckleScale: 1, attenuationCoeff: 0.08 },  // aorta (total)
  2:  { baseBrightness: 10, speckleSigma: 5, speckleScale: 1, attenuationCoeff: 0.08 },  // pulm vein
  3:  { baseBrightness: 10, speckleSigma: 5, speckleScale: 1, attenuationCoeff: 0.08 },  // SVC
  4:  { baseBrightness: 10, speckleSigma: 5, speckleScale: 1, attenuationCoeff: 0.08 },  // IVC
  5:  { baseBrightness: 90, speckleSigma: 15, speckleScale: 2, attenuationCoeff: 0.6 },   // Esophagus
  6:  { baseBrightness: 5, speckleSigma: 35, speckleScale: 5, attenuationCoeff: 2.0 },    // Lung (high attenuation)
};
```

## Key Design Decisions

### 1. Label-only rendering (no CT HU fallback in echo mode)

When `labelsVisible` is ON (echo mode), the entire image is generated from labels. The CT reslice is NOT used. This:
- Ensures motion compatibility (labels animate → image animates)
- Simplifies the rendering pipeline
- Makes blood pools consistently dark (not dependent on CT contrast)

When `labelsVisible` is OFF, fall back to current CT-based rendering (backward compatible).

### 2. Deterministic speckle

Speckle pattern must be deterministic (seeded by pixel position + label) so it doesn't flicker every frame. Use a simple hash function, not Math.random().

### 3. Boundary detection is the key to realism

The single most important visual feature is **bright lines at label boundaries**. This is what makes:
- Endocardial border visible (LV wall ↔ LV blood)
- Valve leaflets appear as bright thin lines
- Pericardium visible as a bright outline

Without boundary detection, the image looks like colored segmentation. With it, it looks like echo.

### 4. TGC as a user control (future)

Time-gain compensation should eventually be a user-adjustable curve (like real echo machines). For v0.2, use a simple linear ramp.

## Files to Modify

| File | Change |
|------|--------|
| `src/renderer/PseudoTeePane.tsx` | Replace `applySectorMask()` with `renderEchoSector()` when labels available |
| `src/renderer/echo-renderer.ts` | **NEW:** Tissue table, speckle generator, boundary detector, TGC |
| `src/renderer/label-colors.ts` | Keep for oblique pane; echo renderer uses its own tissue table |
| `src/renderer/types.ts` | Add `echoMode: boolean` to PseudoTeeAppearance |

## Performance

- Same CPU pixel loop as current `applySectorMask()`
- Extra cost: 4-neighbor boundary check per pixel (~2x slower than current)
- At 768×768 output: ~590K pixels × 4 neighbors = ~2.4M label lookups
- Still should be <16ms per frame on modern CPU

## Effort Estimate

- `echo-renderer.ts` (tissue table + speckle + boundary + TGC): 1 day
- Wire into PseudoTeePane: 0.5 day
- Tuning tissue parameters: 0.5 day
- **Total: 2 days**

## What The User Will See

- **Blood pools (LV, RV, LA, RA):** Dark cavities with fine speckle — like real echo
- **Myocardium:** Bright tissue with coarser texture
- **Valve leaflets:** Very bright thin lines at annulus positions
- **Endocardial borders:** Bright lines where blood meets muscle
- **Pericardium/tissue interfaces:** Bright specular reflections
- **Depth gradient:** Near field slightly cluttered, far field attenuated but TGC compensated
- **Sector shape:** Same fan geometry as current
