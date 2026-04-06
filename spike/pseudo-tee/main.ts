import '@kitware/vtk.js/Rendering/Profiles/Volume';

import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray.js';
import vtkImageData, { type vtkImageData as VtkImageData } from '@kitware/vtk.js/Common/DataModel/ImageData.js';
import vtkPlane from '@kitware/vtk.js/Common/DataModel/Plane.js';
import { InterpolationMode } from '@kitware/vtk.js/Imaging/Core/AbstractImageInterpolator/Constants.js';
import { SlabMode } from '@kitware/vtk.js/Imaging/Core/ImageReslice/Constants.js';
import vtkImageReslice from '@kitware/vtk.js/Imaging/Core/ImageReslice.js';
import vtkImageMapper from '@kitware/vtk.js/Rendering/Core/ImageMapper.js';
import vtkImageResliceMapper from '@kitware/vtk.js/Rendering/Core/ImageResliceMapper.js';
import { SlabTypes } from '@kitware/vtk.js/Rendering/Core/ImageResliceMapper/Constants.js';
import vtkImageSlice from '@kitware/vtk.js/Rendering/Core/ImageSlice.js';
import vtkGenericRenderWindow from '@kitware/vtk.js/Rendering/Misc/GenericRenderWindow.js';

type Vec3 = [number, number, number];
type InterpolationKey = 'nearest' | 'linear' | 'cubic';

type Controls = {
  depthMm: number;
  interpolation: InterpolationKey;
  planeAngleDeg: number;
  sectorAngleDeg: number;
  slabMm: number;
};

type RenderSurface = {
  container: HTMLDivElement;
  generic: vtkGenericRenderWindow;
};

type PlaneFrame = {
  depthAxis: Vec3;
  lateralAxis: Vec3;
  normal: Vec3;
  probeOrigin: Vec3;
  viewUp: Vec3;
};

type VolumeStats = {
  generationMs: number;
  max: number;
  min: number;
};

type RuntimeStats = {
  cpuMaskMs: number;
  cpuRenderMs: number;
  cpuResliceMs: number;
  gpuInterpolation: 'nearest' | 'linear';
  gpuRenderMs: number;
  gpuStatus: string;
  interpolationDeltaMax: number;
  interpolationDeltaMean: number;
  linearInterpolationObserved: boolean;
  linearBenchmarkMs: number;
  nearestBenchmarkMs: number;
  slabBenchmarkMs: number;
  slabCompositionObserved: boolean;
  slabDeltaMax: number;
  slabDeltaMean: number;
  slabSlices: number;
  volume: VolumeStats;
};

const VOLUME_DIMENSION = 256;
const VOLUME_SPACING_MM = 1;
const OUTPUT_WIDTH_MM = 220;
const OUTPUT_DEPTH_MM = 180;
const OUTPUT_SPACING_MM = 0.5;
const OUTPUT_WIDTH_PX = Math.round(OUTPUT_WIDTH_MM / OUTPUT_SPACING_MM);
const OUTPUT_HEIGHT_PX = Math.round(OUTPUT_DEPTH_MM / OUTPUT_SPACING_MM);
const OUTPUT_EXTENT: [number, number, number, number, number, number] = [
  0,
  OUTPUT_WIDTH_PX - 1,
  0,
  OUTPUT_HEIGHT_PX - 1,
  0,
  0,
];
const OUTPUT_ORIGIN: Vec3 = [-OUTPUT_WIDTH_MM / 2, 0, 0];
const CPU_WINDOW_LOW = -180;
const CPU_WINDOW_HIGH = 240;
const PROBE_ORIGIN: Vec3 = [(VOLUME_DIMENSION - 1) / 2, 52, (VOLUME_DIMENSION - 1) / 2];

const DEFAULT_CONTROLS: Controls = {
  planeAngleDeg: 35,
  depthMm: 145,
  interpolation: 'linear',
  sectorAngleDeg: 90,
  slabMm: 4,
};

const planeAngleInput = getRequiredElement<HTMLInputElement>('plane-angle');
const depthInput = getRequiredElement<HTMLInputElement>('depth');
const sectorAngleInput = getRequiredElement<HTMLInputElement>('sector-angle');
const slabInput = getRequiredElement<HTMLInputElement>('slab');
const interpolationSelect = getRequiredElement<HTMLSelectElement>('interpolation');
const resetButton = getRequiredElement<HTMLButtonElement>('reset');

const planeAngleValue = getRequiredElement<HTMLElement>('plane-angle-value');
const depthValue = getRequiredElement<HTMLElement>('depth-value');
const sectorAngleValue = getRequiredElement<HTMLElement>('sector-angle-value');
const slabValue = getRequiredElement<HTMLElement>('slab-value');
const findingsEl = getRequiredElement<HTMLDivElement>('findings');
const statusEl = getRequiredElement<HTMLDivElement>('status');

const cpuSurface = createRenderSurface(getRequiredElement<HTMLDivElement>('cpu-view'), [0.02, 0.04, 0.06]);
const gpuSurface = createRenderSurface(getRequiredElement<HTMLDivElement>('gpu-view'), [0.04, 0.05, 0.08]);

const volumeStats = createSyntheticVolume();
const volumeImage = volumeStats.image;

const processedImage = createOutputImage();
const processedScalars = processedImage.getPointData().getScalars();
if (!processedScalars) {
  throw new Error('Processed output image was created without scalars.');
}
const processedValues = processedScalars.getData() as Uint8Array;

const cpuReslice = vtkImageReslice.newInstance();
const nearestBenchmarkReslice = vtkImageReslice.newInstance();
const linearBenchmarkReslice = vtkImageReslice.newInstance();
const slabBenchmarkReslice = vtkImageReslice.newInstance();

[cpuReslice, nearestBenchmarkReslice, linearBenchmarkReslice, slabBenchmarkReslice].forEach((reslice) => {
  reslice.setInputData(volumeImage);
  reslice.setOutputDimensionality(2);
  reslice.setOutputSpacing([OUTPUT_SPACING_MM, OUTPUT_SPACING_MM, 1]);
  reslice.setOutputOrigin(OUTPUT_ORIGIN);
  reslice.setOutputExtent(OUTPUT_EXTENT);
  reslice.setBackgroundColor([0, 0, 0, 0]);
  reslice.setSlabMode(SlabMode.MEAN);
  reslice.setSlabSliceSpacingFraction(1);
});

const cpuMapper = vtkImageMapper.newInstance();
cpuMapper.setInputData(processedImage);
cpuMapper.setKSlice(0);

const cpuSlice = vtkImageSlice.newInstance();
cpuSlice.setMapper(cpuMapper);
cpuSlice.getProperty().setColorWindow(255);
cpuSlice.getProperty().setColorLevel(127.5);
cpuSlice.getProperty().setInterpolationTypeToLinear();
cpuSurface.generic.getRenderer().addViewProp(cpuSlice);

let gpuStatus = 'initialized';
const gpuMapper = vtkImageResliceMapper.newInstance();
const gpuPlane = vtkPlane.newInstance();
const gpuSlice = vtkImageSlice.newInstance();

gpuMapper.setInputData(volumeImage);
gpuMapper.setSlicePlane(gpuPlane);
gpuMapper.setSlabType(SlabTypes.MEAN);
gpuSlice.setMapper(gpuMapper);
gpuSlice.getProperty().setColorWindow(CPU_WINDOW_HIGH - CPU_WINDOW_LOW);
gpuSlice.getProperty().setColorLevel((CPU_WINDOW_HIGH + CPU_WINDOW_LOW) / 2);
gpuSlice.getProperty().setInterpolationTypeToLinear();
gpuSurface.generic.getRenderer().addViewProp(gpuSlice);

let latestPlaneFrame = buildPlaneFrame(DEFAULT_CONTROLS.planeAngleDeg);
let updateQueued = false;

syncControlInputs(DEFAULT_CONTROLS);
updateControlLabels(DEFAULT_CONTROLS);
setStatus('Generating 256³ synthetic volume…');

cpuSurface.generic.onResize(() => {
  fitOrthographicCamera(cpuSurface, processedImage.getCenter() as Vec3, [0, 0, 1], [0, -1, 0], OUTPUT_WIDTH_MM, OUTPUT_DEPTH_MM);
});

gpuSurface.generic.onResize(() => {
  fitOrthographicCamera(
    gpuSurface,
    add(latestPlaneFrame.probeOrigin, scale(latestPlaneFrame.depthAxis, OUTPUT_DEPTH_MM * 0.48)),
    latestPlaneFrame.normal,
    latestPlaneFrame.viewUp,
    OUTPUT_WIDTH_MM,
    OUTPUT_DEPTH_MM,
  );
});

resetButton.addEventListener('click', () => {
  syncControlInputs(DEFAULT_CONTROLS);
  scheduleRender();
});

[planeAngleInput, depthInput, sectorAngleInput, slabInput, interpolationSelect].forEach((input) => {
  input.addEventListener('input', () => {
    updateControlLabels(readControls());
    scheduleRender();
  });
});

fitOrthographicCamera(cpuSurface, processedImage.getCenter() as Vec3, [0, 0, 1], [0, -1, 0], OUTPUT_WIDTH_MM, OUTPUT_DEPTH_MM);
scheduleRender();

function scheduleRender(): void {
  if (updateQueued) {
    return;
  }

  updateQueued = true;
  window.requestAnimationFrame(() => {
    updateQueued = false;
    renderSpike();
  });
}

function renderSpike(): void {
  const controls = readControls();
  latestPlaneFrame = buildPlaneFrame(controls.planeAngleDeg);
  const axes = buildResliceAxes(latestPlaneFrame.probeOrigin, latestPlaneFrame.lateralAxis, latestPlaneFrame.depthAxis, latestPlaneFrame.normal);
  const slabSlices = Math.max(1, Math.round(controls.slabMm / VOLUME_SPACING_MM));

  setStatus('Updating reslice and sector presentation…');

  const cpuResliceResult = executeReslice(cpuReslice, axes, toInterpolationMode(controls.interpolation), slabSlices);
  const cpuMaskStart = performance.now();
  applySectorMask(cpuResliceResult.image, processedValues, controls.depthMm, controls.sectorAngleDeg);
  processedScalars.dataChange();
  processedImage.modified();
  const cpuMaskMs = performance.now() - cpuMaskStart;

  const cpuRenderStart = performance.now();
  cpuSurface.generic.getRenderWindow().render();
  const cpuRenderMs = performance.now() - cpuRenderStart;

  const nearestBenchmark = executeReslice(nearestBenchmarkReslice, axes, InterpolationMode.NEAREST, 1);
  const linearBenchmark = executeReslice(linearBenchmarkReslice, axes, InterpolationMode.LINEAR, 1);
  const slabBenchmark = executeReslice(slabBenchmarkReslice, axes, InterpolationMode.LINEAR, slabSlices);
  const interpolationDelta = compareResliceOutputs(nearestBenchmark.image, linearBenchmark.image);
  const slabDelta = compareResliceOutputs(linearBenchmark.image, slabBenchmark.image);

  const gpuRenderStart = performance.now();
  updateGpuPath(latestPlaneFrame, controls);
  const gpuRenderMs = performance.now() - gpuRenderStart;

  const stats: RuntimeStats = {
    cpuMaskMs,
    cpuRenderMs,
    cpuResliceMs: cpuResliceResult.elapsedMs,
    gpuInterpolation: controls.interpolation === 'nearest' ? 'nearest' : 'linear',
    gpuRenderMs,
    gpuStatus,
    interpolationDeltaMax: interpolationDelta.maxAbs,
    interpolationDeltaMean: interpolationDelta.meanAbs,
    linearBenchmarkMs: linearBenchmark.elapsedMs,
    linearInterpolationObserved: interpolationDelta.meanAbs > 0.01 || interpolationDelta.maxAbs > 1,
    nearestBenchmarkMs: nearestBenchmark.elapsedMs,
    slabBenchmarkMs: slabBenchmark.elapsedMs,
    slabCompositionObserved: slabDelta.meanAbs > 0.01 || slabDelta.maxAbs > 1,
    slabDeltaMax: slabDelta.maxAbs,
    slabDeltaMean: slabDelta.meanAbs,
    slabSlices,
    volume: {
      generationMs: volumeStats.generationMs,
      max: volumeStats.max,
      min: volumeStats.min,
    },
  };

  renderFindings(stats, controls);
  setStatus('Spike ready');
}

function updateGpuPath(planeFrame: PlaneFrame, controls: Controls): void {
  try {
    gpuPlane.setOrigin(...planeFrame.probeOrigin);
    gpuPlane.setNormal(...planeFrame.normal);

    if (controls.interpolation === 'nearest') {
      gpuSlice.getProperty().setInterpolationTypeToNearest();
    } else {
      gpuSlice.getProperty().setInterpolationTypeToLinear();
    }

    gpuMapper.setSlabThickness(controls.slabMm);

    fitOrthographicCamera(
      gpuSurface,
      add(planeFrame.probeOrigin, scale(planeFrame.depthAxis, OUTPUT_DEPTH_MM * 0.48)),
      planeFrame.normal,
      planeFrame.viewUp,
      OUTPUT_WIDTH_MM,
      OUTPUT_DEPTH_MM,
    );

    gpuSurface.generic.getRenderWindow().render();
    gpuStatus =
      controls.interpolation === 'cubic'
        ? 'ok (GPU path downgraded cubic → linear; ImageProperty exposes nearest/linear only)'
        : 'ok';
  } catch (error) {
    gpuStatus = `error: ${toErrorMessage(error)}`;
  }
}

function executeReslice(
  reslice: ReturnType<typeof vtkImageReslice.newInstance>,
  axes: Float32Array,
  interpolationMode: number,
  slabSlices: number,
): { elapsedMs: number; image: VtkImageData } {
  reslice.setResliceAxes(axes);
  reslice.setInterpolationMode(interpolationMode);
  reslice.setSlabMode(SlabMode.MEAN);
  reslice.setSlabNumberOfSlices(Math.max(1, slabSlices));

  const start = performance.now();
  reslice.update();
  const elapsedMs = performance.now() - start;
  const image = reslice.getOutputData() as VtkImageData | null;

  if (!image) {
    throw new Error('vtkImageReslice returned no output image.');
  }

  return { elapsedMs, image };
}

function compareResliceOutputs(a: VtkImageData, b: VtkImageData): { maxAbs: number; meanAbs: number } {
  const aScalars = a.getPointData().getScalars();
  const bScalars = b.getPointData().getScalars();

  if (!aScalars || !bScalars) {
    throw new Error('Interpolation benchmark outputs are missing scalar arrays.');
  }

  const aData = aScalars.getData();
  const bData = bScalars.getData();
  const length = Math.min(aData.length, bData.length);

  let maxAbs = 0;
  let sumAbs = 0;

  for (let index = 0; index < length; index += 1) {
    const delta = Math.abs(Number(aData[index]) - Number(bData[index]));
    sumAbs += delta;
    if (delta > maxAbs) {
      maxAbs = delta;
    }
  }

  return {
    maxAbs,
    meanAbs: length === 0 ? 0 : sumAbs / length,
  };
}

function applySectorMask(source: VtkImageData, target: Uint8Array, depthMm: number, sectorAngleDeg: number): void {
  const sourceScalars = source.getPointData().getScalars();
  if (!sourceScalars) {
    throw new Error('CPU reslice output is missing scalars.');
  }

  const sourceData = sourceScalars.getData();
  const halfSectorRad = degreesToRadians(sectorAngleDeg * 0.5);
  const centerX = OUTPUT_WIDTH_PX / 2;
  const nearFieldMm = 4;

  let flatIndex = 0;
  for (let row = 0; row < OUTPUT_HEIGHT_PX; row += 1) {
    const axialDepthMm = (row + 0.5) * OUTPUT_SPACING_MM;
    for (let column = 0; column < OUTPUT_WIDTH_PX; column += 1, flatIndex += 1) {
      const lateralMm = (column + 0.5 - centerX) * OUTPUT_SPACING_MM;
      const radiusMm = Math.hypot(lateralMm, axialDepthMm);
      const angularOffset = Math.abs(Math.atan2(lateralMm, Math.max(axialDepthMm, 0.0001)));

      const withinSector =
        axialDepthMm >= nearFieldMm &&
        axialDepthMm <= depthMm &&
        radiusMm <= depthMm &&
        angularOffset <= halfSectorRad;

      if (!withinSector) {
        target[flatIndex] = 0;
        continue;
      }

      const rawValue = Number(sourceData[flatIndex]);
      const mapped = remapToByte(rawValue, CPU_WINDOW_LOW, CPU_WINDOW_HIGH);
      const depthNorm = clamp(axialDepthMm / Math.max(depthMm, 1), 0, 1);
      const angleNorm = clamp(angularOffset / Math.max(halfSectorRad, 0.0001), 0, 1);
      const radialNorm = clamp(radiusMm / Math.max(depthMm, 1), 0, 1);
      const depthAttenuation = 0.9 * Math.exp(-1.18 * depthNorm) + 0.1;
      const edgeFeather = 1 - smoothstep(0.86, 1, Math.max(angleNorm, radialNorm));
      const nearFieldGate = smoothstep(nearFieldMm, nearFieldMm + 7, axialDepthMm);
      const pixel = mapped * depthAttenuation * edgeFeather * nearFieldGate;
      target[flatIndex] = clampToByte(pixel);
    }
  }
}

function createSyntheticVolume(): VolumeStats & { image: VtkImageData } {
  const image = vtkImageData.newInstance({
    extent: [0, VOLUME_DIMENSION - 1, 0, VOLUME_DIMENSION - 1, 0, VOLUME_DIMENSION - 1],
    origin: [0, 0, 0],
    spacing: [VOLUME_SPACING_MM, VOLUME_SPACING_MM, VOLUME_SPACING_MM],
  });

  const values = new Int16Array(VOLUME_DIMENSION * VOLUME_DIMENSION * VOLUME_DIMENSION);
  const center = (VOLUME_DIMENSION - 1) / 2;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let writeIndex = 0;

  const start = performance.now();

  for (let zIndex = 0; zIndex < VOLUME_DIMENSION; zIndex += 1) {
    const z = (zIndex - center) * VOLUME_SPACING_MM;
    const zSquared = z * z;
    const zGradient = 8 * Math.cos(z * 0.08);

    for (let yIndex = 0; yIndex < VOLUME_DIMENSION; yIndex += 1) {
      const y = (yIndex - center) * VOLUME_SPACING_MM;
      const ySquared = y * y;
      const tissueWave = 6 * Math.sin(y * 0.045);

      for (let xIndex = 0; xIndex < VOLUME_DIMENSION; xIndex += 1, writeIndex += 1) {
        const x = (xIndex - center) * VOLUME_SPACING_MM;
        const xSquared = x * x;
        const gradient = 12 * Math.sin((x + 0.4 * y) * 0.06) + zGradient + tissueWave;
        const bloodGradient = 4 * Math.sin(x * 0.11) + 3 * Math.cos(z * 0.13) - 2 * Math.sin(y * 0.07);

        let value = -950 + 4 * Math.sin((x - z) * 0.07);

        const thorax = xSquared / 11025 + ySquared / 13225 + zSquared / 11025;
        if (thorax <= 1.02) {
          value = -180 + gradient * 0.35;
        }

        const heartX = x;
        const heartY = y - 10;
        const heartEnvelope = (heartX * heartX) / 3025 + (heartY * heartY) / 2025 + zSquared / 3600;
        if (heartEnvelope <= 1.02) {
          value = 52 + gradient * 0.75;
        }

        const lvX = x + 18;
        const lvY = y - 4;
        const lvZ = z + 4;
        const lvOuter = (lvX * lvX) / 900 + (lvY * lvY) / 1225 + (lvZ * lvZ) / 784;
        const lvInner = (lvX * lvX) / 324 + (lvY * lvY) / 625 + (lvZ * lvZ) / 324;
        if (lvOuter <= 1 && lvInner > 1) {
          value = 138 + gradient * 0.55;
        }
        if (lvInner <= 1) {
          value = 36 + bloodGradient;
        }

        const rvOuterX = x - 16;
        const rvOuterY = y - 2;
        const rvOuterZ = z;
        const rvInnerX = x - 8;
        const rvOuter = (rvOuterX * rvOuterX) / 1296 + (rvOuterY * rvOuterY) / 729 + (rvOuterZ * rvOuterZ) / 576;
        const rvInner = (rvInnerX * rvInnerX) / 625 + (rvOuterY * rvOuterY) / 441 + (rvOuterZ * rvOuterZ) / 324;
        if (rvOuter <= 1 && rvInner > 1 && x > -2) {
          value = 118 + gradient * 0.45;
        }
        if (rvInner <= 1 && x > 4) {
          value = 42 + bloodGradient * 0.85;
        }

        const laX = x + 10;
        const laY = y - 30;
        const laZ = z + 2;
        const laOuter = (laX * laX) / 484 + (laY * laY) / 324 + (laZ * laZ) / 400;
        const laInner = (laX * laX) / 289 + (laY * laY) / 196 + (laZ * laZ) / 225;
        if (laOuter <= 1 && laInner > 1) {
          value = 112 + gradient * 0.35;
        }
        if (laInner <= 1) {
          value = 30 + bloodGradient * 0.75;
        }

        const raX = x - 20;
        const raY = y - 28;
        const raZ = z - 2;
        const raOuter = (raX * raX) / 484 + (raY * raY) / 324 + (raZ * raZ) / 400;
        const raInner = (raX * raX) / 289 + (raY * raY) / 196 + (raZ * raZ) / 225;
        if (raOuter <= 1 && raInner > 1) {
          value = 108 + gradient * 0.3;
        }
        if (raInner <= 1) {
          value = 34 + bloodGradient * 0.7;
        }

        const aoX = x;
        const aoY = y - 18;
        const aoZ = z - 24;
        const aoWall = (aoX * aoX) / 169 + (aoY * aoY) / 225 + (aoZ * aoZ) / 1444;
        const aoLumen = (aoX * aoX) / 100 + (aoY * aoY) / 144 + (aoZ * aoZ) / 1156;
        if (aoWall <= 1 && aoLumen > 1) {
          value = 186 + gradient * 0.25;
        }
        if (aoLumen <= 1) {
          value = 58 + bloodGradient * 0.55;
        }

        const septum = ((x + 2) * (x + 2)) / 64 + ((y - 3) * (y - 3)) / 2209 + (z * z) / 729;
        if (septum <= 1) {
          value = Math.max(value, 122 + gradient * 0.4);
        }

        const pericardium = (heartX * heartX) / 3364 + (heartY * heartY) / 2304 + zSquared / 3969;
        if (pericardium <= 1.02 && heartEnvelope > 1.02) {
          value = 92 + gradient * 0.25;
        }

        const calc1 = (x + 2) * (x + 2) + (y - 18) * (y - 18) + (z - 22) * (z - 22);
        const calc2 = (x - 6) * (x - 6) + (y - 16) * (y - 16) + (z - 20) * (z - 20);
        if (calc1 < 18 || calc2 < 14) {
          value = 280;
        }

        const clamped = Math.round(clamp(value, -1024, 512));
        values[writeIndex] = clamped;
        if (clamped < min) {
          min = clamped;
        }
        if (clamped > max) {
          max = clamped;
        }
      }
    }
  }

  image.getPointData().setScalars(
    vtkDataArray.newInstance({
      dataType: 'Int16Array',
      name: 'SyntheticHeartIntensity',
      numberOfComponents: 1,
      values,
    }),
  );
  image.modified();

  return {
    generationMs: performance.now() - start,
    image,
    max,
    min,
  };
}

function createOutputImage(): VtkImageData {
  const image = vtkImageData.newInstance({
    extent: OUTPUT_EXTENT,
    origin: OUTPUT_ORIGIN,
    spacing: [OUTPUT_SPACING_MM, OUTPUT_SPACING_MM, 1],
  });

  image.getPointData().setScalars(
    vtkDataArray.newInstance({
      dataType: 'Uint8Array',
      name: 'SectorizedSlice',
      numberOfComponents: 1,
      values: new Uint8Array(OUTPUT_WIDTH_PX * OUTPUT_HEIGHT_PX),
    }),
  );
  image.modified();
  return image;
}

function buildPlaneFrame(planeAngleDeg: number): PlaneFrame {
  const theta = degreesToRadians(planeAngleDeg);
  const lateralAxis = normalize([Math.cos(theta), 0, Math.sin(theta)]);
  const depthAxis: Vec3 = [0, 1, 0];
  const normal = normalize(cross(lateralAxis, depthAxis));
  const viewUp = scale(depthAxis, -1);

  return {
    depthAxis,
    lateralAxis,
    normal,
    probeOrigin: PROBE_ORIGIN,
    viewUp,
  };
}

function buildResliceAxes(origin: Vec3, xAxis: Vec3, yAxis: Vec3, normal: Vec3): Float32Array {
  const matrix = new Float32Array(16);

  matrix[0] = xAxis[0];
  matrix[1] = xAxis[1];
  matrix[2] = xAxis[2];
  matrix[3] = 0;

  matrix[4] = yAxis[0];
  matrix[5] = yAxis[1];
  matrix[6] = yAxis[2];
  matrix[7] = 0;

  matrix[8] = normal[0];
  matrix[9] = normal[1];
  matrix[10] = normal[2];
  matrix[11] = 0;

  matrix[12] = origin[0];
  matrix[13] = origin[1];
  matrix[14] = origin[2];
  matrix[15] = 1;

  return matrix;
}

function createRenderSurface(container: HTMLDivElement, background: [number, number, number]): RenderSurface {
  const generic = vtkGenericRenderWindow.newInstance({
    background,
    container,
  });

  generic.resize();
  return { container, generic };
}

function fitOrthographicCamera(
  surface: RenderSurface,
  focalPoint: Vec3,
  normal: Vec3,
  viewUp: Vec3,
  widthMm: number,
  heightMm: number,
): void {
  const renderer = surface.generic.getRenderer();
  const camera = renderer.getActiveCamera();
  const cameraDistance = 420;
  const aspect =
    surface.container.clientWidth > 0 && surface.container.clientHeight > 0
      ? surface.container.clientWidth / surface.container.clientHeight
      : 1;
  const parallelScale = Math.max(heightMm / 2, widthMm / (2 * Math.max(aspect, 0.001)));

  camera.setParallelProjection(true);
  camera.setFocalPoint(...focalPoint);
  camera.setPosition(
    focalPoint[0] + normal[0] * cameraDistance,
    focalPoint[1] + normal[1] * cameraDistance,
    focalPoint[2] + normal[2] * cameraDistance,
  );
  camera.setViewUp(...viewUp);
  camera.setParallelScale(parallelScale);
  renderer.resetCameraClippingRange();
}

function renderFindings(stats: RuntimeStats, controls: Controls): void {
  const cpuInterpolationFinding = stats.linearInterpolationObserved
    ? `Linear interpolation produced a measurable delta vs nearest on the oblique slice (mean |Δ| ${stats.interpolationDeltaMean.toFixed(2)}, max ${stats.interpolationDeltaMax.toFixed(2)}), so the nearest-only comment in vtk.js typings appears stale for @kitware/vtk.js 35.5.2.`
    : `Nearest and linear produced no meaningful delta in this setup (mean |Δ| ${stats.interpolationDeltaMean.toFixed(4)}). That suggests the chosen plane/setup is not exposing a practical interpolation difference right now.`;
  const slabFinding = stats.slabCompositionObserved
    ? `A ${controls.slabMm} mm mean slab changed the reslice relative to a single-slice linear benchmark (mean |Δ| ${stats.slabDeltaMean.toFixed(2)}, max ${stats.slabDeltaMax.toFixed(2)}), so thick-slab composition is observably active in this setup.`
    : `A ${controls.slabMm} mm mean slab produced no meaningful delta vs the single-slice linear benchmark (mean |Δ| ${stats.slabDeltaMean.toFixed(4)}).`;

  const gpuFinding =
    stats.gpuStatus === 'ok'
      ? `vtkImageResliceMapper rendered the live volume on the same plane with ${stats.gpuInterpolation} interpolation and ${controls.slabMm} mm slab thickness.`
      : `vtkImageResliceMapper surfaced a runtime problem: ${stats.gpuStatus}`;

  findingsEl.innerHTML = [
    findingMarkup(
      'Volume',
      `Synthetic cardiac-like volume generated in ${stats.volume.generationMs.toFixed(1)} ms. Scalar range ${stats.volume.min} to ${stats.volume.max}.`,
    ),
    findingMarkup(
      'vtkImageReslice',
      `CPU oblique reslice: ${stats.cpuResliceMs.toFixed(1)} ms. Sector mask + attenuation: ${stats.cpuMaskMs.toFixed(1)} ms. Active interpolation: ${controls.interpolation}. Thick slab: ${stats.slabSlices} slices (~${controls.slabMm} mm).`,
    ),
    findingMarkup('Interpolation', cpuInterpolationFinding, !stats.linearInterpolationObserved),
    findingMarkup('Thick slab', slabFinding, !stats.slabCompositionObserved && stats.slabSlices > 1),
    findingMarkup(
      'vtkImageResliceMapper',
      `${gpuFinding} Render dispatch: ${stats.gpuRenderMs.toFixed(1)} ms.`,
      stats.gpuStatus !== 'ok' && !stats.gpuStatus.startsWith('ok ('),
    ),
    findingMarkup(
      'Benchmarks',
      `Nearest benchmark: ${stats.nearestBenchmarkMs.toFixed(1)} ms. Linear benchmark: ${stats.linearBenchmarkMs.toFixed(1)} ms. Slab benchmark: ${stats.slabBenchmarkMs.toFixed(1)} ms. CPU image redraw: ${stats.cpuRenderMs.toFixed(1)} ms.`,
    ),
  ].join('');
}

function findingMarkup(label: string, value: string, warning = false): string {
  return `
    <article class="finding">
      <span class="finding-label">${label}</span>
      <div class="finding-value${warning ? ' is-warning' : ''}">${value}</div>
    </article>
  `;
}

function readControls(): Controls {
  return {
    depthMm: depthInput.valueAsNumber,
    interpolation: interpolationSelect.value as InterpolationKey,
    planeAngleDeg: planeAngleInput.valueAsNumber,
    sectorAngleDeg: sectorAngleInput.valueAsNumber,
    slabMm: slabInput.valueAsNumber,
  };
}

function syncControlInputs(controls: Controls): void {
  planeAngleInput.value = String(controls.planeAngleDeg);
  depthInput.value = String(controls.depthMm);
  sectorAngleInput.value = String(controls.sectorAngleDeg);
  slabInput.value = String(controls.slabMm);
  interpolationSelect.value = controls.interpolation;
  updateControlLabels(controls);
}

function updateControlLabels(controls: Controls): void {
  planeAngleValue.textContent = `${controls.planeAngleDeg.toFixed(0)}°`;
  depthValue.textContent = `${controls.depthMm.toFixed(0)} mm`;
  sectorAngleValue.textContent = `${controls.sectorAngleDeg.toFixed(0)}°`;
  slabValue.textContent = `${controls.slabMm.toFixed(0)} mm`;
}

function setStatus(value: string): void {
  statusEl.textContent = value;
}

function getRequiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element #${id}.`);
  }
  return element as T;
}

function toInterpolationMode(value: InterpolationKey): number {
  switch (value) {
    case 'nearest':
      return InterpolationMode.NEAREST;
    case 'linear':
      return InterpolationMode.LINEAR;
    case 'cubic':
      return InterpolationMode.CUBIC;
    default:
      return InterpolationMode.LINEAR;
  }
}

function remapToByte(value: number, low: number, high: number): number {
  const normalized = (value - low) / (high - low);
  return clamp(normalized * 255, 0, 255);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampToByte(value: number): number {
  return Math.round(clamp(value, 0, 255));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) {
    return value < edge0 ? 0 : 1;
  }

  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function normalize(vector: Vec3): Vec3 {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (length === 0) {
    return [0, 0, 0];
  }
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(vector: Vec3, factor: number): Vec3 {
  return [vector[0] * factor, vector[1] * factor, vector[2] * factor];
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
