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
import { renderEchoSector } from './echo-appearance';
import { getLabelColor, LABEL_OVERLAY_ALPHA } from './label-colors';
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

type OverlayRuntime = {
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
  labelVolume?: VtkImageData | null;
  labelsVisible?: boolean;
  volume?: VtkImageData | null;
  width: number;
};

const DEFAULT_APPEARANCE: Required<PseudoTeeAppearance> = {
  depthMm: 140,
  nearFieldMm: 4,
  outputSpacingMm: 0.6,
  sectorAngleDeg: 90,
};

const renderLabelOverlay = (
  labelData: ArrayLike<number>,
  runtime: OverlayRuntime,
  appearance: Required<PseudoTeeAppearance>,
): void => {
  const overlayValues = runtime.values;
  const overlayAlpha = Math.round(LABEL_OVERLAY_ALPHA * 255);
  const halfSectorRad = (appearance.sectorAngleDeg * Math.PI) / 360;
  const centerX = runtime.widthPx / 2;

  overlayValues.fill(0);

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
        continue;
      }

      const labelColor = getLabelColor(Number(labelData[flatIndex]));
      if (!labelColor) {
        continue;
      }

      const overlayIndex = flatIndex * 4;
      overlayValues[overlayIndex] = labelColor[0];
      overlayValues[overlayIndex + 1] = labelColor[1];
      overlayValues[overlayIndex + 2] = labelColor[2];
      overlayValues[overlayIndex + 3] = overlayAlpha;
    }
  }

  runtime.scalars.dataChange();
  runtime.image.modified();
};

export const PseudoTeePane = forwardRef<PseudoTeePaneHandle, PseudoTeePaneProps>(function PseudoTeePane(
  { appearance, height, imagingPlane, labelVolume, labelsVisible, volume, width },
  ref,
) {
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderWindowRef = useRef<ReturnType<typeof createRenderWindow> | null>(null);
  const mapperRef = useRef<ReturnType<typeof vtkImageMapper.newInstance> | null>(null);
  const imageSliceRef = useRef<ReturnType<typeof vtkImageSlice.newInstance> | null>(null);
  const labelOverlayMapperRef = useRef<ReturnType<typeof vtkImageMapper.newInstance> | null>(null);
  const labelOverlaySliceRef = useRef<ReturnType<typeof vtkImageSlice.newInstance> | null>(null);
  const resliceRef = useRef<ReturnType<typeof vtkImageReslice.newInstance> | null>(null);
  const outputRuntimeRef = useRef<OutputRuntime | null>(null);
  const labelOverlayRuntimeRef = useRef<OverlayRuntime | null>(null);
  const latestStateRef = useRef<PaneState>({
    appearance,
    height,
    imagingPlane,
    labelVolume,
    labelsVisible,
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

  const ensureLabelOverlayRuntime = (
    widthPx: number,
    heightPx: number,
    spacingMm: number,
  ): OverlayRuntime => {
    const existing = labelOverlayRuntimeRef.current;
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
      name: 'PseudoTeeLabelOverlay',
      numberOfComponents: 4,
      values: new Uint8Array(widthPx * heightPx * 4),
    });
    image.getPointData().setScalars(scalars);
    image.modified();

    const runtime: OverlayRuntime = {
      heightPx,
      image,
      scalars,
      spacingMm,
      values: scalars.getData() as Uint8Array,
      widthPx,
    };

    labelOverlayRuntimeRef.current = runtime;
    labelOverlayMapperRef.current?.setInputData(image);
    return runtime;
  };

  const flush = (): void => {
    const renderWindow = renderWindowRef.current;
    const reslice = resliceRef.current;
    const imageSlice = imageSliceRef.current;
    const labelOverlaySlice = labelOverlaySliceRef.current;
    const container = containerRef.current;
    if (!renderWindow || !reslice || !imageSlice || !labelOverlaySlice) {
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
    labelOverlaySlice.setVisibility(false);
    setStatusMessage(null);

    const { imagingPlane: nextImagingPlane, labelVolume: nextLabelVolume } = latestStateRef.current;
    if (!nextImagingPlane) {
      imageSlice.setVisibility(false);
      labelOverlaySlice.setVisibility(false);
      setStatusMessage(null);
      updateLoading(true);
      renderWindow.getRenderWindow().render();
      if (container) {
        setCanvasRenderState(container, 'loading');
      }
      return;
    }

    if (!nextLabelVolume) {
      imageSlice.setVisibility(false);
      labelOverlaySlice.setVisibility(false);
      setStatusMessage('Label volume required for echo rendering');
      updateLoading(false);
      renderWindow.getRenderWindow().render();
      if (container) {
        setCanvasRenderState(container, 'empty');
      }
      return;
    }

    const overlayActive = Boolean(latestStateRef.current.labelsVisible);
    const overlayRuntime = overlayActive
      ? ensureLabelOverlayRuntime(widthPx, heightPx, runtime.spacingMm)
      : null;

    reslice.setInputData(nextLabelVolume);
    reslice.setResliceAxes(buildResliceAxes(nextImagingPlane));
    reslice.setOutputSpacing([runtime.spacingMm, runtime.spacingMm, 1]);
    reslice.setOutputOrigin([-(runtime.widthPx * runtime.spacingMm) / 2, 0, 0]);
    reslice.setOutputExtent([0, runtime.widthPx - 1, 0, runtime.heightPx - 1, 0, 0]);
    reslice.setInterpolationMode(InterpolationMode.NEAREST);
    reslice.setSlabNumberOfSlices(1);
    reslice.update();

    const reslicedLabels = reslice.getOutputData() as VtkImageData | null;
    if (!reslicedLabels) {
      throw new Error('vtkImageReslice returned no pseudo-TEE label output.');
    }

    const labelScalars = reslicedLabels.getPointData().getScalars();
    if (!labelScalars) {
      throw new Error('Pseudo-TEE label reslice output is missing scalar data.');
    }

    const labelValues = labelScalars.getData();
    renderEchoSector(labelValues, runtime.values, {
      depthMm: resolvedAppearance.depthMm,
      heightPx: runtime.heightPx,
      nearFieldMm: resolvedAppearance.nearFieldMm,
      sectorAngleDeg: resolvedAppearance.sectorAngleDeg,
      spacingMm: runtime.spacingMm,
      widthPx: runtime.widthPx,
    });
    runtime.scalars.dataChange();
    runtime.image.modified();

    if (overlayRuntime) {
      renderLabelOverlay(labelValues, overlayRuntime, resolvedAppearance);
    }

    imageSlice.setVisibility(true);
    labelOverlaySlice.setVisibility(Boolean(overlayActive && overlayRuntime));
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
    if (labelVolume !== undefined) {
      latestStateRef.current.labelVolume = labelVolume;
    }
    if (labelsVisible !== undefined) {
      latestStateRef.current.labelsVisible = labelsVisible;
    }
    if (volume !== undefined) {
      latestStateRef.current.volume = volume;
    }
    flush();
  }, [appearance, height, imagingPlane, labelVolume, labelsVisible, volume, width]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const renderWindow = createRenderWindow(container, [0.01, 0.015, 0.02]);
    const mapper = vtkImageMapper.newInstance();
    const imageSlice = vtkImageSlice.newInstance();
    const reslice = vtkImageReslice.newInstance();
    const labelOverlayMapper = vtkImageMapper.newInstance();
    const labelOverlaySlice = vtkImageSlice.newInstance();

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

    labelOverlayMapper.setKSlice(0);
    labelOverlaySlice.setMapper(labelOverlayMapper);
    labelOverlaySlice.getProperty().setIndependentComponents(false);
    labelOverlaySlice.getProperty().setInterpolationTypeToNearest();
    labelOverlaySlice.setVisibility(false);
    renderWindow.getRenderer().addViewProp(labelOverlaySlice);

    renderWindowRef.current = renderWindow;
    mapperRef.current = mapper;
    imageSliceRef.current = imageSlice;
    resliceRef.current = reslice;
    labelOverlayMapperRef.current = labelOverlayMapper;
    labelOverlaySliceRef.current = labelOverlaySlice;

    renderWindow.resize();
    flush();

    return () => {
      mapperRef.current = null;
      imageSliceRef.current = null;
      labelOverlayMapperRef.current = null;
      labelOverlayRuntimeRef.current = null;
      labelOverlaySliceRef.current = null;
      outputRuntimeRef.current = null;
      resliceRef.current = null;
      disposePipeline(renderWindow);
      renderWindowRef.current = null;
    };
  }, []);

  return (
    <div
      style={{
        height: '100%',
        maxHeight: height,
        maxWidth: width,
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
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
        Label-driven echo appearance
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
      {statusMessage ? (
        <div
          style={{
            alignItems: 'center',
            color: '#d6e7ee',
            display: 'flex',
            inset: 0,
            justifyContent: 'center',
            padding: '0 24px',
            pointerEvents: 'none',
            position: 'absolute',
            textAlign: 'center',
          }}
        >
          {statusMessage}
        </div>
      ) : null}
    </div>
  );
});

PseudoTeePane.displayName = 'PseudoTeePane';
