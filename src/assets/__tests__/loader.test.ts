import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeLoaderMocks = vi.hoisted(() => ({
  loadGlbActors: vi.fn(async (url: string) => [{ url }] as never),
  loadVtiVolume: vi.fn(async (url: string) => ({ url }) as never),
}));

vi.mock('../runtime-loaders', () => runtimeLoaderMocks);

import { loadCaseBundle, loadCaseIndex } from '../loader';

const jsonResponse = (body: unknown): Response =>
  ({
    ok: true,
    json: async () => body,
  }) as Response;

describe('asset loader', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    runtimeLoaderMocks.loadGlbActors.mockClear();
    runtimeLoaderMocks.loadVtiVolume.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes legacy case-index entries into runtime case records', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        cases: [
          {
            caseId: 'lctsc_s1_006',
            title: 'LCTSC S1-006',
            description: 'Thorax CT public case',
          },
        ],
      }),
    );

    await expect(loadCaseIndex()).resolves.toEqual([
      {
        id: 'lctsc_s1_006',
        title: 'LCTSC S1-006',
        description: 'Thorax CT public case',
        bundleVersion: '0.1.0',
        caseVersion: '0.1.0',
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith('/cases/index.json');
  });

  it('loads the real public bundle assets and normalizes authored schemas', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      switch (url) {
        case '/cases/0.1.0/lctsc_s1_006/case_manifest.json':
          return jsonResponse({
            schemaVersion: '1.0.0',
            caseId: 'lctsc_s1_006',
            bundleVersion: '0.1.0',
            caseVersion: '0.1.0',
            assets: {
              sceneGlb: { path: 'scene.glb' },
              heartDetailGlb: { path: 'heart_detail.glb' },
              heartRoiVti: { path: 'heart_roi.vti' },
            },
            metadata: {
              probePath: 'probe_path.json',
              views: 'views.json',
              landmarks: 'landmarks.json',
            },
          });
        case '/cases/0.1.0/lctsc_s1_006/probe_path.json':
          return jsonResponse({
            schemaVersion: '1.0.0',
            coordinateSystem: 'RAS',
            units: 'mm',
            sampleSpacingMm: 1,
            points: [
              [1, 2, 3],
              [4, 5, 6],
            ],
            arcLengthMm: [0, 5],
            frames: [
              { tangent: [0, 0, 1], normal: [1, 0, 0], binormal: [0, 1, 0] },
              { tangent: [0, 1, 0], normal: [1, 0, 0], binormal: [0, 0, 1] },
            ],
            stations: [{ id: 'ME', sRangeMm: [0, 5] }],
          });
        case '/cases/0.1.0/lctsc_s1_006/views.json':
          return jsonResponse([
            {
              id: 'me-4c',
              label: 'ME Four-Chamber',
              station: 'ME',
              probePose: {
                sMm: 97,
                rollDeg: 0,
                anteDeg: -5,
                lateralDeg: 0,
                omniplaneDeg: 0,
              },
              tolerance: {
                sMm: 15,
                angleDeg: 12,
              },
              targetStructures: ['heart', 'esophagus'],
            },
          ]);
        case '/cases/0.1.0/lctsc_s1_006/landmarks.json':
          return jsonResponse({
            points: [
              { id: 'heart', structureId: 'heart', position: [0, 0, 0] },
              { id: 'lung', structureId: 'lung_r', position: [1, 1, 1] },
            ],
          });
        default:
          throw new Error(`Unexpected fetch URL: ${url}`);
      }
    });

    const bundle = await loadCaseBundle({
      id: 'lctsc_s1_006',
      title: 'LCTSC S1-006',
      description: 'Thorax CT public case',
      bundleVersion: '0.1.0',
      caseVersion: '0.1.0',
    });

    expect(runtimeLoaderMocks.loadGlbActors).toHaveBeenCalledTimes(2);
    expect(runtimeLoaderMocks.loadGlbActors).toHaveBeenNthCalledWith(
      1,
      '/cases/0.1.0/lctsc_s1_006/scene.glb',
    );
    expect(runtimeLoaderMocks.loadGlbActors).toHaveBeenNthCalledWith(
      2,
      '/cases/0.1.0/lctsc_s1_006/heart_detail.glb',
    );
    expect(runtimeLoaderMocks.loadVtiVolume).toHaveBeenCalledWith(
      '/cases/0.1.0/lctsc_s1_006/heart_roi.vti',
    );

    expect(bundle.meshes).toHaveLength(2);
    expect(bundle.volume).toEqual({ url: '/cases/0.1.0/lctsc_s1_006/heart_roi.vti' });
    expect(bundle.manifest.structures).toEqual(['heart', 'esophagus', 'lung_r']);
    expect(bundle.probePath.points[0]).toEqual({
      position: [1, 2, 3],
      arcLengthMm: 0,
      tangent: [0, 0, 1],
      normal: [1, 0, 0],
      binormal: [0, 1, 0],
    });
    expect(bundle.probePath.stations).toEqual([{ id: 'ME', sRange: [0, 5] }]);
    expect(bundle.views[0].ranges).toEqual({
      sMm: 15,
      rollDeg: 12,
      anteDeg: 12,
      lateralDeg: 12,
      omniplaneDeg: 12,
    });
    expect(bundle.views[0].validation.status).toBe('pending');
  });
});
