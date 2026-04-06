import { clamp } from './math';
import { ProbePose, ViewMatch, ViewMatchStatus, ViewPreset } from './types';

const DEFAULT_RANGES: Record<keyof ProbePose, number> = {
  sMm: 300,
  rollDeg: 180,
  anteDeg: 180,
  lateralDeg: 180,
  omniplaneDeg: 180,
};

const DEFAULT_WEIGHTS: Record<keyof ProbePose, number> = {
  sMm: 1,
  rollDeg: 1,
  anteDeg: 1,
  lateralDeg: 1,
  omniplaneDeg: 1,
};

const POSE_KEYS: (keyof ProbePose)[] = ['sMm', 'rollDeg', 'anteDeg', 'lateralDeg', 'omniplaneDeg'];

const shortestWrappedAngleDelta = (current: number, target: number, periodDeg: number): number => {
  let delta = (current - target) % periodDeg;

  if (delta > periodDeg / 2) {
    delta -= periodDeg;
  } else if (delta < -periodDeg / 2) {
    delta += periodDeg;
  }

  return delta;
};

const assertFinitePose = (pose: ProbePose, label: string): void => {
  for (const key of POSE_KEYS) {
    if (!Number.isFinite(pose[key])) {
      throw new Error(`${label}.${key} must be a finite number.`);
    }
  }
};

const resolveMetricParameters = (
  preset: ViewPreset,
): {
  ranges: Record<keyof ProbePose, number>;
  weights: Record<keyof ProbePose, number>;
} => {
  const ranges = { ...DEFAULT_RANGES, ...preset.ranges };
  const weights = { ...DEFAULT_WEIGHTS, ...preset.weights };

  for (const key of POSE_KEYS) {
    if (!Number.isFinite(ranges[key]) || ranges[key] <= 0) {
      throw new Error(`View preset "${preset.id}" has an invalid range for ${key}.`);
    }

    if (!Number.isFinite(weights[key]) || weights[key] < 0) {
      throw new Error(`View preset "${preset.id}" has an invalid weight for ${key}.`);
    }
  }

  return { ranges, weights };
};

const getViewScore = (distance: number): number => clamp(1 - distance, 0, 1);

const getViewStatus = (score: number): ViewMatchStatus => {
  if (score >= 0.85) {
    return 'match';
  }

  if (score >= 0.6) {
    return 'near';
  }

  return 'exploring';
};

export const computeViewDistance = (pose: ProbePose, preset: ViewPreset): number => {
  assertFinitePose(pose, 'Probe pose');
  assertFinitePose(preset.probePose, `View preset "${preset.id}" probePose`);
  const { ranges, weights } = resolveMetricParameters(preset);
  const target = preset.probePose;

  const normalizedS = (pose.sMm - target.sMm) / ranges.sMm;
  const normalizedRoll = shortestWrappedAngleDelta(pose.rollDeg, target.rollDeg, 360) / ranges.rollDeg;
  const normalizedAnte = (pose.anteDeg - target.anteDeg) / ranges.anteDeg;
  const normalizedLateral = (pose.lateralDeg - target.lateralDeg) / ranges.lateralDeg;
  const normalizedOmniplane =
    shortestWrappedAngleDelta(pose.omniplaneDeg, target.omniplaneDeg, 180) / ranges.omniplaneDeg;

  return Math.sqrt(
    weights.sMm * normalizedS * normalizedS +
      weights.rollDeg * normalizedRoll * normalizedRoll +
      weights.anteDeg * normalizedAnte * normalizedAnte +
      weights.lateralDeg * normalizedLateral * normalizedLateral +
      weights.omniplaneDeg * normalizedOmniplane * normalizedOmniplane,
  );
};

export const matchViews = (pose: ProbePose, presets: ViewPreset[]): ViewMatch[] =>
  [...presets]
    .map((preset) => {
      const distance = computeViewDistance(pose, preset);
      const score = getViewScore(distance);

      return {
        preset,
        distance,
        score,
        status: getViewStatus(score),
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      if (a.distance !== b.distance) {
        return a.distance - b.distance;
      }

      return a.preset.label.localeCompare(b.preset.label);
    });
