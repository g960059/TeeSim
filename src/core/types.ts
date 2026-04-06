import type { Mat4, Vec3 } from './math';

export interface ProbePose {
  sMm: number;
  rollDeg: number;
  anteDeg: number;
  lateralDeg: number;
  omniplaneDeg: number;
}

export interface ImagingPlane {
  origin: Vec3;
  right: Vec3;
  up: Vec3;
  normal: Vec3;
  worldFromPlane: Mat4;
}

export interface CenterlinePoint {
  position: Vec3;
  arcLengthMm: number;
  tangent: Vec3;
  normal: Vec3;
  binormal: Vec3;
}

export interface StationRange {
  id: string;
  sRange: readonly [number, number];
}

export interface CenterlinePath {
  points: CenterlinePoint[];
  stations?: StationRange[];
  coordinateSystem?: string;
  sampleSpacingMm?: number;
  units?: 'mm';
}

export type ViewValidationStatus = 'pending' | 'approved' | 'rejected';

export interface ViewValidation {
  approvedBy: string | null;
  approvedAt: string | null;
  status: ViewValidationStatus;
}

export interface ViewPreset {
  id: string;
  label: string;
  aseCode?: string;
  station?: string;
  probePose: ProbePose;
  validation: ViewValidation;
  weights?: Partial<Record<keyof ProbePose, number>>;
  ranges?: Partial<Record<keyof ProbePose, number>>;
}

export type ViewMatchStatus = 'match' | 'near' | 'exploring';

export interface ViewMatch {
  preset: ViewPreset;
  distance: number;
  score: number;
  status: ViewMatchStatus;
}
