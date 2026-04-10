# Comprehensive Clinical Review: TeeSim v0.2

**Date:** 2026-04-10
**Reviewer profile:** Cardiac anesthesiologist evaluating teaching readiness
**Model:** Claude Opus 4.6 (1M context)
**Case:** LCTSC S1-006 (Female, Thorax CT)
**Bundle:** 0.1.0
**Screenshots reviewed:** 8 views x 4 panes (32 images) + 4 motion frames (36 total)
**Prior reviews referenced:** `2026-04-06-clinical-validation-v2-opus.md`, `2026-04-06-rendering-diagnosis.md`, `2026-04-07-realistic-rendering-strategy.md`

---

## Executive Summary

TeeSim v0.2 demonstrates a technically impressive framework: correct 5-DOF probe kinematics, esophageal centerline constraint, view-matching with 100% quality badges, and a well-designed three-pane UI. However, as a clinical teaching tool it is **not yet ready for a TEE fellow**. The pseudo-TEE image does not resemble echocardiography. The 3D model is rendered as an uncolored wireframe that does not look like a heart. Cardiac motion is not perceptible across the captured frames. The oblique slice pane is the strongest component -- a trained eye can identify structures there -- but even it falls short of what a trainee needs to build spatial intuition.

**Bottom line:** The engineering scaffolding is solid. The clinical content layer is pre-alpha.

---

## Per-View Detailed Assessment

### View 1: ME Four-Chamber (ME 4C)

**Probe:** Position=97mm, Roll=0, Ante/Retro=-5, Lateral=0, Omniplane=0 deg

#### Pseudo-TEE Pane

The sector fan geometry is correct (apex at top, ~90 deg sweep), matching standard TEE display convention. Within the sector, a heterogeneous tissue mass is visible with colored patches (yellow, blue-gray, dark regions) occupying the central portion. These colored areas correspond to label-map-driven HU boosting -- they are not grayscale echo-like. A trainee would not recognize this as a four-chamber view. In a real ME 4C, four distinct dark (anechoic) blood pools surround a bright central crux formed by the interatrial septum, interventricular septum, and AV valve plane. Here, no crux is visible. No chambers are individually identifiable. The colored patches bear no resemblance to ultrasound tissue appearance.

**Verdict:** The slice is cutting the correct anatomical plane, but the rendering does not communicate cardiac anatomy.

#### 3D Model Pane

The heart is rendered as a monochrome (gray/white) wireframe mesh on a black background with a translucent teal sector plane. The badge reads "ME Four-Chamber / 100% quality." The wireframe shows a complex organic shape that an anatomist could recognize as a heart-like silhouette (two bulging ventricles inferiorly, atrial/great vessel region superiorly), but the visual impression is of a tangled mesh -- not a teaching-quality heart model. There is no color coding of structures, no solid surface rendering, no transparency layering, and no internal detail. The sector plane at omniplane=0 is difficult to see, appearing nearly edge-on.

**Verdict:** A trainee could not use this to understand which structures the echo beam is crossing.

#### Oblique Slice Pane

This is the strongest pane. The tissue is displayed with a multi-structure color overlay (yellow for one label, pink/magenta for another, purple/blue for others, brown for unlabeled tissue). At the ME 4C level, a large yellow structure (likely LV myocardium) is visible centrally, with adjacent colored regions that plausibly correspond to the RV (dark/blue), LA (pink/magenta superiorly), and surrounding mediastinal structures. The spine is visible at the posterior aspect. Structure tags below read: heart, esophagus, spinalcord, lung_r, lung_l.

**Verdict:** A knowledgeable reader can roughly orient themselves, but the color coding maps to gross segmentation labels (whole heart, whole esophagus) rather than to individual cardiac chambers and valves. This limits its chamber-level teaching value.

#### Teaching Utility

A trainee would learn that the probe is in the esophagus behind the heart at this position and the sector sweeps forward. They would not learn to identify the four chambers, AV valves, or septa -- the defining elements of the ME 4C view.

---

### View 2: ME Two-Chamber (ME 2C)

**Probe:** Position=97mm, Roll=0, Ante/Retro=-5, Lateral=0, Omniplane=65 deg

#### Pseudo-TEE Pane

Tissue visible in the sector is smaller and more asymmetric than the ME 4C, consistent with a 65 deg omniplane rotation that should isolate the LA and LV. The label-colored blobs (yellow, blue) are present but do not define recognizable LA/LV contours. In real echo, the ME 2C shows a long-axis slice through the LA and LV with the mitral valve as a hinge point between them, and the LAA often visible superiorly. None of these structures are individually visible here.

#### 3D Model Pane

Identical wireframe appearance to ME 4C. The camera angle and mesh are unchanged; only the sector plane orientation should differ, but the sector is not prominently visible. Indistinguishable from the 4C 3D pane to a casual observer.

#### Oblique Slice Pane

The oblique cross-section shows a different tissue pattern from the 4C view (confirming the omniplane rotation is working). The dark region (blood pool or air-filled structure) appears more anteriorly. Colored label overlay is present. The structures are plausible for a 2-chamber cut but not individually identifiable.

#### Teaching Utility

The trainee can see that rotating omniplane from 0 to 65 changes the cross-section. This demonstrates a core TEE concept. But the specific anatomy of the ME 2C view (LA, LV, mitral valve, LAA) is not recognizable.

---

### View 3: ME Long-Axis (ME LAX)

**Probe:** Position=97mm, Roll=0, Ante/Retro=-5, Lateral=0, Omniplane=130 deg

#### Pseudo-TEE Pane

The tissue cross-section within the sector is again distinct from the 4C and 2C views. The colored patches (blue, yellow, gray) are more elongated, plausibly corresponding to the long-axis cut through the LV, AO root, and LA. However, no LVOT, aortic valve leaflets, or anterior mitral leaflet are individually visible -- these are the signature structures of the ME LAX view that every anesthesiologist must identify.

#### 3D Model Pane

Same monochrome wireframe. The sector plane at omniplane=130 should be visible as a more anteriorly directed cut, but again it is not prominently displayed.

#### Oblique Slice Pane

The tissue cross-section with color overlay shows a different pattern. A yellow structure (possibly the aortic root or LA) is prominent. The slice angle appears consistent with a long-axis cut. This is the most convincing of the three ME views in terms of showing a different anatomical section.

#### Teaching Utility

Limited. The concept that omniplane=130 produces a long-axis view is conveyed. The actual anatomy of the view is not.

---

### View 4: TG Mid Short-Axis (TG SAX)

**Probe:** Position=166mm, Roll=0, Ante/Retro=20, Lateral=0, Omniplane=10 deg

#### Pseudo-TEE Pane

The tissue mass within the sector is small and centrally located with a yellow/gold colored patch. In a real TG SAX, the LV appears as a circular or "donut" cross-section with a bright myocardial ring and dark blood-filled center, often described as the "steering wheel" view. Here, no circular myocardial ring is visible. The small blob does not convey the short-axis anatomy.

#### 3D Model Pane

The wireframe now shows the probe advanced further (position=166mm, into the transgastric station). The sector plane with its sharp rod (probe shaft) is visible cutting through the heart from below -- this is anatomically correct for a transgastric approach. The wireframe mesh appears similar to the ME views but from a different vantage point.

#### Oblique Slice Pane

The cross-section shows a small yellow/gold round structure surrounded by dark tissue -- this actually looks somewhat like a short-axis cross-section of the LV, with the bright label possibly corresponding to the myocardial ring. This is one of the more recognizable views in the oblique pane.

#### Teaching Utility

The concept that TG views require advancing the probe and anteflexing (ante/retro=20) is clearly conveyed through the probe controls. The oblique slice provides weak but present visual feedback. The pseudo-TEE pane does not communicate the iconic TG SAX "donut."

---

### View 5: ME AV Short-Axis (ME AV SAX)

**Probe:** Position=83mm, Roll=0, Ante/Retro=0, Lateral=0, Omniplane=40 deg

#### Pseudo-TEE Pane

Within the sector, colored label patches (teal/blue, yellow, gray) are visible. In real echo, the ME AV SAX at omniplane 30-60 deg shows the aortic valve as a "Mercedes-Benz sign" (three cusps) or a triangular orifice in cross-section, surrounded by the RA, LA, TV, and RVOT. No valve cusps or tri-leaflet pattern is visible here. The colored patches do not suggest three-cusp geometry.

#### 3D Model Pane

Same wireframe. The sector plane is barely visible -- a small teal sliver at the right side of the mesh. Without color-coded anatomy, a trainee cannot see what the plane is cutting through.

#### Oblique Slice Pane

This is the most anatomically rich oblique slice across all 8 views. Multiple colored structures (yellow circular area likely aortic root, pink/magenta adjacent structure, purple, blue) are visible in close proximity. The relationships between these structures in the oblique pane are plausible for the AV SAX level: the aortic root centrally with RA, RV, LA, and interatrial septum surrounding it. A knowledgeable reader could begin to orient themselves here.

#### Teaching Utility

Moderate for the oblique pane alone. This view benefits the most from the label overlay. The pseudo-TEE pane contributes nothing recognizable.

---

### View 6: ME AV Long-Axis (ME AV LAX)

**Probe:** Position=83mm, Roll=0, Ante/Retro=0, Lateral=0, Omniplane=130 deg

#### Pseudo-TEE Pane

The sector shows colored patches that are more spread out than the AV SAX. In real echo, the ME AV LAX (approximately same position, omniplane ~120-130 deg) should show the LVOT, aortic valve leaflets opening/closing, proximal ascending aorta, and sometimes the right coronary cusp. The rendering shows colored blobs (yellow, blue, red/green) that correspond to label-boosted regions, but they do not form recognizable aortic valve or LVOT geometry. One yellow structure is prominent -- possibly the aortic root.

#### 3D Model Pane

Same wireframe, sector plane rotated to 130 deg. The sector is more visible here as a teal fan projecting into the mesh. The relationship between the sector and the wireframe is the most informative aspect.

#### Oblique Slice Pane

A yellow circular structure (aortic root) and adjacent magenta structure (likely LA) are visible. The spatial relationship is plausible for a long-axis cut through the aortic root.

#### Teaching Utility

The probe-control comparison between ME AV SAX (omniplane=40) and ME AV LAX (omniplane=130) teaches the concept that same position + different omniplane gives orthogonal views of the same structure. This is valuable. The rendered images do not reinforce this lesson visually.

---

### View 7: ME RV Inflow-Outflow (ME RV IO)

**Probe:** Position=97mm, Roll=0, Ante/Retro=0, Lateral=10, Omniplane=75 deg

#### Pseudo-TEE Pane

The tissue in the sector is a fairly uniform gray-brown mass with a small blue-colored patch. In real echo, the ME RV IO view shows the RA, TV, RV, RVOT, and pulmonic valve in a single sweep. It is one of the more complex views to obtain and interpret. Nothing recognizable is visible in the pseudo-TEE rendering.

#### 3D Model Pane

Same wireframe. This view uses lateral=10, making it the only view with non-zero lateral flex. The wireframe does not convey this.

#### Oblique Slice Pane

The cross-section is darker overall with a prominent dark region (blood pool or air) and surrounding tissue. Some colored labels are visible at the periphery. The structures are not individually identifiable.

#### Teaching Utility

The probe parameter lateral=10 introduces the concept that some views require lateral flexion, which is an important clinical pearl. Beyond that, minimal teaching value.

---

### View 8: ME Bicaval

**Probe:** Position=92mm, Roll=10, Ante/Retro=0, Lateral=0, Omniplane=95 deg

#### Pseudo-TEE Pane

The sector shows a relatively large tissue area with a prominent teal/cyan colored patch and adjacent darker regions. In real echo, the ME Bicaval view shows the RA with SVC entering from above and IVC from below, plus the interatrial septum and LA behind. The teal-colored region could correspond to one of these structures (likely RA or SVC), but the arrangement does not read as a bicaval view. No SVC/IVC "pipes" entering the RA are visible.

#### 3D Model Pane

Same wireframe. This is the only view with non-zero roll (roll=10), which in clinical practice corresponds to slight clockwise rotation to bring the SVC/IVC axis into the imaging plane. The wireframe does not communicate this.

#### Oblique Slice Pane

Multiple colored structures visible: teal/blue, pink, darker regions. The relationships are not clear enough to identify SVC, IVC, RA, or interatrial septum individually.

#### Teaching Utility

The concept that bicaval requires both roll=10 and omniplane=95 is conveyed by the controls. The images do not reinforce the anatomy.

---

## Motion Assessment (Frames 0-3)

The four motion frames are captured at the ME Four-Chamber view. Key observations:

- **Frame 0:** Cardiac phase = ED (end-diastole), Phase display shows "ED"
- **Frame 1:** Cardiac phase = 2/12, Phase display shows "IsoC" (isovolumetric contraction)
- **Frame 2:** Cardiac phase = 3/12, Phase display shows "Ej-1" (early ejection)
- **Frame 3:** Cardiac phase = 3/12, Phase display shows "Ej-1" (same or similar phase)

### Visible Contraction

Comparing the four frames at their native resolution: the pseudo-TEE pane, the 3D wireframe, and the oblique slice all appear **essentially identical** across all four frames. I cannot detect visible chamber wall motion, ventricular contraction, or valve movement between any pair of frames. The cardiac phase indicator advances (ED -> IsoC -> Ej-1), confirming that the animation system is cycling, but the rendered geometry does not change perceptibly.

### Possible Explanations

1. The mesh deformation between phases is very subtle and not visible at screenshot resolution
2. The cardiac motion data may only affect the VTI volume, which is sampled too coarsely
3. The wireframe rendering obscures small geometric changes that would be visible with surface rendering
4. The label-map-driven pseudo-TEE image is dominated by label-level granularity rather than sub-voxel motion

### Contraction Pattern

Not recognizable. In real ME 4C, systolic contraction shows symmetric inward movement of the LV free wall and septum, with the mitral valve closing at the onset of systole and the tricuspid valve closing slightly later. None of these dynamic landmarks are visible.

**Motion verdict:** The animation infrastructure exists (phase counter advances, play/pause works) but the visual output does not show identifiable cardiac motion. This is insufficient for teaching cardiac cycle concepts.

---

## 3D Model Assessment: Why It Looks Wrong

The user's concern that "it looks very different from standard 3D heart models" is entirely valid. Here is a specific diagnosis.

### Problem 1: Wireframe Rendering

The heart mesh is rendered as a transparent wireframe (white/gray edges on black background). This reveals every polygon edge simultaneously, creating a confusing visual tangle. Standard anatomical heart models use **opaque surface rendering** with diffuse/specular lighting (Phong or PBR shading) that reveals the external surface contours -- the smooth, muscular shape of the ventricles, the rounded atria, the great vessels emerging from the base. Wireframe rendering destroys all perception of surface, depth, and shape.

**Fix:** Switch to opaque surface rendering with ambient occlusion and directional lighting. This single change would make the biggest visual difference.

### Problem 2: Monochrome / No Per-Structure Colors

The entire mesh is rendered in a uniform gray/white. Standard anatomical heart models use distinct colors per structure:
- Myocardium: warm red/pink (approximating muscle tissue)
- Blood pools / chambers: dark red or transparent
- Aorta / great arteries: red
- Pulmonary arteries: blue
- Valves: pale yellow or white
- Pericardium: tan/translucent

The label segmentation data is already available (it drives the oblique slice colors). Those same labels should map to per-structure colors on the 3D mesh.

**Fix:** Assign vertex colors or per-mesh materials based on the existing TotalSegmentator label map. Use the same color palette as the oblique slice but with anatomically conventional hues.

### Problem 3: No Transparency / Layering

In teaching models, outer structures (pericardium, atria, great vessels) are often rendered semi-transparent so the trainee can see the sector plane cutting through internal structures. Currently, the wireframe provides accidental transparency (you can see through it), but in a confusing, non-pedagogical way.

**Fix:** Render outer shells (whole heart, pericardium) at 20-40% opacity. Render chamber blood pools as solid dark volumes. This reveals the sector plane intersecting internal anatomy.

### Problem 4: No Interior Surfaces

The mesh appears to be an exterior-only surface of the whole heart. There are no internal chamber walls, no septal surfaces, no valve leaflets, and no papillary muscles. A standard anatomical heart model (like the Visible Heart Lab models, Zygote, or the Open Anatomy heart) includes interior detail. Without it, slicing through the model reveals nothing about what is inside.

**Fix:** Generate interior chamber surface meshes from the segmentation labels. At minimum, create separate meshes for LV cavity, RV cavity, LA, RA. The TotalSegmentator labels for cardiac substructures (if available) or a cardiac-specific segmentation model could provide this.

### Problem 5: Mesh Quality / Topology

The wireframe reveals an irregular, high-polygon mesh with visibly uneven triangle sizes and some protruding features that look like segmentation artifacts (the blob-like inferior extensions, which may be diaphragm or liver tissue incorrectly included). Standard anatomical models are smooth, artist-cleaned meshes with regular quad topology.

**Fix:** Apply Laplacian smoothing, decimate to a reasonable polygon count (~50K-100K triangles), and remove non-cardiac structures from the heart mesh. Use marching cubes with anti-aliased isosurface extraction rather than raw label-boundary meshing.

### Problem 6: Missing Anatomical Context

Standard 3D heart teaching models include:
- Coronary arteries (LAD, LCx, RCA) on the epicardial surface
- Great vessel branches (brachiocephalic, left common carotid, left subclavian)
- Pulmonary veins entering the LA
- IVC/SVC entering the RA

None of these are visible. While some may be beyond the segmentation scope, the great vessels and venae cavae are typically segmentable and would dramatically improve anatomical recognition.

### Problem 7: No Anatomical Orientation Aids

There is no anterior/posterior/superior/inferior labeling, no base/apex indicator, no standard anatomical position reference. A trainee looking at the wireframe has no way to orient it as a heart.

**Fix:** Add a small anatomical compass, or fixed labels (Anterior, Posterior, Superior, Inferior) that rotate with the camera.

---

## Component Ratings (1-5 scale, for clinical teaching utility)

| Component | Score | Rationale |
|-----------|-------|-----------|
| **Pseudo-TEE pane** | 1.5/5 | Correct sector geometry and probe-driven reslicing. But the label-colored rendering bears no resemblance to echocardiographic images. A trainee cannot learn to identify echo structures from this. Not usable for view recognition training. |
| **3D anatomy pane** | 1.5/5 | Wireframe mesh is unrecognizable as a heart. No colors, no solid surfaces, no interior detail. The probe position and sector plane are present but nearly invisible. A trainee cannot build probe-to-anatomy spatial mapping from this. |
| **Oblique slice pane** | 3.0/5 | The best component. CT cross-section with color label overlay shows real anatomical relationships. A knowledgeable reader can orient themselves for some views (especially AV SAX). Limited by single-label granularity (no sub-cardiac chamber labels). Useful as an adjunct to an atlas. |
| **Probe controls / 5-DOF model** | 4.0/5 | Excellent. All five degrees of freedom are correctly implemented and displayed. The position slider, omniplane dial, and flexion controls map to real probe manipulation. View presets snap correctly. The controls alone teach TEE probe mechanics effectively. |
| **View matching / presets** | 4.0/5 | All 8 anchor views report 100% quality match. The preset buttons provide correct probe parameters for each ASE standard view. Keyboard shortcuts (1-8) work. The matching badge system is pedagogically useful. |
| **Cardiac motion** | 1.0/5 | Animation infrastructure is present (phase counter advances, play/pause button exists) but no visible contraction is detectable in the rendered output. No valve motion. No wall thickening. Cannot teach cardiac cycle concepts. |
| **UI / layout** | 3.5/5 | Clean, dark-themed interface. Three-pane layout is logical. Probe controls are well-organized. The case label and bundle version are clearly shown. Minor issues: the pseudo-TEE text overlay ("Label-driven echo appearance") is distracting and should be removable. |
| **Overall clinical readiness** | 2.0/5 | The simulator teaches probe mechanics and view nomenclature but cannot teach anatomy recognition, echo interpretation, or dynamic cardiac assessment. |

---

## Top 3 Improvements Needed

### 1. Replace Label-Colored Pseudo-TEE with Ultrasound-Like Rendering (Critical)

**Current state:** The pseudo-TEE pane displays label-map colors (yellow, blue, teal) mapped directly from segmentation labels with HU boosting. This looks nothing like echocardiography.

**Required:** A grayscale rendering pipeline that simulates the basic physics of ultrasound:
- Tissue boundaries appear bright (high echo return at interfaces between structures with different acoustic impedance)
- Blood pools appear dark/anechoic
- Myocardium appears as intermediate gray with speckle texture
- Depth-dependent attenuation (far-field structures are dimmer)
- Sector-shaped display with lateral resolution variation

This is the single most impactful change. Without echo-like appearance, the pseudo-TEE pane has no training value for view recognition -- which is the core competency TEE fellows must develop.

**Reference:** The CT2TEE system (AGH Krakow) and research by Salehi et al. demonstrate that label-map-to-ultrasound conversion is feasible. Per-label acoustic impedance tables plus edge enhancement at label boundaries can produce convincing B-mode images from segmented volumes.

### 2. Replace 3D Wireframe with Solid, Color-Coded, Semi-Transparent Surface Rendering (Critical)

**Current state:** Monochrome wireframe is visually unrecognizable as a heart.

**Required:**
- Opaque surface rendering with Phong/PBR shading
- Per-structure coloring from the existing label map (myocardium=red, blood=dark, aorta=red, PA=blue)
- Semi-transparency for outer structures to show the sector plane cutting through internal anatomy
- Interior chamber surfaces (LV, RV, LA, RA cavities) as separate meshes
- Mesh smoothing and cleanup to remove segmentation artifacts
- Anatomical orientation labels

This would transform the 3D pane from confusing to pedagogically powerful. The trainee needs to see: "here is the heart, here is where the probe sits, and the sector plane slices through these specific structures."

### 3. Achieve Visible Cardiac Motion (High Priority)

**Current state:** The phase counter advances but no perceptible motion is visible in any pane.

**Required:**
- Verify that the mesh deformation between cardiac phases actually changes vertex positions by a detectable amount (at least several mm of wall excursion)
- Ensure the VTI volume is being resampled at each phase
- Consider scaling or exaggerating the motion slightly for teaching purposes
- Prioritize LV wall thickening and AV valve plane excursion as the primary motion targets
- Display the cardiac phase prominently with a simple ECG trace or timing diagram

Cardiac motion is fundamental to TEE. Static images can teach anatomy, but TEE interpretation in the OR depends on recognizing dynamic patterns: wall motion abnormalities, valve opening/closing, filling/ejection. Without visible motion, the simulator cannot progress beyond static anatomy training.

---

## Is This Simulator Ready to Show to a TEE Fellow?

**No.** In its current state, showing this to a TEE fellow would risk:

1. **Confusion:** The pseudo-TEE images do not look like echo. A fellow would not recognize the views and might question the validity of the tool.
2. **Negative learning:** The 3D wireframe could create incorrect mental models of cardiac anatomy.
3. **Credibility damage:** A TEE fellow has seen hundreds of real echo images. The gap between this rendering and real echo is too large to overlook.

**However,** the simulator could be shown to a TEE fellow as a **technology demonstration** with appropriate framing:
- "This is a probe mechanics trainer -- practice the 5-DOF manipulation to reach each standard view"
- "The echo appearance is placeholder; we are building a realistic rendering pipeline"
- "Focus on the probe position/omniplane/flexion parameters, not the image content"

With this framing, the probe controls and view presets have genuine teaching value for the mechanical skill of TEE probe manipulation, which is the first thing fellows struggle with.

---

## Positive Findings (What Works Well)

1. **Probe kinematics are correct.** The 5-DOF model faithfully represents real TEE probe manipulation. The esophageal centerline constraint is a clinically accurate touch.
2. **View presets are accurate.** The 8 anchor views use appropriate probe parameters that match ASE/SCA guidelines.
3. **Omniplane rotation works.** Comparing ME 4C (0 deg), ME 2C (65 deg), and ME LAX (130 deg) at the same position confirms the omniplane axis rotates the imaging plane correctly. The oblique slices show visibly different tissue cross-sections.
4. **Probe position changes produce correct effects.** The TG SAX (position=166mm, anteFlex=20) is correctly placed in the transgastric position with anteflexion, matching clinical technique.
5. **View matching works.** All 8 views show 100% quality match, indicating the geometric comparison between current probe state and stored anchor parameters is functioning.
6. **UI is clean and functional.** The three-pane layout, slider controls, and preset buttons are well-designed and intuitive.

---

## Roadmap Priority Recommendation

| Priority | Item | Impact | Effort |
|----------|------|--------|--------|
| P0 | Ultrasound-like grayscale rendering (pseudo-TEE pane) | Transforms core value proposition | High |
| P0 | Solid surface rendering with per-structure colors (3D pane) | Makes 3D pane usable for teaching | Medium |
| P1 | Visible cardiac motion (all panes) | Enables dynamic assessment training | Medium |
| P1 | Interior chamber surfaces (3D pane) | Enables probe-to-anatomy correlation | Medium |
| P2 | Mesh smoothing and anatomical cleanup | Professional appearance | Low |
| P2 | Speckle texture and depth attenuation (pseudo-TEE) | Echo realism | Medium |
| P2 | Anatomical orientation labels (3D pane) | Orientation aid for trainees | Low |
| P3 | Valve leaflet geometry (3D + pseudo-TEE) | Enables valve assessment training | High |
| P3 | Doppler simulation (color flow, spectral) | Enables hemodynamic assessment | Very High |

---

*Review conducted on 36 screenshots from `/screenshots/review-v02/`. All assessments based on visual inspection of static frames. Interactive behavior (slider responsiveness, animation smoothness, camera controls) was not evaluated.*
