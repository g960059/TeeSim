import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import '@kitware/vtk.js/Rendering/Profiles/Volume';

import type { vtkImageData as VtkImageData } from '@kitware/vtk.js/Common/DataModel/ImageData';
import vtkGLTFImporter from '@kitware/vtk.js/IO/Geometry/GLTFImporter.js';
import vtkXMLImageDataReader from '@kitware/vtk.js/IO/XML/XMLImageDataReader.js';
import type vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';

export const loadGlbActors = async (url: string): Promise<readonly vtkActor[]> => {
  const importer = vtkGLTFImporter.newInstance();
  const ready = new Promise<void>((resolve) => {
    importer.onReady(() => resolve());
  });

  await importer.setUrl(url, { binary: url.toLowerCase().endsWith('.glb') });
  await ready;
  return Array.from(importer.getActors().values());
};

export const loadVtiVolume = async (url: string): Promise<VtkImageData> => {
  const reader = vtkXMLImageDataReader.newInstance();
  await reader.setUrl(url, { binary: true });

  const output = reader.getOutputData();
  if (!output) {
    throw new Error(`Failed to parse VTI volume from ${url}.`);
  }

  return output as VtkImageData;
};
