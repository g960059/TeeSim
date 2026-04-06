import type { CenterlinePath, ViewPreset } from '../core';

export interface CaseIndexEntry {
  id: string;
  title: string;
  description: string;
  bundleVersion: string;
  caseVersion: string;
}

export interface CaseIndexFile {
  cases: CaseIndexEntry[];
}

export interface CaseGeneratorMetadata {
  pipelineVersion: string;
  gitCommit: string;
  generatedAt: string;
}

export interface CaseSourceRecord {
  dataset: string;
  bucket: string;
  license: string;
  artifact?: string;
}

export interface MeshAssetRef {
  path: string;
  triangles: number;
  bytes: number;
}

export interface VolumeAssetRef {
  path: string;
  dimensions: [number, number, number];
  spacing: [number, number, number];
  scalarType: string;
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
  };
  metadata: {
    probePath: string;
    views: string;
    landmarks?: string;
  };
}

export interface ProbePathAsset extends CenterlinePath {
  schemaVersion: string;
}

export type ViewsAsset = ViewPreset[];

export interface LoadedCaseBundle {
  entry: CaseIndexEntry;
  manifest: CaseManifest;
  probePath: CenterlinePath;
  views: ViewPreset[];
}
