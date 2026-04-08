import type { RefObject } from 'react';
import type { vtkImageData } from '@kitware/vtk.js/Common/DataModel/ImageData';
import type vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import type {
  CenterlinePath,
  ImagingPlane,
  Mat4,
  ProbeModelOptions,
  ProbePose,
} from '../core';

export type LoadedMeshActors = readonly vtkActor[];
export type RendererVolume = vtkImageData;

export interface PseudoTeeAppearance {
  depthMm?: number;
  nearFieldMm?: number;
  outputSpacingMm?: number;
  sectorAngleDeg?: number;
}

export interface Scene3DPaneProps {
  width: number;
  height: number;
  meshes?: LoadedMeshActors;
  probeTransform?: Mat4 | null;
  imagingPlane?: ImagingPlane | null;
}

export interface PseudoTeePaneProps {
  width: number;
  height: number;
  volume?: RendererVolume | null;
  labelVolume?: RendererVolume | null;
  imagingPlane?: ImagingPlane | null;
  appearance?: PseudoTeeAppearance;
  labelsVisible?: boolean;
}

export interface ObliqueSlicePaneProps {
  width: number;
  height: number;
  volume?: RendererVolume | null;
  labelVolume?: RendererVolume | null;
  imagingPlane?: ImagingPlane | null;
  labelsVisible?: boolean;
}

export interface Scene3DPaneHandle {
  render(): void;
  setImagingPlane(imagingPlane?: ImagingPlane | null): void;
  setMeshes(meshes?: LoadedMeshActors): void;
  setProbeTransform(probeTransform?: Mat4 | null): void;
}

export interface PseudoTeePaneHandle {
  render(): void;
  setAppearance(appearance?: PseudoTeeAppearance): void;
  setImagingPlane(imagingPlane?: ImagingPlane | null): void;
  setVolume(volume?: RendererVolume | null): void;
}

export interface ObliqueSlicePaneHandle {
  render(): void;
  setImagingPlane(imagingPlane?: ImagingPlane | null): void;
  setVolume(volume?: RendererVolume | null): void;
}

export type RendererPaneHandle =
  | Scene3DPaneHandle
  | PseudoTeePaneHandle
  | ObliqueSlicePaneHandle;

export type RendererPaneRef = RefObject<RendererPaneHandle | null>;

export interface RendererUpdate {
  imagingPlane: ImagingPlane;
  probePose: ProbePose;
  probeTransform: Mat4;
}

export interface SelectorStore<TState> {
  getState(): TState;
  subscribe(listener: (state: TState, prevState: TState) => void): () => void;
  subscribe<U>(
    selector: (state: TState) => U,
    listener: (selectedState: U, previousSelectedState: U) => void,
    options?: {
      equalityFn?: (a: U, b: U) => boolean;
      fireImmediately?: boolean;
    },
  ): () => void;
}

export interface SyncManagerOptions<TState> {
  paneRefs: readonly RendererPaneRef[];
  path: CenterlinePath | null;
  probeModelOptions?: ProbeModelOptions;
  selectProbePose: (state: TState) => ProbePose;
  store: SelectorStore<TState>;
}
