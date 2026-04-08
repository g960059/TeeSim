# Echo Appearance Implementation Plan (Codex)

**Date:** 2026-04-07  
**Status:** Proposed research note  
**Scope:** Replace CT-windowed pseudo-TEE rendering with a label-driven, echo-like appearance model in the browser runtime  
**Inputs:** [`src/renderer/PseudoTeePane.tsx`](../../src/renderer/PseudoTeePane.tsx), [`src/renderer/label-colors.ts`](../../src/renderer/label-colors.ts), [`docs/research/2026-04-07-remaining-challenges-plan.md`](./2026-04-07-remaining-challenges-plan.md)

---

## Summary Recommendation

The pseudo-TEE pane should become a **label-first renderer**:

- keep the current **VTK.js reslice + sector mask + fan geometry**
- remove **CT HU windowing** from the pseudo-TEE image path
- synthesize grayscale entirely from the **resliced label volume**
- keep label colors only as an **optional educator overlay**, not as the base image

This is the key architectural correction:

> The pseudo-TEE pane must react to **label motion**, not to static CT intensity.

If the labels change at a cardiac phase step, the pseudo-TEE image should change automatically because blood pools, myocardium, and valves are rendered from labels directly.

---

## Non-Negotiables

1. **No CT dependency in pseudo-TEE appearance**
   The pseudo-TEE pane should no longer derive grayscale from `heart_roi.vti`. CT can remain for the oblique slice pane.

2. **`labelsVisible` stops meaning “use labels for rendering”**
   In the current code, labels are optional overlay input. After this change, labels are the base signal. The existing `labelsVisible` flag should control only the optional color overlay.

3. **No silent fallback to CT mode**
   If a case lacks `heart_labels.vti`, the pane should show an explicit unavailable/loading state. Falling back to CT would break the motion coupling requirement and hide missing data problems.

4. **Sector geometry stays**
   The current fan mask, depth limits, near-field gate, and edge feathering remain the display geometry.

---

## Current Implementation Constraint

[`src/renderer/PseudoTeePane.tsx`](../../src/renderer/PseudoTeePane.tsx) currently does this:

1. reslice CT intensity with `vtkImageReslice`
2. optionally reslice labels
3. in `applySectorMask()`:
   - map HU to grayscale with `windowLow/windowHigh`
   - apply depth attenuation
   - optionally paint a colored label overlay

That is the wrong data flow for echo-like appearance. It keeps the image tied to CT values even when the label volume carries the clinically meaningful anatomy.

There is also one important technical trap in the current label path:

- `labelReslice` uses `SlabMode.MAX`
- that is acceptable for a **binary mask**
- that is **not** a correct aggregator for categorical labels like `11=LV`, `15=myocardium`, `20=mitral valve`

So the new renderer should not reuse the current categorical label slab path unchanged.

---

## Proposed Runtime Design

### 1. Split “base anatomy” from “thin specular structures”

Use two label-derived reslice products in the pseudo-TEE pane:

- **Base label slice**
  - nearest-neighbor categorical reslice
  - `SlabNumberOfSlices = 1`
  - drives dominant tissue identity per pixel

- **Specular mask slice**
  - derived binary mask for high-impedance thin structures
  - valves first (`20-23`), extend later if pericardium or other reflector labels appear
  - `SlabMode.MAX` over the current 3-5 mm thickness
  - drives bright leaflet/specular reinforcement

This keeps categorical labels correct while preserving visibility of thin structures.

### 2. Add an explicit acoustic property table

Do **not** overload [`src/renderer/label-colors.ts`](../../src/renderer/label-colors.ts). That file is an educator overlay palette, not an acoustic model.

Add a new renderer module, for example:

- `src/renderer/echo-appearance.ts`

It should define:

- `EchoTissueClass`
- `LABEL_TO_TISSUE_CLASS`
- per-class acoustic properties
- deterministic noise helpers
- boundary enhancement helpers
- row-based depth effect helpers

Recommended tissue classes and defaults:

| Tissue class | Labels | Base brightness | Speckle | Boundary/specular behavior |
|---|---|---:|---|---|
| Background | `0` | `0` | none | black |
| Blood | `1-4`, `11-14`, `16-17` | `10-30` | fine, low variance | bright at blood-tissue interfaces |
| Myocardium | `15`, fallback `7` | `140-180` | coarse, moderate variance | strong chamber-wall boundary gain |
| Valve | `20-23` | `220-255` | minimal | very strong specular boost |
| Lung | `6` | `5-15` | coarse, irregular | mostly dark, high clutter/dropout look |
| Esophagus | `5` | `80-120` | medium | moderate boundary gain |

### 3. Keep the optional educator overlay separate

The color overlay from [`src/renderer/label-colors.ts`](../../src/renderer/label-colors.ts) can remain, but it should be treated as a second layer:

- default off or lower-alpha in normal use
- on-demand in educator mode
- never mixed into the base grayscale synthesis logic

---

## Pixel-Level Rendering Algorithm

Render in two CPU passes after reslice.

### Pass A: base echo intensity

For each in-sector pixel:

1. Read `labelId` from the **base label slice**
2. Map `labelId -> tissueClass -> acousticProps`
3. Compute deterministic speckle using world-anchored noise
4. Add near-field clutter term
5. Apply row-based TGC and far-field attenuation
6. Apply sector edge feathering

Recommended formula:

```text
base = acoustic.baseBrightness

speckle = normalizedRayleigh(
  hash(worldXmm, worldZmm, tissueClass, seed),
  acoustic.speckleSigma,
  acoustic.speckleGrainMm
)

clutter = nearFieldClutter(depthMm, worldXmm, seed)

depthGain = tgc(depthMm) * farField(depthMm)

I0 = (base * speckle + clutter) * depthGain * sectorFeather
```

Recommended behavior by tissue:

- **Blood:** mean brightness ~`10-30`, fine low-variance speckle
- **Myocardium:** mean brightness ~`140-180`, coarser speckle
- **Valve:** mean brightness ~`220-255`, minimal speckle
- **Lung:** mean brightness ~`5-15`, coarse noisy texture
- **Esophagus:** mean brightness ~`80-120`
- **Background/air:** `0`

### Pass B: boundary and specular reinforcement

Then compute interface brightness from the label image itself.

For each in-sector pixel:

1. Compare the current dominant label to 4-neighbor labels
2. Compute an impedance mismatch term from the tissue classes
3. Add extra brightness if the **specular mask** is present at that pixel

Recommended boundary model:

```text
neighborMismatch =
  max(
    impedanceDiff(center, left),
    impedanceDiff(center, right),
    impedanceDiff(center, up),
    impedanceDiff(center, down)
  )

boundaryBoost = boundaryGain(center) * neighborMismatch

if specularMask(center) > 0:
  boundaryBoost += specularGain(center)

I = clamp(I0 + boundaryBoost, 0, 255)
```

This is the most important realism cue. It is what makes:

- chamber walls visible
- valve leaflets appear as bright thin lines
- blood pools read as dark cavities bordered by bright endocardium

### Deterministic noise requirement

The noise must be stable for a fixed probe pose and cardiac phase. Use a seeded hash from:

- case seed
- pixel world coordinates
- tissue class

Do **not** use `Math.random()` in the render loop.

---

## Depth-Dependent Effects

Keep all depth effects as 1D row-based functions so they are cheap to evaluate and easy to tune.

### Time-Gain Compensation (TGC)

Use a monotonic increasing gain curve with depth, for example:

```text
tgc(depthNorm) = 1.0 + a * depthNorm^gamma
```

Suggested first-pass values:

- `a = 0.7`
- `gamma = 1.2`

### Far-field attenuation

Do not fully cancel attenuation with TGC. Keep some far-field rolloff:

```text
farField(depthNorm) = exp(-b * depthNorm)
```

Suggested first-pass value:

- `b = 0.35`

### Near-field clutter

Add a bright noisy zone in the first `6-10 mm`:

```text
clutter(depthMm) = c * exp(-depthMm / decayMm) * clutterNoise
```

Suggested first-pass values:

- `c = 25-40`
- `decayMm = 5-7`

This should read as transducer-adjacent haze, not as a solid white band.

---

## Concrete Code Changes

### `src/renderer/PseudoTeePane.tsx`

Replace the current CT-first flow with a label-first flow:

- remove HU windowing from the pseudo-TEE image path
- rename `applySectorMask()` to something like `renderEchoSector()`
- keep the current sector mask geometry logic
- change the render prerequisites:
  - require `labelVolume`
  - treat `volume` as unused here or remove it from the pane API
- replace the current single categorical label slab path with:
  - base label reslice (`nearest`, single slice)
  - specular binary mask reslice (`MAX`, 3-5 mm slab)

### `src/renderer/echo-appearance.ts` (new)

Add:

- label-to-tissue-class mapping
- acoustic property table
- deterministic Rayleigh noise
- row-based TGC / far-field / clutter utilities
- boundary enhancement helpers

### `src/renderer/types.ts`

Deprecate CT-window fields in `PseudoTeeAppearance`:

- `windowLow`
- `windowHigh`

Replace with echo controls such as:

- `tgcStrength`
- `tgcGamma`
- `farFieldDecay`
- `nearFieldClutterMm`
- `nearFieldClutterStrength`
- `boundaryGain`
- `speckleSeed`

### `src/renderer/label-colors.ts`

Keep this file for overlay colors only. Add a clear comment so future changes do not mix educator colors with echo acoustics.

### `src/App.tsx`

Update the pane title/caption from:

- `CT-derived anatomical slice`

to something truthful for the new mode, for example:

- `Anatomy-driven pseudo-TEE`
- caption: `Label-driven echo-like rendering, not diagnostic ultrasound`

### `e2e/pseudo-tee.spec.ts`

Update the label assertion to match the new caption.

Add one new behavioral check:

- with the probe pose fixed, changing cardiac phase / active label volume should change the pseudo-TEE screenshot

### Optional later cleanup

If the new renderer is adopted as default, update the wording in:

- `docs/decisions/ADR-0001-mvp-architecture.md`
- `docs/product/overview.md`

so the repo no longer claims the pane is strictly CT-derived.

---

## Performance Plan

The implementation should stay on the current CPU postprocess path first. Do not jump to workers or shaders unless measurements say it is necessary.

### Expected hot spots

1. label reslice
2. per-pixel speckle generation
3. boundary neighbor checks

### Guardrails

- keep output spacing around current defaults (`0.6 mm`) unless measured quality requires more
- cap pseudo-TEE raster size to a practical upper bound (`<= 512 x 512` effective output)
- use typed arrays only; no per-frame object allocation inside the pixel loop
- precompute row tables when size/appearance changes:
  - `depthMmByRow`
  - `tgcByRow`
  - `farFieldByRow`
  - `clutterByRow`
- precompute sector geometry tables:
  - `lateralMmByCol`
  - `edgeFeatherByPixel` or per-row/per-col terms if cheaper
- store label properties in dense lookup arrays, not `Map`

### Why this should fit

Compared with the current implementation, the new pass adds:

- one extra 4-neighbor boundary check
- deterministic noise per in-sector pixel
- one binary specular mask reslice

That is meaningfully more work, but still within a reasonable main-thread budget for the current pane size if the code stays allocation-free.

### Escalation rule

If `PseudoTeePane.flush()` exceeds the frame budget in measurement:

1. reduce pseudo-TEE output resolution slightly
2. simplify the noise function before changing architecture
3. move only the echo synthesis loop to a worker

Do not start with a worker-first design.

---

## Rollout Plan

### Step 1. Refactor the pseudo-TEE contract

- make `labelVolume` mandatory for pseudo-TEE rendering
- stop using `labelsVisible` as a rendering-mode switch
- keep the current sector geometry and VTK display plumbing

### Step 2. Add the acoustic model

- implement `echo-appearance.ts`
- wire base label slice + specular mask slice
- replace CT windowing with label-based brightness

### Step 3. Add boundary/TGC/clutter

- boundary reinforcement from 4-neighbor label differences
- row-based TGC and far-field attenuation
- near-field clutter

### Step 4. Tune against the 8 anchor views

Check at minimum:

- ME 4C
- ME 2C
- ME LAX
- TG SAX
- ME AV SAX
- ME Bicaval

Expected visual outcomes:

- four-chamber cavities are dark
- myocardium is brighter than blood
- AV valves are the brightest structures
- interfaces read as bright lines rather than flat segmentation blocks

### Step 5. Validate motion coupling

Once phase-resolved label volumes exist, confirm:

- fixed probe pose + different label phase -> different pseudo-TEE image
- no change to pseudo-TEE code is needed beyond swapping the active label volume

---

## Test and Acceptance Criteria

### Unit tests

Add `src/renderer/__tests__/echo-appearance.test.ts` for:

- deterministic noise stability
- label-to-tissue-class mapping
- blood darker than myocardium
- valve brighter than myocardium
- boundary boost when adjacent labels differ

### E2E / manual acceptance

Minimum acceptance:

1. pseudo-TEE renders with `labelVolume` even if `heart_roi.vti` is absent
2. pseudo-TEE does **not** silently render CT when `labelVolume` is missing
3. moving the probe changes the image
4. changing cardiac phase changes the image with fixed probe pose
5. the pane caption no longer says `CT-derived anatomical slice`

Clinical acceptance target:

- a reviewer can identify dark chamber cavities, bright myocardium, and bright AV valve structures in ME 4C / ME LAX without needing the colored overlay

---

## Effort Estimate

For a first convincing implementation on the current codebase:

| Task | Effort |
|---|---:|
| Pseudo-TEE contract refactor | `0.5-1 day` |
| `echo-appearance.ts` + acoustic table | `1 day` |
| Boundary/TGC/clutter integration | `1 day` |
| Specular-mask slab path | `0.5 day` |
| UI/test/doc updates | `0.5-1 day` |
| Screenshot tuning across anchor views | `0.5-1 day` |

**Total:** `4-5.5 engineering days` plus `~0.5 day` for clinician screenshot review

This is a better estimate than a 1-2 day patch because the change is not just cosmetic. It changes the pseudo-TEE data contract, removes the CT dependency, and fixes the categorical slab issue in the current label path.

---

## Final Recommendation

Implement the pseudo-TEE pane as a **label-driven echo synthesizer**, not as a CT slice with decorative styling.

The simplest design that satisfies the motion requirement is:

- base anatomy from a single-slice categorical label reslice
- thin bright structures from a slabbed binary specular mask
- grayscale appearance from tissue-class acoustics
- bright interfaces from label boundaries
- TGC, far-field rolloff, and near-field clutter as cheap row-based modifiers

That keeps the current VTK.js rendering structure intact while moving the image semantics to the only signal that can support future cardiac motion: the labels.
