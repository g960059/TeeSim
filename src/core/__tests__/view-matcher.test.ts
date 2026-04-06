import { describe, expect, it } from 'vitest';

import { computeViewDistance, matchViews } from '../view-matcher';
import { ProbePose, ViewPreset } from '../types';

const pendingValidation = {
  approvedBy: null,
  approvedAt: null,
  status: 'pending' as const,
};

const referencePose: ProbePose = {
  sMm: 140,
  rollDeg: 10,
  anteDeg: 15,
  lateralDeg: -5,
  omniplaneDeg: 60,
};

const presets: ViewPreset[] = [
  {
    id: 'me-2c',
    label: 'ME Two-Chamber',
    station: 'ME',
    probePose: referencePose,
    validation: pendingValidation,
    ranges: {
      sMm: 100,
      rollDeg: 180,
      anteDeg: 90,
      lateralDeg: 90,
      omniplaneDeg: 180,
    },
  },
  {
    id: 'tg-sax',
    label: 'TG Mid SAX',
    station: 'TG',
    probePose: {
      sMm: 210,
      rollDeg: 0,
      anteDeg: 35,
      lateralDeg: 0,
      omniplaneDeg: 10,
    },
    validation: pendingValidation,
    ranges: {
      sMm: 100,
      rollDeg: 180,
      anteDeg: 90,
      lateralDeg: 90,
      omniplaneDeg: 180,
    },
  },
];

describe('computeViewDistance', () => {
  it('returns zero for an exact pose match', () => {
    expect(computeViewDistance(referencePose, presets[0])).toBe(0);
  });

  it('wraps roll differences through 360 degrees', () => {
    const wrappedRollPose: ProbePose = {
      ...referencePose,
      rollDeg: 370,
    };

    expect(computeViewDistance(wrappedRollPose, presets[0])).toBe(0);
  });

  it('wraps omniplane differences through 180 degrees', () => {
    const wrappedOmniplanePose: ProbePose = {
      ...referencePose,
      omniplaneDeg: 179,
    };
    const wrappedOmniplanePreset: ViewPreset = {
      ...presets[0],
      probePose: {
        ...referencePose,
        omniplaneDeg: 1,
      },
    };

    expect(computeViewDistance(wrappedOmniplanePose, wrappedOmniplanePreset)).toBeCloseTo(2 / 180, 8);
  });

  it('rejects invalid preset ranges', () => {
    const invalidPreset: ViewPreset = {
      ...presets[0],
      ranges: {
        ...presets[0].ranges,
        sMm: 0,
      },
    };

    expect(() => computeViewDistance(referencePose, invalidPreset)).toThrow(/invalid range/i);
  });
});

describe('matchViews', () => {
  it('sorts matches by score and assigns ADR status bands', () => {
    const matches = matchViews(referencePose, presets);

    expect(matches[0].preset.id).toBe('me-2c');
    expect(matches[0].score).toBe(1);
    expect(matches[0].status).toBe('match');
    expect(matches[1].status).toBe('exploring');
  });

  it('marks moderately close poses as near', () => {
    const nearPose: ProbePose = {
      ...referencePose,
      sMm: 165,
      omniplaneDeg: 84,
    };

    const [match] = matchViews(nearPose, [presets[0]]);

    expect(match.distance).toBeCloseTo(Math.sqrt(0.0625 + (24 / 180) ** 2), 8);
    expect(match.score).toBeCloseTo(1 - Math.sqrt(0.0625 + (24 / 180) ** 2), 8);
    expect(match.status).toBe('near');
  });

  it('treats the ADR threshold boundaries as inclusive', () => {
    const matchBoundaryPose: ProbePose = {
      ...referencePose,
      sMm: 155,
    };
    const nearBoundaryPose: ProbePose = {
      ...referencePose,
      sMm: 180,
    };

    expect(matchViews(matchBoundaryPose, [presets[0]])[0].score).toBeCloseTo(0.85, 8);
    expect(matchViews(matchBoundaryPose, [presets[0]])[0].status).toBe('match');
    expect(matchViews(nearBoundaryPose, [presets[0]])[0].score).toBeCloseTo(0.6, 8);
    expect(matchViews(nearBoundaryPose, [presets[0]])[0].status).toBe('near');
  });
});
