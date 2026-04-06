import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction.js';
import vtkImageMapper from '@kitware/vtk.js/Rendering/Core/ImageMapper.js';
import vtkImageProperty from '@kitware/vtk.js/Rendering/Core/ImageProperty.js';
import vtkImageSlice from '@kitware/vtk.js/Rendering/Core/ImageSlice.js';
import vtkPiecewiseFunction from '@kitware/vtk.js/Common/DataModel/PiecewiseFunction.js';
import vtkImageReslice from '@kitware/vtk.js/Imaging/Core/ImageReslice.js';
import { InterpolationMode } from '@kitware/vtk.js/Imaging/Core/AbstractImageInterpolator/Constants.js';
import { SlabMode } from '@kitware/vtk.js/Imaging/Core/ImageReslice/Constants.js';
import type { vtkImageData as VtkImageData } from '@kitware/vtk.js/Common/DataModel/ImageData';
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
  volume?: VtkImageData | null;
  width: number;
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
  function ObliqueSlicePane({ height, imagingPlane, volume, width }, ref) {
    const [isLoading, setIsLoading] = useState(true);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const renderWindowRef = useRef<ReturnType<typeof createRenderWindow> | null>(null);
    const imageSliceRef = useRef<ReturnType<typeof vtkImageSlice.newInstance> | null>(null);
    const mapperRef = useRef<ReturnType<typeof vtkImageMapper.newInstance> | null>(null);
    const resliceRef = useRef<ReturnType<typeof vtkImageReslice.newInstance> | null>(null);
    const latestStateRef = useRef<PaneState>({
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

    const flush = (): void => {
      const renderWindow = renderWindowRef.current;
      const mapper = mapperRef.current;
      const imageSlice = imageSliceRef.current;
      const reslice = resliceRef.current;
      if (!renderWindow || !mapper || !imageSlice || !reslice) {
        return;
      }

      const widthPx = Math.max(1, Math.round(latestStateRef.current.width));
      const heightPx = Math.max(1, Math.round(latestStateRef.current.height));
      const outputSpacingMm = 0.6;

      fitSliceCamera(renderWindow, widthPx * outputSpacingMm, heightPx * outputSpacingMm);

      if (!latestStateRef.current.volume || !latestStateRef.current.imagingPlane) {
        imageSlice.setVisibility(false);
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
      latestStateRef.current = {
        height,
        imagingPlane,
        volume,
        width,
      };
      flush();
    }, [height, imagingPlane, volume, width]);

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
      const transferFunctions = createCtTransferFunctions();

      setCanvasTestId(container, 'oblique-slice-canvas');

      reslice.setOutputDimensionality(2);
      reslice.setBackgroundColor([0, 0, 0, 0]);
      reslice.setInterpolationMode(InterpolationMode.LINEAR);
      reslice.setSlabMode(SlabMode.MEAN);
      reslice.setSlabNumberOfSlices(1);

      mapper.setKSlice(0);
      imageSlice.setMapper(mapper);
      imageSlice.getProperty().setInterpolationTypeToLinear();
      imageSlice.getProperty().setRGBTransferFunction(0, transferFunctions.color);
      imageSlice.getProperty().setScalarOpacity(0, transferFunctions.opacity);
      imageSlice.getProperty().setUseLookupTableScalarRange(true);
      renderWindow.getRenderer().addViewProp(imageSlice);

      renderWindowRef.current = renderWindow;
      imageSliceRef.current = imageSlice;
      mapperRef.current = mapper;
      resliceRef.current = reslice;

      renderWindow.resize();
      flush();

      return () => {
        imageSliceRef.current = null;
        mapperRef.current = null;
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
