import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CaseIndexEntry, CaseManifest } from './assets';

const assetMocks = vi.hoisted(() => ({
  loadCaseBundle: vi.fn(),
  loadCaseIndex: vi.fn(),
  loadMotionPhaseVolume: vi.fn(),
}));

vi.mock('./assets', () => assetMocks);
vi.mock('./core/view-matcher', () => ({
  matchViews: vi.fn(() => []),
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const deferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
};

const waitForAssertion = async (
  assertion: () => void,
  timeoutMs = 250,
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;

  while (Date.now() <= deadline) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  throw lastError;
};

describe('motion phase store', () => {
  beforeEach(() => {
    vi.resetModules();
    assetMocks.loadCaseBundle.mockReset();
    assetMocks.loadCaseIndex.mockReset();
    assetMocks.loadMotionPhaseVolume.mockReset();
  });

  it('accepts an async-loaded phase when playback has already advanced past it', async () => {
    const phaseLoads = new Map<number, Deferred<object | null>>();
    assetMocks.loadMotionPhaseVolume.mockImplementation(
      async (_currentCase, _manifest, phase: number) => {
        const request = deferred<object | null>();
        phaseLoads.set(phase, request);
        return request.promise as never;
      },
    );

    const { useTeeSimStore } = await import('./store');

    const baselineVolume = { id: 'baseline' } as never;
    const phaseTwoVolume = { id: 'phase-2' } as never;
    const currentCase: CaseIndexEntry = {
      id: 'lctsc_s1_006',
      title: 'LCTSC S1-006',
      description: 'Thorax CT public case',
      bundleVersion: '0.1.0',
      caseVersion: '0.1.0',
    };
    const manifest: CaseManifest = {
      schemaVersion: '1.0.0',
      caseId: currentCase.id,
      caseVersion: currentCase.caseVersion,
      bundleVersion: currentCase.bundleVersion,
      coordinateSystem: 'RAS',
      units: 'mm',
      worldFromImage: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      worldFromMesh: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      generator: {},
      sources: [],
      structures: [],
      assets: {},
      motionPhases: Array.from({ length: 12 }, (_, phase) => ({
        phase,
        path: `phases/phase_${String(phase).padStart(2, '0')}.vti`,
      })),
      metadata: {
        probePath: 'probe_path.json',
        views: 'views.json',
      },
    };

    useTeeSimStore.setState((state) => ({
      scene: {
        ...state.scene,
        currentCase,
        currentCaseId: currentCase.id,
        manifest,
        labelVolume: baselineVolume,
      },
      cardiac: {
        ...state.cardiac,
        cardiacPhase: 0,
        resolvedPhase: 0,
        phaseVolumes: new Map([[0, baselineVolume]]),
      },
    }));

    useTeeSimStore.getState().cardiac.setPhase(2);
    useTeeSimStore.getState().cardiac.setPhase(3);

    const phaseTwoRequest = phaseLoads.get(2);
    if (!phaseTwoRequest) {
      throw new Error('Expected phase 2 to be requested.');
    }

    phaseTwoRequest.resolve(phaseTwoVolume);
    await phaseTwoRequest.promise;

    await waitForAssertion(() => {
      const state = useTeeSimStore.getState();
      expect(state.cardiac.cardiacPhase).toBe(3);
      expect(state.cardiac.resolvedPhase).toBe(2);
      expect(state.cardiac.phaseVolumes.get(2)).toBe(phaseTwoVolume);
    });
  });
});
