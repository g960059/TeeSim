import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { vtkImageData as VtkImageData } from '@kitware/vtk.js/Common/DataModel/ImageData';
import type vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';

import {
  loadCaseBundle,
  loadCaseIndex,
  loadMotionPhaseVolume,
  type CaseIndexEntry,
  type CaseManifest,
} from './assets';
import { clamp } from './core/math';
import { matchViews } from './core/view-matcher';
import type { CenterlinePath, ProbePose, ViewMatch, ViewPreset } from './core/types';

export type LoadPhase = 'idle' | 'loading' | 'ready' | 'error';
export type SelectedPanel = 'left' | 'center' | 'right';

interface ProbeSlice extends ProbePose {
  setProbe: (patch: Partial<ProbePose>) => void;
  snapToView: (preset: ViewPreset) => void;
}

interface SceneSlice {
  caseIndex: CaseIndexEntry[];
  currentCase: CaseIndexEntry | null;
  currentCaseId: string | null;
  manifest: CaseManifest | null;
  meshes: readonly vtkActor[];
  probePath: CenterlinePath | null;
  volume: VtkImageData | null;
  labelVolume: VtkImageData | null;
  views: ViewPreset[];
  loadPhase: LoadPhase;
  structures: string[];
  loadCaseIndex: () => Promise<void>;
  loadCase: (caseId: string) => Promise<void>;
}

interface ViewMatchSlice {
  matches: ViewMatch[];
  bestMatch: ViewMatch | null;
}

interface UiSlice {
  depthMm: number;
  labelsVisible: boolean;
  selectedPanel: SelectedPanel;
  setDepthMm: (depthMm: number) => void;
  setSelectedPanel: (panel: SelectedPanel) => void;
  toggleLabelsVisible: () => void;
}

interface CardiacSlice {
  cardiacPhase: number;
  resolvedPhase: number;
  isPlaying: boolean;
  cycleMs: number;
  phaseVolumes: Map<number, VtkImageData>;
  play: () => void;
  pause: () => void;
  setPhase: (phase: number) => void;
}

export interface TeeSimStoreState {
  probe: ProbeSlice;
  scene: SceneSlice;
  viewMatch: ViewMatchSlice;
  ui: UiSlice;
  cardiac: CardiacSlice;
}

const pendingValidation = {
  approvedBy: null,
  approvedAt: null,
  status: 'pending' as const,
};

export const VIEW_PRESETS: ViewPreset[] = [
  {
    id: 'me-4c',
    label: 'ME 4C',
    aseCode: 'ME Four-Chamber',
    station: 'ME',
    probePose: { sMm: 118, rollDeg: 0, anteDeg: -8, lateralDeg: 0, omniplaneDeg: 0 },
    validation: pendingValidation,
    ranges: { sMm: 100, rollDeg: 140, anteDeg: 80, lateralDeg: 60, omniplaneDeg: 120 },
  },
  {
    id: 'me-2c',
    label: 'ME 2C',
    aseCode: 'ME Two-Chamber',
    station: 'ME',
    probePose: { sMm: 120, rollDeg: 0, anteDeg: -6, lateralDeg: 0, omniplaneDeg: 65 },
    validation: pendingValidation,
    ranges: { sMm: 100, rollDeg: 140, anteDeg: 80, lateralDeg: 60, omniplaneDeg: 120 },
  },
  {
    id: 'me-lax',
    label: 'ME LAX',
    aseCode: 'ME Long-Axis',
    station: 'ME',
    probePose: { sMm: 122, rollDeg: 2, anteDeg: -4, lateralDeg: 0, omniplaneDeg: 132 },
    validation: pendingValidation,
    ranges: { sMm: 100, rollDeg: 140, anteDeg: 80, lateralDeg: 60, omniplaneDeg: 120 },
  },
  {
    id: 'tg-sax',
    label: 'TG SAX',
    aseCode: 'TG Mid Short-Axis',
    station: 'TG',
    probePose: { sMm: 214, rollDeg: 0, anteDeg: 34, lateralDeg: 0, omniplaneDeg: 12 },
    validation: pendingValidation,
    ranges: { sMm: 110, rollDeg: 140, anteDeg: 90, lateralDeg: 60, omniplaneDeg: 120 },
  },
  {
    id: 'me-av-sax',
    label: 'ME AV SAX',
    aseCode: 'ME AV Short-Axis',
    station: 'ME',
    probePose: { sMm: 110, rollDeg: 4, anteDeg: -2, lateralDeg: 0, omniplaneDeg: 38 },
    validation: pendingValidation,
    ranges: { sMm: 100, rollDeg: 140, anteDeg: 80, lateralDeg: 60, omniplaneDeg: 120 },
  },
  {
    id: 'me-av-lax',
    label: 'ME AV LAX',
    aseCode: 'ME AV Long-Axis',
    station: 'ME',
    probePose: { sMm: 112, rollDeg: 4, anteDeg: -2, lateralDeg: 0, omniplaneDeg: 126 },
    validation: pendingValidation,
    ranges: { sMm: 100, rollDeg: 140, anteDeg: 80, lateralDeg: 60, omniplaneDeg: 120 },
  },
  {
    id: 'me-rv-io',
    label: 'ME RV I-O',
    aseCode: 'ME RV Inflow-Outflow',
    station: 'ME',
    probePose: { sMm: 128, rollDeg: 18, anteDeg: 10, lateralDeg: 20, omniplaneDeg: 58 },
    validation: pendingValidation,
    ranges: { sMm: 100, rollDeg: 150, anteDeg: 90, lateralDeg: 70, omniplaneDeg: 120 },
  },
  {
    id: 'me-bicaval',
    label: 'ME Bicaval',
    aseCode: 'ME Bicaval',
    station: 'ME',
    probePose: { sMm: 126, rollDeg: 74, anteDeg: -4, lateralDeg: 12, omniplaneDeg: 96 },
    validation: pendingValidation,
    ranges: { sMm: 100, rollDeg: 150, anteDeg: 90, lateralDeg: 70, omniplaneDeg: 120 },
  },
];

export const PROBE_LIMITS = {
  sMm: { min: 0, max: 320, step: 1, keyboardStep: 5 },
  rollDeg: { min: -180, max: 180, step: 1, keyboardStep: 5 },
  anteDeg: { min: -90, max: 90, step: 1, keyboardStep: 5 },
  lateralDeg: { min: -90, max: 90, step: 1, keyboardStep: 5 },
  omniplaneDeg: { min: 0, max: 180, step: 1, keyboardStep: 5 },
} as const;

export const PSEUDO_TEE_LIMITS = {
  depthMm: { min: 40, max: 200, step: 10 },
} as const;

const DEFAULT_PROBE_POSE: ProbePose = {
  sMm: 92,
  rollDeg: 0,
  anteDeg: 0,
  lateralDeg: 0,
  omniplaneDeg: 25,
};
const DEFAULT_DEPTH_MM = 140;
const CARDIAC_PHASE_COUNT = 12;
const DEFAULT_CYCLE_MS = 1000;
const MAX_PHASE_CACHE = 3;

let caseLoadRequestToken = 0;
let cardiacAnimationFrameId: number | null = null;
let cardiacAnimationStartMs = 0;
let cardiacAnimationStep = 0;
const pendingMotionPhaseLoads = new Map<string, Promise<VtkImageData | null>>();

export const selectProbePose = (state: Pick<TeeSimStoreState, 'probe'>): ProbePose => ({
  sMm: state.probe.sMm,
  rollDeg: state.probe.rollDeg,
  anteDeg: state.probe.anteDeg,
  lateralDeg: state.probe.lateralDeg,
  omniplaneDeg: state.probe.omniplaneDeg,
});

const normalizeCardiacPhase = (phase: number): number => {
  const wrapped = Math.round(phase) % CARDIAC_PHASE_COUNT;
  return wrapped < 0 ? wrapped + CARDIAC_PHASE_COUNT : wrapped;
};

const getCardiacPhaseDistance = (a: number, b: number): number => {
  const normalizedA = normalizeCardiacPhase(a);
  const normalizedB = normalizeCardiacPhase(b);
  const absoluteDistance = Math.abs(normalizedA - normalizedB);
  return Math.min(absoluteDistance, CARDIAC_PHASE_COUNT - absoluteDistance);
};

const resolveNearestLoadedPhase = (
  currentPhase: number,
  phaseVolumes: ReadonlyMap<number, VtkImageData>,
  preferredPhase: number | null,
): number | null => {
  const normalizedCurrentPhase = normalizeCardiacPhase(currentPhase);
  const normalizedPreferredPhase =
    preferredPhase === null ? null : normalizeCardiacPhase(preferredPhase);
  let bestPhase: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const availablePhase of phaseVolumes.keys()) {
    const candidatePhase = normalizeCardiacPhase(availablePhase);
    const candidateDistance = getCardiacPhaseDistance(normalizedCurrentPhase, candidatePhase);
    if (candidateDistance < bestDistance) {
      bestPhase = candidatePhase;
      bestDistance = candidateDistance;
      continue;
    }

    if (candidateDistance > bestDistance || bestPhase === null) {
      continue;
    }

    const candidateMatchesCurrent = candidatePhase === normalizedCurrentPhase;
    const bestMatchesCurrent = bestPhase === normalizedCurrentPhase;
    if (candidateMatchesCurrent !== bestMatchesCurrent) {
      if (candidateMatchesCurrent) {
        bestPhase = candidatePhase;
      }
      continue;
    }

    if (normalizedPreferredPhase !== null) {
      const candidateMatchesPreferred = candidatePhase === normalizedPreferredPhase;
      const bestMatchesPreferred = bestPhase === normalizedPreferredPhase;
      if (candidateMatchesPreferred !== bestMatchesPreferred) {
        if (candidateMatchesPreferred) {
          bestPhase = candidatePhase;
        }
        continue;
      }
    }

    if (candidatePhase < bestPhase) {
      bestPhase = candidatePhase;
    }
  }

  return bestPhase;
};

const getAdjacentCardiacPhases = (phase: number): readonly [number, number, number] => {
  const current = normalizeCardiacPhase(phase);
  return [
    normalizeCardiacPhase(current - 1),
    current,
    normalizeCardiacPhase(current + 1),
  ] as const;
};

const prunePhaseCache = (
  cache: ReadonlyMap<number, VtkImageData>,
  phase: number,
): Map<number, VtkImageData> => {
  const allowed = new Set(getAdjacentCardiacPhases(phase));
  const next = new Map<number, VtkImageData>();

  for (const [cachedPhase, volume] of cache.entries()) {
    if (allowed.has(cachedPhase)) {
      next.set(cachedPhase, volume);
    }
  }

  if (next.size <= MAX_PHASE_CACHE) {
    return next;
  }

  const phases = getAdjacentCardiacPhases(phase);
  return new Map(
    phases
      .filter((adjacentPhase) => next.has(adjacentPhase))
      .map((adjacentPhase) => [adjacentPhase, next.get(adjacentPhase)!]),
  );
};

const getMotionPhaseLoadKey = (caseId: string, phase: number): string =>
  `${caseId}:${normalizeCardiacPhase(phase)}`;

const stopCardiacAnimation = (): void => {
  if (typeof window === 'undefined') {
    cardiacAnimationFrameId = null;
    return;
  }

  if (cardiacAnimationFrameId !== null) {
    window.cancelAnimationFrame(cardiacAnimationFrameId);
    cardiacAnimationFrameId = null;
  }
};

const clampProbePose = (pose: ProbePose): ProbePose => ({
  sMm: clamp(pose.sMm, PROBE_LIMITS.sMm.min, PROBE_LIMITS.sMm.max),
  rollDeg: clamp(pose.rollDeg, PROBE_LIMITS.rollDeg.min, PROBE_LIMITS.rollDeg.max),
  anteDeg: clamp(pose.anteDeg, PROBE_LIMITS.anteDeg.min, PROBE_LIMITS.anteDeg.max),
  lateralDeg: clamp(pose.lateralDeg, PROBE_LIMITS.lateralDeg.min, PROBE_LIMITS.lateralDeg.max),
  omniplaneDeg: clamp(pose.omniplaneDeg, PROBE_LIMITS.omniplaneDeg.min, PROBE_LIMITS.omniplaneDeg.max),
});

const getActiveViewPresets = (state: Pick<TeeSimStoreState, 'scene'>): ViewPreset[] =>
  state.scene.views.length > 0 ? state.scene.views : VIEW_PRESETS;

const deriveViewMatch = (pose: ProbePose, presets: ViewPreset[]): ViewMatchSlice => {
  const matches = matchViews(pose, presets);

  return {
    matches,
    bestMatch: matches[0] ?? null,
  };
};

export const getStationLabel = (sMm: number): string => {
  if (sMm < 80) {
    return 'UE';
  }

  if (sMm < 180) {
    return 'ME';
  }

  if (sMm < 260) {
    return 'TG';
  }

  return 'DTG';
};

const initialViewMatch = deriveViewMatch(DEFAULT_PROBE_POSE, VIEW_PRESETS);

export const useTeeSimStore = create<TeeSimStoreState>()(
  subscribeWithSelector((set, get) => {
    const ensureMotionPhaseLoaded = async (phase: number): Promise<VtkImageData | null> => {
      const normalizedPhase = normalizeCardiacPhase(phase);
      const state = get();
      const currentCase = state.scene.currentCase;
      const manifest = state.scene.manifest;

      if (normalizedPhase === 0 && state.scene.labelVolume) {
        set((innerState) => ({
          cardiac: (() => {
            const phaseVolumes = prunePhaseCache(
              new Map(innerState.cardiac.phaseVolumes).set(0, state.scene.labelVolume!),
              innerState.cardiac.cardiacPhase,
            );
            const resolvedPhase =
              resolveNearestLoadedPhase(
                innerState.cardiac.cardiacPhase,
                phaseVolumes,
                innerState.cardiac.resolvedPhase,
              ) ?? innerState.cardiac.resolvedPhase;

            return {
              ...innerState.cardiac,
              phaseVolumes,
              resolvedPhase,
            };
          })(),
        }));
        return state.scene.labelVolume;
      }

      if (!currentCase || !manifest?.motionPhases?.length) {
        return null;
      }

      const cached = state.cardiac.phaseVolumes.get(normalizedPhase);
      if (cached) {
        return cached;
      }

      const caseId = currentCase.id;
      const loadKey = getMotionPhaseLoadKey(caseId, normalizedPhase);
      let pendingLoad = pendingMotionPhaseLoads.get(loadKey);
      if (!pendingLoad) {
        pendingLoad = loadMotionPhaseVolume(currentCase, manifest, normalizedPhase).finally(() => {
          pendingMotionPhaseLoads.delete(loadKey);
        });
        pendingMotionPhaseLoads.set(loadKey, pendingLoad);
      }

      const volume = await pendingLoad;
      if (!volume) {
        return null;
      }

      set((innerState) => {
        if (innerState.scene.currentCaseId !== caseId) {
          return innerState;
        }

        const nextPhaseVolumes = new Map(innerState.cardiac.phaseVolumes);
        nextPhaseVolumes.set(normalizedPhase, volume);
        const phaseVolumes = prunePhaseCache(
          nextPhaseVolumes,
          innerState.cardiac.cardiacPhase,
        );
        const resolvedPhase =
          resolveNearestLoadedPhase(
            innerState.cardiac.cardiacPhase,
            phaseVolumes,
            innerState.cardiac.resolvedPhase,
          ) ?? innerState.cardiac.resolvedPhase;

        return {
          cardiac: {
            ...innerState.cardiac,
            phaseVolumes,
            resolvedPhase,
          },
        };
      });

      return volume;
    };

    const queueMotionPrefetch = (phase: number): void => {
      void ensureMotionPhaseLoaded(phase).catch(() => undefined);
    };

    const startCardiacAnimation = (): void => {
      if (typeof window === 'undefined' || cardiacAnimationFrameId !== null) {
        return;
      }

      const initialState = get();
      const phaseDuration = initialState.cardiac.cycleMs / CARDIAC_PHASE_COUNT;
      if (phaseDuration <= 0) {
        return;
      }

      cardiacAnimationStep = normalizeCardiacPhase(initialState.cardiac.cardiacPhase);
      cardiacAnimationStartMs = window.performance.now() - cardiacAnimationStep * phaseDuration;

      const tick = (now: number): void => {
        const state = get();
        if (!state.cardiac.isPlaying) {
          stopCardiacAnimation();
          return;
        }

        const nextPhaseDuration = state.cardiac.cycleMs / CARDIAC_PHASE_COUNT;
        if (nextPhaseDuration <= 0) {
          stopCardiacAnimation();
          return;
        }

        const elapsedSteps = Math.floor((now - cardiacAnimationStartMs) / nextPhaseDuration);
        if (elapsedSteps !== cardiacAnimationStep) {
          cardiacAnimationStep = elapsedSteps;
          state.cardiac.setPhase(elapsedSteps);
        }

        cardiacAnimationFrameId = window.requestAnimationFrame(tick);
      };

      cardiacAnimationFrameId = window.requestAnimationFrame(tick);
    };

    return {
      probe: {
        ...DEFAULT_PROBE_POSE,
        setProbe: (patch) =>
          set((state) => {
            const nextPose = clampProbePose({
              ...selectProbePose(state),
              ...patch,
            });

            return {
              probe: {
                ...state.probe,
                ...nextPose,
              },
              viewMatch: deriveViewMatch(nextPose, getActiveViewPresets(state)),
            };
          }),
        snapToView: (preset) =>
          set((state) => {
            const nextPose = clampProbePose(preset.probePose);

            return {
              probe: {
                ...state.probe,
                ...nextPose,
              },
              viewMatch: deriveViewMatch(nextPose, getActiveViewPresets(state)),
            };
          }),
      },
      scene: {
        caseIndex: [],
        currentCase: null,
        currentCaseId: null,
        manifest: null,
        meshes: [],
        probePath: null,
        volume: null,
        labelVolume: null,
        views: VIEW_PRESETS,
        loadPhase: 'idle',
        structures: [],
        loadCaseIndex: async () => {
          if (get().scene.caseIndex.length > 0) {
            return;
          }

          const caseIndex = await loadCaseIndex();
          set((state) => ({
            scene: {
              ...state.scene,
              caseIndex,
            },
          }));
        },
        loadCase: async (caseId) => {
          const requestToken = ++caseLoadRequestToken;
          stopCardiacAnimation();

          set((state) => ({
            scene: {
              ...state.scene,
              currentCaseId: caseId,
              loadPhase: 'loading',
            },
            cardiac: {
              ...state.cardiac,
              cardiacPhase: 0,
              resolvedPhase: 0,
              isPlaying: false,
              phaseVolumes: new Map(),
            },
          }));

          let caseIndex = get().scene.caseIndex;
          if (caseIndex.length === 0) {
            caseIndex = await loadCaseIndex();
            if (requestToken !== caseLoadRequestToken) {
              return;
            }

            set((state) => ({
              scene: {
                ...state.scene,
                caseIndex,
              },
            }));
          }

          const currentCase = caseIndex.find((entry) => entry.id === caseId) ?? null;
          if (!currentCase) {
            set((state) => ({
              scene: {
                ...state.scene,
                currentCase: null,
                currentCaseId: null,
                manifest: null,
                meshes: [],
                probePath: null,
                volume: null,
                labelVolume: null,
                views: VIEW_PRESETS,
                loadPhase: 'error',
                structures: [],
              },
              cardiac: {
                ...state.cardiac,
                cardiacPhase: 0,
                resolvedPhase: 0,
                isPlaying: false,
                phaseVolumes: new Map(),
              },
              viewMatch: deriveViewMatch(selectProbePose(state), VIEW_PRESETS),
            }));
            return;
          }

          try {
            const bundle = await loadCaseBundle(currentCase);
            if (requestToken !== caseLoadRequestToken) {
              return;
            }

            const nextProbePose = selectProbePose(get());
            const phaseVolumes = bundle.labelVolume
              ? new Map<number, VtkImageData>([[0, bundle.labelVolume]])
              : new Map<number, VtkImageData>();

            set((state) => ({
              scene: {
                ...state.scene,
                caseIndex,
                currentCase,
                currentCaseId: currentCase.id,
                manifest: bundle.manifest,
                meshes: bundle.meshes,
                probePath: bundle.probePath,
                volume: bundle.volume,
                labelVolume: bundle.labelVolume,
                views: bundle.views,
                loadPhase: 'ready',
                structures: bundle.manifest.structures,
              },
              cardiac: {
                ...state.cardiac,
                cardiacPhase: 0,
                resolvedPhase: 0,
                isPlaying: false,
                phaseVolumes,
              },
              viewMatch: deriveViewMatch(nextProbePose, bundle.views),
            }));

            if (bundle.manifest.motionPhases?.length) {
              queueMotionPrefetch(1);
            }
          } catch {
            if (requestToken !== caseLoadRequestToken) {
              return;
            }

            set((state) => ({
              scene: {
                ...state.scene,
                currentCase: null,
                currentCaseId: null,
                manifest: null,
                meshes: [],
                probePath: null,
                volume: null,
                labelVolume: null,
                views: VIEW_PRESETS,
                loadPhase: 'error',
                structures: [],
              },
              cardiac: {
                ...state.cardiac,
                cardiacPhase: 0,
                resolvedPhase: 0,
                isPlaying: false,
                phaseVolumes: new Map(),
              },
              viewMatch: deriveViewMatch(selectProbePose(state), VIEW_PRESETS),
            }));
          }
        },
      },
      viewMatch: initialViewMatch,
      ui: {
        depthMm: DEFAULT_DEPTH_MM,
        labelsVisible: true,
        selectedPanel: 'center',
        setDepthMm: (depthMm) =>
          set((state) => ({
            ui: {
              ...state.ui,
              depthMm: clamp(depthMm, PSEUDO_TEE_LIMITS.depthMm.min, PSEUDO_TEE_LIMITS.depthMm.max),
            },
          })),
        setSelectedPanel: (panel) =>
          set((state) => ({
            ui: {
              ...state.ui,
              selectedPanel: panel,
            },
          })),
        toggleLabelsVisible: () =>
          set((state) => ({
            ui: {
              ...state.ui,
              labelsVisible: !state.ui.labelsVisible,
            },
          })),
      },
      cardiac: {
        cardiacPhase: 0,
        resolvedPhase: 0,
        isPlaying: false,
        cycleMs: DEFAULT_CYCLE_MS,
        phaseVolumes: new Map(),
        play: () => {
          const state = get();
          if (!state.scene.manifest?.motionPhases?.length || !state.scene.labelVolume) {
            return;
          }

          queueMotionPrefetch(state.cardiac.cardiacPhase);
          queueMotionPrefetch(state.cardiac.cardiacPhase + 1);

          set((innerState) => ({
            cardiac: {
              ...innerState.cardiac,
              isPlaying: true,
            },
          }));
          startCardiacAnimation();
        },
        pause: () => {
          stopCardiacAnimation();
          set((state) => ({
            cardiac: {
              ...state.cardiac,
              isPlaying: false,
            },
          }));
        },
        setPhase: (phase) => {
          const nextPhase = normalizeCardiacPhase(phase);

          set((state) => {
            const nextPhaseVolumes = new Map(state.cardiac.phaseVolumes);
            if (nextPhase === 0 && state.scene.labelVolume) {
              nextPhaseVolumes.set(0, state.scene.labelVolume);
            }

            const phaseVolumes = prunePhaseCache(nextPhaseVolumes, nextPhase);
            const resolvedPhase =
              resolveNearestLoadedPhase(nextPhase, phaseVolumes, state.cardiac.resolvedPhase) ??
              state.cardiac.resolvedPhase;

            return {
              cardiac: {
                ...state.cardiac,
                cardiacPhase: nextPhase,
                resolvedPhase,
                phaseVolumes,
              },
            };
          });

          queueMotionPrefetch(nextPhase);
          queueMotionPrefetch(nextPhase + 1);
        },
      },
    };
  }),
);
