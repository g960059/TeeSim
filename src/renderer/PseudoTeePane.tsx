import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray.js';
import vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData.js';
import type { vtkImageData as VtkImageData } from '@kitware/vtk.js/Common/DataModel/ImageData';
import { InterpolationMode } from '@kitware/vtk.js/Imaging/Core/AbstractImageInterpolator/Constants.js';
import { SlabMode } from '@kitware/vtk.js/Imaging/Core/ImageReslice/Constants.js';
import vtkImageReslice from '@kitware/vtk.js/Imaging/Core/ImageReslice.js';
import vtkImageMapper from '@kitware/vtk.js/Rendering/Core/ImageMapper.js';
import vtkImageSlice from '@kitware/vtk.js/Rendering/Core/ImageSlice.js';
import type { ImagingPlane } from '../core';
import type { PseudoTeeAppearance, PseudoTeePaneHandle, PseudoTeePaneProps } from './types';
import {
  buildResliceAxes,
  createRenderWindow,
  disposePipeline,
  fitSliceCamera,
  setCanvasRenderState,
  setCanvasTestId,
} from './vtk-helpers';

type OutputRuntime = {
  heightPx: number;
  image: VtkImageData;
  scalars: vtkDataArray;
  spacingMm: number;
  values: Uint8Array;
  widthPx: number;
};

type PaneState = {
  appearance?: PseudoTeeAppearance;
  height: number;
  imagingPlane?: ImagingPlane | null;
  volume?: VtkImageData | null;
  width: number;
};

const DEFAULT_APPEARANCE: Required<PseudoTeeAppearance> = {
  depthMm: 150,
  nearFieldMm: 4,
  outputSpacingMm: 0.6,
  sectorAngleDeg: 90,
  slabThicknessMm: 4,
  windowHigh: 240,
  windowLow: -180,
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const clampToByte = (value: number): number => Math.round(clamp(value, 0, 255));

const remapToByte = (value: number, low: number, high: number): number => {
  const normalized = (value - low) / Math.max(high - low, 1);
  return clamp(normalized * 255, 0, 255);
};

const smoothstep = (edge0: number, edge1: number, value: number): number => {
  if (edge0 === edge1) {
    return value < edge0 ? 0 : 1;
  }

  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const applySectorMask = (
  source: VtkImageData,
  runtime: OutputRuntime,
  appearance: Required<PseudoTeeAppearance>,
): void => {
  const sourceScalars = source.getPointData().getScalars();
  if (!sourceScalars) {
    throw new Error('Pseudo-TEE reslice output is missing scalar data.');
  }

  const sourceValues = sourceScalars.getData();
  const halfSectorRad = (appearance.sectorAngleDeg * Math.PI) / 360;
  const centerX = runtime.widthPx / 2;
  let flatIndex = 0;

  for (let row = 0; row < runtime.heightPx; row += 1) {
    const axialDepthMm = (row + 0.5) * runtime.spacingMm;

    for (let column = 0; column < runtime.widthPx; column += 1, flatIndex += 1) {
      const lateralMm = (column + 0.5 - centerX) * runtime.spacingMm;
      const radiusMm = Math.hypot(lateralMm, axialDepthMm);
      const angularOffset = Math.abs(Math.atan2(lateralMm, Math.max(axialDepthMm, 1e-4)));
      const withinSector =
        axialDepthMm >= appearance.nearFieldMm &&
        axialDepthMm <= appearance.depthMm &&
        radiusMm <= appearance.depthMm &&
        angularOffset <= halfSectorRad;

      if (!withinSector) {
        runtime.values[flatIndex] = 0;
        continue;
      }

      const rawValue = Number(sourceValues[flatIndex]);
      const mapped = remapToByte(rawValue, appearance.windowLow, appearance.windowHigh);
      const depthNorm = clamp(axialDepthMm / Math.max(appearance.depthMm, 1), 0, 1);
      const angleNorm = clamp(angularOffset / Math.max(halfSectorRad, 1e-4), 0, 1);
      const radialNorm = clamp(radiusMm / Math.max(appearance.depthMm, 1), 0, 1);
      const depthAttenuation = 0.9 * Math.exp(-1.18 * depthNorm) + 0.1;
      const edgeFeather = 1 - smoothstep(0.86, 1, Math.max(angleNorm, radialNorm));
      const nearFieldGate = smoothstep(
        appearance.nearFieldMm,
        appearance.nearFieldMm + 7,
        axialDepthMm,
      );

      runtime.values[flatIndex] = clampToByte(
        mapped * depthAttenuation * edgeFeather * nearFieldGate,
      );
    }
  }

  runtime.scalars.dataChange();
  runtime.image.modified();
};

export const PseudoTeePane = forwardRef<PseudoTeePaneHandle, PseudoTeePaneProps>(function PseudoTeePane(
  { appearance, height, imagingPlane, volume, width },
  ref,
) {
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderWindowRef = useRef<ReturnType<typeof createRenderWindow> | null>(null);
  const mapperRef = useRef<ReturnType<typeof vtkImageMapper.newInstance> | null>(null);
  const imageSliceRef = useRef<ReturnType<typeof vtkImageSlice.newInstance> | null>(null);
  const resliceRef = useRef<ReturnType<typeof vtkImageReslice.newInstance> | null>(null);
  const outputRuntimeRef = useRef<OutputRuntime | null>(null);
  const latestStateRef = useRef<PaneState>({
    appearance,
    height,
    imagingPlane,
    volume,
    width,
  });
  const loadingStateRef = useRef(true);

  const updateLoading = (nextLoading: boolean): void => {
    if (loadingStateRef.current === nextLoading) {
      return;
    }

    loadingStateRef.current = nextLoading;
    setIsLoading(nextLoading);
  };

  const ensureOutputRuntime = (
    widthPx: number,
    heightPx: number,
    spacingMm: number,
  ): OutputRuntime => {
    const existing = outputRuntimeRef.current;
    if (
      existing &&
      existing.widthPx === widthPx &&
      existing.heightPx === heightPx &&
      existing.spacingMm === spacingMm
    ) {
      return existing;
    }

    const image = vtkImageData.newInstance({
      extent: [0, widthPx - 1, 0, heightPx - 1, 0, 0],
      origin: [-(widthPx * spacingMm) / 2, 0, 0],
      spacing: [spacingMm, spacingMm, 1],
    });
    const scalars = vtkDataArray.newInstance({
      dataType: 'Uint8Array',
      name: 'PseudoTeeSlice',
      numberOfComponents: 1,
      values: new Uint8Array(widthPx * heightPx),
    });
    image.getPointData().setScalars(scalars);
    image.modified();

    const runtime: OutputRuntime = {
      heightPx,
      image,
      scalars,
      spacingMm,
      values: scalars.getData() as Uint8Array,
      widthPx,
    };

    outputRuntimeRef.current = runtime;
    mapperRef.current?.setInputData(image);
    fitSliceCamera(renderWindowRef.current!, widthPx * spacingMm, heightPx * spacingMm);
    return runtime;
  };

  const flush = (): void => {
    const renderWindow = renderWindowRef.current;
    const reslice = resliceRef.current;
    const imageSlice = imageSliceRef.current;
    const container = containerRef.current;
    if (!renderWindow || !reslice || !imageSlice) {
      return;
    }

    const resolvedAppearance = {
      ...DEFAULT_APPEARANCE,
      ...latestStateRef.current.appearance,
    };
    const widthPx = Math.max(1, Math.round(latestStateRef.current.width));
    const heightPx = Math.max(1, Math.round(latestStateRef.current.height));
    const runtime = ensureOutputRuntime(widthPx, heightPx, resolvedAppearance.outputSpacingMm);

    runtime.values.fill(0);
    runtime.scalars.dataChange();
    runtime.image.modified();

    const { imagingPlane: nextImagingPlane, volume: nextVolume } = latestStateRef.current;
    if (!nextVolume || !nextImagingPlane) {
      imageSlice.setVisibility(false);
      updateLoading(true);
      renderWindow.getRenderWindow().render();
      if (container) {
        setCanvasRenderState(container, 'loading');
      }
      return;
    }

    const slabSpacingMm = Math.min(...nextVolume.getSpacing());
    const slabSlices = Math.max(
      1,
      Math.round(resolvedAppearance.slabThicknessMm / Math.max(slabSpacingMm, 1e-3)),
    );

    reslice.setInputData(nextVolume);
    reslice.setResliceAxes(buildResliceAxes(nextImagingPlane));
    reslice.setOutputSpacing([runtime.spacingMm, runtime.spacingMm, 1]);
    reslice.setOutputOrigin([-(runtime.widthPx * runtime.spacingMm) / 2, 0, 0]);
    reslice.setOutputExtent([0, runtime.widthPx - 1, 0, runtime.heightPx - 1, 0, 0]);
    reslice.setInterpolationMode(InterpolationMode.LINEAR);
    reslice.setSlabNumberOfSlices(slabSlices);
    reslice.update();

    const reslicedImage = reslice.getOutputData() as VtkImageData | null;
    if (!reslicedImage) {
      throw new Error('vtkImageReslice returned no pseudo-TEE output.');
    }

    applySectorMask(reslicedImage, runtime, resolvedAppearance);

    imageSlice.setVisibility(true);
    updateLoading(false);
    renderWindow.getRenderWindow().render();
    if (container) {
      setCanvasRenderState(container, 'ready');
    }
  };

  useImperativeHandle(ref, () => ({
    render() {
      flush();
    },
    setAppearance(nextAppearance) {
      latestStateRef.current.appearance = nextAppearance;
    },
    setImagingPlane(nextImagingPlane) {
      latestStateRef.current.imagingPlane = nextImagingPlane;
    },
    setVolume(nextVolume) {
      latestStateRef.current.volume = nextVolume;
    },
  }), []);

  useEffect(() => {
    latestStateRef.current.height = height;
    latestStateRef.current.width = width;
    if (appearance !== undefined) {
      latestStateRef.current.appearance = appearance;
    }
    if (imagingPlane !== undefined) {
      latestStateRef.current.imagingPlane = imagingPlane;
    }
    if (volume !== undefined) {
      latestStateRef.current.volume = volume;
    }
    flush();
  }, [appearance, height, imagingPlane, volume, width]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const renderWindow = createRenderWindow(container, [0.01, 0.015, 0.02]);
    const mapper = vtkImageMapper.newInstance();
    const imageSlice = vtkImageSlice.newInstance();
    const reslice = vtkImageReslice.newInstance();

    setCanvasTestId(container, 'pseudo-tee-canvas');
    setCanvasRenderState(container, 'loading');

    reslice.setOutputDimensionality(2);
    reslice.setBackgroundColor([0, 0, 0, 0]);
    reslice.setSlabMode(SlabMode.MEAN);
    reslice.setSlabSliceSpacingFraction(1);

    mapper.setKSlice(0);
    imageSlice.setMapper(mapper);
    imageSlice.getProperty().setColorWindow(255);
    imageSlice.getProperty().setColorLevel(127.5);
    imageSlice.getProperty().setInterpolationTypeToLinear();
    renderWindow.getRenderer().addViewProp(imageSlice);

    renderWindowRef.current = renderWindow;
    mapperRef.current = mapper;
    imageSliceRef.current = imageSlice;
    resliceRef.current = reslice;

    renderWindow.resize();
    flush();

    return () => {
      mapperRef.current = null;
      imageSliceRef.current = null;
      outputRuntimeRef.current = null;
      resliceRef.current = null;
      disposePipeline(renderWindow);
      renderWindowRef.current = null;
    };
  }, []);

  return (
    <div
      style={{
        height,
        position: 'relative',
        width,
      }}
    >
      <div
        ref={containerRef}
        style={{
          height: '100%',
          overflow: 'hidden',
          width: '100%',
        }}
      />
      <div
        data-testid="pseudo-tee-label"
        style={{
          background: 'rgba(0, 0, 0, 0.58)',
          borderRadius: 4,
          color: '#eef7fb',
          fontSize: 12,
          left: 12,
          padding: '6px 8px',
          position: 'absolute',
          top: 12,
        }}
      >
        CT-derived anatomical slice
      </div>
      {isLoading ? (
        <div
          style={{
            alignItems: 'center',
            color: '#d6e7ee',
            display: 'flex',
            inset: 0,
            justifyContent: 'center',
            pointerEvents: 'none',
            position: 'absolute',
          }}
        >
          Loading...
        </div>
      ) : null}
    </div>
  );
});

PseudoTeePane.displayName = 'PseudoTeePane';
