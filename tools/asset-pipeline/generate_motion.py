#!/usr/bin/env python3
"""
Generate discrete cardiac motion label phases for TeeSim.

Inputs:
  - heart_labels.vti: ED baseline label map on the public ROI grid
  - valves.json: authored valve metadata used to anchor chamber axes

Outputs:
  - phases/phase_00.vti ... phases/phase_11.vti

The script stays self-contained and avoids third-party Python packages so it can
run in the same lightweight environments as the reviewed valve generator.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
from array import array
from dataclasses import dataclass

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from generate_valves import Volume, parse_vti, write_vti  # noqa: E402


PHASE_COUNT = 12
UINT8_MAX = 255
INF_DISTANCE = 1.0e20

LV_LABEL = 11
RV_LABEL = 12
LA_LABEL = 13
RA_LABEL = 14
MYOCARDIUM_LABEL = 15
AORTA_LABEL = 16
PA_LABEL = 17
MV_LABEL = 20
AV_LABEL = 21
TV_LABEL = 22
PV_LABEL = 23

LABEL_NAMES = {
    LV_LABEL: "lv",
    RV_LABEL: "rv",
    LA_LABEL: "la",
    RA_LABEL: "ra",
    AORTA_LABEL: "aorta",
    PA_LABEL: "pa",
}

SYSTOLIC_CURVE = [0.0, 0.0, 0.35, 0.68, 0.9, 1.0, 1.0, 0.82, 0.55, 0.28, 0.08, 0.0]
ATRIAL_CURVE = [0.0, 0.12, 0.35, 0.65, 0.88, 1.0, 1.0, 0.82, 0.52, 0.24, 0.08, 0.0]
EJECTION_CURVE = [0.0, 0.0, 0.42, 1.0, 0.58, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]

LV_RADIAL_MIN = 0.45 ** 0.3
LV_AXIAL_MIN = 0.45 ** 0.4
RV_FREE_WALL_MIN = 0.64
RV_SEPTAL_MIN = 0.98
RV_AXIAL_MIN = 0.965
LA_SCALE_MAX = 1.25 ** (1.0 / 3.0)
RA_SCALE_MAX = 1.20 ** (1.0 / 3.0)
VESSEL_RADIAL_MAX = math.sqrt(1.05)

OPEN_VALVE_FILL = {
    MV_LABEL: LA_LABEL,
    AV_LABEL: AORTA_LABEL,
    TV_LABEL: RA_LABEL,
    PV_LABEL: PA_LABEL,
}

OPEN_VALVE_PHASES = {
    MV_LABEL: {7, 8, 9, 10, 11},
    AV_LABEL: {2, 3, 4},
    TV_LABEL: {7, 8, 9, 10, 11},
    PV_LABEL: {2, 3, 4},
}

FORWARD_NEIGHBORS = [
    (dx, dy, dz)
    for dz in (-1, 0, 1)
    for dy in (-1, 0, 1)
    for dx in (-1, 0, 1)
    if not (dx == 0 and dy == 0 and dz == 0)
    if dz < 0 or (dz == 0 and dy < 0) or (dz == 0 and dy == 0 and dx < 0)
]
BACKWARD_NEIGHBORS = [(-dx, -dy, -dz) for (dx, dy, dz) in FORWARD_NEIGHBORS]


@dataclass(frozen=True)
class Bounds:
    minimum: tuple[int, int, int]
    maximum: tuple[int, int, int]

    @property
    def dims(self) -> tuple[int, int, int]:
        return (
            self.maximum[0] - self.minimum[0] + 1,
            self.maximum[1] - self.minimum[1] + 1,
            self.maximum[2] - self.minimum[2] + 1,
        )


@dataclass
class LabelScan:
    label_id: int
    count: int
    sum_x: float
    sum_y: float
    sum_z: float
    bbox_min: list[int]
    bbox_max: list[int]
    indices: list[int]

    def centroid(self) -> tuple[float, float, float]:
        if self.count <= 0:
            raise ValueError(f"Label {self.label_id} is absent from the source volume")
        return (
            self.sum_x / self.count,
            self.sum_y / self.count,
            self.sum_z / self.count,
        )

    def bounds(self) -> Bounds:
        if self.count <= 0:
            raise ValueError(f"Label {self.label_id} is absent from the source volume")
        return Bounds(
            minimum=(self.bbox_min[0], self.bbox_min[1], self.bbox_min[2]),
            maximum=(self.bbox_max[0], self.bbox_max[1], self.bbox_max[2]),
        )


@dataclass
class RoiSdf:
    bounds: Bounds
    sdf: array

    @property
    def dims(self) -> tuple[int, int, int]:
        return self.bounds.dims


@dataclass
class LongAxisMotion:
    label_id: int
    roi: RoiSdf
    apex: tuple[float, float, float]
    axis: tuple[float, float, float]
    radial_min: float
    axial_min: float


@dataclass
class RvMotion:
    label_id: int
    roi: RoiSdf
    apex: tuple[float, float, float]
    axis: tuple[float, float, float]
    free_wall_axis: tuple[float, float, float]
    free_wall_min: float
    septal_min: float
    axial_min: float


@dataclass
class IsotropicMotion:
    label_id: int
    roi: RoiSdf
    center: tuple[float, float, float]
    scale_max: float


@dataclass
class RadialAxisMotion:
    label_id: int
    roi: RoiSdf
    center: tuple[float, float, float]
    axis: tuple[float, float, float]
    radial_max: float


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--label-vti",
        required=True,
        help="Path to the ED baseline heart_labels.vti",
    )
    parser.add_argument(
        "--valves-json",
        required=True,
        help="Path to valves.json for chamber/base anchors",
    )
    parser.add_argument(
        "--output-dir",
        required=True,
        help="Directory that receives phases/phase_00.vti ... phase_11.vti",
    )
    parser.add_argument(
        "--phase-dir-name",
        default="phases",
        help="Subdirectory name under --output-dir for generated phase VTIs",
    )
    return parser.parse_args()


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def vector_sub(a: tuple[float, float, float], b: tuple[float, float, float]) -> tuple[float, float, float]:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def vector_add(a: tuple[float, float, float], b: tuple[float, float, float]) -> tuple[float, float, float]:
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def vector_scale(a: tuple[float, float, float], scale: float) -> tuple[float, float, float]:
    return (a[0] * scale, a[1] * scale, a[2] * scale)


def vector_dot(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def vector_length(a: tuple[float, float, float]) -> float:
    return math.sqrt(vector_dot(a, a))


def normalize(a: tuple[float, float, float]) -> tuple[float, float, float]:
    length = vector_length(a)
    if length <= 1.0e-8:
        return (0.0, 0.0, 0.0)
    return (a[0] / length, a[1] / length, a[2] / length)


def vector_project(vector: tuple[float, float, float], axis: tuple[float, float, float]) -> tuple[float, float, float]:
    return vector_scale(axis, vector_dot(vector, axis))


def world_to_voxel(volume: Volume, point: tuple[float, float, float]) -> tuple[float, float, float]:
    return (
        (point[0] - volume.origin[0]) / volume.spacing[0],
        (point[1] - volume.origin[1]) / volume.spacing[1],
        (point[2] - volume.origin[2]) / volume.spacing[2],
    )


def neighbor_cost(offset: tuple[int, int, int], spacing: tuple[float, float, float]) -> float:
    dx, dy, dz = offset
    return math.sqrt(
        (dx * spacing[0]) * (dx * spacing[0])
        + (dy * spacing[1]) * (dy * spacing[1])
        + (dz * spacing[2]) * (dz * spacing[2])
    )


def build_neighbor_steps(spacing: tuple[float, float, float], offsets: list[tuple[int, int, int]]) -> list[tuple[int, int, int, float]]:
    return [(dx, dy, dz, neighbor_cost((dx, dy, dz), spacing)) for (dx, dy, dz) in offsets]


def voxel_index(x: int, y: int, z: int, dims: tuple[int, int, int]) -> int:
    nx, ny, _ = dims
    return x + nx * (y + ny * z)


def scan_labels(data: bytes, dims: tuple[int, int, int]) -> dict[int, LabelScan]:
    tracked = {
        label_id: LabelScan(
            label_id=label_id,
            count=0,
            sum_x=0.0,
            sum_y=0.0,
            sum_z=0.0,
            bbox_min=[dims[0], dims[1], dims[2]],
            bbox_max=[-1, -1, -1],
            indices=[],
        )
        for label_id in (LV_LABEL, RV_LABEL, LA_LABEL, RA_LABEL, AORTA_LABEL, PA_LABEL, MV_LABEL, AV_LABEL, TV_LABEL, PV_LABEL)
    }

    nx, ny, nz = dims
    plane = nx * ny
    indexed_labels = {LV_LABEL, RV_LABEL, MV_LABEL, AV_LABEL, TV_LABEL, PV_LABEL}

    for z in range(nz):
        z_offset = z * plane
        for y in range(ny):
            row_offset = z_offset + y * nx
            for x in range(nx):
                flat_index = row_offset + x
                label = data[flat_index]
                scan = tracked.get(label)
                if scan is None:
                    continue

                scan.count += 1
                scan.sum_x += x
                scan.sum_y += y
                scan.sum_z += z
                if x < scan.bbox_min[0]:
                    scan.bbox_min[0] = x
                if y < scan.bbox_min[1]:
                    scan.bbox_min[1] = y
                if z < scan.bbox_min[2]:
                    scan.bbox_min[2] = z
                if x > scan.bbox_max[0]:
                    scan.bbox_max[0] = x
                if y > scan.bbox_max[1]:
                    scan.bbox_max[1] = y
                if z > scan.bbox_max[2]:
                    scan.bbox_max[2] = z
                if label in indexed_labels:
                    scan.indices.append(flat_index)

    return tracked


def expand_bounds(bounds: Bounds, margin: int, dims: tuple[int, int, int]) -> Bounds:
    return Bounds(
        minimum=(
            max(0, bounds.minimum[0] - margin),
            max(0, bounds.minimum[1] - margin),
            max(0, bounds.minimum[2] - margin),
        ),
        maximum=(
            min(dims[0] - 1, bounds.maximum[0] + margin),
            min(dims[1] - 1, bounds.maximum[1] + margin),
            min(dims[2] - 1, bounds.maximum[2] + margin),
        ),
    )


def build_binary_mask(
    source_data: bytes,
    dims: tuple[int, int, int],
    bounds: Bounds,
    include_label: int,
    predicate: callable | None = None,
) -> bytearray:
    mask = bytearray(bounds.dims[0] * bounds.dims[1] * bounds.dims[2])
    nx, ny, _ = dims
    roi_nx, roi_ny, _ = bounds.dims
    plane = nx * ny
    roi_plane = roi_nx * roi_ny

    for local_z, global_z in enumerate(range(bounds.minimum[2], bounds.maximum[2] + 1)):
        z_offset = global_z * plane
        roi_z_offset = local_z * roi_plane
        for local_y, global_y in enumerate(range(bounds.minimum[1], bounds.maximum[1] + 1)):
            row_offset = z_offset + global_y * nx
            roi_row_offset = roi_z_offset + local_y * roi_nx
            for local_x, global_x in enumerate(range(bounds.minimum[0], bounds.maximum[0] + 1)):
                flat_index = row_offset + global_x
                if source_data[flat_index] != include_label:
                    continue
                if predicate is not None and not predicate(global_x, global_y, global_z):
                    continue
                mask[roi_row_offset + local_x] = 1

    return mask


def build_distance_field(mask: bytearray, dims: tuple[int, int, int], spacing: tuple[float, float, float], seed_inside: bool) -> array:
    size = dims[0] * dims[1] * dims[2]
    distance = array("f", [INF_DISTANCE]) * size
    seeds = 1 if seed_inside else 0
    for index, value in enumerate(mask):
        if value == seeds:
            distance[index] = 0.0

    forward_steps = build_neighbor_steps(spacing, FORWARD_NEIGHBORS)
    backward_steps = build_neighbor_steps(spacing, BACKWARD_NEIGHBORS)
    nx, ny, nz = dims
    plane = nx * ny

    for z in range(nz):
        z_offset = z * plane
        for y in range(ny):
            row_offset = z_offset + y * nx
            for x in range(nx):
                index = row_offset + x
                best = distance[index]
                for dx, dy, dz, cost in forward_steps:
                    nxp = x + dx
                    nyp = y + dy
                    nzp = z + dz
                    if nxp < 0 or nyp < 0 or nzp < 0 or nxp >= nx or nyp >= ny or nzp >= nz:
                        continue
                    candidate = distance[index + dx + nx * dy + plane * dz] + cost
                    if candidate < best:
                        best = candidate
                distance[index] = best

    for z in range(nz - 1, -1, -1):
        z_offset = z * plane
        for y in range(ny - 1, -1, -1):
            row_offset = z_offset + y * nx
            for x in range(nx - 1, -1, -1):
                index = row_offset + x
                best = distance[index]
                for dx, dy, dz, cost in backward_steps:
                    nxp = x + dx
                    nyp = y + dy
                    nzp = z + dz
                    if nxp < 0 or nyp < 0 or nzp < 0 or nxp >= nx or nyp >= ny or nzp >= nz:
                        continue
                    candidate = distance[index + dx + nx * dy + plane * dz] + cost
                    if candidate < best:
                        best = candidate
                distance[index] = best

    return distance


def build_signed_distance(mask: bytearray, dims: tuple[int, int, int], spacing: tuple[float, float, float]) -> array:
    outside = build_distance_field(mask, dims, spacing, seed_inside=False)
    inside = build_distance_field(mask, dims, spacing, seed_inside=True)
    signed = array("f", [0.0]) * (dims[0] * dims[1] * dims[2])

    for index, value in enumerate(mask):
        if value:
            signed[index] = -outside[index]
        else:
            signed[index] = inside[index]

    return signed


def sample_sdf(field: RoiSdf, point: tuple[float, float, float]) -> float:
    lx = point[0] - field.bounds.minimum[0]
    ly = point[1] - field.bounds.minimum[1]
    lz = point[2] - field.bounds.minimum[2]
    nx, ny, nz = field.dims

    if lx < 0.0 or ly < 0.0 or lz < 0.0 or lx > nx - 1 or ly > ny - 1 or lz > nz - 1:
        return INF_DISTANCE

    x0 = int(math.floor(lx))
    y0 = int(math.floor(ly))
    z0 = int(math.floor(lz))
    x1 = min(x0 + 1, nx - 1)
    y1 = min(y0 + 1, ny - 1)
    z1 = min(z0 + 1, nz - 1)
    tx = lx - x0
    ty = ly - y0
    tz = lz - z0
    plane = nx * ny

    def value_at(x: int, y: int, z: int) -> float:
        return field.sdf[x + nx * (y + ny * z)]

    c000 = value_at(x0, y0, z0)
    c100 = value_at(x1, y0, z0)
    c010 = value_at(x0, y1, z0)
    c110 = value_at(x1, y1, z0)
    c001 = value_at(x0, y0, z1)
    c101 = value_at(x1, y0, z1)
    c011 = value_at(x0, y1, z1)
    c111 = value_at(x1, y1, z1)

    c00 = c000 * (1.0 - tx) + c100 * tx
    c10 = c010 * (1.0 - tx) + c110 * tx
    c01 = c001 * (1.0 - tx) + c101 * tx
    c11 = c011 * (1.0 - tx) + c111 * tx
    c0 = c00 * (1.0 - ty) + c10 * ty
    c1 = c01 * (1.0 - ty) + c11 * ty
    return c0 * (1.0 - tz) + c1 * tz


def build_roi_sdf(volume: Volume, source_data: bytes, bounds: Bounds, label_id: int, predicate: callable | None = None) -> RoiSdf:
    mask = build_binary_mask(source_data, volume.dims, bounds, include_label=label_id, predicate=predicate)
    if max(mask, default=0) == 0:
        raise ValueError(f"Mask for label {label_id} is empty inside requested ROI")
    return RoiSdf(bounds=bounds, sdf=build_signed_distance(mask, bounds.dims, volume.spacing))


def find_farthest_label_point(
    volume: Volume,
    data: bytes,
    label_id: int,
    reference: tuple[float, float, float],
) -> tuple[float, float, float]:
    nx, ny, nz = volume.dims
    plane = nx * ny
    best_distance = -1.0
    best_point = reference

    for z in range(nz):
        z_offset = z * plane
        for y in range(ny):
            row_offset = z_offset + y * nx
            for x in range(nx):
                if data[row_offset + x] != label_id:
                    continue
                point = (float(x), float(y), float(z))
                distance = vector_length(vector_sub(point, reference))
                if distance > best_distance:
                    best_distance = distance
                    best_point = point

    return best_point


def make_vessel_root_predicate(
    center: tuple[float, float, float],
    axis: tuple[float, float, float],
    axial_half_length_vox: float,
    radial_limit_vox: float,
):
    def predicate(x: int, y: int, z: int) -> bool:
        point = (float(x), float(y), float(z))
        relative = vector_sub(point, center)
        axial = vector_dot(relative, axis)
        if abs(axial) > axial_half_length_vox:
            return False
        radial = vector_sub(relative, vector_scale(axis, axial))
        return vector_length(radial) <= radial_limit_vox

    return predicate


def deformed_source_lv(context: LongAxisMotion, point: tuple[float, float, float], phase_fraction: float) -> tuple[float, float, float]:
    radial_scale = 1.0 - phase_fraction * (1.0 - context.radial_min)
    axial_scale = 1.0 - phase_fraction * (1.0 - context.axial_min)
    relative = vector_sub(point, context.apex)
    axial = vector_dot(relative, context.axis)
    radial = vector_sub(relative, vector_scale(context.axis, axial))
    return vector_add(
        context.apex,
        vector_add(
            vector_scale(context.axis, axial / max(axial_scale, 1.0e-6)),
            vector_scale(radial, 1.0 / max(radial_scale, 1.0e-6)),
        ),
    )


def deformed_source_rv(context: RvMotion, point: tuple[float, float, float], phase_fraction: float) -> tuple[float, float, float]:
    axial_scale = 1.0 - phase_fraction * (1.0 - context.axial_min)
    relative = vector_sub(point, context.apex)
    axial = vector_dot(relative, context.axis)
    radial = vector_sub(relative, vector_scale(context.axis, axial))
    radial_length = vector_length(radial)
    if radial_length <= 1.0e-6:
        weight = 0.5
    else:
        radial_unit = vector_scale(radial, 1.0 / radial_length)
        weight = clamp((vector_dot(radial_unit, context.free_wall_axis) + 1.0) * 0.5, 0.0, 1.0)

    full_radial_scale = context.septal_min * (1.0 - weight) + context.free_wall_min * weight
    radial_scale = 1.0 - phase_fraction * (1.0 - full_radial_scale)
    return vector_add(
        context.apex,
        vector_add(
            vector_scale(context.axis, axial / max(axial_scale, 1.0e-6)),
            vector_scale(radial, 1.0 / max(radial_scale, 1.0e-6)),
        ),
    )


def deformed_source_isotropic(context: IsotropicMotion, point: tuple[float, float, float], phase_fraction: float) -> tuple[float, float, float]:
    scale = 1.0 + phase_fraction * (context.scale_max - 1.0)
    return vector_add(
        context.center,
        vector_scale(vector_sub(point, context.center), 1.0 / max(scale, 1.0e-6)),
    )


def deformed_source_vessel(context: RadialAxisMotion, point: tuple[float, float, float], phase_fraction: float) -> tuple[float, float, float]:
    radial_scale = 1.0 + phase_fraction * (context.radial_max - 1.0)
    relative = vector_sub(point, context.center)
    axial = vector_dot(relative, context.axis)
    radial = vector_sub(relative, vector_scale(context.axis, axial))
    return vector_add(
        context.center,
        vector_add(vector_scale(context.axis, axial), vector_scale(radial, 1.0 / max(radial_scale, 1.0e-6))),
    )


def rasterize_motion(
    target: bytearray,
    volume: Volume,
    label_id: int,
    field: RoiSdf,
    source_mapper,
    phase_fraction: float,
) -> int:
    if phase_fraction <= 0.0 and label_id not in (LV_LABEL, RV_LABEL):
        return 0

    dims = volume.dims
    nx, ny, _ = dims
    plane = nx * ny
    written = 0

    for z in range(field.bounds.minimum[2], field.bounds.maximum[2] + 1):
        z_offset = z * plane
        for y in range(field.bounds.minimum[1], field.bounds.maximum[1] + 1):
            row_offset = z_offset + y * nx
            for x in range(field.bounds.minimum[0], field.bounds.maximum[0] + 1):
                source_point = source_mapper((float(x), float(y), float(z)), phase_fraction)
                if sample_sdf(field, source_point) <= 0.0:
                    target[row_offset + x] = label_id
                    written += 1

    return written


def replace_indices(target: bytearray, indices: list[int], label_id: int) -> None:
    label_value = max(0, min(UINT8_MAX, label_id))
    for index in indices:
        target[index] = label_value


def summarize_counts(data: bytes, labels: list[int]) -> dict[int, int]:
    counts = {label_id: 0 for label_id in labels}
    for value in data:
        if value in counts:
            counts[value] += 1
    return counts


def phase_filename(phase_index: int) -> str:
    return f"phase_{phase_index:02d}.vti"


def main() -> int:
    args = parse_args()
    label_volume = parse_vti(args.label_vti)
    if label_volume.scalar_type != "UInt8":
        raise ValueError("The motion generator expects a UInt8 heart label VTI")

    with open(args.valves_json, "r", encoding="utf-8") as handle:
        valve_metadata = json.load(handle)

    scans = scan_labels(label_volume.data, label_volume.dims)
    spacing_vox = (1.0, 1.0, 1.0)

    mitral_center = world_to_voxel(label_volume, tuple(valve_metadata["mitral"]["center"]))
    tricuspid_center = world_to_voxel(label_volume, tuple(valve_metadata["tricuspid"]["center"]))
    aortic_center = world_to_voxel(label_volume, tuple(valve_metadata["aortic"]["center"]))
    pulmonic_center = world_to_voxel(label_volume, tuple(valve_metadata["pulmonic"]["center"]))

    lv_apex = find_farthest_label_point(label_volume, label_volume.data, LV_LABEL, mitral_center)
    rv_apex = find_farthest_label_point(label_volume, label_volume.data, RV_LABEL, tricuspid_center)
    lv_axis = normalize(vector_sub(mitral_center, lv_apex))
    rv_axis = normalize(vector_sub(tricuspid_center, rv_apex))
    rv_free_wall_axis = normalize(vector_sub(scans[RV_LABEL].centroid(), scans[LV_LABEL].centroid()))
    aortic_axis = normalize(tuple(float(value) for value in valve_metadata["aortic"]["normal"]))
    pulmonic_axis = normalize(tuple(float(value) for value in valve_metadata["pulmonic"]["normal"]))

    lv_bounds = expand_bounds(scans[LV_LABEL].bounds(), margin=4, dims=label_volume.dims)
    rv_bounds = expand_bounds(scans[RV_LABEL].bounds(), margin=4, dims=label_volume.dims)
    la_bounds = expand_bounds(scans[LA_LABEL].bounds(), margin=12, dims=label_volume.dims)
    ra_bounds = expand_bounds(scans[RA_LABEL].bounds(), margin=12, dims=label_volume.dims)

    aortic_predicate = make_vessel_root_predicate(
        aortic_center,
        aortic_axis,
        axial_half_length_vox=48.0 / label_volume.spacing[0],
        radial_limit_vox=28.0 / label_volume.spacing[0],
    )
    pulmonic_predicate = make_vessel_root_predicate(
        pulmonic_center,
        pulmonic_axis,
        axial_half_length_vox=46.0 / label_volume.spacing[0],
        radial_limit_vox=30.0 / label_volume.spacing[0],
    )
    aorta_bounds = expand_bounds(scans[AORTA_LABEL].bounds(), margin=6, dims=label_volume.dims)
    pa_bounds = expand_bounds(scans[PA_LABEL].bounds(), margin=6, dims=label_volume.dims)

    lv_motion = LongAxisMotion(
        label_id=LV_LABEL,
        roi=build_roi_sdf(label_volume, label_volume.data, lv_bounds, LV_LABEL),
        apex=lv_apex,
        axis=lv_axis,
        radial_min=LV_RADIAL_MIN,
        axial_min=LV_AXIAL_MIN,
    )
    rv_motion = RvMotion(
        label_id=RV_LABEL,
        roi=build_roi_sdf(label_volume, label_volume.data, rv_bounds, RV_LABEL),
        apex=rv_apex,
        axis=rv_axis,
        free_wall_axis=rv_free_wall_axis,
        free_wall_min=RV_FREE_WALL_MIN,
        septal_min=RV_SEPTAL_MIN,
        axial_min=RV_AXIAL_MIN,
    )
    la_motion = IsotropicMotion(
        label_id=LA_LABEL,
        roi=build_roi_sdf(label_volume, label_volume.data, la_bounds, LA_LABEL),
        center=scans[LA_LABEL].centroid(),
        scale_max=LA_SCALE_MAX,
    )
    ra_motion = IsotropicMotion(
        label_id=RA_LABEL,
        roi=build_roi_sdf(label_volume, label_volume.data, ra_bounds, RA_LABEL),
        center=scans[RA_LABEL].centroid(),
        scale_max=RA_SCALE_MAX,
    )
    aorta_motion = RadialAxisMotion(
        label_id=AORTA_LABEL,
        roi=build_roi_sdf(label_volume, label_volume.data, aorta_bounds, AORTA_LABEL, predicate=aortic_predicate),
        center=aortic_center,
        axis=aortic_axis,
        radial_max=VESSEL_RADIAL_MAX,
    )
    pa_motion = RadialAxisMotion(
        label_id=PA_LABEL,
        roi=build_roi_sdf(label_volume, label_volume.data, pa_bounds, PA_LABEL, predicate=pulmonic_predicate),
        center=pulmonic_center,
        axis=pulmonic_axis,
        radial_max=VESSEL_RADIAL_MAX,
    )

    phase_root = os.path.join(args.output_dir, args.phase_dir_name)
    os.makedirs(phase_root, exist_ok=True)

    baseline_counts = summarize_counts(label_volume.data, [LV_LABEL, RV_LABEL, LA_LABEL, RA_LABEL, AORTA_LABEL, PA_LABEL, MV_LABEL, AV_LABEL, TV_LABEL, PV_LABEL])
    print("Baseline label counts:")
    for label_id in sorted(baseline_counts):
        print(f"  {label_id:2d} {LABEL_NAMES.get(label_id, 'valve'):<6} {baseline_counts[label_id]}")
    print("Generating cardiac motion phases...")

    for phase_index in range(PHASE_COUNT):
        phase_data = bytearray(label_volume.data)
        replace_indices(phase_data, scans[LV_LABEL].indices, MYOCARDIUM_LABEL)
        replace_indices(phase_data, scans[RV_LABEL].indices, MYOCARDIUM_LABEL)

        for valve_label, open_phases in OPEN_VALVE_PHASES.items():
            if phase_index in open_phases:
                replace_indices(phase_data, scans[valve_label].indices, OPEN_VALVE_FILL[valve_label])

        rasterize_motion(
            phase_data,
            label_volume,
            AORTA_LABEL,
            aorta_motion.roi,
            lambda point, fraction: deformed_source_vessel(aorta_motion, point, fraction),
            EJECTION_CURVE[phase_index],
        )
        rasterize_motion(
            phase_data,
            label_volume,
            PA_LABEL,
            pa_motion.roi,
            lambda point, fraction: deformed_source_vessel(pa_motion, point, fraction),
            EJECTION_CURVE[phase_index],
        )
        rasterize_motion(
            phase_data,
            label_volume,
            LA_LABEL,
            la_motion.roi,
            lambda point, fraction: deformed_source_isotropic(la_motion, point, fraction),
            ATRIAL_CURVE[phase_index],
        )
        rasterize_motion(
            phase_data,
            label_volume,
            RA_LABEL,
            ra_motion.roi,
            lambda point, fraction: deformed_source_isotropic(ra_motion, point, fraction),
            ATRIAL_CURVE[phase_index],
        )
        rasterize_motion(
            phase_data,
            label_volume,
            LV_LABEL,
            lv_motion.roi,
            lambda point, fraction: deformed_source_lv(lv_motion, point, fraction),
            SYSTOLIC_CURVE[phase_index],
        )
        rasterize_motion(
            phase_data,
            label_volume,
            RV_LABEL,
            rv_motion.roi,
            lambda point, fraction: deformed_source_rv(rv_motion, point, fraction),
            SYSTOLIC_CURVE[phase_index],
        )

        for valve_label, open_phases in OPEN_VALVE_PHASES.items():
            if phase_index not in open_phases:
                replace_indices(phase_data, scans[valve_label].indices, valve_label)

        output_path = os.path.join(phase_root, phase_filename(phase_index))
        write_vti(
            Volume(
                dims=label_volume.dims,
                origin=label_volume.origin,
                spacing=label_volume.spacing,
                direction=label_volume.direction,
                scalar_type=label_volume.scalar_type,
                data=bytes(phase_data),
                whole_extent=label_volume.whole_extent,
            ),
            output_path,
        )

        counts = summarize_counts(
            phase_data,
            [LV_LABEL, RV_LABEL, LA_LABEL, RA_LABEL, AORTA_LABEL, PA_LABEL, MV_LABEL, AV_LABEL, TV_LABEL, PV_LABEL],
        )
        print(
            f"  phase {phase_index:02d}: "
            f"LV={counts[LV_LABEL]} RV={counts[RV_LABEL]} "
            f"LA={counts[LA_LABEL]} RA={counts[RA_LABEL]} "
            f"Ao={counts[AORTA_LABEL]} PA={counts[PA_LABEL]} "
            f"MV={counts[MV_LABEL]} AV={counts[AV_LABEL]} TV={counts[TV_LABEL]} PV={counts[PV_LABEL]}"
        )

    print(f"Generated {PHASE_COUNT} motion phases in {phase_root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
