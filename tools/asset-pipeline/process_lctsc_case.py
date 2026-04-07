#!/usr/bin/env python3
"""
Process an LCTSC TCIA case into TeeSim browser-ready assets.

Input: DICOM CT + RTSTRUCT
Output: scene.glb, heart_detail.glb, heart_roi.vti, probe_path.json, landmarks.json, case_manifest.json

Usage:
    python process_lctsc_case.py \
        --ct-dir data/raw/lctsc-s1-006/ct_dicom \
        --rt-file data/raw/lctsc-s1-006/rt_dicom/00000001.dcm \
        --output-dir public/cases/lctsc_s1_006
"""

import argparse
import json
import os
import struct
import sys
from datetime import datetime, timezone

import numpy as np

# Medical imaging
import SimpleITK as sitk
import pydicom

# 3D processing
import vtk
from vtk.util.numpy_support import numpy_to_vtk, vtk_to_numpy

# Mesh export
import trimesh


def load_ct_volume(ct_dir: str) -> sitk.Image:
    """Load CT DICOM series as SimpleITK Image."""
    reader = sitk.ImageSeriesReader()
    dicom_files = reader.GetGDCMSeriesFileNames(ct_dir)
    if not dicom_files:
        raise ValueError(f"No DICOM files found in {ct_dir}")
    reader.SetFileNames(dicom_files)
    image = reader.Execute()
    print(f"  CT loaded: {image.GetSize()}, spacing={image.GetSpacing()}, origin={image.GetOrigin()}")
    return image


def parse_rtstruct(rt_file: str, ct_image: sitk.Image) -> dict[str, sitk.Image]:
    """Parse RTSTRUCT and create binary label masks for each structure."""
    ds = pydicom.dcmread(rt_file)

    # Get structure names
    structures = {}
    if hasattr(ds, 'StructureSetROISequence'):
        for roi in ds.StructureSetROISequence:
            structures[roi.ROINumber] = roi.ROIName

    print(f"  RTSTRUCT structures: {list(structures.values())}")

    ct_size = ct_image.GetSize()
    ct_spacing = ct_image.GetSpacing()
    ct_origin = ct_image.GetOrigin()
    ct_direction = ct_image.GetDirection()

    masks = {}

    if hasattr(ds, 'ROIContourSequence'):
        for roi_contour in ds.ROIContourSequence:
            roi_number = roi_contour.ReferencedROINumber
            name = structures.get(roi_number, f"ROI_{roi_number}")

            if not hasattr(roi_contour, 'ContourSequence'):
                continue

            # Create empty mask
            mask_array = np.zeros(ct_size[::-1], dtype=np.uint8)

            for contour in roi_contour.ContourSequence:
                if contour.ContourGeometricType != 'CLOSED_PLANAR':
                    continue

                points = np.array(contour.ContourData).reshape(-1, 3)

                # Convert physical points to voxel indices
                for point in points:
                    idx = ct_image.TransformPhysicalPointToIndex(point.tolist())
                    if all(0 <= idx[i] < ct_size[i] for i in range(3)):
                        mask_array[idx[2], idx[1], idx[0]] = 1

            # Fill contours slice by slice using morphological operations
            from scipy import ndimage
            for z in range(mask_array.shape[0]):
                if mask_array[z].any():
                    mask_array[z] = ndimage.binary_fill_holes(mask_array[z]).astype(np.uint8)

            mask = sitk.GetImageFromArray(mask_array)
            mask.CopyInformation(ct_image)
            masks[name.lower().replace(' ', '_')] = mask
            print(f"    {name}: {np.sum(mask_array)} voxels")

    return masks


def create_mesh_from_mask(mask: sitk.Image, label_value: int = 1) -> trimesh.Trimesh:
    """Create a mesh from a binary mask using marching cubes."""
    arr = sitk.GetArrayFromImage(mask)
    spacing = mask.GetSpacing()
    origin = mask.GetOrigin()

    # Use VTK marching cubes
    vtk_data = vtk.vtkImageData()
    vtk_data.SetDimensions(arr.shape[2], arr.shape[1], arr.shape[0])
    vtk_data.SetSpacing(spacing)
    vtk_data.SetOrigin(origin)

    flat = arr.flatten(order='C').astype(np.float32)
    vtk_arr = numpy_to_vtk(flat, deep=True)
    vtk_data.GetPointData().SetScalars(vtk_arr)

    # Marching cubes
    mc = vtk.vtkMarchingCubes()
    mc.SetInputData(vtk_data)
    mc.SetValue(0, 0.5)
    mc.Update()

    poly = mc.GetOutput()
    if poly.GetNumberOfPoints() == 0:
        return None

    # Smooth
    smoother = vtk.vtkWindowedSincPolyDataFilter()
    smoother.SetInputData(poly)
    smoother.SetNumberOfIterations(20)
    smoother.SetPassBand(0.1)
    smoother.Update()
    poly = smoother.GetOutput()

    # Decimate
    decimate = vtk.vtkQuadricDecimation()
    decimate.SetInputData(poly)
    decimate.SetTargetReduction(0.8)  # Keep 20% of triangles
    decimate.Update()
    poly = decimate.GetOutput()

    # Convert to trimesh
    points = vtk_to_numpy(poly.GetPoints().GetData())

    cells = poly.GetPolys()
    cells.InitTraversal()
    faces = []
    id_list = vtk.vtkIdList()
    while cells.GetNextCell(id_list):
        if id_list.GetNumberOfIds() == 3:
            faces.append([id_list.GetId(0), id_list.GetId(1), id_list.GetId(2)])

    if not faces:
        return None

    mesh = trimesh.Trimesh(vertices=points, faces=np.array(faces))
    print(f"    Mesh: {len(mesh.vertices)} verts, {len(mesh.faces)} faces")
    return mesh


def export_glb(meshes: dict[str, trimesh.Trimesh], output_path: str):
    """Export multiple meshes as a single GLB file."""
    scene = trimesh.Scene()
    for name, mesh in meshes.items():
        if mesh is not None and len(mesh.faces) > 0:
            scene.add_geometry(mesh, geom_name=name)

    scene.export(output_path, file_type='glb')
    size_mb = os.path.getsize(output_path) / 1e6
    print(f"  Exported {output_path}: {size_mb:.1f} MB")


def export_vti(ct_image: sitk.Image, masks: dict, output_path: str, roi_center: list, roi_size_mm: list = [200, 200, 280]):
    """Export a cropped cardiac ROI as VTI."""
    spacing = ct_image.GetSpacing()

    # Compute ROI in voxel coordinates
    roi_start_phys = [roi_center[i] - roi_size_mm[i] / 2 for i in range(3)]
    roi_start_idx = ct_image.TransformPhysicalPointToIndex(roi_start_phys)
    roi_size_vox = [int(roi_size_mm[i] / spacing[i]) for i in range(3)]

    # Clamp to image bounds
    ct_size = ct_image.GetSize()
    roi_start_idx = [max(0, min(roi_start_idx[i], ct_size[i] - 1)) for i in range(3)]
    roi_size_vox = [min(roi_size_vox[i], ct_size[i] - roi_start_idx[i]) for i in range(3)]

    # Extract ROI
    roi = sitk.RegionOfInterest(ct_image, roi_size_vox, roi_start_idx)

    # Resample to 0.8mm isotropic
    target_spacing = [0.8, 0.8, 0.8]
    target_size = [int(roi_size_vox[i] * spacing[i] / target_spacing[i]) for i in range(3)]

    resampler = sitk.ResampleImageFilter()
    resampler.SetSize(target_size)
    resampler.SetOutputSpacing(target_spacing)
    resampler.SetOutputOrigin(roi.GetOrigin())
    resampler.SetOutputDirection(roi.GetDirection())
    resampler.SetInterpolator(sitk.sitkLinear)
    resampled = resampler.Execute(roi)

    # Convert to VTK and write VTI
    arr = sitk.GetArrayFromImage(resampled).astype(np.int16)
    origin = resampled.GetOrigin()

    vtk_data = vtk.vtkImageData()
    vtk_data.SetDimensions(arr.shape[2], arr.shape[1], arr.shape[0])
    vtk_data.SetSpacing(target_spacing)
    vtk_data.SetOrigin(origin)

    flat = arr.flatten(order='C')
    vtk_arr = numpy_to_vtk(flat, deep=True, array_type=vtk.VTK_SHORT)
    vtk_data.GetPointData().SetScalars(vtk_arr)

    writer = vtk.vtkXMLImageDataWriter()
    writer.SetFileName(output_path)
    writer.SetInputData(vtk_data)
    writer.SetCompressorTypeToZLib()
    writer.Write()

    size_mb = os.path.getsize(output_path) / 1e6
    print(f"  Exported {output_path}: {size_mb:.1f} MB, dims={arr.shape}")
    return resampled  # Return the resampled image for use as reference grid


def run_totalsegmentator(ct_image: sitk.Image, output_dir: str) -> dict[str, sitk.Image]:
    """Run TotalSegmentator on CT to get per-structure label masks."""
    import tempfile

    # Save CT as temporary NIfTI for TotalSegmentator
    tmp_ct = os.path.join(output_dir, '_tmp_ct.nii.gz')
    sitk.WriteImage(ct_image, tmp_ct)

    # Run 'total' task (open license, covers: heart, aorta, esophagus, SVC, IVC, lungs, pulmonary_vein)
    tmp_seg_dir = os.path.join(output_dir, '_tmp_totalseg')
    os.makedirs(tmp_seg_dir, exist_ok=True)

    print("  Running TotalSegmentator 'total' task (CPU, may take 5-10 min)...")
    try:
        from totalsegmentator.python_api import totalsegmentator
        totalsegmentator(tmp_ct, tmp_seg_dir, task='total', fast=True, device='cpu', verbose=True)
    except Exception as e:
        print(f"  TotalSegmentator failed: {e}")
        return {}

    # Load relevant structure masks
    STRUCTURE_MAP = {
        'heart': ('heart.nii.gz', 7),
        'aorta': ('aorta.nii.gz', 1),
        'pulmonary_vein': ('pulmonary_vein.nii.gz', 2),
        'superior_vena_cava': ('superior_vena_cava.nii.gz', 3),
        'inferior_vena_cava': ('inferior_vena_cava.nii.gz', 4),
        'esophagus': ('esophagus.nii.gz', 5),
    }

    # Also load lung lobes and merge
    LUNG_FILES = [
        'lung_upper_lobe_left.nii.gz', 'lung_lower_lobe_left.nii.gz',
        'lung_upper_lobe_right.nii.gz', 'lung_middle_lobe_right.nii.gz', 'lung_lower_lobe_right.nii.gz',
    ]

    masks = {}
    for name, (filename, label_id) in STRUCTURE_MAP.items():
        fpath = os.path.join(tmp_seg_dir, filename)
        if os.path.exists(fpath):
            masks[name] = (sitk.ReadImage(fpath), label_id)
            print(f"    Loaded {name} (label {label_id})")
        else:
            print(f"    Missing {filename}")

    # Merge lung lobes into single lung mask
    lung_mask = None
    for lf in LUNG_FILES:
        fpath = os.path.join(tmp_seg_dir, lf)
        if os.path.exists(fpath):
            m = sitk.ReadImage(fpath)
            if lung_mask is None:
                lung_mask = m
            else:
                lung_mask = sitk.Or(lung_mask, m)
    if lung_mask is not None:
        masks['lung'] = (lung_mask, 6)
        print(f"    Merged lungs (label 6)")

    # Try heartchambers_highres (requires separate license)
    # Skip entirely for now — academic license must be obtained first
    # See: https://backend.totalsegmentator.com/license-academic/
    print("  Skipping 'heartchambers_highres' (requires license). Using 'total' task labels only.")

    # Cleanup temp CT file (keep segmentation dir for debugging)
    try:
        if os.path.exists(tmp_ct):
            os.remove(tmp_ct)
    except OSError:
        pass

    return masks


def export_label_vti(masks: dict, reference_vti: sitk.Image, output_path: str):
    """Export a combined label VTI aligned to the intensity VTI grid.

    Uses the intensity VTI as reference to guarantee exact grid alignment.
    """
    # Create empty label volume on the reference grid
    ref_arr = sitk.GetArrayFromImage(reference_vti)
    label_arr = np.zeros(ref_arr.shape, dtype=np.uint8)

    # Sort by label ID (lower IDs get overwritten by higher = higher priority)
    sorted_masks = sorted(masks.items(), key=lambda x: x[1][1])

    for name, (mask_img, label_id) in sorted_masks:
        # Resample mask to reference grid with nearest-neighbor
        resampled = sitk.Resample(
            mask_img,
            reference_vti,
            sitk.Transform(),
            sitk.sitkNearestNeighbor,
            0,  # default pixel value
            mask_img.GetPixelID(),
        )
        mask_arr = sitk.GetArrayFromImage(resampled)
        label_arr[mask_arr > 0] = label_id
        nonzero = int((mask_arr > 0).sum())
        print(f"    {name} (ID={label_id}): {nonzero} voxels in ROI")

    # Convert to VTK
    origin = reference_vti.GetOrigin()
    spacing = reference_vti.GetSpacing()

    vtk_data = vtk.vtkImageData()
    vtk_data.SetDimensions(label_arr.shape[2], label_arr.shape[1], label_arr.shape[0])
    vtk_data.SetSpacing(spacing)
    vtk_data.SetOrigin(origin)

    flat = label_arr.flatten(order='C')
    vtk_arr = numpy_to_vtk(flat, deep=True, array_type=vtk.VTK_UNSIGNED_CHAR)
    vtk_data.GetPointData().SetScalars(vtk_arr)

    writer = vtk.vtkXMLImageDataWriter()
    writer.SetFileName(output_path)
    writer.SetInputData(vtk_data)
    writer.SetCompressorTypeToZLib()
    writer.Write()

    unique_labels = np.unique(label_arr)
    size_mb = os.path.getsize(output_path) / 1e6
    print(f"  Exported {output_path}: {size_mb:.1f} MB, labels={unique_labels.tolist()}")


def generate_probe_path(esophagus_mask: sitk.Image, heart_center: np.ndarray | None = None) -> dict:
    """Generate esophageal centerline from esophagus segmentation."""
    arr = sitk.GetArrayFromImage(esophagus_mask)
    spacing = esophagus_mask.GetSpacing()
    origin = esophagus_mask.GetOrigin()

    # Find centroid per slice (Z axis)
    points = []
    for z in range(arr.shape[0]):
        coords = np.argwhere(arr[z] > 0)
        if len(coords) > 5:
            cy, cx = coords.mean(axis=0)
            # Convert to physical coordinates (RAS)
            phys = [
                origin[0] + cx * spacing[0],
                origin[1] + cy * spacing[1],
                origin[2] + z * spacing[2],
            ]
            points.append(phys)

    if len(points) < 20:
        print("  WARNING: Esophagus segmentation too sparse, generating synthetic path")
        return generate_synthetic_probe_path(origin, spacing, arr.shape)

    points = np.array(points)

    # Resample at 1mm intervals
    from scipy.interpolate import CubicSpline
    arc_lengths = [0.0]
    for i in range(1, len(points)):
        d = np.linalg.norm(points[i] - points[i - 1])
        arc_lengths.append(arc_lengths[-1] + d)

    arc_lengths = np.array(arc_lengths)
    total_length = arc_lengths[-1]

    # Resample
    target_s = np.arange(0, total_length, 1.0)
    cs_x = CubicSpline(arc_lengths, points[:, 0])
    cs_y = CubicSpline(arc_lengths, points[:, 1])
    cs_z = CubicSpline(arc_lengths, points[:, 2])

    resampled = np.column_stack([cs_x(target_s), cs_y(target_s), cs_z(target_s)])

    # Compute parallel-transport frames
    tangents = np.gradient(resampled, axis=0)
    tangents = tangents / np.linalg.norm(tangents, axis=1, keepdims=True)

    # Initial normal: anatomical anterior direction.
    # In the patient coordinate system (LPS from SimpleITK), anterior = -Y.
    # The TEE transducer face always points anteriorly (toward the patient's chest).
    # We do NOT use the heart center — the probe can look at descending aorta
    # (posterior) by using shaft rotation (roll), not by flipping the normal.
    t0 = tangents[0]
    anterior_dir = np.array([0, -1, 0])  # anatomical anterior in LPS

    # Project anterior onto perpendicular to tangent
    ant_perp = anterior_dir - np.dot(anterior_dir, t0) * t0
    if np.linalg.norm(ant_perp) < 1e-6:
        # Tangent is nearly aligned with Y — use X as fallback
        ant_perp = np.array([1, 0, 0])
        ant_perp = ant_perp - np.dot(ant_perp, t0) * t0
    n0 = ant_perp / np.linalg.norm(ant_perp)

    normals = [n0]
    binormals = [np.cross(t0, n0)]

    # Parallel transport
    for i in range(1, len(tangents)):
        b = np.cross(tangents[i - 1], tangents[i])
        if np.linalg.norm(b) < 1e-10:
            normals.append(normals[-1])
        else:
            b = b / np.linalg.norm(b)
            angle = np.arccos(np.clip(np.dot(tangents[i - 1], tangents[i]), -1, 1))
            # Rodrigues rotation
            n_prev = normals[-1]
            cos_a, sin_a = np.cos(angle), np.sin(angle)
            n_new = n_prev * cos_a + np.cross(b, n_prev) * sin_a + b * np.dot(b, n_prev) * (1 - cos_a)
            normals.append(n_new / np.linalg.norm(n_new))
        binormals.append(np.cross(tangents[i], normals[-1]))

    normals = np.array(normals)
    binormals = np.array(binormals)

    # Ensure continuous normal orientation along the path.
    # Parallel transport is smooth but can accumulate sign flips.
    # We propagate: if frame i's normal flips relative to i-1, flip it back.
    # The initial frame was set to anatomical anterior, so propagation
    # maintains anterior-facing throughout without heart-center dependency.
    for i in range(1, len(normals)):
        if np.dot(normals[i], normals[i - 1]) < 0:
            normals[i] = -normals[i]
            binormals[i] = -binormals[i]

    # Verify: smooth centerline by additional spline smoothing of normals
    # to reduce abrupt tangent changes (e.g., near GEJ)
    from scipy.ndimage import uniform_filter1d
    for axis in range(3):
        normals[:, axis] = uniform_filter1d(normals[:, axis], size=5)
    # Re-normalize after smoothing
    norms = np.linalg.norm(normals, axis=1, keepdims=True)
    norms[norms < 1e-8] = 1
    normals = normals / norms
    # Recompute binormals from smoothed normals
    binormals = np.cross(tangents, normals)
    bin_norms = np.linalg.norm(binormals, axis=1, keepdims=True)
    bin_norms[bin_norms < 1e-8] = 1
    binormals = binormals / bin_norms

    # Define stations based on path length fractions
    total = target_s[-1]
    stations = [
        {"id": "UE", "sRangeMm": [0, total * 0.25]},
        {"id": "ME", "sRangeMm": [total * 0.25, total * 0.55]},
        {"id": "TG", "sRangeMm": [total * 0.55, total * 0.82]},
        {"id": "DTG", "sRangeMm": [total * 0.82, total]},
    ]

    path_data = {
        "schemaVersion": "1.0.0",
        "coordinateSystem": "RAS",
        "units": "mm",
        "sampleSpacingMm": 1.0,
        "points": resampled.tolist(),
        "arcLengthMm": target_s.tolist(),
        "frames": [
            {
                "tangent": tangents[i].tolist(),
                "normal": normals[i].tolist(),
                "binormal": binormals[i].tolist(),
            }
            for i in range(len(resampled))
        ],
        "stations": stations,
        "qa": {
            "totalLengthMm": float(total),
            "pointCount": len(resampled),
            "manualCorrection": False,
        },
    }

    print(f"  Probe path: {len(resampled)} points, {total:.1f} mm total")
    return path_data


def generate_synthetic_probe_path(origin, spacing, shape):
    """Fallback: generate a straight synthetic esophageal path."""
    center_x = origin[0] + shape[2] * spacing[0] / 2
    center_y = origin[1] + shape[1] * spacing[1] * 0.35  # Posterior
    z_start = origin[2] + shape[0] * spacing[2] * 0.2
    z_end = origin[2] + shape[0] * spacing[2] * 0.85

    n_points = int((z_end - z_start))
    points = []
    for i in range(n_points):
        t = i / max(n_points - 1, 1)
        z = z_start + t * (z_end - z_start)
        x = center_x + 5 * np.sin(t * np.pi * 0.5)  # Gentle S-curve
        y = center_y + 3 * np.cos(t * np.pi * 0.3)
        points.append([x, y, z])

    points = np.array(points)
    tangents = np.gradient(points, axis=0)
    tangents = tangents / np.linalg.norm(tangents, axis=1, keepdims=True)

    normals = np.zeros_like(tangents)
    normals[:, 0] = 1.0  # Simple X normal
    binormals = np.cross(tangents, normals)

    total = float(n_points - 1)
    return {
        "schemaVersion": "1.0.0",
        "coordinateSystem": "RAS",
        "units": "mm",
        "sampleSpacingMm": 1.0,
        "points": points.tolist(),
        "arcLengthMm": list(range(n_points)),
        "frames": [
            {"tangent": tangents[i].tolist(), "normal": normals[i].tolist(), "binormal": binormals[i].tolist()}
            for i in range(len(points))
        ],
        "stations": [
            {"id": "UE", "sRangeMm": [0, total * 0.25]},
            {"id": "ME", "sRangeMm": [total * 0.25, total * 0.55]},
            {"id": "TG", "sRangeMm": [total * 0.55, total * 0.82]},
            {"id": "DTG", "sRangeMm": [total * 0.82, total]},
        ],
        "qa": {"totalLengthMm": total, "pointCount": n_points, "manualCorrection": True},
    }


def compute_heart_center(masks: dict, ct_image: sitk.Image) -> list:
    """Compute the centroid of the heart mask."""
    if 'heart' in masks:
        arr = sitk.GetArrayFromImage(masks['heart'])
    else:
        # Combine all available masks
        combined = None
        for name, mask in masks.items():
            a = sitk.GetArrayFromImage(mask)
            if combined is None:
                combined = a.copy()
            else:
                combined = np.maximum(combined, a)
        arr = combined if combined is not None else np.ones((10, 10, 10))

    coords = np.argwhere(arr > 0)
    if len(coords) == 0:
        size = ct_image.GetSize()
        origin = ct_image.GetOrigin()
        spacing = ct_image.GetSpacing()
        return [origin[i] + size[i] * spacing[i] / 2 for i in range(3)]

    centroid_vox = coords.mean(axis=0)
    spacing = ct_image.GetSpacing()
    origin = ct_image.GetOrigin()

    return [
        origin[0] + centroid_vox[2] * spacing[0],
        origin[1] + centroid_vox[1] * spacing[1],
        origin[2] + centroid_vox[0] * spacing[2],
    ]


def generate_landmarks(masks: dict, ct_image: sitk.Image) -> dict:
    """Generate landmark points from structure centroids."""
    spacing = ct_image.GetSpacing()
    origin = ct_image.GetOrigin()

    landmarks = []
    for name, mask in masks.items():
        arr = sitk.GetArrayFromImage(mask)
        coords = np.argwhere(arr > 0)
        if len(coords) == 0:
            continue
        centroid = coords.mean(axis=0)
        position = [
            origin[0] + centroid[2] * spacing[0],
            origin[1] + centroid[1] * spacing[1],
            origin[2] + centroid[0] * spacing[2],
        ]
        landmarks.append({
            "id": f"{name}-centroid",
            "structureId": name,
            "position": [round(p, 1) for p in position],
        })

    return {
        "schemaVersion": "1.0.0",
        "coordinateSystem": "RAS",
        "units": "mm",
        "points": landmarks,
    }


def generate_views(probe_path: dict) -> list:
    """Generate 8 anchor view presets based on the probe path."""
    stations = {s["id"]: s["sRangeMm"] for s in probe_path["stations"]}
    me_mid = (stations["ME"][0] + stations["ME"][1]) / 2
    tg_mid = (stations["TG"][0] + stations["TG"][1]) / 2
    me_upper = stations["ME"][0] + (stations["ME"][1] - stations["ME"][0]) * 0.3

    return [
        {"id": "me-4c", "label": "ME Four-Chamber", "aseCode": "ME_4C", "station": "ME",
         "probePose": {"sMm": round(me_mid), "rollDeg": 0, "anteDeg": -5, "lateralDeg": 0, "omniplaneDeg": 0},
         "targetStructures": ["heart", "esophagus"], "tolerance": {"sMm": 15, "angleDeg": 12},
         "validation": {"status": "pending", "approvedBy": None, "approvedAt": None}},
        {"id": "me-2c", "label": "ME Two-Chamber", "aseCode": "ME_2C", "station": "ME",
         "probePose": {"sMm": round(me_mid), "rollDeg": 0, "anteDeg": -5, "lateralDeg": 0, "omniplaneDeg": 65},
         "targetStructures": ["heart"], "tolerance": {"sMm": 15, "angleDeg": 12},
         "validation": {"status": "pending", "approvedBy": None, "approvedAt": None}},
        {"id": "me-lax", "label": "ME Long-Axis", "aseCode": "ME_LAX", "station": "ME",
         "probePose": {"sMm": round(me_mid), "rollDeg": 0, "anteDeg": -5, "lateralDeg": 0, "omniplaneDeg": 130},
         "targetStructures": ["heart"], "tolerance": {"sMm": 15, "angleDeg": 15},
         "validation": {"status": "pending", "approvedBy": None, "approvedAt": None}},
        {"id": "tg-mid-sax", "label": "TG Mid Short-Axis", "aseCode": "TG_MID_SAX", "station": "TG",
         "probePose": {"sMm": round(tg_mid), "rollDeg": 0, "anteDeg": 20, "lateralDeg": 0, "omniplaneDeg": 10},
         "targetStructures": ["heart"], "tolerance": {"sMm": 20, "angleDeg": 15},
         "validation": {"status": "pending", "approvedBy": None, "approvedAt": None}},
        {"id": "me-av-sax", "label": "ME AV Short-Axis", "aseCode": "ME_AV_SAX", "station": "ME",
         "probePose": {"sMm": round(me_upper), "rollDeg": 0, "anteDeg": 0, "lateralDeg": 0, "omniplaneDeg": 40},
         "targetStructures": ["heart"], "tolerance": {"sMm": 12, "angleDeg": 12},
         "validation": {"status": "pending", "approvedBy": None, "approvedAt": None}},
        {"id": "me-av-lax", "label": "ME AV Long-Axis", "aseCode": "ME_AV_LAX", "station": "ME",
         "probePose": {"sMm": round(me_upper), "rollDeg": 0, "anteDeg": 0, "lateralDeg": 0, "omniplaneDeg": 130},
         "targetStructures": ["heart"], "tolerance": {"sMm": 12, "angleDeg": 15},
         "validation": {"status": "pending", "approvedBy": None, "approvedAt": None}},
        {"id": "me-rv-io", "label": "ME RV Inflow-Outflow", "aseCode": "ME_RV_IO", "station": "ME",
         "probePose": {"sMm": round(me_mid), "rollDeg": 0, "anteDeg": 0, "lateralDeg": 10, "omniplaneDeg": 75},
         "targetStructures": ["heart"], "tolerance": {"sMm": 15, "angleDeg": 15},
         "validation": {"status": "pending", "approvedBy": None, "approvedAt": None}},
        {"id": "me-bicaval", "label": "ME Bicaval", "aseCode": "ME_BICAVAL", "station": "ME",
         "probePose": {"sMm": round(me_mid - 5), "rollDeg": 10, "anteDeg": 0, "lateralDeg": 0, "omniplaneDeg": 95},
         "targetStructures": ["heart"], "tolerance": {"sMm": 15, "angleDeg": 15},
         "validation": {"status": "pending", "approvedBy": None, "approvedAt": None}},
    ]


def main():
    parser = argparse.ArgumentParser(description="Process LCTSC case for TeeSim")
    parser.add_argument("--ct-dir", required=True)
    parser.add_argument("--rt-file", required=True)
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    # 1. Load CT
    print("1. Loading CT volume...")
    ct_image = load_ct_volume(args.ct_dir)

    # 2. Parse RTSTRUCT
    print("2. Parsing RTSTRUCT contours...")
    try:
        from scipy import ndimage  # noqa: F401
        masks = parse_rtstruct(args.rt_file, ct_image)
    except ImportError:
        print("  scipy not available, using simplified contour parsing")
        masks = {}

    if not masks:
        print("  WARNING: No valid masks extracted. Creating whole-body mask.")
        arr = sitk.GetArrayFromImage(ct_image)
        body_mask = (arr > -300).astype(np.uint8)
        mask_img = sitk.GetImageFromArray(body_mask)
        mask_img.CopyInformation(ct_image)
        masks = {"heart": mask_img}

    # 3. Generate meshes
    print("3. Generating meshes...")
    scene_meshes = {}
    heart_meshes = {}
    for name, mask in masks.items():
        print(f"  Processing {name}...")
        mesh = create_mesh_from_mask(mask)
        if mesh is not None:
            if name in ('heart', 'heart_wall'):
                heart_meshes[name] = mesh
            scene_meshes[name] = mesh

    # 4. Export GLB
    print("4. Exporting GLB files...")
    if scene_meshes:
        export_glb(scene_meshes, os.path.join(args.output_dir, "scene.glb"))
    if heart_meshes:
        export_glb(heart_meshes, os.path.join(args.output_dir, "heart_detail.glb"))
    elif scene_meshes:
        export_glb(scene_meshes, os.path.join(args.output_dir, "heart_detail.glb"))

    # 5. Export VTI
    print("5. Exporting VTI volume...")
    heart_center = compute_heart_center(masks, ct_image)
    print(f"  Heart center: {heart_center}")
    reference_vti = export_vti(ct_image, masks, os.path.join(args.output_dir, "heart_roi.vti"), heart_center)

    # 5b. Run TotalSegmentator for label segmentation
    print("5b. Running TotalSegmentator for label segmentation...")
    ts_masks = run_totalsegmentator(ct_image, args.output_dir)

    # 5c. Export label VTI (aligned to intensity VTI grid)
    if ts_masks and reference_vti is not None:
        print("5c. Exporting label VTI...")
        export_label_vti(ts_masks, reference_vti, os.path.join(args.output_dir, "heart_labels.vti"))
    else:
        print("  Skipping label VTI (no TotalSegmentator masks or missing reference)")

    # 6. Generate probe path
    print("6. Generating probe path...")
    esophagus_mask = masks.get('esophagus')
    if esophagus_mask is not None:
        probe_path = generate_probe_path(esophagus_mask, heart_center=np.array(heart_center))
    else:
        print("  No esophagus mask, generating synthetic path")
        probe_path = generate_synthetic_probe_path(
            ct_image.GetOrigin(), ct_image.GetSpacing(),
            sitk.GetArrayFromImage(ct_image).shape
        )

    with open(os.path.join(args.output_dir, "probe_path.json"), "w") as f:
        json.dump(probe_path, f, indent=2)

    # 7. Generate landmarks
    print("7. Generating landmarks...")
    landmarks = generate_landmarks(masks, ct_image)
    with open(os.path.join(args.output_dir, "landmarks.json"), "w") as f:
        json.dump(landmarks, f, indent=2)

    # 8. Generate views
    print("8. Generating view presets...")
    views = generate_views(probe_path)
    with open(os.path.join(args.output_dir, "views.json"), "w") as f:
        json.dump(views, f, indent=2)

    # 9. Generate case manifest
    print("9. Writing case manifest...")
    manifest = {
        "schemaVersion": "1.0.0",
        "caseId": "lctsc_s1_006",
        "caseVersion": "0.1.0",
        "coordinateSystem": "RAS",
        "units": "mm",
        "bundleVersion": "0.1.0",
        "generator": {
            "pipelineVersion": "0.1.0",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        },
        "sources": [
            {
                "dataset": "LCTSC (Lung CT Segmentation Challenge)",
                "bucket": "maybe-verify-first",
                "license": "TCIA Data Usage Policy",
                "artifact": "LCTSC-Train-S1-006",
            }
        ],
        "assets": {
            "sceneGlb": {"path": "scene.glb"},
            "heartDetailGlb": {"path": "heart_detail.glb"},
            "heartRoiVti": {"path": "heart_roi.vti"},
            "labelVti": {"path": "heart_labels.vti", "scalarType": "Uint8"},
        },
        "metadata": {
            "landmarks": "landmarks.json",
            "probePath": "probe_path.json",
            "views": "views.json",
        },
    }
    with open(os.path.join(args.output_dir, "case_manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)

    # 10. Update case index
    print("10. Updating case index...")
    index_path = os.path.join(os.path.dirname(args.output_dir), "index.json")
    if os.path.exists(index_path):
        with open(index_path) as f:
            index = json.load(f)
    else:
        index = {"cases": []}

    case_entry = {
        "caseId": "lctsc_s1_006",
        "title": "LCTSC S1-006 (Female, Thorax CT)",
        "description": "Thorax CT with heart, esophagus, lung, spinal cord segmentation from LCTSC challenge",
    }

    # Update or add
    existing = [c for c in index["cases"] if c["caseId"] == case_entry["caseId"]]
    if existing:
        existing[0].update(case_entry)
    else:
        index["cases"].append(case_entry)

    with open(index_path, "w") as f:
        json.dump(index, f, indent=2)

    print("\nDone! Case assets written to:", args.output_dir)
    print("Files:")
    for f in sorted(os.listdir(args.output_dir)):
        size = os.path.getsize(os.path.join(args.output_dir, f))
        print(f"  {f}: {size / 1e3:.1f} KB")


if __name__ == "__main__":
    main()
