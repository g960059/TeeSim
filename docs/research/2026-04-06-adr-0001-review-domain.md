# ADR-0001 Domain Review: Medical Imaging and TEE Perspective

**Date:** 2026-04-06  
**Status:** Review note  
**Subject:** [`ADR-0001-mvp-architecture`](../decisions/ADR-0001-mvp-architecture.md)

## 1. Overall Assessment

ADR-0001 is directionally strong for an education-first MVP. It correctly centers the architecture on probe pose, synchronized reslicing, offline asset authoring, and explicit data governance instead of over-investing in frontend polish. From a medical-imaging and TEE-domain perspective, however, the ADR is still underspecified in the places that most directly determine fidelity: distal probe mechanics, patient-space coordinate conventions, the exact reslice primitive in VTK.js, and what the project means by "pseudo-TEE." The current design is viable as a browser-based spatial tutor, but only if it is framed and implemented as anatomically grounded sectorized MPR rather than as a realistic ultrasound simulator.

## 2. Domain-Specific Strengths

- The 5-DOF `ProbePose` is the right top-level control contract for an educational TEE simulator. Advance/withdraw, axial rotation, ante/retroflexion, lateral flexion, and multiplane angle map cleanly to how trainees are taught to think about probe manipulation.
- Splitting the runtime volumes into `heart_intensity.vti` and `heart_labels.vti` is the correct medical-imaging choice. Continuous intensity data and discrete labels have different sampling semantics and should not be forced through one scalar volume.
- The offline 3D Slicer + SlicerHeart factory is the right authoring environment. Standard-view authoring, landmark placement, and anatomy QA belong in a clinical imaging toolchain, not in browser code.
- The chosen 10-view set is clinically defensible for MVP. The ME 4C / 2C / LAX triad plus TG mid SAX, AV SAX/LAX, RV inflow-outflow, and bicaval views cover the core manipulations defined in the ASE/SCA comprehensive adult TEE framework.
- Explicit JSON sidecars for `views.json`, `probe_path.json`, and `landmarks.json` are preferable to hiding anatomy metadata in mesh files. They make clinical review, regression testing, and future case authoring much easier.

## 3. Domain-Specific Weaknesses & Gaps

1. **The 5 DOF are sufficient as UI state, but not as a full probe mechanics model.**  
   ADR-0001 defines `ProbePose` but not the actual distal-tip geometry that converts that state into a scan plane. In real TEE, roll is applied about the shaft axis, ante/lateral flex are applied over a short distal bending section, and multiplane rotation is applied about the transducer axis at the tip, not about the shaft centerline. Without an explicit distal bending segment length, transducer origin offset, and local tip frame, the same `ProbePose` can generate the wrong plane.  
   **Suggested fix:** add a normative mechanical model in `@teesim/core`, including shaft frame, distal bending arc, tip frame, transducer origin, and sector axis definitions.

2. **Frame computation must be elevated from an implementation detail to an ADR requirement.**  
   The data-pipeline proposal correctly mentions parallel transport, but ADR-0001 does not. A naive Frenet frame will flip unpredictably in low-curvature or near-inflection segments of the esophageal path, which would make roll and omniplane behavior clinically wrong.  
   **Suggested fix:** require `probe_path.json` to carry arc-length samples plus a parallel-transport reference frame, or require the runtime to derive one deterministically from the centerline.

3. **The coordinate-system contract is incomplete for medical data.**  
   DICOM image geometry is defined by `ImagePositionPatient (0020,0032)` and `ImageOrientationPatient (0020,0037)` in the patient LPS frame. Slicer commonly works in RAS. glTF/GLB will not preserve DICOM semantics by itself. The ADR says "normalize to NIfTI RAS-mm," which is reasonable, but it does not require explicit affine validation between images, meshes, and landmarks. A silent sign error here will mirror left and right heart anatomy.  
   **Suggested fix:** include explicit `worldFromImage` and `worldFromMesh` affines in `case_manifest.json`, and validate image bounds, landmark positions, and mesh centroids against those affines in CI.

4. **The proposed VTK.js primitive is not quite aligned with the stated sampling requirements.**  
   ADR-0001 assumes `vtkImageReslice` can be the core reslice engine for both panes while also implying linear interpolation for intensity data and nearest-neighbor sampling for labels. In current VTK.js, `vtkImageReslice.setInterpolationMode(...)` documents that only nearest-neighbor interpolation is supported. That is acceptable for labels, but not for a visually stable intensity slice.  
   **Suggested fix:** spike the MVP on `vtkImageResliceMapper` + `vtkImageProperty.setInterpolationType(...)` for the intensity slice, and keep discrete label sampling in a separate nearest-neighbor pass. If `vtkImageReslice` is retained, accept visibly blockier output and document that tradeoff.

5. **A true TEE image is not an infinitesimal plane; the MVP currently models one.**  
   Real multiplane TEE has finite elevational beam thickness, depth-dependent beam width, and angle-dependent specular behavior. A single 2D plane through CT or label data is an MPR, not an ultrasound acquisition model. This is especially important for valve annuli, septa, and great-vessel walls, which can disappear or appear too abruptly in a zero-thickness slice.  
   **Suggested fix:** model the MVP image as a thick-slab sectorized slice, not a zero-thickness plane. `vtkImageResliceMapper.setSlabThickness(...)` or `vtkImageReslice.setSlabNumberOfSlices(...)` can approximate elevational thickness well enough for education.

6. **The current "pseudo-TEE" framing overpromises fidelity.**  
   CT intensity plus label lookup can produce a sector-shaped anatomical image with grayscale remapping, but it does not reproduce acoustic shadowing, dropout, reverberation, anisotropic backscatter, or gain/TGC behavior. If the UI presents that output as "TEE-like ultrasound" without qualification, it will teach the wrong mental model for image appearance even if the slice geometry is correct.  
   **Suggested fix:** explicitly position the MVP output as a "sectorized anatomical slice" or "anatomy-derived pseudo-TEE," and keep the rendering claims limited to spatial reasoning and view-finding.

7. **The centerline extraction plan is sound in spirit but too optimistic for CT esophagus anatomy.**  
   The proposal speaks in terms of lumen extraction and VMTK. In real thoracic CT, the esophagus is frequently collapsed or partially fluid-filled, and many segmentations represent the organ wall volume rather than a clean lumen. Around the gastroesophageal junction, a lumen-style centerline can drift or bifurcate into the stomach in non-physiologic ways.  
   **Suggested fix:** derive the path from the segmented esophagus/stomach organ volume or its medial axis, not from an assumed lumen. Add QA on path clearance, curvature radius, and GE-junction continuity, not just inside-mask fraction.

8. **A centerline-only probe constraint is a reasonable simplification, but it is not physically neutral.**  
   Several clinically important maneuvers are achieved by probe-wall contact and eccentric pressure, especially transgastric views and some bicaval fine-tuning. A probe that is always constrained to the centerline can generate physically impossible TG or ME positions that still look plausible in 3D.  
   **Suggested fix:** either disclose this explicitly as an MVP simplification or introduce a small radial-offset/contact model with collision constraints in a later phase.

9. **The chosen views are good overall, but the aortic naming and scoring targets need cleanup.**  
   The 10-view set is clinically reasonable, but the repository currently mixes "ascending aorta" and "aortic arch" terminology across documents. Those are not interchangeable ASE/SCA views. Also, combining descending aortic SAX/LAX as one teaching unit is good pedagogy, but they should still exist as separate scoring targets because the image orientation and visible structures differ meaningfully between 0 deg and 90 deg.  
   **Suggested fix:** normalize all view IDs and labels to ASE/SCA names, and keep combined tutorials if desired while storing separate target presets for Desc Ao SAX and Desc Ao LAX.

10. **Thin structures will not be reliable if the scoring engine depends on a 0.8 mm `uint8` label volume alone.**  
    Valve leaflets, interatrial septum, coronary sinus, pulmonary vein ostia, and thin aortic cusps are below or near the effective resolution of the proposed label volume. A visibility rule that depends on voxel intersection will be unstable and may teach the wrong view boundaries.  
    **Suggested fix:** reserve label-volume scoring for chambers and large vessels. Represent thin structures with landmarks, mesh-derived surfaces, or structure-specific signed-distance masks instead of raw voxel occupancy.

11. **The future DICOM route is underspecified for real 3D/4D TEE.**  
    Treating Phase 2 as "VTI today, DICOMweb later" is fine for CT/MR. It is not enough for real volumetric TEE. Ultrasound DICOM commonly arrives as scan-converted or vendor-specific volumetric data with geometry that is not equivalent to a Cartesian CT volume. Cornerstone3D helps with DICOM transport, but it does not remove the need for ultrasound-specific geometry handling.  
    **Suggested fix:** scope the future DICOM route explicitly as CT/MR first, or define a separate ultrasound-volume path that can handle vendor geometry and scan conversion.

## 4. Clinical Accuracy Risks

- **Left-right mirroring or view inversion risk.** A single unnoticed LPS↔RAS or mesh-axis sign error will produce anatomically wrong chamber orientation while still rendering something that looks plausible.
- **False-positive view matches.** A weighted 5-DOF distance alone can award a green match to a plane that is mechanically close but clinically non-standard. ASE views are defined by visible structures and orientation, not only by probe knob settings.
- **Transgastric realism risk.** A centerline-only probe model may let the user obtain TG-like slices without the wall apposition and anteflexion mechanics that are essential in real TEE.
- **Thin-structure disappearance.** Valve, septal, and venous structures may flicker in and out of view if the simulator relies on coarse voxel labels, leading to incorrect view-validation behavior.
- **Appearance-transfer risk.** If users read the pseudo-TEE pane as ultrasound rather than anatomy-derived MPR, they may learn incorrect brightness and artifact expectations that do not transfer to clinical TEE.
- **Phase mismatch risk.** If motion is later added from an external prior, view presets and scoring must declare the reference cardiac phase. Otherwise the same view may appear "wrong" simply because the anatomy is in a different phase.

## 5. Verdict

**Accept-with-changes.** The ADR is a sound MVP architecture for a browser-based TEE spatial tutor, but it should not be accepted as clinically grounded until it explicitly defines the probe mechanical model, centerline/frame computation, coordinate-system contract, VTK.js reslice path, and the scope limits of the pseudo-TEE image. If those changes are made, the architecture is appropriate for MVP. If they are not, the highest-probability failure mode is a simulator that is visually convincing but spatially and pedagogically wrong in subtle ways.
