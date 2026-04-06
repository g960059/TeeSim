# Clinical Validation Report v2: TeeSim 8 Anchor Views (Post-Probe-Model Fix)

**Date:** 2026-04-06
**Reviewer:** Board-certified cardiac anesthesiologist / TEE expert (AI-assisted, Opus 4.6)
**Case:** LCTSC S1-006 (Female, Thorax CT)
**Bundle:** 0.1.0
**Software:** TeeSim MVP Shell
**Prior report:** `2026-04-06-clinical-validation-report.md` (pre-fix baseline)
**Bug fixed:** Imaging plane now correctly rotates with omniplane angle (see `2026-04-06-rendering-diagnosis.md`)

---

## Context: What Changed

The probe-model bug diagnosed in `rendering-diagnosis.md` has been fixed:

- **Before fix:** `plane.up` was set to `transducerFrame.tangent` (shaft direction), so the depth axis of the pseudo-TEE sector always pointed along the esophageal centerline regardless of omniplane angle. All ME views looked nearly identical.
- **After fix:** The imaging plane basis is now computed correctly -- `plane.up` points into the heart (depth), `plane.right` is the lateral axis, and the omniplane angle genuinely rotates the imaging plane around the beam axis. The basis is also now right-handed.

This report evaluates the 8 anchor views **after** the fix, comparing against ASE/SCA standard reference anatomy for each view.

---

## Methodology

For each of the 8 ASE standard views, four screenshots were examined:

1. **Full-screen (*-full.png):** Complete application layout showing all three panes plus probe controls
2. **Pseudo-TEE (*-tee.png):** CT-derived anatomical slice within a sector-shaped mask
3. **Oblique Slice (*-oblique.png):** Full rectangular CT cross-section with tissue color transfer function
4. **3D Scene (*-3d.png):** Wireframe heart mesh with probe and sector plane overlay

Each view was compared against published ASE/SCA guidelines (Hahn et al., JASE 2013; Reeves et al., Anesth Analg 2013) and standard TEE reference atlases.

---

## View 1: ME Four-Chamber (me-4c)

**Probe parameters:** Position=97mm, Roll=0, Ante/Retro=-5, Lateral=0, Omniplane=0 deg
**ASE standard:** Omniplane 0-20 deg, mid-esophageal position (~30-35cm from incisors)
**Expected anatomy:** LV, RV, LA, RA, MV, TV -- the "four-chamber cross"

### A. Pseudo-TEE Pane

- **Sector geometry:** Correctly rendered ~90 deg sector fan with apex at top (transducer position). This matches standard TEE display convention.
- **Within the sector:** A roughly triangular/trapezoidal bright tissue mass is visible in the near-to-mid field, occupying the central ~60% of the sector width. The tissue appears as a homogeneous gray-white density with subtle internal contrast variations.
- **Chamber boundaries:** No clearly delineated four-chamber cross is visible. In a real ME 4C view, one expects to see the crux of the heart at center screen -- four dark (blood-filled) chambers separated by the bright interatrial septum (vertical) and the bright AV valve plane (horizontal). Here, the tissue mass appears as a single bright region without clear dark chambers.
- **Near field (top of sector):** Shows the expected posterior structures (the esophageal-facing surface of the heart). There is tissue in the near field, which is consistent with the posterior wall of the LA being closest to the transducer.
- **Differentiation from other views:** This view does appear subtly different from the me-2c and me-lax views (confirmed in side-by-side full-screen comparison), indicating the omniplane rotation fix is working. The tissue shape within the sector is broader and more symmetric compared to me-lax.

### B. Oblique Slice Pane

- **Anatomical cross-section:** Shows a tissue-colored (brown/tan) cross-section of the thorax. In the upper-right quadrant, a dark region bordered by lighter tissue is visible -- this could represent a blood-filled cardiac chamber or the descending aorta.
- **Structure identification:** The spine/vertebral body appears as a bright horizontal bar at the top of the image (posterior). Below it, there is a large area of homogeneous tan tissue with a dark region that may correspond to the cardiac cross-section at the four-chamber level. However, individual chambers are not clearly separable.
- **ASE match:** The overall tissue volume is consistent with a mid-esophageal transverse section, but the lack of contrast enhancement in this CT dataset means blood and myocardium are nearly isodense, preventing clear chamber delineation.

### C. 3D Scene Pane

- **Probe position:** The wireframe heart mesh is clearly visible with recognizable cardiac and great vessel anatomy. The probe appears to be positioned behind the heart (esophageal position), which is correct.
- **Sector plane:** The sector plane is not prominently visible in this particular camera angle at omniplane=0 deg. It may be edge-on to the viewing direction, or its opacity may be low. The badge reads "ME Four-Chamber / 100% quality" confirming the view-matching algorithm recognizes this position.

### D. Comparison with Real TEE

**Reference (ASE standard ME 4C):** In a real TEE ME 4C view, the image shows four distinct dark chambers -- LA closest to the transducer (top), RA to the viewer's left of LA, LV in the far field below LA, and RV to the viewer's left of LV. The mitral and tricuspid valves appear as bright linear echoes at the crux. The interatrial and interventricular septa divide the image into left and right halves.

**What matches:**
- Sector geometry and orientation are correct
- Probe position at sMm=97 with omniplane=0 deg is within ASE range
- Near-field tissue density is plausible for the posterior LA wall
- The tissue shape occupies the expected region of the sector

**What is missing:**
- No visible dark blood pools to delineate the four chambers
- No visible AV valve plane (crux of the heart)
- No visible interatrial or interventricular septum
- No differentiation between left and right-sided structures
- No apex visualization (LV/RV tips in the far field)

### E. Per-View Verdict: PARTIAL

The geometry is correct and the sector shows tissue in the expected region, but chamber identification is not possible. This is improved from pre-fix (where all ME views looked identical) but still insufficient for clinical education.

---

## View 2: ME Two-Chamber (me-2c)

**Probe parameters:** Position=97mm, Roll=0, Ante/Retro=-5, Lateral=0, Omniplane=65 deg
**ASE standard:** Omniplane 60-90 deg (typically ~65 deg), same mid-esophageal station
**Expected anatomy:** LV, LA, MV -- only left-sided chambers, with anterior and inferior LV walls

### A. Pseudo-TEE Pane

- **Sector geometry:** Identical sector shape and orientation convention to me-4c. Apex at top.
- **Within the sector:** The tissue mass within the sector has a noticeably different shape from the me-4c view -- it appears slightly narrower and shifted, which is consistent with the omniplane rotating 65 degrees. This is a significant improvement over the pre-fix state where me-4c and me-2c were visually indistinguishable in the pseudo-TEE pane.
- **Chamber boundaries:** Still no clearly defined chambers. In a real ME 2C, one expects to see the LA in the near field with the LV elongated in the far field, separated by the MV leaflets. The image shows a similar homogeneous bright tissue region without dark blood pools.
- **Near field:** Tissue density in the near field is consistent with LA posterior wall.
- **Differentiation from me-4c:** The tissue shape IS visibly different from me-4c, confirming the omniplane fix is producing distinct cross-sections. The tissue distribution is slightly asymmetric compared to the more symmetric me-4c, which is directionally correct (the 2C view eliminates the right heart from view).

### B. Oblique Slice Pane

- **Anatomical cross-section:** The oblique slice is visibly different from me-4c. The vertebral column is visible at the top. The cardiac section appears as a more elongated structure compared to the 4C cut, which is consistent with a 65-degree rotation capturing the long axis of the LV.
- **Structure identification:** Darker regions visible in the upper portion could represent the LA or a cut through the LV cavity. The tissue below appears to be chest wall/lung.
- **ASE match:** The oblique orientation is consistent with what a 65-degree cut through the heart should produce -- an elongated longitudinal section.

### C. 3D Scene Pane

- **Probe position:** Plausible esophageal position. The wireframe mesh is unchanged from me-4c (same camera).
- **Sector plane:** Not clearly visible at this camera angle. The badge correctly reads "ME Two-Chamber / 100% quality."

### D. Comparison with Real TEE

**Reference (ASE standard ME 2C):** Shows only LA (near field, top) and LV (far field, bottom) separated by the MV. The anterior wall is on the right side of the display and the inferior wall is on the left. The left atrial appendage (LAA) should be visible near the LA on the left side.

**What matches:**
- The tissue shape within the sector is visibly different from ME 4C (confirms working omniplane rotation)
- Omniplane angle of 65 deg is textbook for this view
- The narrower tissue profile is directionally consistent with seeing only left-sided chambers

**What is missing:**
- No distinct LA and LV cavities visible as dark regions
- No MV leaflets identifiable
- No LAA visible
- Cannot distinguish anterior from inferior LV walls

### E. Per-View Verdict: PARTIAL

Meaningful improvement over pre-fix: the view is now visibly distinct from ME 4C, confirming the omniplane fix works. Chamber delineation remains impossible due to contrast limitations.

---

## View 3: ME Long-Axis (me-lax)

**Probe parameters:** Position=97mm, Roll=0, Ante/Retro=-5, Lateral=0, Omniplane=130 deg
**ASE standard:** Omniplane 120-160 deg (typically ~130 deg), mid-esophageal
**Expected anatomy:** LV, LA, MV, LVOT, AV, ascending aorta -- analogous to parasternal long axis

### A. Pseudo-TEE Pane

- **Within the sector:** The tissue mass is distinctly different from both me-4c and me-2c. At 130 deg omniplane, the cross-section is nearly orthogonal to the 4C plane. The tissue shape within the sector appears more compact/irregular with a visible darker region within the tissue mass in the mid-sector. This darker region could plausibly represent the LVOT or aortic root in cross-section.
- **Chamber boundaries:** There is a subtle internal structure visible -- a darker rectangular/linear region embedded in the brighter tissue, particularly in the mid-to-far field. This is more internal contrast than seen in me-4c or me-2c, and is anatomically plausible since the me-lax view cuts through the LVOT and aortic root, which contain blood.
- **Differentiation:** This is the most visually distinct of the three ME mitral-level views. The omniplane fix has clearly produced three different cross-sections at 0, 65, and 130 degrees.

### B. Oblique Slice Pane

- **Anatomical cross-section:** The oblique slice shows clearly different anatomy from the 4C and 2C views. There are distinct darker structures in the upper portion that appear tubular/elongated -- consistent with the aortic outflow tract in long axis.
- **Structure identification:** A dark linear structure is visible that could represent the ascending aorta or LVOT lumen. The surrounding bright tissue is consistent with aortic/cardiac walls. This is the most anatomically suggestive oblique slice among the ME mitral-level views.
- **ASE match:** The cross-section orientation is consistent with a long-axis cut through the LVOT-AV-ascending aorta axis.

### C. 3D Scene Pane

- **Probe position:** Plausible. Badge reads "ME Long-Axis / 100% quality."
- **Sector plane:** Not prominently visible at this camera angle, but the sector may be partially visible as a subtle teal region below/behind the mesh.

### D. Comparison with Real TEE

**Reference (ASE standard ME LAX):** Shows the LA in the near field, MV at center, LV cavity below, with the LVOT leading rightward to the AV and ascending aorta. The anteroseptal wall is on the right and the inferolateral (posterior) wall is on the left.

**What matches:**
- The cross-section is clearly distinct from 4C and 2C views
- There are subtle internal structures visible that could correspond to the LVOT/aortic root
- Omniplane 130 deg is within ASE range
- The oblique slice shows elongated structures consistent with aortic outflow

**What is missing:**
- No clearly defined LA, LV cavities
- No identifiable MV or AV leaflets
- No tubular ascending aorta visible in pseudo-TEE
- Wall motion segments (anteroseptal, inferolateral) not distinguishable

### E. Per-View Verdict: PARTIAL

Best of the three ME mitral-level views -- subtle internal contrast suggests correct anatomy is being sliced. The oblique pane is particularly encouraging. Still not sufficient for standalone educational use.

---

## View 4: TG Mid Short-Axis (tg-sax)

**Probe parameters:** Position=166mm, Roll=0, Ante/Retro=20, Lateral=0, Omniplane=10 deg
**ASE standard:** Omniplane 0-20 deg, transgastric (probe advanced into stomach, anteflexed)
**Expected anatomy:** LV short-axis circle ("donut"), anterolateral and posteromedial papillary muscles

### A. Pseudo-TEE Pane

- **Sector geometry:** Sector fan is rendered correctly with apex at top.
- **Within the sector:** The sector contains faint tissue density with a small bright structure in the near field and the rest of the sector appearing mostly dark. There is slightly more visible content than in the pre-fix "completely black" state, suggesting the imaging plane is now at least partially intersecting tissue.
- **Chamber boundaries:** The characteristic "donut" shape of the LV in short axis (thick myocardial ring surrounding a dark central cavity) is NOT visible. No papillary muscles can be identified.
- **Near field:** A small bright triangular region is visible very close to the sector apex, which could represent the gastric wall or diaphragm between the probe and the heart.

### B. Oblique Slice Pane

- **Anatomical cross-section:** The oblique slice is predominantly brown/tan with some brighter regions in the upper-right corner that could represent tissue boundaries. The slice appears to cut through mostly homogeneous tissue with poor anatomical differentiation.
- **Structure identification:** No clearly identifiable cardiac chambers. The slice may be partially intersecting the inferior wall of the heart but does not appear to produce a clean short-axis cross-section through the LV.
- **ASE match:** Does NOT match the expected short-axis "donut." The imaging plane either does not fully reach the LV mid-cavity or is angled suboptimally.

### C. 3D Scene Pane

- **Probe position:** This is the most visually informative pane. The probe has clearly moved to a more inferior position and the sector plane (visible as a large teal translucent fan) projects from a lower position through the heart mesh. This confirms the probe has advanced to the transgastric window.
- **Sector plane:** Clearly visible teal sector fan intersecting the inferior portion of the heart. The angle of the sector plane appears reasonable for a transgastric approach (coming from below/behind the heart rather than from behind as in ME views).

### D. Comparison with Real TEE

**Reference (ASE standard TG Mid SAX):** The iconic "donut" view -- a circular cross-section of the LV with thick myocardial walls, a dark central cavity, and two papillary muscles visible as bright dots at approximately 4 and 8 o'clock positions. The RV may appear as a crescent anterior to the LV.

**What matches:**
- Probe has correctly advanced to transgastric position (sMm=166)
- Anteflexion (20 deg) is applied, which is required for TG views
- The 3D scene confirms the sector plane intersects the inferior heart
- Omniplane 10 deg is within standard range

**What is missing:**
- The characteristic LV "donut" is completely absent
- No papillary muscles visible
- No circular myocardial ring visible
- The CT volume may not extend far enough inferiorly, or the ante=20 is insufficient to bring the sector up into the LV cavity

### E. Per-View Verdict: FAIL

The 3D geometry suggests the probe is in approximately the right location, but the imaging plane does not produce recognizable LV short-axis anatomy. This remains the most significant gap in the simulator. Possible causes: (1) the LCTSC CT volume inferior extent does not fully cover the transgastric window, (2) the anteflexion model needs more aggressive upward aim from the gastric position, or (3) the centerline endpoint in the "stomach" region is not anatomically correct.

---

## View 5: ME AV Short-Axis (me-av-sax)

**Probe parameters:** Position=83mm, Roll=0, Ante/Retro=0, Lateral=0, Omniplane=40 deg
**ASE standard:** Omniplane 30-60 deg (typically ~40 deg), probe withdrawn slightly from 4C position
**Expected anatomy:** AV "Mercedes sign" (3 cusps), RA, LA, interatrial septum, TV, RVOT

### A. Pseudo-TEE Pane

- **Within the sector:** The sector shows more tissue contrast than the standard ME 4C/2C views. There is a bright triangular/wedge-shaped tissue mass in the near-to-mid field, with visible internal structures. A brighter region appears near the center that could correspond to the aortic root region.
- **Chamber boundaries:** There are subtle density differences within the tissue that hint at structural boundaries. A slightly darker region flanked by brighter tissue could represent a vessel lumen (aortic root in cross-section). However, the classic "Mercedes-Benz" sign of three aortic cusps is NOT identifiable.
- **Near field:** Brighter tissue in the near field is consistent with the base of the heart at the atrial level, which is closest to the esophagus when withdrawn to the AV level.

### B. Oblique Slice Pane

- **Anatomical cross-section:** The oblique slice shows a cross-section through the base of the heart. A bright linear structure (likely the spine/vertebral body) is visible at the top. Below it, there are tissue structures with some darker and lighter regions that suggest cross-sectional cardiac anatomy at the great vessel level.
- **Structure identification:** A darker region surrounded by brighter tissue is visible that could represent the aortic root or another vessel in cross-section. This is more anatomically informative than the standard ME oblique slices.
- **ASE match:** The slice level appears correct -- the withdrawn probe position (sMm=83 vs 97) places the imaging plane more superiorly at the base of the heart where the aortic valve is located.

### C. 3D Scene Pane

- **Probe position:** Plausible esophageal position at a more cephalad level than ME 4C.
- **Sector plane:** A subtle teal region is visible inferior to the heart mesh, suggesting the sector plane is rendered. Badge reads "ME AV Short-Axis / 100% quality."

### D. Comparison with Real TEE

**Reference (ASE standard ME AV SAX):** Shows a round aortic valve in the center with three cusps forming the "Y" or "Mercedes sign" (right coronary, left coronary, and non-coronary cusps). The LA is posterior (top of image, nearest transducer). The RA is to the viewer's left. The IAS separates LA and RA. The TV and RVOT are visible to the viewer's left wrapping around the aortic root.

**What matches:**
- Probe withdrawn to sMm=83 (correct for basal/AV level)
- Omniplane 40 deg is textbook
- More tissue contrast visible than in mitral-level views, consistent with dense structures at the aortic root level
- Internal density variations hint at structural boundaries

**What is missing:**
- The characteristic three-cusp "Mercedes sign" is not visible
- Individual cusps (RCC, LCC, NCC) cannot be identified
- RA, LA, and IAS are not delineated
- TV and RVOT cannot be distinguished

### E. Per-View Verdict: PARTIAL

Encouraging level of tissue contrast and structural hints. Geometry is correct. With narrower CT windowing and/or contrast-enhanced data, this view has the best potential to become clinically recognizable among the ME views.

---

## View 6: ME AV Long-Axis (me-av-lax)

**Probe parameters:** Position=83mm, Roll=0, Ante/Retro=0, Lateral=0, Omniplane=130 deg
**ASE standard:** Omniplane 120-160 deg (typically ~130 deg), same position as AV SAX
**Expected anatomy:** LVOT, AV in long axis (leaflets opening/closing), aortic root, proximal ascending aorta, sinuses of Valsalva

### A. Pseudo-TEE Pane

- **Within the sector:** The tissue mass is clearly different from the AV SAX view (confirming 90-degree omniplane rotation from 40 to 130 degrees). There is a larger, more complex tissue shape within the sector. Notably, there are darker regions within the tissue that form linear or tubular shapes -- these could represent the LVOT and aortic root in long axis.
- **Chamber boundaries:** This view shows the most internal tissue contrast of any pseudo-TEE image. There are at least two distinct density zones visible within the tissue mass -- a brighter peripheral zone (walls) and a darker central zone (lumen). This is consistent with a long-axis cut through the aortic outflow.
- **Near field:** Dense tissue in the near field, consistent with the posterior wall structures at the base of the heart.

### B. Oblique Slice Pane

- **Anatomical cross-section:** This is the most anatomically informative oblique slice in the entire set. Dark spaces representing blood-filled chambers or vessels are clearly visible, separated by bright tissue walls. There are structures that can be tentatively identified as chambers and outflow tracts.
- **Structure identification:** A large dark region (blood) is bordered by bright tissue (walls), with what appears to be a tubular structure leading away from it. This could represent the LV cavity with the LVOT leading to the aortic root. Smaller dark regions may represent the LA.
- **ASE match:** This is the closest match to expected anatomy of any oblique slice. The long-axis orientation through the aortic outflow is plausible.

### C. 3D Scene Pane

- **Probe position:** Plausible. The sector plane is visible as a teal region projecting from behind the heart mesh in a distinctly different orientation from the AV SAX view.
- **Sector plane:** Visible and clearly rotated ~90 degrees relative to the AV SAX sector plane, confirming correct omniplane behavior. Badge reads "ME AV Long-Axis / 100% quality."

### D. Comparison with Real TEE

**Reference (ASE standard ME AV LAX):** Shows the LVOT on the left leading through the aortic valve to the aortic root and ascending aorta on the right. The sinuses of Valsalva bulge above and below the valve. The LA is in the near field (top). This is the key view for measuring the aortic annulus (TAVR planning) and assessing aortic regurgitation severity.

**What matches:**
- Omniplane 130 deg is standard
- Same probe station as AV SAX (sMm=83), correctly paired
- The pseudo-TEE shows internal density variation suggesting tubular outflow structures
- The oblique slice shows the most convincing cardiac anatomy of any view
- The 3D sector plane is visibly rotated 90 deg from AV SAX

**What is missing:**
- AV leaflets not individually visible
- Aortic root sinuses of Valsalva not identifiable
- Ascending aorta not clearly tubular
- No measurement landmarks for annulus sizing

### E. Per-View Verdict: PARTIAL

Best overall performance of any view. The oblique slice is genuinely educational -- cardiac chambers and outflow structures are recognizable. The pseudo-TEE shows promising internal contrast. With improved windowing, this view could approach clinical utility.

---

## View 7: ME RV Inflow-Outflow (me-rv-io)

**Probe parameters:** Position=97mm, Roll=0, Ante/Retro=0, Lateral=10, Omniplane=75 deg
**ASE standard:** Omniplane 60-90 deg, slight rightward rotation/lateral deflection
**Expected anatomy:** RV, RA, TV, RVOT, pulmonic valve (PV), proximal PA

### A. Pseudo-TEE Pane

- **Within the sector:** The tissue mass has a distinct shape compared to other ME views. The tissue appears broader and more asymmetric, which is consistent with the lateral deflection (lateral=10) directing the beam toward the right heart. There is a small bright structure near the apex of the sector.
- **Chamber boundaries:** The right heart structures are inherently more difficult to image even in real TEE due to the thin RV free wall and complex RV geometry. No individual RV structures are identifiable.
- **Differentiation:** The image is visibly different from ME 4C (omni=0) and ME 2C (omni=65), confirming the omniplane at 75 deg with lateral=10 produces a unique cross-section.

### B. Oblique Slice Pane

- **Anatomical cross-section:** Shows cardiac structures with a different obliquity compared to other ME views. There are some darker regions that could represent right-heart chambers, but identification is speculative.
- **Structure identification:** The lateral deflection should shift the imaging plane rightward to capture RA/TV/RV/RVOT, but these structures are not clearly delineated in the oblique slice. There is a dark region in the upper portion that could be a right-heart chamber.

### C. 3D Scene Pane

- **Probe position:** Plausible mid-esophageal position. The lateral=10 parameter should shift the imaging plane rightward, though this is difficult to confirm from the wireframe view alone.
- **Sector plane:** A very small teal region is visible at the bottom of the mesh, suggesting the sector plane is rendered. Badge reads "ME RV Inflow-Outflow / 100% quality."

### D. Comparison with Real TEE

**Reference (ASE standard ME RV I-O):** Shows the RA on the right, TV at center, RV wrapping around the aortic root, RVOT leading to the PV and proximal PA. The AV is often visible in the center of the image. This view is essential for assessing RV function, TR severity, and RVOT obstruction.

**What matches:**
- Lateral deflection (10 deg) is clinically appropriate for rightward orientation
- Omniplane 75 deg is within standard range (60-90 deg)
- The tissue shape in the sector is distinct from other views

**What is missing:**
- No identifiable RA, TV, RV, RVOT, or PV
- The thin-walled right heart structures are not visible
- No "wrap-around" appearance of RV around aortic root

### E. Per-View Verdict: PARTIAL

Correct parameterization including the important lateral deflection. The cross-section is geometrically unique. Right-heart anatomy is not identifiable, though this is the most difficult view to render even with contrast-enhanced CT.

---

## View 8: ME Bicaval (me-bicaval)

**Probe parameters:** Position=92mm, Roll=10, Ante/Retro=0, Lateral=0, Omniplane=95 deg
**ASE standard:** Omniplane 80-110 deg (typically ~90-110 deg), probe rotated clockwise (rightward)
**Expected anatomy:** SVC (entering from viewer's left), IVC (entering from viewer's right), RA, IAS

### A. Pseudo-TEE Pane

- **Within the sector:** This is one of the most distinctive pseudo-TEE images. The tissue mass has a V-shaped or chevron appearance that is markedly different from any other view. The V-shape has two arms extending laterally from a central point, with the sector being mostly dark between them. This distinctive shape could represent the SVC/IVC axis with the RA between them, though the structures are not individually labeled.
- **Chamber boundaries:** The V-shaped pattern is anatomically suggestive. In a real bicaval view, the SVC enters the RA from above (viewer's left) and the IVC enters from below (viewer's right), creating a vertical axis with the RA as the chamber between them. The V-shape in the simulator could be capturing this geometry.
- **Near field:** Tissue is present in the near field, consistent with the LA and IAS being closest to the esophageal transducer in this view.

### B. Oblique Slice Pane

- **Anatomical cross-section:** The oblique slice shows a strikingly different anatomy from all other views. There is a large dark region (diamond or rhomboid shape) surrounded by bright tissue. This dark region is very likely a blood-filled chamber -- potentially the RA seen in the bicaval orientation. Smaller bright structures are visible at the periphery.
- **Structure identification:** The large dark (blood) region is the most clearly identifiable cardiac chamber in any of the oblique slices. Its size and position are consistent with the RA. Structures entering from the edges could represent the SVC and IVC ostia, though they are not clearly tubular.
- **ASE match:** This is the second-best oblique slice (after ME AV LAX). The anatomy is consistent with a bicaval orientation showing the RA.

### C. 3D Scene Pane

- **Probe position:** The probe is in a plausible esophageal position. The roll=10 deg parameter orients the imaging plane slightly to capture the SVC/IVC axis, which lies to the patient's right.
- **Sector plane:** A prominent teal sector plane is clearly visible, extending from the probe position inferiorly/rightward. This is the most clearly visible sector plane among the ME views, and its orientation is distinctly different from the standard ME views -- it is directed more posteriorly/rightward, which is correct for targeting the IAS and caval veins.

### D. Comparison with Real TEE

**Reference (ASE standard ME Bicaval):** Shows the SVC entering the RA from the viewer's left (superior), the IVC entering from the viewer's right (inferior), with the RA as the central chamber. The IAS is visible as a bright line in the near field, with the LA just behind it. This is the key view for ASD/PFO assessment, transseptal puncture guidance, and SVC/IVC evaluation.

**What matches:**
- Roll=10 deg provides rightward orientation for the caval axis
- Omniplane 95 deg is within standard range
- The V-shaped tissue pattern in the pseudo-TEE is suggestive of the bicaval geometry
- The oblique slice shows a large, clearly identifiable blood-filled chamber (RA)
- The 3D sector plane orientation is distinctly different and anatomically appropriate
- The sector plane is clearly visible, confirming correct geometry

**What is missing:**
- SVC and IVC as distinct tubular structures entering the RA are not clearly identifiable
- IAS is not visible as a linear structure in the near field
- LA is not clearly delineated behind the IAS

### E. Per-View Verdict: PARTIAL

The most anatomically distinctive view in the simulator. The V-shaped pseudo-TEE pattern is unique and suggestive of correct anatomy. The oblique slice shows the clearest chamber identification of any view. The 3D scene provides excellent geometric confirmation. With improved windowing, this could be the first view to achieve clinical recognizability.

---

## Cross-Cutting Observations

### 1. Omniplane Rotation Fix: CONFIRMED WORKING

The most important finding of this v2 validation is that **the omniplane fix is definitively working**. Evidence:

- ME 4C (0 deg), ME 2C (65 deg), and ME LAX (130 deg) all produce visibly different tissue shapes within the pseudo-TEE sector. In the pre-fix report, these three views were "visually indistinguishable."
- ME AV SAX (40 deg) and ME AV LAX (130 deg) are clearly different from each other, confirming 90-degree rotation at the same probe station.
- ME Bicaval (95 deg with roll=10) produces a unique V-shaped pattern unlike any other view.
- The oblique slices are all distinct from each other, further confirming different imaging planes.

### 2. Pseudo-TEE Tissue Contrast: IMPROVED BUT STILL INSUFFICIENT

The pseudo-TEE images now show real anatomical variation between views, but chamber identification remains impossible in most views. The underlying issue is the non-contrast CT dataset (blood and myocardium are nearly isodense at ~30-80 HU) combined with a CT window that is too wide (420 HU range).

### 3. Oblique Slice Quality: VARIABLE BUT OCCASIONALLY GOOD

The oblique slices range from uninformative (TG SAX) to genuinely educational (ME AV LAX, ME Bicaval). The tissue color transfer function works well when the slice passes through structures with different densities (vessels, chambers, walls), but fails when the anatomy is homogeneous soft tissue.

### 4. 3D Scene: CONSISTENTLY USEFUL

The 3D wireframe scene correctly identifies all 8 views (100% match quality for all) and shows the probe and sector plane in varying degrees of visibility. The sector plane is most visible in the TG SAX and Bicaval views. This pane provides the best spatial orientation information for a learner.

### 5. View-Matching Algorithm: PERFECT

All 8 views receive 100% quality match from the view-matching algorithm, confirming the probe parameters correctly map to the intended ASE standard views.

### 6. Probe Parameter Accuracy: UNCHANGED (EXCELLENT)

All probe parameters remain within published ASE guidelines:

| View | Omniplane | ASE Range | Position (sMm) | Station | Special Params |
|------|-----------|-----------|-----------------|---------|----------------|
| ME 4C | 0 deg | 0-20 deg | 97 | ME | ante=-5 |
| ME 2C | 65 deg | 60-90 deg | 97 | ME | ante=-5 |
| ME LAX | 130 deg | 120-160 deg | 97 | ME | ante=-5 |
| TG SAX | 10 deg | 0-20 deg | 166 | TG | ante=20 |
| ME AV SAX | 40 deg | 30-60 deg | 83 | ME | -- |
| ME AV LAX | 130 deg | 120-160 deg | 83 | ME | -- |
| ME RV I-O | 75 deg | 60-90 deg | 97 | ME | lateral=10 |
| ME Bicaval | 95 deg | 80-110 deg | 92 | ME | roll=10 |

---

## Summary Table: 8 Views x 3 Panes = 24 Verdicts

| View | Pseudo-TEE | Oblique Slice | 3D Scene | Overall |
|------|-----------|---------------|----------|---------|
| ME Four-Chamber (me-4c) | PARTIAL | PARTIAL | PASS | PARTIAL |
| ME Two-Chamber (me-2c) | PARTIAL | PARTIAL | PASS | PARTIAL |
| ME Long-Axis (me-lax) | PARTIAL | PARTIAL | PASS | PARTIAL |
| TG Mid Short-Axis (tg-sax) | FAIL | FAIL | PASS | FAIL |
| ME AV Short-Axis (me-av-sax) | PARTIAL | PARTIAL | PASS | PARTIAL |
| ME AV Long-Axis (me-av-lax) | PARTIAL | PASS | PASS | PARTIAL |
| ME RV Inflow-Outflow (me-rv-io) | PARTIAL | PARTIAL | PASS | PARTIAL |
| ME Bicaval (me-bicaval) | PARTIAL | PASS | PASS | PARTIAL |

**Pane-level summary:**
- Pseudo-TEE: 0 PASS, 7 PARTIAL, 1 FAIL (0/8 clinically recognizable)
- Oblique Slice: 2 PASS, 5 PARTIAL, 1 FAIL (2/8 show identifiable anatomy)
- 3D Scene: 8 PASS, 0 PARTIAL, 0 FAIL (8/8 geometrically correct)

**Improvement vs. v1 (pre-fix):**
- Pseudo-TEE: 7 views upgraded from CONCERN to PARTIAL (now show distinct anatomy per view)
- Oblique Slice: 2 views upgraded from CONCERN/PASS- to PASS (ME AV LAX, Bicaval)
- 3D Scene: 3 views upgraded from CONCERN to PASS (ME 2C, ME LAX, ME RV I-O now benefit from correct omniplane)
- TG SAX: Remains FAIL (unchanged -- this is a data/geometry issue, not an omniplane issue)

---

## Overall Educational Value Assessment

### Current State

**The simulator is a valid spatial-anatomy teaching tool.** A trainee using TeeSim can learn:

1. **Probe manipulation concepts:** How position (depth), omniplane angle, flexion, lateral deflection, and roll each affect the imaging plane -- this is clearly demonstrated across the 8 presets.
2. **Spatial relationships:** The 3D pane excellently shows where the probe is relative to the heart and how the imaging plane intersects cardiac structures.
3. **View differentiation:** The post-fix simulator now produces visibly different images for each view, so a trainee can understand that different omniplane angles produce different cross-sections.

**The simulator is NOT yet a standalone clinical imaging trainer.** A trainee cannot:

1. Identify specific cardiac chambers by their ultrasound appearance.
2. Recognize valve leaflets, septa, or papillary muscles.
3. Practice interpreting pathology (regurgitation, stenosis, masses, effusions).
4. Develop the pattern-recognition skills needed for real-time intraoperative TEE.

### Comparison to Existing TEE Simulators

Compared to commercial TEE simulators (HeartWorks by Inventive Medical, CAE VimedixAR), TeeSim is in an early but architecturally sound stage. The probe model and 5-DOF manipulation framework are competitive. The rendering fidelity gap is primarily due to the data source (non-contrast CT vs. segmented/labeled cardiac models with ultrasound physics simulation).

### Recommended Use Case

In its current form, TeeSim is best suited as a **supplementary spatial orientation tool** used alongside standard TEE textbooks or labeled diagrams, not as a primary training simulator.

---

## Top 3 Most Important Fixes for Clinical Accuracy

### Fix 1 (CRITICAL): Replace or Supplement CT Data with a Contrast-Enhanced Cardiac CTA

**Impact: Would transform all 8 views from PARTIAL to potential PASS**

The single most impactful change. The LCTSC dataset is a non-contrast thoracic CT with ~30 HU blood-myocardium contrast. A contrast-enhanced cardiac CTA would provide ~200-300 HU contrast between blood pool (300+ HU with iodine) and myocardium (~80-100 HU). This would:

- Make all four cardiac chambers immediately visible as bright regions within darker myocardial walls
- Make the aortic root, great vessels, and coronary sinuses clearly identifiable
- Enable the "donut" appearance in TG SAX
- Make valve planes visible at the junction of bright blood and dense annular tissue

Recommended public datasets: MM-WHS (Multi-Modality Whole Heart Segmentation), ACDC (Automated Cardiac Diagnosis Challenge), or ImageCAS (Coronary Artery Segmentation from CTA).

### Fix 2 (HIGH): Narrow CT Windowing and Reduce Depth Attenuation in Pseudo-TEE Pane

**Impact: Immediate improvement in chamber visibility with current data**

Even without switching datasets, significant improvement is possible:

- **CT window:** Narrow from the current 420 HU range (-180 to 240) to ~100-150 HU centered at 40-60 HU (e.g., window level=50, width=120, giving range -10 to 110 HU). This maximizes the grayscale dynamic range within the soft tissue band where blood (30-50 HU), myocardium (50-80 HU), and fat (around -100 HU) differ.
- **Depth attenuation:** Reduce the exponential coefficient from 1.18 to ~0.3-0.5, or replace with a linear ramp. Current attenuation obliterates far-field structures.
- **Add user-adjustable gain/TGC:** A time-gain compensation (TGC) slider would let users optimize visibility at different depths, mimicking real ultrasound controls and teaching an important concept.

### Fix 3 (HIGH): Fix or Replace TG SAX Geometry

**Impact: Recovers the single FAIL view -- one of the most clinically important TEE views**

The transgastric mid-papillary short-axis view is arguably the single most important intraoperative TEE view (ASA/SCA consensus). It is used for continuous wall-motion monitoring during cardiac surgery. Options:

1. **Verify CT volume extent:** Confirm the LCTSC CT volume extends inferior enough to reach the transgastric acoustic window. If the volume is truncated above the diaphragm, no probe adjustment will help.
2. **Adjust anteflexion model:** The current ante=20 deg may not provide sufficient upward angulation from the gastric position. Consider increasing to 25-30 deg or adjusting the flexion pivot point to be more distal.
3. **Verify centerline:** Ensure the esophageal centerline extends through the gastroesophageal junction and into the gastric fundus, where the TG window actually originates. If the centerline ends at the diaphragmatic hiatus, the probe cannot reach the correct position.
4. **Add a dedicated TG-specific centerline segment:** The gastric probe position has very different geometry from the esophageal segment. The probe in the stomach lies nearly horizontal, anteflexed sharply to aim superiorly at the heart through the diaphragm.

---

## Appendix: Sources

- [ASE/SCA Guidelines for Performing a Comprehensive Multiplane TEE Exam (PDF)](https://www.asecho.org/wp-content/uploads/2013/05/Performing-a-Comprehensive-Multiplane-TEE-Exam.pdf)
- [TEE Mid-esophageal Views -- Echocardiographer.org](https://www.echocardiographer.org/tee-midesophageal)
- [An Update on TEE Views 2016: 2D vs 3D -- PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC5100243/)
- [TEE Standard Views -- University of Toronto HTML5 App](https://pie.med.utoronto.ca/TEE/TEE_content/assets/applications/standardViewsHTML5/TEE-HTML5-SV/index.html)
- [The 11 TEE Windows -- Show Me The POCUS](https://www.showmethepocus.com/the-11-tee-windows)
- [Focused TEE -- Radiology Key](https://radiologykey.com/focused-transesophageal-echocardiography/)
- [ME Four-Chamber View -- Medmastery](https://www.medmastery.com/magazine/midesophageal-fourchamber-view-transesophageal-echo-teethe-nuts-and-bolts)
