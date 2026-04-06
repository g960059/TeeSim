import { Mat4, Vec3, degToRad, mat4, vec3 } from './math';
import { CenterlinePath, CenterlinePoint, ImagingPlane, ProbePose } from './types';

const EPSILON = 1e-8;
const DEFAULT_DISTAL_BENDING_MM = 35;
const DEFAULT_TRANSDUCER_OFFSET_MM = 10;

export interface ProbeFrame {
  origin: Vec3;
  tangent: Vec3;
  normal: Vec3;
  binormal: Vec3;
  transform: Mat4;
}

export interface ProbeModelOptions {
  distalBendingLengthMm?: number;
  transducerOffsetMm?: number;
}

const AXIS_FALLBACKS: Vec3[] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

const isFiniteVec3 = (value: Vec3): boolean =>
  Number.isFinite(value[0]) && Number.isFinite(value[1]) && Number.isFinite(value[2]);

const assertFiniteNumber = (value: number, label: string): void => {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
};

const assertFiniteVec3 = (value: Vec3, label: string): void => {
  if (!isFiniteVec3(value)) {
    throw new Error(`${label} must contain only finite numbers.`);
  }
};

const pickPerpendicularSeed = (axis: Vec3): Vec3 =>
  AXIS_FALLBACKS.reduce((bestAxis, candidate) =>
    Math.abs(vec3.dot(axis, candidate)) < Math.abs(vec3.dot(axis, bestAxis)) ? candidate : bestAxis,
  );

const projectPerpendicular = (value: Vec3, axis: Vec3): Vec3 =>
  vec3.sub(value, vec3.scale(axis, vec3.dot(value, axis)));

const resolveUnitVector = (candidates: Vec3[], label: string): Vec3 => {
  for (const candidate of candidates) {
    if (!isFiniteVec3(candidate)) {
      continue;
    }

    const normalized = vec3.normalize(candidate);
    if (vec3.dot(normalized, normalized) > EPSILON) {
      return normalized;
    }
  }

  throw new Error(`${label} must resolve to a non-zero vector.`);
};

const orthonormalizeFrame = (
  tangentInput: Vec3,
  normalInput: Vec3,
  binormalInput: Vec3,
): Omit<ProbeFrame, 'origin' | 'transform'> => {
  assertFiniteVec3(tangentInput, 'Probe tangent input');
  assertFiniteVec3(normalInput, 'Probe normal input');
  assertFiniteVec3(binormalInput, 'Probe binormal input');

  const tangent = resolveUnitVector(
    [tangentInput, vec3.cross(normalInput, binormalInput), [0, 0, 1]],
    'Probe tangent',
  );
  let normal = resolveUnitVector(
    [
      projectPerpendicular(normalInput, tangent),
      vec3.cross(binormalInput, tangent),
      projectPerpendicular(pickPerpendicularSeed(tangent), tangent),
    ],
    'Probe normal',
  );

  let binormal = resolveUnitVector([vec3.cross(tangent, normal)], 'Probe binormal');
  const binormalSeed = vec3.normalize(binormalInput);

  if (vec3.dot(binormalSeed, binormalSeed) > EPSILON && vec3.dot(binormal, binormalSeed) < 0) {
    normal = vec3.scale(normal, -1);
    binormal = vec3.scale(binormal, -1);
  }

  normal = resolveUnitVector([vec3.cross(binormal, tangent)], 'Probe normal');
  binormal = resolveUnitVector([vec3.cross(tangent, normal)], 'Probe binormal');

  return { tangent, normal, binormal };
};

const buildTransform = (origin: Vec3, xAxis: Vec3, yAxis: Vec3, zAxis: Vec3): Mat4 => [
  xAxis[0], xAxis[1], xAxis[2], 0,
  yAxis[0], yAxis[1], yAxis[2], 0,
  zAxis[0], zAxis[1], zAxis[2], 0,
  origin[0], origin[1], origin[2], 1,
];

const buildFrame = (origin: Vec3, tangentInput: Vec3, normalInput: Vec3, binormalInput: Vec3): ProbeFrame => {
  const { tangent, normal, binormal } = orthonormalizeFrame(tangentInput, normalInput, binormalInput);

  return {
    origin,
    tangent,
    normal,
    binormal,
    transform: buildTransform(origin, normal, binormal, tangent),
  };
};

const rotateVectorAroundAxis = (value: Vec3, axis: Vec3, angleRad: number): Vec3 => {
  const unitAxis = vec3.normalize(axis);

  if (vec3.dot(unitAxis, unitAxis) <= EPSILON || Math.abs(angleRad) <= EPSILON) {
    return value;
  }

  const cosTheta = Math.cos(angleRad);
  const sinTheta = Math.sin(angleRad);

  return vec3.add(
    vec3.add(
      vec3.scale(value, cosTheta),
      vec3.scale(vec3.cross(unitAxis, value), sinTheta),
    ),
    vec3.scale(unitAxis, vec3.dot(unitAxis, value) * (1 - cosTheta)),
  );
};

const getTransducerFrame = (
  path: CenterlinePath,
  pose: ProbePose,
  options?: ProbeModelOptions,
): ProbeFrame => {
  const shaftFrame = computeShaftFrame(path, pose.sMm);
  const tipFrame = applyDistalFlex(
    shaftFrame,
    pose.anteDeg,
    pose.lateralDeg,
    options?.distalBendingLengthMm ?? DEFAULT_DISTAL_BENDING_MM,
  );
  const rolledFrame = applyRoll(tipFrame, pose.rollDeg);
  const transducerOffsetMm = options?.transducerOffsetMm ?? DEFAULT_TRANSDUCER_OFFSET_MM;
  const transducerOrigin = vec3.sub(
    rolledFrame.origin,
    vec3.scale(rolledFrame.tangent, transducerOffsetMm),
  );

  return buildFrame(
    transducerOrigin,
    rolledFrame.tangent,
    rolledFrame.normal,
    rolledFrame.binormal,
  );
};

export const interpolateCenterline = (path: CenterlinePath, sMm: number): CenterlinePoint => {
  if (path.points.length === 0) {
    throw new Error('CenterlinePath.points must contain at least one sample.');
  }

  assertFiniteNumber(sMm, 'ProbePose.sMm');

  for (let index = 0; index < path.points.length; index += 1) {
    const point = path.points[index];
    assertFiniteVec3(point.position, `CenterlinePath.points[${index}].position`);
    assertFiniteNumber(point.arcLengthMm, `CenterlinePath.points[${index}].arcLengthMm`);
    assertFiniteVec3(point.tangent, `CenterlinePath.points[${index}].tangent`);
    assertFiniteVec3(point.normal, `CenterlinePath.points[${index}].normal`);
    assertFiniteVec3(point.binormal, `CenterlinePath.points[${index}].binormal`);

    if (index > 0 && point.arcLengthMm < path.points[index - 1].arcLengthMm) {
      throw new Error('CenterlinePath.points arcLengthMm values must be non-decreasing.');
    }
  }

  if (path.points.length === 1) {
    const onlyPoint = path.points[0];
    const frame = orthonormalizeFrame(onlyPoint.tangent, onlyPoint.normal, onlyPoint.binormal);

    return {
      position: onlyPoint.position,
      arcLengthMm: onlyPoint.arcLengthMm,
      tangent: frame.tangent,
      normal: frame.normal,
      binormal: frame.binormal,
    };
  }

  const firstPoint = path.points[0];
  const lastPoint = path.points[path.points.length - 1];
  const clampedS = Math.min(Math.max(sMm, firstPoint.arcLengthMm), lastPoint.arcLengthMm);

  for (let index = 0; index < path.points.length - 1; index += 1) {
    const current = path.points[index];
    const next = path.points[index + 1];

    if (clampedS > next.arcLengthMm) {
      continue;
    }

    const segmentLength = next.arcLengthMm - current.arcLengthMm;
    const t = segmentLength <= EPSILON ? 0 : (clampedS - current.arcLengthMm) / segmentLength;
    const { tangent, normal, binormal } = orthonormalizeFrame(
      vec3.lerp(current.tangent, next.tangent, t),
      vec3.lerp(current.normal, next.normal, t),
      vec3.lerp(current.binormal, next.binormal, t),
    );

    return {
      position: vec3.lerp(current.position, next.position, t),
      arcLengthMm: clampedS,
      tangent,
      normal,
      binormal,
    };
  }

  const frame = orthonormalizeFrame(lastPoint.tangent, lastPoint.normal, lastPoint.binormal);

  return {
    position: lastPoint.position,
    arcLengthMm: lastPoint.arcLengthMm,
    tangent: frame.tangent,
    normal: frame.normal,
    binormal: frame.binormal,
  };
};

export const computeShaftFrame = (path: CenterlinePath, sMm: number): ProbeFrame => {
  const point = interpolateCenterline(path, sMm);
  return buildFrame(point.position, point.tangent, point.normal, point.binormal);
};

export const applyDistalFlex = (
  frame: ProbeFrame,
  anteDeg: number,
  lateralDeg: number,
  distalBendingLengthMm = DEFAULT_DISTAL_BENDING_MM,
): ProbeFrame => {
  if (distalBendingLengthMm <= EPSILON) {
    return frame;
  }

  const anteRad = degToRad(anteDeg);
  const lateralRad = degToRad(lateralDeg);
  const flexMagnitude = Math.hypot(anteRad, lateralRad);

  if (flexMagnitude <= EPSILON) {
    return buildFrame(
      vec3.add(frame.origin, vec3.scale(frame.tangent, distalBendingLengthMm)),
      frame.tangent,
      frame.normal,
      frame.binormal,
    );
  }

  const bendDirection = vec3.normalize(
    vec3.add(
      vec3.scale(frame.normal, anteRad),
      vec3.scale(frame.binormal, lateralRad),
    ),
  );
  const bendAxis = vec3.normalize(vec3.cross(frame.tangent, bendDirection));
  const radius = distalBendingLengthMm / flexMagnitude;

  // Constant-curvature arc over the distal bending section.
  const offset = vec3.add(
    vec3.scale(bendDirection, radius * (1 - Math.cos(flexMagnitude))),
    vec3.scale(frame.tangent, radius * Math.sin(flexMagnitude)),
  );

  return buildFrame(
    vec3.add(frame.origin, offset),
    rotateVectorAroundAxis(frame.tangent, bendAxis, flexMagnitude),
    rotateVectorAroundAxis(frame.normal, bendAxis, flexMagnitude),
    rotateVectorAroundAxis(frame.binormal, bendAxis, flexMagnitude),
  );
};

export const applyRoll = (frame: ProbeFrame, rollDeg: number): ProbeFrame => {
  const rollRad = degToRad(rollDeg);

  if (Math.abs(rollRad) <= EPSILON) {
    return frame;
  }

  return buildFrame(
    frame.origin,
    frame.tangent,
    rotateVectorAroundAxis(frame.normal, frame.tangent, rollRad),
    rotateVectorAroundAxis(frame.binormal, frame.tangent, rollRad),
  );
};

export const computeImagingPlane = (
  path: CenterlinePath,
  pose: ProbePose,
  options?: ProbeModelOptions,
): ImagingPlane => {
  const transducerFrame = getTransducerFrame(path, pose, options);
  const omniplaneRad = degToRad(pose.omniplaneDeg);
  // The TEE scan plane rotates about the probe shaft, but image depth should follow the
  // side-firing beam direction rather than the shaft tangent itself.
  const beamDirection = vec3.normalize(
    rotateVectorAroundAxis(transducerFrame.normal, transducerFrame.tangent, omniplaneRad),
  );
  const right = transducerFrame.tangent;
  const up = beamDirection;
  const normal = vec3.normalize(vec3.cross(right, up));

  return {
    origin: transducerFrame.origin,
    right,
    up,
    normal,
    worldFromPlane: buildTransform(transducerFrame.origin, right, up, normal),
  };
};

export const getFullTransform = (
  path: CenterlinePath,
  pose: ProbePose,
  options?: ProbeModelOptions,
): Mat4 => getTransducerFrame(path, pose, options).transform;

export const transformPoint = (transform: Mat4, point: Vec3): Vec3 => mat4.transformPoint(transform, point);
