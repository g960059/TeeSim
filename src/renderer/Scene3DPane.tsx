import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import type { vtkSubscription } from '@kitware/vtk.js/interfaces';
import {
  applyUserMatrix,
  createPlaceholderBoxActor,
  createProbeGlyph,
  createRenderWindow,
  createSectorPlane,
  disposePipeline,
  setCanvasRenderState,
  setCanvasTestId,
} from './vtk-helpers';
import type { ImagingPlane, Vec3 } from '../core';
import type { LoadedMeshActors, Scene3DPaneHandle, Scene3DPaneProps } from './types';

type SceneState = {
  imagingPlane?: ImagingPlane | null;
  meshes?: LoadedMeshActors;
  probeTransform?: readonly number[] | null;
};

const MIN_CAMERA_DISTANCE = 120;
const MAX_CAMERA_DISTANCE = 1200;
const MESH_PALETTE: Array<{ color: [number, number, number]; opacity?: number }> = [
  { color: [0.85, 0.25, 0.25] },
  { color: [0.95, 0.6, 0.6] },
  { color: [0.6, 0.15, 0.15] },
  { color: [0.3, 0.5, 0.85] },
  { color: [0.7, 0.7, 0.75], opacity: 0.3 },
  { color: [0.7, 0.7, 0.75], opacity: 0.3 },
];
const FALLBACK_MESH_STYLE = { color: [0.55, 0.55, 0.6] as [number, number, number], opacity: 1 };

const normalize = (vector: Vec3): Vec3 => {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (length === 0) {
    return [0, 0, 1];
  }
  return [vector[0] / length, vector[1] / length, vector[2] / length];
};

const clampOrbitCamera = (renderer: ReturnType<NonNullable<ReturnType<typeof createRenderWindow>['getRenderer']>>) => {
  const camera = renderer.getActiveCamera();
  const position = camera.getPosition();
  const focalPoint = camera.getFocalPoint();
  const offset: Vec3 = [
    position[0] - focalPoint[0],
    position[1] - focalPoint[1],
    position[2] - focalPoint[2],
  ];
  const distance = Math.hypot(offset[0], offset[1], offset[2]);
  const clampedDistance = Math.min(Math.max(distance, MIN_CAMERA_DISTANCE), MAX_CAMERA_DISTANCE);

  if (Math.abs(clampedDistance - distance) <= 1e-6) {
    renderer.resetCameraClippingRange();
    return;
  }

  const direction = normalize(offset);
  camera.setPosition(
    focalPoint[0] + direction[0] * clampedDistance,
    focalPoint[1] + direction[1] * clampedDistance,
    focalPoint[2] + direction[2] * clampedDistance,
  );
  renderer.resetCameraClippingRange();
};

export const Scene3DPane = forwardRef<Scene3DPaneHandle, Scene3DPaneProps>(function Scene3DPane(
  { height, imagingPlane, meshes, probeTransform, width },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderWindowRef = useRef<ReturnType<typeof createRenderWindow> | null>(null);
  const interactionSubscriptionRef = useRef<Readonly<vtkSubscription> | null>(null);
  const probeActorRef = useRef<vtkActor | null>(null);
  const placeholderActorRef = useRef<vtkActor | null>(null);
  const sectorActorRef = useRef<vtkActor | null>(null);
  const meshActorsRef = useRef<LoadedMeshActors>([]);
  const latestStateRef = useRef<SceneState>({
    imagingPlane,
    meshes,
    probeTransform,
  });
  const cameraInitializedRef = useRef(false);

  const resetCamera = (forceOrientation = false): void => {
    const renderWindow = renderWindowRef.current;
    if (!renderWindow) {
      return;
    }

    const renderer = renderWindow.getRenderer();
    const camera = renderer.getActiveCamera();

    if (!cameraInitializedRef.current || forceOrientation) {
      camera.setViewUp(0, 0, 1);
      renderer.resetCamera();
      camera.azimuth(28);
      camera.elevation(18);
      cameraInitializedRef.current = true;
    }

    clampOrbitCamera(renderer);
  };

  const syncMeshes = (nextMeshes?: LoadedMeshActors): void => {
    const renderWindow = renderWindowRef.current;
    const placeholderActor = placeholderActorRef.current;
    if (!renderWindow || !placeholderActor) {
      return;
    }

    const renderer = renderWindow.getRenderer();
    const currentMeshes = meshActorsRef.current;
    const resolvedMeshes = nextMeshes ?? [];

    if (currentMeshes === resolvedMeshes) {
      placeholderActor.setVisibility(resolvedMeshes.length === 0);
      return;
    }

    currentMeshes.forEach((actor) => renderer.removeActor(actor));
    resolvedMeshes.forEach((actor, index) => {
      const prop = actor.getProperty();
      const style = MESH_PALETTE[index] ?? FALLBACK_MESH_STYLE;

      prop.setColor(...style.color);
      prop.setOpacity(style.opacity ?? 1);
      prop.setAmbient(0.3);
      prop.setDiffuse(0.7);
      prop.setSpecular(0.2);
      prop.setSpecularPower(20);
      actor.setVisibility(true);
      renderer.addActor(actor);
    });
    meshActorsRef.current = resolvedMeshes;

    placeholderActor.setVisibility(resolvedMeshes.length === 0);
    if (resolvedMeshes.length > 0 || currentMeshes.length > 0) {
      resetCamera(true);
    }
  };

  const syncProbeTransform = (nextProbeTransform?: readonly number[] | null): void => {
    const probeActor = probeActorRef.current;
    if (!probeActor) {
      return;
    }

    if (!nextProbeTransform) {
      probeActor.setVisibility(false);
      return;
    }

    applyUserMatrix(probeActor, nextProbeTransform);
    probeActor.setVisibility(true);
  };

  const syncImagingPlane = (nextImagingPlane?: ImagingPlane | null): void => {
    const renderWindow = renderWindowRef.current;
    if (!renderWindow) {
      return;
    }

    const renderer = renderWindow.getRenderer();

    if (sectorActorRef.current) {
      renderer.removeActor(sectorActorRef.current);
      sectorActorRef.current = null;
    }

    if (!nextImagingPlane) {
      return;
    }

    sectorActorRef.current = createSectorPlane(nextImagingPlane);
    renderer.addActor(sectorActorRef.current);
  };

  const flush = (): void => {
    const renderWindow = renderWindowRef.current;
    const container = containerRef.current;
    if (!renderWindow) {
      return;
    }

    syncMeshes(latestStateRef.current.meshes);
    syncProbeTransform(latestStateRef.current.probeTransform);
    syncImagingPlane(latestStateRef.current.imagingPlane);
    clampOrbitCamera(renderWindow.getRenderer());
    renderWindow.getRenderWindow().render();
    if (container) {
      const renderState = latestStateRef.current.meshes?.length ? 'ready' : 'empty';
      setCanvasRenderState(container, renderState);
    }
  };

  useImperativeHandle(ref, () => ({
    render() {
      flush();
    },
    setImagingPlane(nextImagingPlane) {
      latestStateRef.current.imagingPlane = nextImagingPlane;
    },
    setMeshes(nextMeshes) {
      latestStateRef.current.meshes = nextMeshes;
    },
    setProbeTransform(nextProbeTransform) {
      latestStateRef.current.probeTransform = nextProbeTransform;
    },
  }), []);

  useEffect(() => {
    latestStateRef.current.meshes = meshes;
    if (imagingPlane !== undefined) {
      latestStateRef.current.imagingPlane = imagingPlane;
    }
    if (probeTransform !== undefined) {
      latestStateRef.current.probeTransform = probeTransform;
    }
    flush();
  }, [imagingPlane, meshes, probeTransform]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const renderWindow = createRenderWindow(container, [0.04, 0.05, 0.07]);
    const renderer = renderWindow.getRenderer();
    const probeActor = createProbeGlyph();
    const placeholderActor = createPlaceholderBoxActor();

    setCanvasTestId(container, 'three-d-canvas');
    setCanvasRenderState(container, latestStateRef.current.meshes?.length ? 'ready' : 'empty');

    probeActor.setVisibility(Boolean(latestStateRef.current.probeTransform));
    renderer.addActor(placeholderActor);
    renderer.addActor(probeActor);

    probeActorRef.current = probeActor;
    placeholderActorRef.current = placeholderActor;
    renderWindowRef.current = renderWindow;
    // onEndInteractionEvent may not exist at runtime in some vtk.js builds
    try {
      const interactor = renderWindow.getInteractor();
      if (interactor && typeof interactor.onEndInteractionEvent === 'function') {
        interactionSubscriptionRef.current = interactor.onEndInteractionEvent(() => {
          clampOrbitCamera(renderer);
          renderWindow.getRenderWindow().render();
        });
      }
    } catch {
      // Gracefully degrade: orbit camera clamping won't auto-trigger after interaction
    }

    resetCamera(true);
    flush();

    return () => {
      interactionSubscriptionRef.current?.unsubscribe();
      interactionSubscriptionRef.current = null;
      sectorActorRef.current = null;
      probeActorRef.current = null;
      placeholderActorRef.current = null;
      meshActorsRef.current = [];
      cameraInitializedRef.current = false;
      disposePipeline(renderWindow);
      renderWindowRef.current = null;
    };
  }, []);

  useEffect(() => {
    const renderWindow = renderWindowRef.current;
    if (!renderWindow) {
      return;
    }

    renderWindow.resize();
    clampOrbitCamera(renderWindow.getRenderer());
    renderWindow.getRenderWindow().render();
  }, [height, width]);

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        maxHeight: height,
        maxWidth: width,
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
      }}
    />
  );
});

Scene3DPane.displayName = 'Scene3DPane';
