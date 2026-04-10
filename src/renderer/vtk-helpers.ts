import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import '@kitware/vtk.js/Rendering/Profiles/Volume';

import type { mat4 } from 'gl-matrix';
import vtkCellArray from '@kitware/vtk.js/Common/Core/CellArray.js';
import vtkPoints from '@kitware/vtk.js/Common/Core/Points.js';
import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData.js';
import vtkAppendPolyData from '@kitware/vtk.js/Filters/General/AppendPolyData.js';
import vtkConeSource from '@kitware/vtk.js/Filters/Sources/ConeSource.js';
import vtkCubeSource from '@kitware/vtk.js/Filters/Sources/CubeSource.js';
import vtkCylinderSource from '@kitware/vtk.js/Filters/Sources/CylinderSource.js';
import vtkGLTFImporter from '@kitware/vtk.js/IO/Geometry/GLTFImporter.js';
import vtkInteractorStyleTrackballCamera from '@kitware/vtk.js/Interaction/Style/InteractorStyleTrackballCamera.js';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor.js';
import vtkLight from '@kitware/vtk.js/Rendering/Core/Light.js';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper.js';
import vtkGenericRenderWindow from '@kitware/vtk.js/Rendering/Misc/GenericRenderWindow.js';
import type { RGBColor } from '@kitware/vtk.js/types';
import type { vtkGenericRenderWindow as VtkGenericRenderWindow } from '@kitware/vtk.js/Rendering/Misc/GenericRenderWindow';
import type { vtkActor as VtkActor } from '@kitware/vtk.js/Rendering/Core/Actor';
import type { ImagingPlane, Vec3 } from '../core';

const DEFAULT_BACKGROUND: RGBColor = [0.03, 0.04, 0.06];
const DEFAULT_FAN_ANGLE_DEG = 90;
const DEFAULT_FAN_DEPTH_MM = 140;
const DEFAULT_FAN_SEGMENTS = 48;

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (vector: Vec3, factor: number): Vec3 => [
  vector[0] * factor,
  vector[1] * factor,
  vector[2] * factor,
];

export const createRenderWindow = (
  container: HTMLElement,
  background: RGBColor = DEFAULT_BACKGROUND,
): VtkGenericRenderWindow => {
  const generic = vtkGenericRenderWindow.newInstance({
    background,
    listenWindowResize: false,
  });

  // Must call setContainer explicitly — newInstance stores it in model
  // but does NOT attach the OpenGL canvas to the DOM.
  generic.setContainer(container);
  const renderer = generic.getRenderer();
  const light = vtkLight.newInstance();
  light.setPosition(1, 1, 1);
  light.setIntensity(1.0);
  light.setLightTypeToSceneLight();
  renderer.addLight(light);
  generic.getInteractor().setInteractorStyle(vtkInteractorStyleTrackballCamera.newInstance());
  generic.resize();
  return generic;
};

export const setCanvasTestId = (container: HTMLElement, testId: string): void => {
  const canvas = container.querySelector('canvas');
  if (canvas) {
    canvas.setAttribute('data-testid', testId);
  }
};

export const setCanvasRenderState = (
  container: HTMLElement,
  renderState: 'empty' | 'loading' | 'ready',
): void => {
  const canvas = container.querySelector('canvas');
  if (canvas) {
    canvas.setAttribute('data-render-state', renderState);
  }
};

export const loadGLB = async (url: string): Promise<VtkActor[]> => {
  const importer = vtkGLTFImporter.newInstance();
  const ready = new Promise<void>((resolve) => {
    importer.onReady(() => resolve());
  });

  await importer.setUrl(url, { binary: url.toLowerCase().endsWith('.glb') });
  await ready;
  return Array.from(importer.getActors().values());
};

export const createProbeGlyph = (): VtkActor => {
  const shaft = vtkCylinderSource.newInstance({
    capping: true,
    center: [0, 0, 42],
    direction: [0, 0, 1],
    height: 84,
    radius: 4,
    resolution: 36,
  });
  const tip = vtkConeSource.newInstance({
    capping: true,
    center: [0, 0, 94],
    direction: [0, 0, 1],
    height: 24,
    radius: 6.5,
    resolution: 36,
  });
  const append = vtkAppendPolyData.newInstance();
  append.setInputConnection(shaft.getOutputPort());
  append.addInputConnection(tip.getOutputPort());

  const mapper = vtkMapper.newInstance();
  mapper.setInputConnection(append.getOutputPort());

  const actor = vtkActor.newInstance();
  actor.setMapper(mapper);
  actor.getProperty().setColor(0.92, 0.92, 0.95);
  actor.getProperty().setSpecular(0.2);
  actor.getProperty().setSpecularPower(20);
  return actor;
};

export const createPlaceholderBoxActor = (): VtkActor => {
  const cube = vtkCubeSource.newInstance({
    center: [0, 0, 0],
    xLength: 120,
    yLength: 80,
    zLength: 100,
  });
  const mapper = vtkMapper.newInstance();
  mapper.setInputConnection(cube.getOutputPort());

  const actor = vtkActor.newInstance();
  actor.setMapper(mapper);
  actor.getProperty().setColor(0.72, 0.48, 0.18);
  actor.getProperty().setOpacity(0.6);
  actor.getProperty().setRepresentationToWireframe();
  return actor;
};

export const createSectorPlane = (plane: ImagingPlane): VtkActor => {
  const halfAngleRad = (DEFAULT_FAN_ANGLE_DEG * Math.PI) / 360;
  const points = vtkPoints.newInstance();
  const polys = vtkCellArray.newInstance();
  const polyData = vtkPolyData.newInstance();

  points.insertNextPoint(plane.origin[0], plane.origin[1], plane.origin[2]);

  const arcPointIds: number[] = [];
  for (let index = 0; index <= DEFAULT_FAN_SEGMENTS; index += 1) {
    const t = index / DEFAULT_FAN_SEGMENTS;
    const angle = -halfAngleRad + t * halfAngleRad * 2;
    const lateral = Math.sin(angle) * DEFAULT_FAN_DEPTH_MM;
    const depth = Math.cos(angle) * DEFAULT_FAN_DEPTH_MM;
    const point = add(
      plane.origin,
      add(scale(plane.right, lateral), scale(plane.up, depth)),
    );
    arcPointIds.push(points.insertNextPoint(point[0], point[1], point[2]));
  }

  for (let index = 0; index < arcPointIds.length - 1; index += 1) {
    polys.insertNextCell([0, arcPointIds[index], arcPointIds[index + 1]]);
  }

  polyData.setPoints(points);
  polyData.setPolys(polys);

  const mapper = vtkMapper.newInstance();
  mapper.setInputData(polyData);

  const actor = vtkActor.newInstance();
  actor.setMapper(mapper);
  actor.setForceTranslucent(true);
  actor.getProperty().setColor(0.19, 0.84, 0.96);
  actor.getProperty().setOpacity(0.22);
  return actor;
};

export const fitSliceCamera = (
  renderWindow: VtkGenericRenderWindow,
  widthMm: number,
  heightMm: number,
): void => {
  const renderer = renderWindow.getRenderer();
  const camera = renderer.getActiveCamera();
  const focalPoint: Vec3 = [0, heightMm / 2, 0];
  const normal: Vec3 = [0, 0, 1];
  const viewUp: Vec3 = [0, -1, 0];
  const aspect =
    renderWindow.getContainer().clientWidth > 0 && renderWindow.getContainer().clientHeight > 0
      ? renderWindow.getContainer().clientWidth / renderWindow.getContainer().clientHeight
      : 1;
  const parallelScale = Math.max(heightMm / 2, widthMm / (2 * Math.max(aspect, 0.001)));

  camera.setParallelProjection(true);
  camera.setFocalPoint(...focalPoint);
  camera.setPosition(
    focalPoint[0] + normal[0] * 320,
    focalPoint[1] + normal[1] * 320,
    focalPoint[2] + normal[2] * 320,
  );
  camera.setViewUp(...viewUp);
  camera.setParallelScale(parallelScale);
  renderer.resetCameraClippingRange();
};

export const buildResliceAxes = (plane: ImagingPlane): Float32Array => {
  const axes = new Float32Array(16);

  axes[0] = plane.right[0];
  axes[1] = plane.right[1];
  axes[2] = plane.right[2];
  axes[3] = 0;

  axes[4] = plane.up[0];
  axes[5] = plane.up[1];
  axes[6] = plane.up[2];
  axes[7] = 0;

  axes[8] = plane.normal[0];
  axes[9] = plane.normal[1];
  axes[10] = plane.normal[2];
  axes[11] = 0;

  axes[12] = plane.origin[0];
  axes[13] = plane.origin[1];
  axes[14] = plane.origin[2];
  axes[15] = 1;

  return axes;
};

export const applyUserMatrix = (actor: VtkActor, matrixValues: readonly number[]): void => {
  actor.setUserMatrix(Float64Array.from(matrixValues) as unknown as mat4);
};

export const disposePipeline = (renderWindow?: VtkGenericRenderWindow | null): void => {
  try {
    renderWindow?.delete();
  } catch {
    // VTK.js cleanup can fail if OpenGL resources were never initialized
  }
};
