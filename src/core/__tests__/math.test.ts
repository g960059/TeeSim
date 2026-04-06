import { describe, expect, it } from 'vitest';

import { clamp, degToRad, mat4, radToDeg, vec3 } from '../math';

describe('vec3', () => {
  it('supports basic vector operations', () => {
    expect(vec3.add([1, 2, 3], [4, -2, 1])).toEqual([5, 0, 4]);
    expect(vec3.sub([4, 3, 2], [1, 1, 1])).toEqual([3, 2, 1]);
    expect(vec3.scale([2, -3, 4], 0.5)).toEqual([1, -1.5, 2]);
    expect(vec3.dot([1, 2, 3], [4, 5, 6])).toBe(32);
    expect(vec3.cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
    const normalized = vec3.normalize([0, 3, 4]);
    expect(normalized[0]).toBeCloseTo(0, 8);
    expect(normalized[1]).toBeCloseTo(0.6, 8);
    expect(normalized[2]).toBeCloseTo(0.8, 8);
    expect(vec3.lerp([0, 0, 0], [10, 20, 30], 0.25)).toEqual([2.5, 5, 7.5]);
  });
});

describe('mat4', () => {
  it('builds identity, translation, rotation, and multiplication transforms', () => {
    expect(mat4.transformPoint(mat4.identity(), [1, 2, 3])).toEqual([1, 2, 3]);

    const translation = mat4.fromTranslation([5, -3, 2]);
    expect(mat4.transformPoint(translation, [1, 2, 3])).toEqual([6, -1, 5]);

    const rotation = mat4.fromRotation([0, 0, 1], Math.PI / 2);
    const rotated = mat4.transformPoint(rotation, [1, 0, 0]);
    expect(rotated[0]).toBeCloseTo(0, 6);
    expect(rotated[1]).toBeCloseTo(1, 6);
    expect(rotated[2]).toBeCloseTo(0, 6);

    const combined = mat4.multiply(translation, rotation);
    const transformed = mat4.transformPoint(combined, [1, 0, 0]);
    expect(transformed[0]).toBeCloseTo(5, 6);
    expect(transformed[1]).toBeCloseTo(-2, 6);
    expect(transformed[2]).toBeCloseTo(2, 6);
  });
});

describe('scalar helpers', () => {
  it('converts angles and clamps values', () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI, 8);
    expect(radToDeg(Math.PI / 2)).toBeCloseTo(90, 8);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(12, 0, 10)).toBe(10);
    expect(clamp(7, 0, 10)).toBe(7);
  });
});
