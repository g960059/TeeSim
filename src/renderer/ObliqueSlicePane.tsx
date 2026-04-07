import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray.js';
import vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData.js';
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction.js';
import vtkImageMapper from '@kitware/vtk.js/Rendering/Core/ImageMapper.js';
import vtkImageProperty from '@kitware/vtk.js/Rendering/Core/ImageProperty.js';
import vtkImageSlice from '@kitware/vtk.js/Rendering/Core/ImageSlice.js';
import vtkPiecewiseFunction from '@kitware/vtk.js/Common/DataModel/PiecewiseFunction.js';
import vtkImageReslice from '@kitware/vtk.js/Imaging/Core/ImageReslice.js';
import { InterpolationMode } from '@kitware/vtk.js/Imaging/Core/AbstractImageInterpolator/Constants.js';
import { SlabMode } from '@kitware/vtk.js/Imaging/Core/ImageReslice/Constants.js';
import type { vtkImageData as VtkImageData } from '@kitware/vtk.js/Common/DataModel/ImageData';
import { getLabelColor, LABEL_OVERLAY_ALPHA } from './label-colors';
import type { ObliqueSlicePaneHandle, ObliqueSlicePaneProps } from './types';
import {
  buildResliceAxes,
  createRenderWindow,
  disposePipeline,
  fitSliceCamera,
  setCanvasTestId,
} from './vtk-helpers';

type PaneState = {
  height: number;
  imagingPlane?: ObliqueSlicePaneProps['imagingPlane'];
  labelVolume?: VtkImageData | null;
  labelsVisible?: boolean;
  volume?: VtkImageData | null;
  width: number;
};

type BlankImageRuntime = {
  heightPx: number;
  image: VtkImageData;
  spacingMm: number;
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

const createCtTransferFunctions = (): {
  color: vtkColorTransferFunction;
  opacity: vtkPiecewiseFunction;
} => {
  const color = vtkColorTransferFunction.newInstance();
  color.addRGBPoint(-1024, 0.02, 0.03, 0.05);
  color.addRGBPoint(-300, 0.16, 0.17, 0.2);
  color.addRGBPoint(40, 0.68, 0.41, 0.34);
  color.addRGBPoint(120, 0.9, 0.82, 0.76);
  color.addRGBPoint(300, 1, 0.98, 0.95);

  const opacity = vtkPiecewiseFunction.newInstance();
  opacity.addPoint(-1024, 0);
  opacity.addPoint(-300, 0.1);
  opacity.addPoint(40, 0.7);
  opacity.addPoint(300, 1);

  return { color, opacity };
};

export const ObliqueSlicePane = forwardRef<ObliqueSlicePaneHandle, ObliqueSlicePaneProps>(
  function ObliqueSlicePane(
    { height, imagingPlane, labelVolume, labelsVisible, volume, width },
    ref,
  ) {
    const [isLoading, setIsLoading] = useState(true);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const renderWindowRef = useRef<ReturnType<typeof createRenderWindow> | null>(null);
    const imageSliceRef = useRef<ReturnType<typeof vtkImageSlice.newInstance> | null>(null);
    const labelOverlaySliceRef = useRef<ReturnType<typeof vtkImageSlice.newInstance> | null>(null);
    const mapperRef = useRef<ReturnType<typeof vtkImageMapper.newInstance> | null>(null);
    const labelOverlayMapperRef = useRef<ReturnType<typeof vtkImageMapper.newInstance> | null>(null);
    const resliceRef = useRef<ReturnType<typeof vtkImageReslice.newInstance> | null>(null);
    const labelResliceRef = useRef<ReturnType<typeof vtkImageReslice.newInstance> | null>(null);
    const blankImageRef = useRef<BlankImageRuntime | null>(null);
    const overlayRuntimeRef = useRef<OverlayRuntime | null>(null);
    const latestStateRef = useRef<PaneState>({
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

    const ensureBlankImage = (
      widthPx: number,
      heightPx: number,
      spacingMm: number,
    ): BlankImageRuntime => {
      const existing = blankImageRef.current;
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
        name: 'BlankObliqueSlice',
        numberOfComponents: 1,
        values: new Uint8Array(widthPx * heightPx),
      });

      image.getPointData().setScalars(scalars);
      image.modified();

      const runtime: BlankImageRuntime = {
        heightPx,
        image,
        spacingMm,
        widthPx,
      };

      blankImageRef.current = runtime;
      return runtime;
    };

    const ensureOverlayRuntime = (
      widthPx: number,
      heightPx: number,
      spacingMm: number,
    ): OverlayRuntime => {
      const existing = overlayRuntimeRef.current;
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
        name: 'ObliqueSliceLabelOverlay',
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

      overlayRuntimeRef.current = runtime;
      labelOverlayMapperRef.current?.setInputData(image);
      return runtime;
    };

    const applyLabelOverlay = (source: VtkImageData, runtime: OverlayRuntime): void => {
      const labelScalars = source.getPointData().getScalars();
      if (!labelScalars) {
        throw new Error('Oblique slice label reslice is missing scalar data.');
      }

      const labelValues = labelScalars.getData();
      const overlayAlpha = Math.round(LABEL_OVERLAY_ALPHA * 255);

      runtime.values.fill(0);

      for (let flatIndex = 0; flatIndex < runtime.widthPx * runtime.heightPx; flatIndex += 1) {
        const labelColor = getLabelColor(Number(labelValues[flatIndex]));
        if (!labelColor) {
          continue;
        }

        const overlayIndex = flatIndex * 4;
        runtime.values[overlayIndex] = labelColor[0];
        runtime.values[overlayIndex + 1] = labelColor[1];
        runtime.values[overlayIndex + 2] = labelColor[2];
        runtime.values[overlayIndex + 3] = overlayAlpha;
      }

      runtime.scalars.dataChange();
      runtime.image.modified();
    };

    const flush = (): void => {
      const renderWindow = renderWindowRef.current;
      const mapper = mapperRef.current;
      const imageSlice = imageSliceRef.current;
      const reslice = resliceRef.current;
      const labelOverlaySlice = labelOverlaySliceRef.current;
      const labelReslice = labelResliceRef.current;
      if (!renderWindow || !mapper || !imageSlice || !reslice || !labelOverlaySlice || !labelReslice) {
        return;
      }

      const widthPx = Math.max(1, Math.round(latestStateRef.current.width));
      const heightPx = Math.max(1, Math.round(latestStateRef.current.height));
      const outputSpacingMm = 0.6;
      const blankImage = ensureBlankImage(widthPx, heightPx, outputSpacingMm);
      const overlayActive = Boolean(latestStateRef.current.labelsVisible && latestStateRef.current.labelVolume);

      fitSliceCamera(renderWindow, widthPx * outputSpacingMm, heightPx * outputSpacingMm);
      labelOverlaySlice.setVisibility(false);

      if (!latestStateRef.current.volume || !latestStateRef.current.imagingPlane) {
        mapper.setInputData(blankImage.image);
        imageSlice.setVisibility(false);
        labelOverlaySlice.setVisibility(false);
        updateLoading(true);
        renderWindow.getRenderWindow().render();
        return;
      }

      reslice.setInputData(latestStateRef.current.volume);
      reslice.setResliceAxes(buildResliceAxes(latestStateRef.current.imagingPlane));
      reslice.setOutputSpacing([outputSpacingMm, outputSpacingMm, 1]);
      reslice.setOutputOrigin([-(widthPx * outputSpacingMm) / 2, 0, 0]);
      reslice.setOutputExtent([0, widthPx - 1, 0, heightPx - 1, 0, 0]);
      reslice.setInterpolationMode(InterpolationMode.LINEAR);
      reslice.update();

      const output = reslice.getOutputData() as VtkImageData | null;
      if (!output) {
        throw new Error('vtkImageReslice returned no oblique slice output.');
      }

      mapper.setInputData(output);
      imageSlice.setVisibility(true);
      if (overlayActive) {
        const overlayRuntime = ensureOverlayRuntime(widthPx, heightPx, outputSpacingMm);

        labelReslice.setInputData(latestStateRef.current.labelVolume!);
        labelReslice.setResliceAxes(buildResliceAxes(latestStateRef.current.imagingPlane));
        labelReslice.setOutputSpacing([outputSpacingMm, outputSpacingMm, 1]);
        labelReslice.setOutputOrigin([-(widthPx * outputSpacingMm) / 2, 0, 0]);
        labelReslice.setOutputExtent([0, widthPx - 1, 0, heightPx - 1, 0, 0]);
        labelReslice.setInterpolationMode(InterpolationMode.NEAREST);
        labelReslice.setSlabNumberOfSlices(1);
        labelReslice.update();

        const labelOutput = labelReslice.getOutputData() as VtkImageData | null;
        if (!labelOutput) {
          throw new Error('vtkImageReslice returned no oblique slice label output.');
        }

        applyLabelOverlay(labelOutput, overlayRuntime);
        labelOverlaySlice.setVisibility(true);
      }
      updateLoading(false);
      renderWindow.getRenderWindow().render();
    };

    useImperativeHandle(ref, () => ({
      render() {
        flush();
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
    }, [height, imagingPlane, labelVolume, labelsVisible, volume, width]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const renderWindow = createRenderWindow(container, [0.015, 0.015, 0.02]);
      const mapper = vtkImageMapper.newInstance();
      const property = vtkImageProperty.newInstance();
      const imageSlice = vtkImageSlice.newInstance({ property });
      const reslice = vtkImageReslice.newInstance();
      const labelOverlayMapper = vtkImageMapper.newInstance();
      const labelOverlayProperty = vtkImageProperty.newInstance();
      const labelOverlaySlice = vtkImageSlice.newInstance({ property: labelOverlayProperty });
      const labelReslice = vtkImageReslice.newInstance();
      const transferFunctions = createCtTransferFunctions();

      setCanvasTestId(container, 'oblique-slice-canvas');

      reslice.setOutputDimensionality(2);
      reslice.setBackgroundColor([0, 0, 0, 0]);
      reslice.setInterpolationMode(InterpolationMode.LINEAR);
      reslice.setSlabMode(SlabMode.MEAN);
      reslice.setSlabNumberOfSlices(1);
      labelReslice.setOutputDimensionality(2);
      labelReslice.setBackgroundColor([0, 0, 0, 0]);
      labelReslice.setInterpolationMode(InterpolationMode.NEAREST);
      labelReslice.setSlabMode(SlabMode.MIN);
      labelReslice.setSlabNumberOfSlices(1);

      mapper.setKSlice(0);
      imageSlice.setMapper(mapper);
      imageSlice.getProperty().setInterpolationTypeToLinear();
      imageSlice.getProperty().setRGBTransferFunction(0, transferFunctions.color);
      imageSlice.getProperty().setScalarOpacity(0, transferFunctions.opacity);
      imageSlice.getProperty().setUseLookupTableScalarRange(true);
      renderWindow.getRenderer().addViewProp(imageSlice);

      labelOverlayMapper.setKSlice(0);
      labelOverlaySlice.setMapper(labelOverlayMapper);
      labelOverlaySlice.getProperty().setIndependentComponents(false);
      labelOverlaySlice.getProperty().setInterpolationTypeToNearest();
      labelOverlaySlice.setVisibility(false);
      renderWindow.getRenderer().addViewProp(labelOverlaySlice);

      renderWindowRef.current = renderWindow;
      imageSliceRef.current = imageSlice;
      labelOverlaySliceRef.current = labelOverlaySlice;
      mapperRef.current = mapper;
      labelOverlayMapperRef.current = labelOverlayMapper;
      resliceRef.current = reslice;
      labelResliceRef.current = labelReslice;

      renderWindow.resize();
      flush();

      return () => {
        imageSliceRef.current = null;
        labelOverlaySliceRef.current = null;
        mapperRef.current = null;
        labelOverlayMapperRef.current = null;
        blankImageRef.current = null;
        overlayRuntimeRef.current = null;
        resliceRef.current = null;
        labelResliceRef.current = null;
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
          style={{
            background: 'rgba(0, 0, 0, 0.58)',
            borderRadius: 4,
            color: '#eef1f3',
            fontSize: 12,
            left: 12,
            padding: '6px 8px',
            position: 'absolute',
            top: 12,
          }}
        >
          Oblique slice
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
  },
);

ObliqueSlicePane.displayName = 'ObliqueSlicePane';
