import { describe, expect, it } from 'vitest';

import { vec3 } from '../math';
import {
  applyDistalFlex,
  applyRoll,
  computeImagingPlane,
  computeShaftFrame,
  getFullTransform,
  interpolateCenterline,
  transformPoint,
} from '../probe-model';
import { CenterlinePath, ProbePose } from '../types';

const straightPath: CenterlinePath = {
  points: [
    {
      position: [0, 0, 0],
      arcLengthMm: 0,
      tangent: [0, 0, 1],
      normal: [1, 0, 0],
      binormal: [0, 1, 0],
    },
    {
      position: [0, 0, 50],
      arcLengthMm: 50,
      tangent: [0, 0, 1],
      normal: [1, 0, 0],
      binormal: [0, 1, 0],
    },
    {
      position: [0, 0, 100],
      arcLengthMm: 100,
      tangent: [0, 0, 1],
      normal: [1, 0, 0],
      binormal: [0, 1, 0],
    },
  ],
  stations: [{ id: 'ME', sRange: [0, 100] }],
  units: 'mm',
};

// TODO(core-fixtures): Replace the synthetic straight-path fixture with a curved authored
// probe_path sample once bundle assets exist, so parallel-transport interpolation is checked
// against real case data instead of only analytic geometry.

describe('interpolateCenterline', () => {
  it('samples linearly by arc length and preserves the frame basis', () => {
    const sample = interpolateCenterline(straightPath, 25);

    expect(sample.position).toEqual([0, 0, 25]);
    expect(sample.arcLengthMm).toBe(25);
    expect(sample.tangent).toEqual([0, 0, 1]);
    expect(sample.normal).toEqual([1, 0, 0]);
    expect(sample.binormal).toEqual([0, 1, 0]);
  });

  it('repairs degenerate basis inputs into an orthonormal frame', () => {
    const degeneratePath: CenterlinePath = {
      points: [
        {
          position: [0, 0, 0],
          arcLengthMm: 0,
          tangent: [1, 0, 0],
          normal: [1, 0, 0],
          binormal: [0, 0, 0],
        },
      ],
    };

    const sample = interpolateCenterline(degeneratePath, 0);

    expect(vec3.dot(sample.tangent, sample.normal)).toBeCloseTo(0, 8);
    expect(vec3.dot(sample.tangent, sample.binormal)).toBeCloseTo(0, 8);
    expect(vec3.dot(sample.normal, sample.binormal)).toBeCloseTo(0, 8);
    expect(vec3.dot(sample.normal, sample.normal)).toBeCloseTo(1, 8);
    expect(vec3.dot(sample.binormal, sample.binormal)).toBeCloseTo(1, 8);
  });

  it('rejects malformed centerlines with decreasing arc length', () => {
    const malformedPath: CenterlinePath = {
      points: [
        straightPath.points[0],
        {
          ...straightPath.points[1],
          arcLengthMm: 10,
        },
        {
          ...straightPath.points[2],
          arcLengthMm: 5,
        },
      ],
    };

    expect(() => interpolateCenterline(malformedPath, 5)).toThrow(/non-decreasing/);
  });
});

describe('probe frame operations', () => {
  it('computes the shaft frame directly from the centerline sample', () => {
    const shaftFrame = computeShaftFrame(straightPath, 40);

    expect(shaftFrame.origin).toEqual([0, 0, 40]);
    expect(shaftFrame.tangent).toEqual([0, 0, 1]);
    expect(shaftFrame.normal).toEqual([1, 0, 0]);
    expect(shaftFrame.binormal).toEqual([0, 1, 0]);
  });

  it('applies distal flex as a constant-curvature bend', () => {
    const shaftFrame = computeShaftFrame(straightPath, 40);
    const tipFrame = applyDistalFlex(shaftFrame, 30, 0, 35);

    expect(tipFrame.origin[0]).toBeGreaterThan(0);
    expect(tipFrame.origin[2]).toBeGreaterThan(70);
    expect(tipFrame.tangent[0]).toBeGreaterThan(0);
    expect(tipFrame.tangent[2]).toBeLessThan(1);
    expect(tipFrame.tangent[2]).toBeGreaterThan(0.8);
  });

  it('applies roll about the shaft axis at the tip', () => {
    const shaftFrame = computeShaftFrame(straightPath, 40);
    const rolledFrame = applyRoll(shaftFrame, 90);

    expect(rolledFrame.normal[0]).toBeCloseTo(0, 6);
    expect(rolledFrame.normal[1]).toBeCloseTo(1, 6);
    expect(rolledFrame.binormal[0]).toBeCloseTo(-1, 6);
    expect(rolledFrame.binormal[1]).toBeCloseTo(0, 6);
  });
});

describe('imaging plane', () => {
  const basePose: ProbePose = {
    sMm: 50,
    rollDeg: 0,
    anteDeg: 0,
    lateralDeg: 0,
    omniplaneDeg: 90,
  };

  it('places the transducer origin proximally from the bent tip', () => {
    const plane = computeImagingPlane(straightPath, basePose);

    expect(plane.origin[0]).toBeCloseTo(0, 6);
    expect(plane.origin[1]).toBeCloseTo(0, 6);
    expect(plane.origin[2]).toBeCloseTo(75, 6);
    expect(plane.up).toEqual([0, 0, 1]);
    expect(plane.right[0]).toBeCloseTo(0, 6);
    expect(plane.right[1]).toBeCloseTo(1, 6);
  });

  it('returns the full transducer transform at the rolled tip frame', () => {
    const transform = getFullTransform(straightPath, basePose);
    const origin = transformPoint(transform, [0, 0, 0]);
    const xAxisPoint = transformPoint(transform, [1, 0, 0]);

    expect(origin[2]).toBeCloseTo(75, 6);
    expect(xAxisPoint[0]).toBeCloseTo(1, 6);
    expect(xAxisPoint[1]).toBeCloseTo(0, 6);
    expect(xAxisPoint[2]).toBeCloseTo(75, 6);
  });
});
