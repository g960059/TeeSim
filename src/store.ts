import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { vtkImageData as VtkImageData } from '@kitware/vtk.js/Common/DataModel/ImageData';
import type vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';

import { loadCaseBundle, loadCaseIndex, type CaseIndexEntry, type CaseManifest } from './assets';
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
  labelsVisible: boolean;
  selectedPanel: SelectedPanel;
  setSelectedPanel: (panel: SelectedPanel) => void;
  toggleLabelsVisible: () => void;
}

export interface TeeSimStoreState {
  probe: ProbeSlice;
  scene: SceneSlice;
  viewMatch: ViewMatchSlice;
  ui: UiSlice;
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

const DEFAULT_PROBE_POSE: ProbePose = {
  sMm: 92,
  rollDeg: 0,
  anteDeg: 0,
  lateralDeg: 0,
  omniplaneDeg: 25,
};

let caseLoadRequestToken = 0;

export const selectProbePose = (state: Pick<TeeSimStoreState, 'probe'>): ProbePose => ({
  sMm: state.probe.sMm,
  rollDeg: state.probe.rollDeg,
  anteDeg: state.probe.anteDeg,
  lateralDeg: state.probe.lateralDeg,
  omniplaneDeg: state.probe.omniplaneDeg,
});

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
  subscribeWithSelector((set, get) => ({
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

        set((state) => ({
          scene: {
            ...state.scene,
            currentCaseId: caseId,
            loadPhase: 'loading',
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
              views: VIEW_PRESETS,
              loadPhase: 'error',
              structures: [],
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
              views: bundle.views,
              loadPhase: 'ready',
              structures: bundle.manifest.structures,
            },
            viewMatch: deriveViewMatch(nextProbePose, bundle.views),
          }));
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
              views: VIEW_PRESETS,
              loadPhase: 'error',
              structures: [],
            },
            viewMatch: deriveViewMatch(selectProbePose(state), VIEW_PRESETS),
          }));
        }
      },
    },
    viewMatch: initialViewMatch,
    ui: {
      labelsVisible: true,
      selectedPanel: 'center',
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
  })),
);
