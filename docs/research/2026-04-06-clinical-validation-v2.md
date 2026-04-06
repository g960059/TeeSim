# Clinical Validation v2: TeeSim 8 Standard TEE Views

**Date:** 2026-04-06  
**Reviewer:** TEE clinical review, AI-assisted  
**Case reviewed:** `LCTSC S1-006 (Female, Thorax CT)`  
**Screenshots reviewed:** `screenshots/validate/` (`*-tee.png`, `*-oblique.png`, `*-3d.png`, with `*-full.png` used for UI context)

## Scope and method

I reviewed all 8 rendered anchor views:

1. `me-4c`
2. `me-2c`
3. `me-lax`
4. `tg-sax`
5. `me-av-sax`
6. `me-av-lax`
7. `me-rv-io`
8. `me-bicaval`

For each view I assessed:

- the pseudo-TEE pane for recognizable ASE anatomy and display orientation
- the oblique slice pane for view-specific cross-sectional anatomy
- the 3D scene pane for plausibility of mesh + sector-plane orientation

ASE comparison was based on official ASE/SCA references:

- the 2013 ASE/SCA **Basic Perioperative TEE Examination** consensus statement
- the 2013 ASE/SCA **Comprehensive TEE Examination** guideline
- the ASE/SCA 1999 multiplane TEE position paper for display conventions and orientation details

Display convention used for this review: near field at the top of the sector, far field at the bottom. A pane was rated:

- `PASS`: anatomy is recognizable and consistent with the ASE target view
- `PARTIAL`: some relevant anatomy or geometry is present, but not enough for reliable view recognition
- `FAIL`: wrong anatomy, nearly blank content, or no clinically useful recognition

## Verdict Table

| View | Pseudo-TEE | Oblique | 3D | Summary |
|---|---|---|---|---|
| ME 4C | FAIL | PARTIAL | PARTIAL | Probe geometry looks reasonable, but the teaching pane does not show a recognizable four-chamber cut |
| ME 2C | FAIL | PARTIAL | PARTIAL | Rotation changed, but the rendered image does not isolate the left heart as a true two-chamber view |
| ME LAX | PARTIAL | PARTIAL | PARTIAL | Long-axis direction is hinted at, but LVOT/AV/aorta are not clearly teachable in the pseudo-TEE pane |
| TG SAX | FAIL | FAIL | PASS | 3D station shift is convincing, but the actual reslice does not show the classic transgastric mid-LV short-axis anatomy |
| ME AV SAX | PARTIAL | PARTIAL | PASS | Best short-axis basal geometry in 3D, but not enough valve-level detail in the pseudo-TEE pane |
| ME AV LAX | PARTIAL | PASS | PASS | Strongest orthogonal AV pair overall; oblique and 3D support a true long-axis outflow-plane cut |
| ME RV Inflow-Outflow | FAIL | PARTIAL | PARTIAL | Right-heart targeting is plausible, but RV inflow vs RVOT cannot be confidently identified in the 2D teaching panes |
| ME Bicaval | PARTIAL | PARTIAL | PASS | Distinct atrial/caval geometry is suggested, especially in 3D, but the pseudo-TEE pane still lacks clear septal and caval anatomy |

## Per-View Review

### 1. ME Four-Chamber (`me-4c`)

**ASE reference target**

- Expected structures: RA, RV, LA, LV, IAS, IVS, mitral valve, tricuspid valve.
- Expected orientation: atria near field/top, ventricles far field/bottom; left-sided chambers should appear on the viewer's right and right-sided chambers on the viewer's left.

**Pseudo-TEE pane: FAIL**

- The sector is mostly a uniform gray fan with only a small near-field bright patch.
- I cannot identify all four chambers, either AV valve, or either septum.
- The expected ME 4C layout is not recognizable.
- Orientation cannot be verified because the required landmarks are absent.

**Oblique slice pane: PARTIAL**

- The plane is not blank and does differ from several other views.
- A horizontal dark band and overlying soft tissue are visible, but they do not resolve into clear atrial or ventricular cavities.
- Cardiac chambers cannot be confidently labeled from this pane alone.

**3D scene pane: PARTIAL**

- The heart mesh itself is plausible.
- The sector plane is only faintly visible and is close to edge-on, so the actual 4C cut is hard to appreciate.
- This is enough to suggest the probe is in a reasonable mid-esophageal station, but not enough to teach the view cleanly.

**Comparison with ASE reference images**

- ASE reference images show a true four-chamber cut with the crux of the heart and both AV valves visible.
- TeeSim does not reproduce that recognizable chamber arrangement in the pseudo-TEE pane.

### 2. ME Two-Chamber (`me-2c`)

**ASE reference target**

- Expected structures: LA, LV, MV, LAA; right-sided chambers should disappear.
- Expected orientation: LA near field/top and LV below; the posterior mitral leaflet side should be on the viewer's left and the anterior leaflet side on the viewer's right.

**Pseudo-TEE pane: FAIL**

- The rendered fan remains largely homogeneous gray.
- The image does not isolate the left heart, and the expected loss of RA/RV from the sector is not demonstrable.
- LA, LV, LAA, and MV cannot be identified with confidence.

**Oblique slice pane: PARTIAL**

- The slice differs from ME 4C, so the plane is not frozen.
- Most of the visible anatomy is bright posterior tissue and a large brown background rather than a clear cardiac long-axis cut.
- I cannot confidently label LA, LV, or LAA.

**3D scene pane: PARTIAL**

- The sector plane has rotated slightly relative to ME 4C, which is directionally correct.
- The rotation is subtle in this camera view and does not visually communicate a clean orthogonal shift from 4C to 2C.

**Comparison with ASE reference images**

- ASE reference images show a true left-sided two-chamber view with the LAA and only LA/LV structures.
- TeeSim does not yet make that distinction recognizable in the pseudo-TEE pane.

### 3. ME Long-Axis (`me-lax`)

**ASE reference target**

- Expected structures: LA, LV, MV, LVOT, AV, proximal ascending aorta.
- Expected orientation: posterior mitral leaflet side to the viewer's left and anterior leaflet side to the viewer's right; the plane should look like a long-axis outflow view rather than a chamber-only view.

**Pseudo-TEE pane: PARTIAL**

- This is one of the first ME views where the near-field content clearly differs from ME 4C and ME 2C.
- There is a rotated, darker superior structure that suggests a different cut angle.
- However, I still cannot confidently identify LVOT, AV, or proximal aorta, so it is not a teachable ME LAX image yet.

**Oblique slice pane: PARTIAL**

- The rectangular slice is meaningfully different from ME 4C and ME 2C.
- It shows more central dark lumen-like anatomy and branching structure than the chamber views.
- This is compatible with a long-axis outflow-plane cut, but the structures are still too indistinct for a clean `PASS`.

**3D scene pane: PARTIAL**

- The 3D mesh remains plausible.
- The sector plane becomes almost completely edge-on in this screenshot, which is consistent with a rotated long-axis plane, but visually hard to interpret.

**Comparison with ASE reference images**

- ASE reference images show a clearly elongated LV-MV-LVOT-AV-aorta axis.
- TeeSim hints at that geometry, especially in the oblique slice, but does not yet show a recognizable educational equivalent in the pseudo-TEE pane.

### 4. TG Mid Short-Axis (`tg-sax`)

**ASE reference target**

- Expected structures: circular mid-LV short-axis cavity with papillary muscles; RV may be seen at the same level.
- Expected orientation: the transgastric station should be clearly different from the ME views, with a short-axis "donut" LV rather than a long-axis chamber view.

**Pseudo-TEE pane: FAIL**

- The sector is essentially a gray fan without a recognizable LV cavity.
- No circular mid-ventricular chamber, papillary muscles, or RV crescent can be identified.
- This fails the key educational requirement for TG SAX.

**Oblique slice pane: FAIL**

- The slice is dominated by a large blank/brown field with a bright corner structure.
- It does not show a centered circular LV short-axis cut.
- No ventricular cavity or papillary muscle anatomy can be identified.

**3D scene pane: PASS**

- This is the strongest proof in the current batch that the probe has moved to a genuinely different station.
- The fan is broad, visible, and oriented inferiorly from a transgastric position.
- The mesh + plane relationship is plausible for TG SAX even though the 2D anatomy is not.

**Comparison with ASE reference images**

- ASE TG midpapillary SAX images show a distinct circular LV cavity with two papillary muscles and clear mid-ventricular myocardium.
- TeeSim does not reproduce that anatomy in either 2D pane, despite a plausible 3D station change.

### 5. ME Aortic Valve Short-Axis (`me-av-sax`)

**ASE reference target**

- Expected structures: trileaflet AV in short axis, IAS-adjacent noncoronary cusp, right coronary cusp adjacent to RVOT, left coronary cusp posterior and on the viewer's right.
- Expected orientation: en face valve-level image rather than a long-axis outflow tube.

**Pseudo-TEE pane: PARTIAL**

- Compared with the chamber views, there is more focal near-field structure.
- The pane suggests a basal cut, but the classic trileaflet AV short-axis appearance is not clearly resolved.
- I cannot confidently identify the three cusps or adjacent RA/RVOT landmarks.

**Oblique slice pane: PARTIAL**

- The slice is distinct from the chamber views and plausibly at a more superior/basal level.
- It still shows mostly posterior bright tissue and broad background rather than a clear valve-level cross-section.
- This suggests the right neighborhood, but not a recognizable AV SAX image.

**3D scene pane: PASS**

- The sector plane is visible and plausibly intersects the heart at the AV level.
- Compared with ME AV LAX, the fan orientation looks like the short-axis member of an orthogonal pair.
- This is the best current evidence that the AV SAX preset is geometrically authored correctly.

**Comparison with ASE reference images**

- ASE reference images show a centered, symmetric AV short-axis image with identifiable cusp relationships.
- TeeSim reaches the correct basal station but does not yet deliver valve-level detail in the pseudo-TEE pane.

### 6. ME Aortic Valve Long-Axis (`me-av-lax`)

**ASE reference target**

- Expected structures: LVOT, AV, proximal ascending aorta in long axis, with LA/MV in the same plane.
- Expected orientation: LVOT should lie toward the viewer's left and the proximal ascending aorta toward the viewer's right; this should look orthogonal to AV SAX.

**Pseudo-TEE pane: PARTIAL**

- The superior near-field content is more elongated than in AV SAX and more suggestive of a long-axis outflow cut.
- This is better than the chamber views, but still not sufficient to confidently label LVOT, AV, or proximal aorta.
- It is view-specific enough to earn `PARTIAL`, not `PASS`.

**Oblique slice pane: PASS**

- This is the clearest oblique pane in the batch.
- It shows elongated dark lumen-like structures in a configuration that is meaningfully different from AV SAX and from the chamber views.
- While not beautiful, it plausibly represents a long-axis outflow/aortic-root plane and is the best 2D non-TEE evidence that the preset is correct.

**3D scene pane: PASS**

- The sector plane is visible and clearly rotated relative to AV SAX.
- The pair behaves like a true short-axis/long-axis orthogonal set at the aortic valve level.
- Mesh orientation is plausible.

**Comparison with ASE reference images**

- ASE reference images show a clear AV/LVOT/proximal aorta long axis.
- TeeSim still underperforms in the pseudo-TEE pane but matches the expected geometric relationship much better here than in most other views.

### 7. ME RV Inflow-Outflow (`me-rv-io`)

**ASE reference target**

- Expected structures: RA, TV, RV, RVOT, PV, proximal main PA, with RV free wall on the viewer's left and RVOT on the viewer's right.
- Expected orientation: a right-heart focused view, not a left-heart chamber view.

**Pseudo-TEE pane: FAIL**

- The fan is again dominated by a uniform gray field with a small superior patch of anatomy.
- The expected right-heart landmarks are not identifiable.
- I cannot demonstrate RV inflow vs RV outflow from this pane.

**Oblique slice pane: PARTIAL**

- The slice is not frozen and is different from the chamber views.
- There is more oblique bright tissue on the posterior side, but no clear RA-RV-RVOT-PV sequence.
- This is suggestive only.

**3D scene pane: PARTIAL**

- The sector plane is faintly visible and plausibly aimed more rightward than the standard chamber views.
- The camera view does not make the inflow/outflow geometry obvious.
- Plausible, but not convincingly teachable.

**Comparison with ASE reference images**

- ASE reference images show a true right-heart inflow/outflow view with RV cavity and RVOT/PV in one plane.
- TeeSim does not yet reproduce those right-heart landmarks clearly in either 2D teaching pane.

### 8. ME Bicaval (`me-bicaval`)

**ASE reference target**

- Expected structures: RA, LA, IAS, SVC, IVC, often right atrial appendage.
- Expected orientation: cavae aligned in a bicaval axis rather than a four-chamber layout; ASE display convention places the SVC on the viewer's right and the IVC on the viewer's left.

**Pseudo-TEE pane: PARTIAL**

- This pane is more distinctive than ME 4C or ME 2C because of the V-shaped dark superior indentation.
- It does look less like a chamber view and more like an atrial/caval cut.
- However, IAS, SVC, IVC, RA, and LA still cannot be confidently separated, so it does not reach `PASS`.

**Oblique slice pane: PARTIAL**

- The slice is clearly different from the other ME views and suggests a larger atrial-level cut.
- A large dark polygonal region and bright right-sided structure are visible, but they do not resolve into a clean septal-caval anatomy map.
- It is better than the chamber-view obliques, but still short of a fully recognizable bicaval cut.

**3D scene pane: PASS**

- The sector plane is clearly visible and distinctly different from the standard chamber views.
- The fan orientation is plausible for an atrial septal / caval plane.
- This is one of the best 3D scenes in the batch.

**Comparison with ASE reference images**

- ASE reference images show a clean bicaval plane with SVC, IVC, RA, LA, and IAS.
- TeeSim captures the gross plane orientation in 3D, but not the decisive septal/caval anatomy in the pseudo-TEE pane.

## View Differentiation

### ME 4C vs ME 2C vs ME LAX

- **Pseudo-TEE:** not meaningfully differentiated enough for teaching. The three views do not progress in the expected clinical sequence of four chambers -> isolated left heart -> LVOT/AV long axis.
- **Oblique slice:** differentiation is better. ME LAX is the most distinct of the three. ME 4C and ME 2C are still too similar and too dominated by noncardiac tissue.
- **3D:** the planes do rotate, but ME 4C and ME 2C remain subtle because the camera leaves the fan close to edge-on. ME LAX is more obviously rotated.
- **Bottom line:** partial geometric differentiation, inadequate educational differentiation.

### ME AV SAX vs ME AV LAX

- This is the strongest pair in the current simulator.
- **3D:** clearly behaves like an orthogonal short-axis / long-axis pair.
- **Oblique slice:** AV LAX is more elongated and more plausibly outflow-oriented than AV SAX.
- **Pseudo-TEE:** still too weak to let a trainee learn the cusp-level vs long-axis distinction reliably.
- **Bottom line:** geometry passes; anatomy display still partial.

### TG SAX as a different station

- **3D:** yes, clearly different and plausibly transgastric.
- **Pseudo-TEE / oblique:** no, not clinically convincing. The classic circular mid-LV short-axis target is absent.
- **Bottom line:** transgastric station is demonstrated spatially, not anatomically.

## Comparison With ASE Reference Images

Across the ASE reference figures, each standard view has a visually unique signature:

- **ME 4C:** four chambers and both AV valves in one plane
- **ME 2C:** left-sided chambers only, often with the LAA
- **ME LAX:** LV, MV, LVOT, AV, and proximal aorta in one long-axis plane
- **TG midpapillary SAX:** circular LV cavity with papillary muscles
- **ME AV SAX:** en face trileaflet AV
- **ME AV LAX:** orthogonal long-axis outflow view
- **ME RV inflow-outflow:** RA/RV/TV with RVOT/PV in the same cut
- **ME bicaval:** IAS with both vena cavae

TeeSim currently matches the ASE references better in **probe-plane geometry** than in **recognizable anatomy**:

- The **3D pane** often demonstrates that the preset plane is plausibly authored.
- The **oblique slice** sometimes demonstrates that the plane is different, especially in ME LAX and the AV pair.
- The **pseudo-TEE pane**, which is the educationally most important pane, usually fails to reproduce the distinctive ASE anatomy that a trainee needs to learn.

## Overall Assessment

The simulator is **partially educationally useful** in its current state.

What it already does reasonably well:

- demonstrates that named presets correspond to different probe poses
- shows plausible 3D sector-plane motion for several views
- conveys the idea that TG views are a different station from ME views

What it does not yet do well enough:

- teach chamber-level anatomy from the pseudo-TEE pane
- teach the difference between ME 4C, ME 2C, and ME LAX by recognizable ultrasound-like anatomy
- render a clinically recognizable TG midpapillary SAX view

Practical judgment:

- As a **probe-orientation and plane-navigation demo**, it has value.
- As a **standalone anatomy-learning simulator for standard TEE views**, it is not yet adequate.

## Top Priority Fixes

1. **Improve the pseudo-TEE anatomy signal.**  
   The current fan is too uniform and too dim. The simulator needs either a better cardiac source dataset, label-guided rendering, or more aggressive heart-focused reslice/windowing so chambers and valve-level structures separate visibly.

2. **Fix TG SAX at the image-content level, not just the probe-position level.**  
   The 3D pane suggests a transgastric station, but the 2D panes do not show a mid-LV circular cut with papillary muscles. This is a high-priority educational gap.

3. **Crop and center the oblique slice on the heart rather than on broad background tissue.**  
   Too much of the pane is noninformative brown background. A tighter heart-centered crop would make chamber and vessel geometry easier to read.

4. **Make the sector plane consistently visible in the 3D pane.**  
   ME 4C, ME 2C, ME LAX, and ME RV inflow-outflow are under-explained visually because the fan is too faint or too edge-on for the chosen camera angle.

5. **Add anatomical overlays and ASE reference-side guidance.**  
   Even simple overlays such as `LV`, `RV`, `LA`, `RA`, `AV`, `RVOT`, `SVC`, `IVC` plus orientation markers would dramatically improve teaching value.

6. **Use a more cardiac-friendly source volume if possible.**  
   A noncontrast thoracic CT is a hard starting point for valve-level and chamber-level TEE teaching. Contrast-enhanced cardiac CT or a label-driven synthetic teaching volume would likely improve educational fidelity substantially.

## Sources

- Reeves ST, et al. **Basic Perioperative Transesophageal Echocardiography Examination: A Consensus Statement of the ASE and SCA**. ASE.  
  https://www.asecho.org/wp-content/uploads/2025/04/Basic-Perioperative-TEE-Exam.pdf

- Hahn RT, et al. **Guidelines for Performing a Comprehensive Transesophageal Echocardiographic Examination: Recommendations from the ASE and SCA**. ASE.  
  https://www.asecho.org/wp-content/uploads/2014/05/2013_Performing-Comprehensive-TEE.pdf

- Shanewise JS, et al. **ASE/SCA Guidelines for Performing a Comprehensive Intraoperative Multiplane TEE Examination**. ASE position paper.  
  https://www.asecho.org/wp-content/uploads/2013/05/Performing-a-Comprehensive-Multiplane-TEE-Exam.pdf

- Hahn RT, et al. **Recommended Standards for the Performance of Transesophageal Echocardiographic Screening for Structural Heart Intervention**. ASE. Used to confirm that these named views remain part of the standard comprehensive TEE exam family.  
  https://www.asecho.org/wp-content/uploads/2025/04/PIIS0894731721005940.pdf
