import { describe, expect, it } from 'vitest';

import { renderEchoSector, TISSUE_TABLE } from '../echo-appearance';

const defaultParams = {
  depthMm: 32,
  heightPx: 8,
  nearFieldMm: 0,
  sectorAngleDeg: 180,
  spacingMm: 1,
  widthPx: 8,
} as const;

describe('echo appearance tissue table', () => {
  it('covers the expected pseudo-TEE labels', () => {
    const expectedLabels = [1, 2, 3, 4, 5, 6, 7, 11, 12, 13, 14, 15, 16, 17, 20, 21, 22, 23];

    for (const label of expectedLabels) {
      expect(TISSUE_TABLE[label]).toBeDefined();
    }

    expect(TISSUE_TABLE[11]).toMatchObject({
      attenCoeff: 0.1,
      baseBrightness: 12,
      grainPx: 1,
      speckleSigma: 6,
    });
    expect(TISSUE_TABLE[15]).toMatchObject({
      attenCoeff: 0.5,
      baseBrightness: 150,
      grainPx: 3,
      speckleSigma: 25,
    });
    expect(TISSUE_TABLE[20]).toMatchObject({
      attenCoeff: 0.12,
      baseBrightness: 220,
      grainPx: 1,
      speckleSigma: 5,
    });
  });
});

describe('renderEchoSector', () => {
  it('is deterministic for the same label field', () => {
    const labels = new Uint8Array(defaultParams.widthPx * defaultParams.heightPx).fill(15);
    const outputA = new Uint8Array(labels.length);
    const outputB = new Uint8Array(labels.length);

    renderEchoSector(labels, outputA, defaultParams);
    renderEchoSector(labels, outputB, defaultParams);

    expect(Array.from(outputA)).toEqual(Array.from(outputB));
  });

  it('brightens label interfaces relative to uniform tissue', () => {
    const labelsWithInterface = new Uint8Array(25).fill(11);
    const uniformBlood = new Uint8Array(25).fill(11);
    const outputWithInterface = new Uint8Array(25);
    const uniformOutput = new Uint8Array(25);

    for (let row = 0; row < 5; row += 1) {
      for (let column = 2; column < 5; column += 1) {
        labelsWithInterface[row * 5 + column] = 15;
      }
    }

    renderEchoSector(labelsWithInterface, outputWithInterface, {
      ...defaultParams,
      depthMm: 20,
      heightPx: 5,
      widthPx: 5,
    });
    renderEchoSector(uniformBlood, uniformOutput, {
      ...defaultParams,
      depthMm: 20,
      heightPx: 5,
      widthPx: 5,
    });

    const bloodPixelOnBoundary = 2 * 5 + 1;
    expect(outputWithInterface[bloodPixelOnBoundary]).toBeGreaterThan(uniformOutput[bloodPixelOnBoundary]);
  });

  it('produces visible output for labeled pixels inside the sector', () => {
    const labels = new Uint8Array(defaultParams.widthPx * defaultParams.heightPx).fill(15);
    const output = new Uint8Array(labels.length);

    renderEchoSector(labels, output, defaultParams);

    expect(output.some((value) => value > 0)).toBe(true);
  });
});
