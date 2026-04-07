import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeLoaderMocks = vi.hoisted(() => ({
  loadGlbActors: vi.fn(async () => [] as never),
  loadVtiVolume: vi.fn(async (url: string) => ({ url }) as never),
}));

vi.mock('../runtime-loaders', () => runtimeLoaderMocks);

import { loadCaseBundle } from '../loader';

const publicCaseRoot = path.resolve(
  process.cwd(),
  'public/cases/0.1.0/lctsc_s1_006',
);

const publicCaseEntry = {
  id: 'lctsc_s1_006',
  title: 'LCTSC S1-006',
  description: 'Thorax CT public case',
  bundleVersion: '0.1.0',
  caseVersion: '0.1.0',
} as const;

const jsonResponse = (body: unknown): Response =>
  ({
    ok: true,
    json: async () => body,
  }) as Response;

const readJson = <T>(filename: string): T =>
  JSON.parse(fs.readFileSync(path.join(publicCaseRoot, filename), 'utf8')) as T;

const readVolumeBounds = (): readonly [number, number, number, number, number, number] => {
  const header = fs.readFileSync(path.join(publicCaseRoot, 'heart_roi.vti'), 'utf8');
  const match = header.match(
    /<ImageData[^>]*WholeExtent="([^"]+)"[^>]*Origin="([^"]+)"[^>]*Spacing="([^"]+)"/,
  );

  if (!match) {
    throw new Error('Failed to parse heart_roi.vti ImageData header.');
  }

  const extent = match[1].split(/\s+/).map(Number);
  const origin = match[2].split(/\s+/).map(Number);
  const spacing = match[3].split(/\s+/).map(Number);

  return [
    origin[0] + extent[0] * spacing[0],
    origin[0] + extent[1] * spacing[0],
    origin[1] + extent[2] * spacing[1],
    origin[1] + extent[3] * spacing[1],
    origin[2] + extent[4] * spacing[2],
    origin[2] + extent[5] * spacing[2],
  ];
};

const distance3 = (
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('public LCTSC case assets', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockImplementation(async (url: string) => {
      const pathname = new URL(url, 'http://localhost').pathname;
      const filename = path.basename(pathname);
      return jsonResponse(readJson(filename));
    });

    vi.stubGlobal('fetch', fetchMock);
    runtimeLoaderMocks.loadGlbActors.mockClear();
    runtimeLoaderMocks.loadVtiVolume.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads distinct authored view presets from views.json', async () => {
    const bundle = await loadCaseBundle(publicCaseEntry);
    const presetsById = new Map(bundle.views.map((view) => [view.id, view]));
    const sValues = new Set(bundle.views.map((view) => view.probePose.sMm));
    const omniplaneValues = new Set(bundle.views.map((view) => view.probePose.omniplaneDeg));

    expect(bundle.views).toHaveLength(8);
    expect(bundle.labelVolume).toEqual({ url: '/cases/0.1.0/lctsc_s1_006/heart_labels.vti' });
    expect(presetsById.get('me-4c')?.probePose.sMm).toBe(97);
    expect(presetsById.get('me-2c')?.probePose.sMm).toBe(97);
    expect(presetsById.get('me-4c')?.probePose.omniplaneDeg).toBe(0);
    expect(presetsById.get('me-2c')?.probePose.omniplaneDeg).toBe(65);
    expect(sValues.size).toBeGreaterThanOrEqual(4);
    expect(omniplaneValues.size).toBeGreaterThanOrEqual(7);
  });

  it('keeps the authored probe path inside a plausible thoracic envelope', async () => {
    const bundle = await loadCaseBundle(publicCaseEntry);
    const landmarks = readJson<{
      points: {
        id: string;
        structureId?: string;
        position: [number, number, number];
      }[];
    }>('landmarks.json');
    const volumeBounds = readVolumeBounds();
    const esophagusCentroid = landmarks.points.find((point) => point.structureId === 'esophagus');
    const meStation = bundle.probePath.stations?.find((station) => station.id === 'ME');

    if (!esophagusCentroid || !meStation) {
      throw new Error('Public case is missing esophagus centroid or ME station metadata.');
    }

    const points = bundle.probePath.points;
    const minDistanceToEsophagus = Math.min(
      ...points.map((point) => distance3(point.position, esophagusCentroid.position)),
    );
    const mePoints = points.filter(
      (point) =>
        point.arcLengthMm >= meStation.sRange[0] && point.arcLengthMm <= meStation.sRange[1],
    );
    const meanMeDistanceToEsophagus =
      mePoints.reduce((sum, point) => sum + distance3(point.position, esophagusCentroid.position), 0) /
      mePoints.length;

    expect(points).toHaveLength(244);
    expect(points[0].arcLengthMm).toBe(0);
    expect(points.at(-1)?.arcLengthMm).toBeCloseTo(243, 6);
    expect(points.every((point, index) => index === 0 || point.arcLengthMm >= points[index - 1].arcLengthMm)).toBe(true);
    expect(points.every((point) => point.position[0] >= volumeBounds[0] && point.position[0] <= volumeBounds[1])).toBe(true);
    expect(points.every((point) => point.position[1] >= volumeBounds[2] && point.position[1] <= volumeBounds[3])).toBe(true);
    expect(points.every((point) => point.position[2] >= volumeBounds[4])).toBe(true);
    expect(Math.max(...points.map((point) => point.position[2]))).toBeLessThanOrEqual(volumeBounds[5] + 120);
    expect(minDistanceToEsophagus).toBeLessThan(15);
    expect(meanMeDistanceToEsophagus).toBeLessThan(35);
  });
});
