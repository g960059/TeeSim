#!/usr/bin/env python3
"""
Generate reviewed parametric valve assets for TeeSim.

Inputs:
  - heart_labels.vti: chamber label map on the public ROI grid
  - heart_roi.vti: intensity ROI used as the reference grid contract

Outputs:
  - updated heart_labels.vti with valve labels overwritten in-place
  - valves.json with per-valve center / normal / radius metadata
  - valve_meshes.glb with leaflet surface meshes

This script is intentionally self-contained and avoids non-stdlib Python
dependencies so it can run in lightweight environments.
"""

from __future__ import annotations

import argparse
import base64
import json
import math
import os
import struct
import sys
import xml.etree.ElementTree as ET
import zlib
from dataclasses import dataclass
from typing import Callable


UINT32 = struct.Struct("<I")
FLOAT32 = struct.Struct("<f")
UINT32_PACK = struct.Struct("<I")

TARGET_LABELS = {11, 12, 13, 14, 15, 16, 17}
VALVE_LABELS = {
    "mitral": 20,
    "aortic": 21,
    "tricuspid": 22,
    "pulmonic": 23,
}
DEFAULT_LABEL_THICKNESS_VOXELS = 4
APPENDED_BLOCK_SIZE = 32768
EPSILON = 1e-9


@dataclass
class Volume:
    dims: tuple[int, int, int]
    origin: tuple[float, float, float]
    spacing: tuple[float, float, float]
    direction: tuple[float, ...]
    scalar_type: str
    data: bytes
    whole_extent: tuple[int, int, int, int, int, int]


@dataclass
class LabelStats:
    count: int
    centroid: tuple[float, float, float]
    bbox_min: tuple[int, int, int]
    bbox_max: tuple[int, int, int]
    surface_points: list[tuple[int, int, int]]


@dataclass
class ValveAnnulus:
    name: str
    center: tuple[float, float, float]
    normal: tuple[float, float, float]
    basis_u: tuple[float, float, float]
    basis_v: tuple[float, float, float]
    semi_major_mm: float
    semi_minor_mm: float
    radius_mm: float
    interface_points: list[tuple[float, float, float]]


@dataclass
class Mesh:
    name: str
    vertices: list[tuple[float, float, float]]
    indices: list[int]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--label-vti", required=True, help="Input chamber label VTI")
    parser.add_argument("--roi-vti", required=True, help="Input heart ROI VTI")
    parser.add_argument(
        "--output-dir",
        required=True,
        help="Directory that receives heart_labels.vti, valves.json, and valve_meshes.glb",
    )
    parser.add_argument(
        "--output-label-name",
        default="heart_labels.vti",
        help="Filename for the regenerated label VTI inside --output-dir",
    )
    parser.add_argument(
        "--thickness-voxels",
        type=int,
        default=DEFAULT_LABEL_THICKNESS_VOXELS,
        help="Valve raster thickness in voxels (default: 4)",
    )
    return parser.parse_args()


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def vector_add(a: tuple[float, float, float], b: tuple[float, float, float]) -> tuple[float, float, float]:
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def vector_sub(a: tuple[float, float, float], b: tuple[float, float, float]) -> tuple[float, float, float]:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def vector_scale(a: tuple[float, float, float], scale: float) -> tuple[float, float, float]:
    return (a[0] * scale, a[1] * scale, a[2] * scale)


def vector_dot(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def vector_cross(a: tuple[float, float, float], b: tuple[float, float, float]) -> tuple[float, float, float]:
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def vector_length(a: tuple[float, float, float]) -> float:
    return math.sqrt(vector_dot(a, a))


def normalize(a: tuple[float, float, float]) -> tuple[float, float, float]:
    length = vector_length(a)
    if length < EPSILON:
        return (0.0, 0.0, 0.0)
    return (a[0] / length, a[1] / length, a[2] / length)


def lerp(a: tuple[float, float, float], b: tuple[float, float, float], t: float) -> tuple[float, float, float]:
    return (
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
    )


def project_to_plane(
    vector: tuple[float, float, float], normal: tuple[float, float, float]
) -> tuple[float, float, float]:
    return vector_sub(vector, vector_scale(normal, vector_dot(vector, normal)))


def angle_wrap(angle: float) -> float:
    while angle <= -math.pi:
        angle += 2.0 * math.pi
    while angle > math.pi:
        angle -= 2.0 * math.pi
    return angle


def angle_between(
    point: tuple[float, float, float],
    center: tuple[float, float, float],
    axis_u: tuple[float, float, float],
    axis_v: tuple[float, float, float],
) -> float:
    rel = vector_sub(point, center)
    return math.atan2(vector_dot(rel, axis_v), vector_dot(rel, axis_u))


def arc_angle_distance(start_angle: float, end_angle: float) -> float:
    delta = end_angle - start_angle
    while delta <= 0.0:
        delta += 2.0 * math.pi
    return delta


def percentile_abs(values: list[float], quantile: float) -> float:
    if not values:
        return 0.0
    sorted_values = sorted(abs(value) for value in values)
    index = clamp(quantile, 0.0, 1.0) * float(len(sorted_values) - 1)
    low = int(math.floor(index))
    high = int(math.ceil(index))
    if low == high:
        return sorted_values[low]
    fraction = index - low
    return sorted_values[low] * (1.0 - fraction) + sorted_values[high] * fraction


def voxel_index(x: int, y: int, z: int, dims: tuple[int, int, int]) -> int:
    nx, ny, _ = dims
    return x + nx * (y + ny * z)


def voxel_to_world(volume: Volume, x: float, y: float, z: float) -> tuple[float, float, float]:
    return (
        volume.origin[0] + x * volume.spacing[0],
        volume.origin[1] + y * volume.spacing[1],
        volume.origin[2] + z * volume.spacing[2],
    )


def world_to_voxel(volume: Volume, point: tuple[float, float, float]) -> tuple[int, int, int]:
    return (
        int(round((point[0] - volume.origin[0]) / volume.spacing[0])),
        int(round((point[1] - volume.origin[1]) / volume.spacing[1])),
        int(round((point[2] - volume.origin[2]) / volume.spacing[2])),
    )


def read_uint(buffer: bytes, offset: int) -> int:
    return UINT32.unpack_from(buffer, offset)[0]


def decompress_vtk_appended(
    payload: bytes,
    header_type: str,
    compressor: str | None,
) -> bytes:
    if header_type != "UInt32":
        raise ValueError(f"Unsupported VTK header_type: {header_type}")

    if compressor != "vtkZLibDataCompressor":
        raw_length = read_uint(payload, 0)
        return payload[4 : 4 + raw_length]

    num_blocks = read_uint(payload, 0)
    block_size = read_uint(payload, 4)
    last_block_size = read_uint(payload, 8)
    header_bytes = 12 + num_blocks * 4
    compressed_sizes = [read_uint(payload, 12 + block_index * 4) for block_index in range(num_blocks)]

    cursor = header_bytes
    parts: list[bytes] = []
    for block_index, compressed_size in enumerate(compressed_sizes):
        block = payload[cursor : cursor + compressed_size]
        cursor += compressed_size
        expected_size = last_block_size if block_index == num_blocks - 1 else block_size
        inflated = zlib.decompress(block)
        if len(inflated) != expected_size:
            raise ValueError(
                f"VTK block {block_index} expected {expected_size} bytes after inflate, got {len(inflated)}"
            )
        parts.append(inflated)

    return b"".join(parts)


def compress_vtk_appended(raw: bytes) -> bytes:
    if not raw:
        header = UINT32.pack(0) + UINT32.pack(APPENDED_BLOCK_SIZE) + UINT32.pack(0)
        return header

    blocks = [
        raw[start : start + APPENDED_BLOCK_SIZE]
        for start in range(0, len(raw), APPENDED_BLOCK_SIZE)
    ]
    compressed_blocks = [zlib.compress(block) for block in blocks]

    header_parts = [
        UINT32.pack(len(blocks)),
        UINT32.pack(APPENDED_BLOCK_SIZE),
        UINT32.pack(len(blocks[-1])),
    ]
    for block in compressed_blocks:
        header_parts.append(UINT32.pack(len(block)))
    return b"".join(header_parts + compressed_blocks)


def split_vtk_appended_sections(appended: bytes) -> tuple[bytes, bytes]:
    if len(appended) < 12:
        raise ValueError("Compressed VTK appended payload is too small")

    num_blocks = read_uint(appended, 0)
    header_size = 12 + num_blocks * 4
    if len(appended) < header_size:
        raise ValueError("Compressed VTK appended header is truncated")
    return appended[:header_size], appended[header_size:]


def wrap_base64(encoded: str, width: int = 76) -> str:
    return "\n".join(encoded[index : index + width] for index in range(0, len(encoded), width))


def decode_vtk_base64(encoded: str) -> bytes:
    compact = "".join(encoded.split())
    if not compact:
        return b""

    chunks: list[str] = []
    start = 0
    cursor = 0
    while cursor < len(compact):
        cursor += 4
        quartet = compact[cursor - 4 : cursor]
        if "=" in quartet:
            chunks.append(compact[start:cursor])
            start = cursor
    if start < len(compact):
        chunks.append(compact[start:])

    parts: list[bytes] = []
    for chunk in chunks:
        if not chunk:
            continue
        parts.append(base64.b64decode(chunk))
    return b"".join(parts)


def parse_vti(path: str, decode_scalars: bool = True) -> Volume:
    root = ET.parse(path).getroot()
    if root.tag != "VTKFile":
        raise ValueError(f"{path} is not a VTK XML file")

    header_type = root.attrib.get("header_type", "UInt32")
    compressor = root.attrib.get("compressor")
    image_data = root.find("ImageData")
    if image_data is None:
        raise ValueError(f"{path} is missing ImageData")

    whole_extent = tuple(int(value) for value in image_data.attrib["WholeExtent"].split())
    dims = (
        whole_extent[1] - whole_extent[0] + 1,
        whole_extent[3] - whole_extent[2] + 1,
        whole_extent[5] - whole_extent[4] + 1,
    )
    origin = tuple(float(value) for value in image_data.attrib["Origin"].split())
    spacing = tuple(float(value) for value in image_data.attrib["Spacing"].split())
    direction = tuple(float(value) for value in image_data.attrib.get("Direction", "1 0 0 0 1 0 0 0 1").split())

    data_array = image_data.find("./Piece/PointData/DataArray")
    if data_array is None:
        raise ValueError(f"{path} is missing PointData/DataArray")
    scalar_type = data_array.attrib["type"]

    data = b""
    if decode_scalars:
        appended = root.find("AppendedData")
        if appended is None or appended.text is None:
            raise ValueError(f"{path} is missing AppendedData payload")
        encoded = appended.text.replace("_", "", 1)
        payload = decode_vtk_base64(encoded)
        offset = int(data_array.attrib.get("offset", "0"))
        payload = payload[offset:]
        data = decompress_vtk_appended(payload, header_type=header_type, compressor=compressor)

    return Volume(
        dims=dims,
        origin=(origin[0], origin[1], origin[2]),
        spacing=(spacing[0], spacing[1], spacing[2]),
        direction=direction,
        scalar_type=scalar_type,
        data=data,
        whole_extent=whole_extent,
    )


def write_vti(volume: Volume, path: str) -> None:
    if volume.scalar_type != "UInt8":
        raise ValueError("This writer currently supports UInt8 volumes only")

    raw = bytes(volume.data)
    appended = compress_vtk_appended(raw)
    header_bytes, payload_bytes = split_vtk_appended_sections(appended)
    encoded = wrap_base64(base64.b64encode(header_bytes).decode("ascii") + base64.b64encode(payload_bytes).decode("ascii"))
    range_min = min(raw) if raw else 0
    range_max = max(raw) if raw else 0

    extent = f"{volume.whole_extent[0]} {volume.whole_extent[1]} {volume.whole_extent[2]} {volume.whole_extent[3]} {volume.whole_extent[4]} {volume.whole_extent[5]}"
    origin = " ".join(f"{value:.12g}" for value in volume.origin)
    spacing = " ".join(f"{value:.12g}" for value in volume.spacing)
    direction = " ".join(f"{value:.12g}" for value in volume.direction)

    xml = (
        '<?xml version="1.0"?>\n'
        '<VTKFile type="ImageData" version="0.1" byte_order="LittleEndian" header_type="UInt32" compressor="vtkZLibDataCompressor">\n'
        f'  <ImageData WholeExtent="{extent}" Origin="{origin}" Spacing="{spacing}" Direction="{direction}">\n'
        f'    <Piece Extent="{extent}">\n'
        '      <PointData Scalars="Scalars_">\n'
        f'        <DataArray type="UInt8" Name="Scalars_" format="appended" RangeMin="{range_min}" RangeMax="{range_max}" offset="0" />\n'
        '      </PointData>\n'
        '      <CellData>\n'
        '      </CellData>\n'
        '    </Piece>\n'
        '  </ImageData>\n'
        '  <AppendedData encoding="base64">\n'
        f'   _{encoded}\n'
        '  </AppendedData>\n'
        '</VTKFile>\n'
    )

    with open(path, "w", encoding="utf-8") as handle:
        handle.write(xml)


def ensure_same_grid(label_volume: Volume, roi_volume: Volume) -> None:
    if label_volume.dims != roi_volume.dims:
        raise ValueError(f"Label/ROI dimensions differ: {label_volume.dims} vs {roi_volume.dims}")
    if label_volume.origin != roi_volume.origin:
        raise ValueError(f"Label/ROI origins differ: {label_volume.origin} vs {roi_volume.origin}")
    if label_volume.spacing != roi_volume.spacing:
        raise ValueError(f"Label/ROI spacing differs: {label_volume.spacing} vs {roi_volume.spacing}")
    if label_volume.direction != roi_volume.direction:
        raise ValueError("Label/ROI directions differ")


def analyze_labels(volume: Volume) -> dict[int, LabelStats]:
    if volume.scalar_type != "UInt8":
        raise ValueError("Label volume must be UInt8")

    data = volume.data
    nx, ny, nz = volume.dims
    plane = nx * ny

    counts = {label: 0 for label in TARGET_LABELS}
    sum_x = {label: 0.0 for label in TARGET_LABELS}
    sum_y = {label: 0.0 for label in TARGET_LABELS}
    sum_z = {label: 0.0 for label in TARGET_LABELS}
    bbox_min = {label: [nx, ny, nz] for label in TARGET_LABELS}
    bbox_max = {label: [-1, -1, -1] for label in TARGET_LABELS}
    surfaces = {label: [] for label in TARGET_LABELS}

    for z in range(nz):
        z_offset = z * plane
        for y in range(ny):
            row_offset = z_offset + y * nx
            for x in range(nx):
                index = row_offset + x
                label = data[index]
                if label not in TARGET_LABELS:
                    continue

                counts[label] += 1
                sum_x[label] += x
                sum_y[label] += y
                sum_z[label] += z

                mins = bbox_min[label]
                maxs = bbox_max[label]
                if x < mins[0]:
                    mins[0] = x
                if y < mins[1]:
                    mins[1] = y
                if z < mins[2]:
                    mins[2] = z
                if x > maxs[0]:
                    maxs[0] = x
                if y > maxs[1]:
                    maxs[1] = y
                if z > maxs[2]:
                    maxs[2] = z

                is_surface = (
                    x == 0
                    or data[index - 1] != label
                    or x == nx - 1
                    or data[index + 1] != label
                    or y == 0
                    or data[index - nx] != label
                    or y == ny - 1
                    or data[index + nx] != label
                    or z == 0
                    or data[index - plane] != label
                    or z == nz - 1
                    or data[index + plane] != label
                )
                if is_surface:
                    surfaces[label].append((x, y, z))

    result: dict[int, LabelStats] = {}
    for label in TARGET_LABELS:
        if counts[label] <= 0:
            raise ValueError(f"Required chamber label {label} is absent from the source label map")
        centroid_voxel = (
            sum_x[label] / counts[label],
            sum_y[label] / counts[label],
            sum_z[label] / counts[label],
        )
        result[label] = LabelStats(
            count=counts[label],
            centroid=voxel_to_world(volume, *centroid_voxel),
            bbox_min=(bbox_min[label][0], bbox_min[label][1], bbox_min[label][2]),
            bbox_max=(bbox_max[label][0], bbox_max[label][1], bbox_max[label][2]),
            surface_points=surfaces[label],
        )
    return result


def dilation_offsets(radius_voxels: int) -> list[tuple[int, int, int, float]]:
    offsets: list[tuple[int, int, int, float]] = []
    for dz in range(-radius_voxels, radius_voxels + 1):
        for dy in range(-radius_voxels, radius_voxels + 1):
            for dx in range(-radius_voxels, radius_voxels + 1):
                if dx == 0 and dy == 0 and dz == 0:
                    continue
                distance_squared = dx * dx + dy * dy + dz * dz
                if distance_squared <= radius_voxels * radius_voxels:
                    offsets.append((dx, dy, dz, float(distance_squared)))
    offsets.sort(key=lambda item: item[3])
    return offsets


def jacobi_eigen_symmetric(matrix: list[list[float]], iterations: int = 24) -> tuple[list[float], list[tuple[float, float, float]]]:
    a = [row[:] for row in matrix]
    v = [
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 1.0],
    ]

    for _ in range(iterations):
        p = 0
        q = 1
        max_value = abs(a[p][q])
        for i in range(3):
            for j in range(i + 1, 3):
                value = abs(a[i][j])
                if value > max_value:
                    p, q, max_value = i, j, value
        if max_value < 1e-10:
            break

        theta = 0.5 * math.atan2(2.0 * a[p][q], a[q][q] - a[p][p])
        cos_theta = math.cos(theta)
        sin_theta = math.sin(theta)

        app = a[p][p]
        aqq = a[q][q]
        apq = a[p][q]
        a[p][p] = cos_theta * cos_theta * app - 2.0 * sin_theta * cos_theta * apq + sin_theta * sin_theta * aqq
        a[q][q] = sin_theta * sin_theta * app + 2.0 * sin_theta * cos_theta * apq + cos_theta * cos_theta * aqq
        a[p][q] = 0.0
        a[q][p] = 0.0

        for r in range(3):
            if r == p or r == q:
                continue
            arp = a[r][p]
            arq = a[r][q]
            a[r][p] = cos_theta * arp - sin_theta * arq
            a[p][r] = a[r][p]
            a[r][q] = sin_theta * arp + cos_theta * arq
            a[q][r] = a[r][q]

        for r in range(3):
            vrp = v[r][p]
            vrq = v[r][q]
            v[r][p] = cos_theta * vrp - sin_theta * vrq
            v[r][q] = sin_theta * vrp + cos_theta * vrq

    eigenvalues = [a[0][0], a[1][1], a[2][2]]
    eigenvectors = [
        normalize((v[0][0], v[1][0], v[2][0])),
        normalize((v[0][1], v[1][1], v[2][1])),
        normalize((v[0][2], v[1][2], v[2][2])),
    ]

    ordering = sorted(range(3), key=lambda index: eigenvalues[index], reverse=True)
    return (
        [eigenvalues[index] for index in ordering],
        [eigenvectors[index] for index in ordering],
    )


def fit_annulus(
    volume: Volume,
    data: bytes,
    stats: dict[int, LabelStats],
    name: str,
    chamber_a: int,
    chamber_b: int,
    dilation_radius: int,
    radius_floor_mm: float | None = None,
) -> ValveAnnulus:
    nx, ny, nz = volume.dims
    bbox_b = stats[chamber_b]
    search_min = (
        max(0, bbox_b.bbox_min[0] - dilation_radius),
        max(0, bbox_b.bbox_min[1] - dilation_radius),
        max(0, bbox_b.bbox_min[2] - dilation_radius),
    )
    search_max = (
        min(nx - 1, bbox_b.bbox_max[0] + dilation_radius),
        min(ny - 1, bbox_b.bbox_max[1] + dilation_radius),
        min(nz - 1, bbox_b.bbox_max[2] + dilation_radius),
    )
    offsets = dilation_offsets(dilation_radius)

    interface_points: list[tuple[float, float, float]] = []
    plane = nx * ny

    for x, y, z in stats[chamber_a].surface_points:
        if not (search_min[0] <= x <= search_max[0] and search_min[1] <= y <= search_max[1] and search_min[2] <= z <= search_max[2]):
            continue

        best_neighbor: tuple[int, int, int] | None = None
        for dx, dy, dz, _ in offsets:
            nxp = x + dx
            nyp = y + dy
            nzp = z + dz
            if nxp < 0 or nyp < 0 or nzp < 0 or nxp >= nx or nyp >= ny or nzp >= nz:
                continue
            neighbor_index = nxp + nx * (nyp + ny * nzp)
            if data[neighbor_index] == chamber_b:
                best_neighbor = (nxp, nyp, nzp)
                break
        if best_neighbor is None:
            continue

        point_a = voxel_to_world(volume, float(x), float(y), float(z))
        point_b = voxel_to_world(volume, float(best_neighbor[0]), float(best_neighbor[1]), float(best_neighbor[2]))
        interface_points.append(lerp(point_a, point_b, 0.5))

    if len(interface_points) < 50:
        raise ValueError(f"{name}: annulus detection found only {len(interface_points)} boundary voxels")

    center = (
        sum(point[0] for point in interface_points) / len(interface_points),
        sum(point[1] for point in interface_points) / len(interface_points),
        sum(point[2] for point in interface_points) / len(interface_points),
    )

    covariance = [[0.0, 0.0, 0.0] for _ in range(3)]
    for point in interface_points:
        rel = vector_sub(point, center)
        covariance[0][0] += rel[0] * rel[0]
        covariance[0][1] += rel[0] * rel[1]
        covariance[0][2] += rel[0] * rel[2]
        covariance[1][0] += rel[1] * rel[0]
        covariance[1][1] += rel[1] * rel[1]
        covariance[1][2] += rel[1] * rel[2]
        covariance[2][0] += rel[2] * rel[0]
        covariance[2][1] += rel[2] * rel[1]
        covariance[2][2] += rel[2] * rel[2]

    scale = 1.0 / float(len(interface_points))
    for row in range(3):
        for column in range(3):
            covariance[row][column] *= scale

    _, eigenvectors = jacobi_eigen_symmetric(covariance)
    basis_u = eigenvectors[0]
    basis_v = eigenvectors[1]
    normal = eigenvectors[2]

    chamber_direction = normalize(vector_sub(stats[chamber_b].centroid, stats[chamber_a].centroid))
    if vector_dot(normal, chamber_direction) < 0.0:
        normal = vector_scale(normal, -1.0)
        basis_v = vector_scale(basis_v, -1.0)
    if vector_dot(vector_cross(basis_u, basis_v), normal) < 0.0:
        basis_v = vector_scale(basis_v, -1.0)

    projected_u: list[float] = []
    projected_v: list[float] = []
    for point in interface_points:
        rel = vector_sub(point, center)
        projected_u.append(vector_dot(rel, basis_u))
        projected_v.append(vector_dot(rel, basis_v))

    semi_major_mm = max(percentile_abs(projected_u, 0.92), volume.spacing[0] * 4.0)
    semi_minor_mm = max(percentile_abs(projected_v, 0.92), volume.spacing[1] * 4.0)
    radius_mm = 0.5 * (semi_major_mm + semi_minor_mm)
    if radius_floor_mm is not None and radius_mm < radius_floor_mm:
        radius_mm = radius_floor_mm
        semi_major_mm = max(semi_major_mm, radius_floor_mm)
        semi_minor_mm = max(semi_minor_mm, radius_floor_mm)

    return ValveAnnulus(
        name=name,
        center=center,
        normal=normal,
        basis_u=basis_u,
        basis_v=basis_v,
        semi_major_mm=semi_major_mm,
        semi_minor_mm=semi_minor_mm,
        radius_mm=radius_mm,
        interface_points=interface_points,
    )


def ellipse_point(
    annulus: ValveAnnulus,
    axis_u: tuple[float, float, float],
    axis_v: tuple[float, float, float],
    angle: float,
) -> tuple[float, float, float]:
    offset_u = vector_scale(axis_u, annulus.semi_major_mm * math.cos(angle))
    offset_v = vector_scale(axis_v, annulus.semi_minor_mm * math.sin(angle))
    return vector_add(annulus.center, vector_add(offset_u, offset_v))


def circle_point(
    annulus: ValveAnnulus,
    axis_u: tuple[float, float, float],
    axis_v: tuple[float, float, float],
    angle: float,
) -> tuple[float, float, float]:
    offset_u = vector_scale(axis_u, annulus.radius_mm * math.cos(angle))
    offset_v = vector_scale(axis_v, annulus.radius_mm * math.sin(angle))
    return vector_add(annulus.center, vector_add(offset_u, offset_v))


def build_reference_axes(
    annulus: ValveAnnulus,
    preferred_direction: tuple[float, float, float],
) -> tuple[tuple[float, float, float], tuple[float, float, float]]:
    projected = project_to_plane(preferred_direction, annulus.normal)
    if vector_length(projected) < EPSILON:
        axis_u = annulus.basis_u
    else:
        axis_u = normalize(projected)
    axis_v = normalize(vector_cross(annulus.normal, axis_u))
    if vector_length(axis_v) < EPSILON:
        axis_u = annulus.basis_u
        axis_v = annulus.basis_v
    return axis_u, axis_v


def build_annulus_arc(
    annulus: ValveAnnulus,
    axis_u: tuple[float, float, float],
    axis_v: tuple[float, float, float],
    start_angle: float,
    end_angle: float,
    columns: int,
    point_fn: Callable[[ValveAnnulus, tuple[float, float, float], tuple[float, float, float], float], tuple[float, float, float]],
) -> list[tuple[float, float, float]]:
    total_angle = arc_angle_distance(start_angle, end_angle)
    result: list[tuple[float, float, float]] = []
    for column in range(columns):
        t = 0.0 if columns == 1 else column / float(columns - 1)
        angle = start_angle + total_angle * t
        result.append(point_fn(annulus, axis_u, axis_v, angle))
    return result


def build_line_curve(
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    normal: tuple[float, float, float],
    bow_mm: float,
    columns: int,
) -> list[tuple[float, float, float]]:
    curve: list[tuple[float, float, float]] = []
    for column in range(columns):
        t = 0.0 if columns == 1 else column / float(columns - 1)
        point = lerp(start, end, t)
        point = vector_add(point, vector_scale(normal, bow_mm * math.sin(math.pi * t)))
        curve.append(point)
    return curve


def build_free_edge_curve(
    commissure_a: tuple[float, float, float],
    center_point: tuple[float, float, float],
    commissure_b: tuple[float, float, float],
    columns: int,
) -> list[tuple[float, float, float]]:
    result: list[tuple[float, float, float]] = []
    for column in range(columns):
        t = 0.0 if columns == 1 else column / float(columns - 1)
        if t <= 0.5:
            point = lerp(commissure_a, center_point, t * 2.0)
        else:
            point = lerp(center_point, commissure_b, (t - 0.5) * 2.0)
        result.append(point)
    return result


def build_surface_mesh(
    name: str,
    annulus_curve: list[tuple[float, float, float]],
    free_edge_curve: list[tuple[float, float, float]],
    bow_direction: tuple[float, float, float],
    leaflet_bow_mm: float,
    rows: int,
) -> tuple[Mesh, list[tuple[float, float, float]]]:
    if len(annulus_curve) != len(free_edge_curve):
        raise ValueError(f"{name}: annulus/free-edge columns do not match")

    columns = len(annulus_curve)
    vertices: list[tuple[float, float, float]] = []
    samples: list[tuple[float, float, float]] = []

    for row in range(rows):
        r = 0.0 if rows == 1 else row / float(rows - 1)
        bow_factor = math.sin(math.pi * r)
        for column in range(columns):
            t = 0.0 if columns == 1 else column / float(columns - 1)
            point = lerp(annulus_curve[column], free_edge_curve[column], r)
            point = vector_add(point, vector_scale(bow_direction, leaflet_bow_mm * bow_factor * math.sin(math.pi * t)))
            vertices.append(point)
            samples.append(point)

    # Add cell-center samples to improve voxel coverage without changing the mesh itself.
    for row in range(rows - 1):
        for column in range(columns - 1):
            index_00 = row * columns + column
            index_10 = (row + 1) * columns + column
            index_01 = row * columns + column + 1
            index_11 = (row + 1) * columns + column + 1
            point = (
                (vertices[index_00][0] + vertices[index_10][0] + vertices[index_01][0] + vertices[index_11][0]) * 0.25,
                (vertices[index_00][1] + vertices[index_10][1] + vertices[index_01][1] + vertices[index_11][1]) * 0.25,
                (vertices[index_00][2] + vertices[index_10][2] + vertices[index_01][2] + vertices[index_11][2]) * 0.25,
            )
            samples.append(point)

    indices: list[int] = []
    for row in range(rows - 1):
        for column in range(columns - 1):
            top_left = row * columns + column
            bottom_left = (row + 1) * columns + column
            top_right = row * columns + column + 1
            bottom_right = (row + 1) * columns + column + 1
            indices.extend((top_left, bottom_left, top_right))
            indices.extend((top_right, bottom_left, bottom_right))

    return Mesh(name=name, vertices=vertices, indices=indices), samples


def build_mitral_valve(
    annulus: ValveAnnulus,
    stats: dict[int, LabelStats],
) -> tuple[list[Mesh], list[tuple[tuple[float, float, float], tuple[float, float, float]]]]:
    aorta_direction = vector_sub(stats[16].centroid, annulus.center)
    axis_u, axis_v = build_reference_axes(annulus, aorta_direction)

    anterior_span = 2.0 * math.pi / 3.0
    anterior_start = -anterior_span * 0.5
    anterior_end = anterior_span * 0.5

    commissure_a = ellipse_point(annulus, axis_u, axis_v, anterior_start)
    commissure_b = ellipse_point(annulus, axis_u, axis_v, anterior_end)
    coaptation_curve = build_line_curve(
        commissure_a,
        commissure_b,
        annulus.normal,
        bow_mm=1.6,
        columns=max(48, int((2.0 * annulus.radius_mm) / 0.6)),
    )

    anterior_arc_length = anterior_span * annulus.radius_mm
    posterior_arc_length = (2.0 * math.pi - anterior_span) * annulus.radius_mm
    anterior_columns = max(36, int(anterior_arc_length / 0.6))
    posterior_columns = max(72, int(posterior_arc_length / 0.6))
    rows = max(16, int(annulus.radius_mm / 0.45))

    anterior_annulus = build_annulus_arc(
        annulus,
        axis_u,
        axis_v,
        anterior_start,
        anterior_end,
        anterior_columns,
        ellipse_point,
    )
    anterior_coaptation = build_line_curve(commissure_a, commissure_b, annulus.normal, bow_mm=1.6, columns=anterior_columns)
    posterior_annulus = build_annulus_arc(
        annulus,
        axis_u,
        axis_v,
        anterior_end,
        anterior_start,
        posterior_columns,
        ellipse_point,
    )
    posterior_coaptation = build_line_curve(commissure_b, commissure_a, annulus.normal, bow_mm=1.6, columns=posterior_columns)

    anterior_mesh, anterior_samples = build_surface_mesh(
        "mitral_anterior",
        anterior_annulus,
        anterior_coaptation,
        bow_direction=annulus.normal,
        leaflet_bow_mm=2.6,
        rows=rows,
    )
    posterior_mesh, posterior_samples = build_surface_mesh(
        "mitral_posterior",
        posterior_annulus,
        posterior_coaptation,
        bow_direction=annulus.normal,
        leaflet_bow_mm=1.3,
        rows=max(12, rows - 2),
    )

    sample_pairs = [(sample, annulus.normal) for sample in anterior_samples + posterior_samples]
    return [anterior_mesh, posterior_mesh], sample_pairs


def build_semilunar_valve(
    annulus: ValveAnnulus,
    center_angles: list[tuple[str, float]],
    bow_direction: tuple[float, float, float],
) -> tuple[list[Mesh], list[tuple[tuple[float, float, float], tuple[float, float, float]]]]:
    axis_u = annulus.basis_u
    axis_v = annulus.basis_v

    meshes: list[Mesh] = []
    sample_pairs: list[tuple[tuple[float, float, float], tuple[float, float, float]]] = []
    span = 2.0 * math.pi / 3.0
    rows = max(14, int(annulus.radius_mm / 0.45))
    columns = max(40, int((annulus.radius_mm * span) / 0.55))

    for name, center_angle in center_angles:
        start_angle = center_angle - span * 0.5
        end_angle = center_angle + span * 0.5
        commissure_a = circle_point(annulus, axis_u, axis_v, start_angle)
        commissure_b = circle_point(annulus, axis_u, axis_v, end_angle)
        annulus_arc = build_annulus_arc(
            annulus,
            axis_u,
            axis_v,
            start_angle,
            end_angle,
            columns,
            circle_point,
        )
        central_point = vector_add(annulus.center, vector_scale(bow_direction, 1.4))
        free_edge = build_free_edge_curve(commissure_a, central_point, commissure_b, columns)
        mesh, samples = build_surface_mesh(
            name,
            annulus_arc,
            free_edge,
            bow_direction=bow_direction,
            leaflet_bow_mm=1.4,
            rows=rows,
        )
        meshes.append(mesh)
        sample_pairs.extend((sample, bow_direction) for sample in samples)

    return meshes, sample_pairs


def build_tricuspid_valve(
    annulus: ValveAnnulus,
    stats: dict[int, LabelStats],
) -> tuple[list[Mesh], list[tuple[tuple[float, float, float], tuple[float, float, float]]]]:
    septal_direction = vector_sub(stats[11].centroid, annulus.center)
    axis_u, axis_v = build_reference_axes(annulus, septal_direction)
    anterior_axis = normalize(project_to_plane((0.0, 1.0, 0.0), annulus.normal))
    if vector_length(anterior_axis) < EPSILON:
        anterior_axis = axis_v

    candidate_positive = normalize(
        vector_add(vector_scale(axis_u, math.cos(2.0 * math.pi / 3.0)), vector_scale(axis_v, math.sin(2.0 * math.pi / 3.0)))
    )
    candidate_negative = normalize(
        vector_add(vector_scale(axis_u, math.cos(-2.0 * math.pi / 3.0)), vector_scale(axis_v, math.sin(-2.0 * math.pi / 3.0)))
    )
    if vector_dot(candidate_positive, anterior_axis) >= vector_dot(candidate_negative, anterior_axis):
        anterior_angle = 2.0 * math.pi / 3.0
        posterior_angle = -2.0 * math.pi / 3.0
    else:
        anterior_angle = -2.0 * math.pi / 3.0
        posterior_angle = 2.0 * math.pi / 3.0

    annulus = ValveAnnulus(
        name=annulus.name,
        center=annulus.center,
        normal=annulus.normal,
        basis_u=axis_u,
        basis_v=axis_v,
        semi_major_mm=annulus.semi_major_mm,
        semi_minor_mm=annulus.semi_minor_mm,
        radius_mm=annulus.radius_mm,
        interface_points=annulus.interface_points,
    )

    return build_semilunar_valve(
        annulus,
        [
            ("tricuspid_septal", 0.0),
            ("tricuspid_anterior", anterior_angle),
            ("tricuspid_posterior", posterior_angle),
        ],
        bow_direction=annulus.normal,
    )


def build_aortic_valve(
    annulus: ValveAnnulus,
    stats: dict[int, LabelStats],
) -> tuple[list[Mesh], list[tuple[tuple[float, float, float], tuple[float, float, float]]]]:
    la_direction = vector_sub(stats[13].centroid, annulus.center)
    axis_u, axis_v = build_reference_axes(annulus, la_direction)
    anterior_axis = normalize(project_to_plane((0.0, 1.0, 0.0), annulus.normal))
    if vector_length(anterior_axis) < EPSILON:
        anterior_axis = axis_v

    candidate_a = normalize(
        vector_add(vector_scale(axis_u, math.cos(2.0 * math.pi / 3.0)), vector_scale(axis_v, math.sin(2.0 * math.pi / 3.0)))
    )
    candidate_b = normalize(
        vector_add(vector_scale(axis_u, math.cos(-2.0 * math.pi / 3.0)), vector_scale(axis_v, math.sin(-2.0 * math.pi / 3.0)))
    )
    if vector_dot(candidate_a, anterior_axis) >= vector_dot(candidate_b, anterior_axis):
        rcc_angle = 2.0 * math.pi / 3.0
        lcc_angle = -2.0 * math.pi / 3.0
    else:
        rcc_angle = -2.0 * math.pi / 3.0
        lcc_angle = 2.0 * math.pi / 3.0

    annulus = ValveAnnulus(
        name=annulus.name,
        center=annulus.center,
        normal=annulus.normal,
        basis_u=axis_u,
        basis_v=axis_v,
        semi_major_mm=max(annulus.radius_mm, annulus.semi_major_mm),
        semi_minor_mm=max(annulus.radius_mm, annulus.semi_minor_mm),
        radius_mm=annulus.radius_mm,
        interface_points=annulus.interface_points,
    )
    return build_semilunar_valve(
        annulus,
        [
            ("aortic_ncc", 0.0),
            ("aortic_rcc", rcc_angle),
            ("aortic_lcc", lcc_angle),
        ],
        bow_direction=vector_scale(annulus.normal, -1.0),
    )


def build_pulmonic_valve(annulus: ValveAnnulus) -> tuple[list[Mesh], list[tuple[tuple[float, float, float], tuple[float, float, float]]]]:
    return build_semilunar_valve(
        annulus,
        [
            ("pulmonic_cusp_1", 0.0),
            ("pulmonic_cusp_2", 2.0 * math.pi / 3.0),
            ("pulmonic_cusp_3", -2.0 * math.pi / 3.0),
        ],
        bow_direction=vector_scale(annulus.normal, -1.0),
    )


def stamp_samples_into_labels(
    volume: Volume,
    label_bytes: bytearray,
    samples: list[tuple[tuple[float, float, float], tuple[float, float, float]]],
    label_id: int,
    thickness_voxels: int,
) -> int:
    offsets = [index - (thickness_voxels - 1) * 0.5 for index in range(thickness_voxels)]
    stamped = 0
    for point, normal in samples:
        for layer in offsets:
            thick_point = vector_add(point, vector_scale(normal, layer * volume.spacing[0]))
            x, y, z = world_to_voxel(volume, thick_point)
            if x < 0 or y < 0 or z < 0 or x >= volume.dims[0] or y >= volume.dims[1] or z >= volume.dims[2]:
                continue
            index = voxel_index(x, y, z, volume.dims)
            if label_bytes[index] != label_id:
                label_bytes[index] = label_id
                stamped += 1
    return stamped


def make_glb(meshes: list[Mesh], output_path: str) -> None:
    json_accessors: list[dict[str, object]] = []
    json_buffer_views: list[dict[str, object]] = []
    json_meshes: list[dict[str, object]] = []
    json_nodes: list[dict[str, object]] = []
    binary = bytearray()

    def append_aligned(payload: bytes) -> tuple[int, int]:
        while len(binary) % 4 != 0:
            binary.append(0)
        offset = len(binary)
        binary.extend(payload)
        while len(binary) % 4 != 0:
            binary.append(0)
        return offset, len(payload)

    for mesh_index, mesh in enumerate(meshes):
        if not mesh.vertices or not mesh.indices:
            continue

        position_bytes = bytearray()
        min_values = [float("inf"), float("inf"), float("inf")]
        max_values = [float("-inf"), float("-inf"), float("-inf")]
        for vertex in mesh.vertices:
            for axis in range(3):
                if vertex[axis] < min_values[axis]:
                    min_values[axis] = vertex[axis]
                if vertex[axis] > max_values[axis]:
                    max_values[axis] = vertex[axis]
            for value in vertex:
                position_bytes.extend(FLOAT32.pack(float(value)))

        index_bytes = bytearray()
        for index in mesh.indices:
            index_bytes.extend(UINT32_PACK.pack(index))

        position_offset, position_length = append_aligned(bytes(position_bytes))
        position_view_index = len(json_buffer_views)
        json_buffer_views.append(
            {
                "buffer": 0,
                "byteOffset": position_offset,
                "byteLength": position_length,
                "target": 34962,
            }
        )
        position_accessor_index = len(json_accessors)
        json_accessors.append(
            {
                "bufferView": position_view_index,
                "componentType": 5126,
                "count": len(mesh.vertices),
                "type": "VEC3",
                "min": min_values,
                "max": max_values,
            }
        )

        index_offset, index_length = append_aligned(bytes(index_bytes))
        index_view_index = len(json_buffer_views)
        json_buffer_views.append(
            {
                "buffer": 0,
                "byteOffset": index_offset,
                "byteLength": index_length,
                "target": 34963,
            }
        )
        index_accessor_index = len(json_accessors)
        json_accessors.append(
            {
                "bufferView": index_view_index,
                "componentType": 5125,
                "count": len(mesh.indices),
                "type": "SCALAR",
                "min": [min(mesh.indices)],
                "max": [max(mesh.indices)],
            }
        )

        json_meshes.append(
            {
                "name": mesh.name,
                "primitives": [
                    {
                        "attributes": {"POSITION": position_accessor_index},
                        "indices": index_accessor_index,
                        "mode": 4,
                    }
                ],
            }
        )
        json_nodes.append({"mesh": len(json_meshes) - 1, "name": mesh.name})

    gltf = {
        "asset": {"version": "2.0", "generator": "TeeSim tools/asset-pipeline/generate_valves.py"},
        "scene": 0,
        "scenes": [{"nodes": list(range(len(json_nodes)))}],
        "nodes": json_nodes,
        "meshes": json_meshes,
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": json_buffer_views,
        "accessors": json_accessors,
    }
    json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    while len(json_bytes) % 4 != 0:
        json_bytes += b" "
    while len(binary) % 4 != 0:
        binary.append(0)

    header = b"glTF" + UINT32_PACK.pack(2)
    total_length = 12 + 8 + len(json_bytes) + 8 + len(binary)
    header += UINT32_PACK.pack(total_length)
    json_chunk = UINT32_PACK.pack(len(json_bytes)) + b"JSON" + json_bytes
    bin_chunk = UINT32_PACK.pack(len(binary)) + b"BIN\x00" + bytes(binary)
    with open(output_path, "wb") as handle:
        handle.write(header)
        handle.write(json_chunk)
        handle.write(bin_chunk)


def valve_metadata(annulus: ValveAnnulus, label_id: int, leaflet_count: int) -> dict[str, object]:
    return {
        "center": [round(value, 6) for value in annulus.center],
        "normal": [round(value, 6) for value in annulus.normal],
        "radius": round(annulus.radius_mm, 6),
        "labelId": label_id,
        "leafletCount": leaflet_count,
    }


def integrate_into_pipeline_file(repo_root: str) -> None:
    # Placeholder to keep the function name stable if future pipeline integration
    # needs to be implemented from this script directly.
    _ = repo_root


def main() -> int:
    args = parse_args()
    os.makedirs(args.output_dir, exist_ok=True)

    label_volume = parse_vti(args.label_vti, decode_scalars=True)
    roi_volume = parse_vti(args.roi_vti, decode_scalars=False)
    ensure_same_grid(label_volume, roi_volume)

    stats = analyze_labels(label_volume)
    label_bytes = bytearray(label_volume.data)

    annuli = {
        "mitral": fit_annulus(label_volume, label_volume.data, stats, "mitral", chamber_a=13, chamber_b=11, dilation_radius=2),
        "aortic": fit_annulus(label_volume, label_volume.data, stats, "aortic", chamber_a=11, chamber_b=16, dilation_radius=4, radius_floor_mm=10.0),
        "tricuspid": fit_annulus(label_volume, label_volume.data, stats, "tricuspid", chamber_a=14, chamber_b=12, dilation_radius=2),
        "pulmonic": fit_annulus(label_volume, label_volume.data, stats, "pulmonic", chamber_a=12, chamber_b=17, dilation_radius=3),
    }

    all_meshes: list[Mesh] = []
    metadata: dict[str, dict[str, object]] = {}

    mitral_meshes, mitral_samples = build_mitral_valve(annuli["mitral"], stats)
    all_meshes.extend(mitral_meshes)
    stamped = stamp_samples_into_labels(label_volume, label_bytes, mitral_samples, VALVE_LABELS["mitral"], args.thickness_voxels)
    print(f"mitral: center={annuli['mitral'].center} radius={annuli['mitral'].radius_mm:.2f}mm stamped={stamped}")
    metadata["mitral"] = valve_metadata(annuli["mitral"], VALVE_LABELS["mitral"], leaflet_count=2)

    aortic_meshes, aortic_samples = build_aortic_valve(annuli["aortic"], stats)
    all_meshes.extend(aortic_meshes)
    stamped = stamp_samples_into_labels(label_volume, label_bytes, aortic_samples, VALVE_LABELS["aortic"], args.thickness_voxels)
    print(f"aortic: center={annuli['aortic'].center} radius={annuli['aortic'].radius_mm:.2f}mm stamped={stamped}")
    metadata["aortic"] = valve_metadata(annuli["aortic"], VALVE_LABELS["aortic"], leaflet_count=3)

    tricuspid_meshes, tricuspid_samples = build_tricuspid_valve(annuli["tricuspid"], stats)
    all_meshes.extend(tricuspid_meshes)
    stamped = stamp_samples_into_labels(label_volume, label_bytes, tricuspid_samples, VALVE_LABELS["tricuspid"], args.thickness_voxels)
    print(f"tricuspid: center={annuli['tricuspid'].center} radius={annuli['tricuspid'].radius_mm:.2f}mm stamped={stamped}")
    metadata["tricuspid"] = valve_metadata(annuli["tricuspid"], VALVE_LABELS["tricuspid"], leaflet_count=3)

    pulmonic_meshes, pulmonic_samples = build_pulmonic_valve(annuli["pulmonic"])
    all_meshes.extend(pulmonic_meshes)
    stamped = stamp_samples_into_labels(label_volume, label_bytes, pulmonic_samples, VALVE_LABELS["pulmonic"], args.thickness_voxels)
    print(f"pulmonic: center={annuli['pulmonic'].center} radius={annuli['pulmonic'].radius_mm:.2f}mm stamped={stamped}")
    metadata["pulmonic"] = valve_metadata(annuli["pulmonic"], VALVE_LABELS["pulmonic"], leaflet_count=3)

    output_label_path = os.path.join(args.output_dir, args.output_label_name)
    write_vti(
        Volume(
            dims=label_volume.dims,
            origin=label_volume.origin,
            spacing=label_volume.spacing,
            direction=label_volume.direction,
            scalar_type="UInt8",
            data=bytes(label_bytes),
            whole_extent=label_volume.whole_extent,
        ),
        output_label_path,
    )
    metadata_path = os.path.join(args.output_dir, "valves.json")
    with open(metadata_path, "w", encoding="utf-8") as handle:
        json.dump(metadata, handle, indent=2)
        handle.write("\n")

    glb_path = os.path.join(args.output_dir, "valve_meshes.glb")
    make_glb(all_meshes, glb_path)
    print(f"wrote {output_label_path}")
    print(f"wrote {metadata_path}")
    print(f"wrote {glb_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
