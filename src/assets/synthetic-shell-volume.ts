import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray.js';
import vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData.js';
import type { vtkImageData as VtkImageData } from '@kitware/vtk.js/Common/DataModel/ImageData';

const volumeCache = new Map<string, VtkImageData>();

const buildSyntheticShellVolume = (): VtkImageData => {
  const dimensions = [112, 112, 144] as const;
  const spacing = [1.4, 1.4, 1.4] as const;
  const origin = [
    -(dimensions[0] * spacing[0]) / 2,
    -(dimensions[1] * spacing[1]) / 2,
    -(dimensions[2] * spacing[2]) / 2,
  ] as const;

  const image = vtkImageData.newInstance({
    extent: [0, dimensions[0] - 1, 0, dimensions[1] - 1, 0, dimensions[2] - 1],
    origin: [...origin],
    spacing: [...spacing],
  });

  const values = new Int16Array(dimensions[0] * dimensions[1] * dimensions[2]);
  let flatIndex = 0;

  for (let z = 0; z < dimensions[2]; z += 1) {
    const worldZ = origin[2] + z * spacing[2];

    for (let y = 0; y < dimensions[1]; y += 1) {
      const worldY = origin[1] + y * spacing[1];

      for (let x = 0; x < dimensions[0]; x += 1, flatIndex += 1) {
        const worldX = origin[0] + x * spacing[0];
        let intensity = -920;

        const torso = (worldX * worldX) / (60 * 60) + (worldY * worldY) / (54 * 54);
        if (torso <= 1.0) {
          intensity = -760;
        }

        const heartBody =
          (worldX * worldX) / (28 * 28) +
          ((worldY + 8) * (worldY + 8)) / (24 * 24) +
          ((worldZ + 8) * (worldZ + 8)) / (34 * 34);
        if (heartBody <= 1.0) {
          intensity = 120;
        }

        const leftVentricle =
          ((worldX + 8) * (worldX + 8)) / (11 * 11) +
          ((worldY + 2) * (worldY + 2)) / (14 * 14) +
          ((worldZ + 12) * (worldZ + 12)) / (16 * 16);
        if (leftVentricle <= 1.0) {
          intensity = 34;
        }

        const rightVentricle =
          ((worldX - 9) * (worldX - 9)) / (10 * 10) +
          ((worldY + 1) * (worldY + 1)) / (15 * 15) +
          ((worldZ + 8) * (worldZ + 8)) / (18 * 18);
        if (rightVentricle <= 1.0) {
          intensity = 58;
        }

        const atria =
          (worldX * worldX) / (18 * 18) +
          ((worldY + 16) * (worldY + 16)) / (10 * 10) +
          ((worldZ - 4) * (worldZ - 4)) / (18 * 18);
        if (atria <= 1.0) {
          intensity = 82;
        }

        const valveRing =
          (worldX * worldX) / (13 * 13) +
          ((worldY + 8) * (worldY + 8)) / (4.2 * 4.2) +
          ((worldZ + 1) * (worldZ + 1)) / (13 * 13);
        if (valveRing <= 1.0 && valveRing >= 0.42) {
          intensity = 210;
        }

        values[flatIndex] = intensity;
      }
    }
  }

  const scalars = vtkDataArray.newInstance({
    dataType: 'Int16Array',
    name: 'SyntheticHeartRoi',
    numberOfComponents: 1,
    values,
  });
  image.getPointData().setScalars(scalars);
  image.modified();

  return image;
};

export const getSyntheticShellVolume = (caseId: string): VtkImageData => {
  const cached = volumeCache.get(caseId);
  if (cached) {
    return cached;
  }

  // TODO(asset-volume): Replace the synthetic shell volume with fetched heart_roi.vti decoding.
  const volume = buildSyntheticShellVolume();
  volumeCache.set(caseId, volume);
  return volume;
};
