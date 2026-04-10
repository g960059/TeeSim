# TeeSim v0.2 Review: 3D Anatomy Model & Visual Fidelity

**Date:** 2026-04-10  
**Status:** Draft Review  
**Author:** Gemini CLI  

## Executive Summary
Review of TeeSim v0.2 reveals a significant gap between the functional correctness of the simulation (TEE views, motion, label-driven echo) and the visual fidelity of the 3D anatomy reference pane. The primary user concern—that the 3D model is "unrecognizable and wireframe-like"—is substantiated by the current implementation's reliance on abstract chamber segmentations and a lack of proper asset integration.

## 1. Analysis of the 3D Anatomy Model

### 1.1. Abstract Representation (Chambers vs. Anatomy)
The current 3D model in `lctsc_s1_006` consists of segmented chamber volumes (the "blood pools" inside the heart). While technically accurate for generating the echo appearance, this is **not what a heart looks like to a clinician**.
- **Issue:** Clinicians expect to see the external surface of the heart (myocardium, atria, ventricles) and the great vessels. Segmented blobs of blood are abstract and difficult to orient.
- **Impact:** The model feels "unrecognizable" because it lacks the familiar external morphology of the heart.

### 1.2. Visual Fidelity & Rendering
- **Lack of Color Coding:** The 3D actors currently use default GLB materials or white/gray tones. They do not follow the clinical standard (Left=Red, Right=Blue) used in the 2D overlays.
- **Lighting & Materials:** The `vtk-helpers.ts` setup lacks explicit light sources or high-quality material definitions (PBR). This results in a "flat" or "dark" appearance where depth is hard to perceive.
- **Voxelation Artifacts:** Meshes derived from TotalSegmentator without post-processing often exhibit "stair-stepping" voxelation. This can be interpreted by users as "wireframe-like" or low-quality.

### 1.3. Missing Valve Integration
- **Manifest Omission:** While `valve_meshes.glb` exists in the `public/cases/0.1.0/lctsc_s1_006/` directory, it is **missing from the `case_manifest.json`**.
- **Result:** The parametric valve leaflets (Mitral, Aortic, etc.) are never loaded into the 3D scene. In a TEE simulator, the valves are the most recognizable landmarks; their absence makes the internal heart structure look hollow and empty.

### 1.4. Placeholder UX
- **Wireframe Fallback:** The `Scene3DPane` shows a wireframe box placeholder (`createPlaceholderBoxActor`) whenever `meshes.length === 0`.
- **Issue:** During the initial load (which can take 1-3 seconds), or if a model fails to load, the user is presented with a literal wireframe box. This likely contributes to the "wireframe-like" feedback.

## 2. Recommendations for Improvement

### Phase 1: Immediate Fixes (v0.2.1)
1.  **Update Manifests:** Add `valve_meshes.glb` to the `assets` section of the `case_manifest.json` for all cases and ensure `loadCaseBundle` supports arbitrary GLB mesh lists.
2.  **Apply Clinical Color Coding:** In `Scene3DPane.tsx`, map loaded actors to the `LABEL_COLORS` based on their names (e.g., actors named "left_ventricle" should be red).
3.  **Improve Lighting:** Add a standard three-point lighting setup or an environment light to the `vtkRenderer` to highlight surface depth.
4.  **Replace Placeholder:** Change the wireframe box fallback to a "Loading..." spinner or a more professional "No Data" state that doesn't look like a debug wireframe.

### Phase 2: Structural Improvements (v0.3)
1.  **Anatomical Shell:** Source or generate an external heart surface model (myocardium) to act as a "shell" for the chamber segmentations. This provides the recognizable "heart shape" clinicians expect.
2.  **Mesh Smoothing:** Integrate a smoothing pass (e.g., Laplacian smoothing in the asset pipeline) to remove voxelation artifacts from segmentation-derived meshes.
3.  **Material Properties:** Use PBR materials with appropriate specular highlights for the myocardium and high-reflectivity (white/yellow) for the valve leaflets.
4.  **Transparency Control:** Implement a transparency slider for the 3D pane, allowing users to see through the myocardium to the internal chambers and valves.

## 3. Conclusion
The "unrecognizable" nature of the current 3D model is a combination of **abstract data selection** (showing blood instead of muscle) and **missing assets** (valves omitted from manifest). By aligning the 3D visual language with clinical standards (color, external morphology) and fixing the asset pipeline integration, the 3D pane can become the high-value reference tool intended for the simulator.
