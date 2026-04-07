import type { vtkImageData as VtkImageData } from '@kitware/vtk.js/Common/DataModel/ImageData';
import type vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import type { CenterlinePath, ProbePose, Vec3, ViewPreset, ViewValidation } from '../core';

export interface CaseIndexEntry {
  id: string;
  title: string;
  description: string;
  bundleVersion: string;
  caseVersion: string;
}

export interface RawCaseIndexEntry {
  id?: string;
  caseId?: string;
  title: string;
  description: string;
  bundleVersion?: string;
  caseVersion?: string;
}

export interface CaseIndexFile {
  cases: RawCaseIndexEntry[];
}

export interface CaseGeneratorMetadata {
  pipelineVersion?: string;
  gitCommit?: string;
  generatedAt?: string;
}

export interface CaseSourceRecord {
  dataset: string;
  bucket: string;
  license: string;
  artifact?: string;
}

export interface MeshAssetRef {
  path: string;
  triangles?: number;
  bytes?: number;
}

export interface VolumeAssetRef {
  path: string;
  dimensions?: [number, number, number];
  spacing?: [number, number, number];
  scalarType?: string;
}

export interface CaseManifest {
  schemaVersion: string;
  caseId: string;
  caseVersion: string;
  bundleVersion: string;
  coordinateSystem: string;
  units: 'mm';
  worldFromImage: number[];
  worldFromMesh: number[];
  generator: CaseGeneratorMetadata;
  sources: CaseSourceRecord[];
  structures: string[];
  assets?: {
    sceneGlb?: MeshAssetRef;
    heartDetailGlb?: MeshAssetRef;
    heartRoiVti?: VolumeAssetRef;
    labelVti?: VolumeAssetRef;
  };
  metadata: {
    probePath: string;
    views: string;
    landmarks?: string;
  };
}

export interface RawCaseManifest extends Partial<Omit<CaseManifest, 'structures'>> {
  caseId: string;
  metadata: {
    probePath: string;
    views: string;
    landmarks?: string;
  };
  structures?: string[];
}

export interface ProbePathFrameAsset {
  tangent: Vec3;
  normal: Vec3;
  binormal: Vec3;
}

export interface ProbePathStationAsset {
  id: string;
  sRange?: readonly [number, number];
  sRangeMm?: readonly [number, number];
}

export interface ProbePathAsset {
  schemaVersion: string;
  coordinateSystem?: string;
  units?: 'mm';
  sampleSpacingMm?: number;
  points: Vec3[] | CenterlinePath['points'];
  arcLengthMm?: number[];
  frames?: ProbePathFrameAsset[];
  stations?: ProbePathStationAsset[];
}

export interface ViewToleranceAsset {
  sMm?: number;
  angleDeg?: number;
}

export interface ViewAsset {
  id: string;
  label: string;
  aseCode?: string;
  station?: string;
  probePose: ProbePose;
  validation?: ViewValidation;
  weights?: Partial<Record<keyof ProbePose, number>>;
  ranges?: Partial<Record<keyof ProbePose, number>>;
  tolerance?: ViewToleranceAsset;
  targetStructures?: string[];
}

export interface LandmarksAsset {
  points?: Array<{
    id: string;
    structureId?: string;
    position: Vec3;
  }>;
}

export type ViewsAsset = ViewAsset[];

export interface LoadedCaseBundle {
  entry: CaseIndexEntry;
  manifest: CaseManifest;
  probePath: CenterlinePath;
  views: ViewPreset[];
  meshes: readonly vtkActor[];
  volume: VtkImageData | null;
  labelVolume: VtkImageData | null;
}
