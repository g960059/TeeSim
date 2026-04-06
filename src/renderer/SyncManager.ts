import { useEffect, useRef } from 'react';
import { computeImagingPlane, getFullTransform } from '../core';
import type { ProbePose } from '../core';
import type {
  RendererPaneHandle,
  RendererUpdate,
  SyncManagerOptions,
} from './types';

const probePoseEqual = (
  a: ProbePose,
  b: ProbePose,
): boolean =>
  a.sMm === b.sMm &&
  a.rollDeg === b.rollDeg &&
  a.anteDeg === b.anteDeg &&
  a.lateralDeg === b.lateralDeg &&
  a.omniplaneDeg === b.omniplaneDeg;

const applyUpdateToPanes = (
  panes: readonly RendererPaneHandle[],
  update: RendererUpdate,
): void => {
  panes.forEach((pane) => {
    if ('setProbeTransform' in pane) {
      pane.setProbeTransform(update.probeTransform);
    }
    pane.setImagingPlane(update.imagingPlane);
  });

  panes.forEach((pane) => {
    pane.render();
  });
};

export const useSyncManager = <TState>({
  paneRefs,
  path,
  probeModelOptions,
  selectProbePose,
  store,
}: SyncManagerOptions<TState>): void => {
  const paneRefsRef = useRef(paneRefs);

  useEffect(() => {
    paneRefsRef.current = paneRefs;
  }, [paneRefs]);

  useEffect(() => {
    if (!path) {
      return;
    }

    let frameId: number | null = null;
    let pendingUpdate: RendererUpdate | null = null;

    const queueUpdate = (state: TState): void => {
      const probePose = selectProbePose(state);
      pendingUpdate = {
        imagingPlane: computeImagingPlane(path, probePose, probeModelOptions),
        probePose,
        probeTransform: getFullTransform(path, probePose, probeModelOptions),
      };

      if (frameId !== null) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        if (!pendingUpdate) {
          return;
        }

        const panes = paneRefsRef.current
          .map((paneRef) => paneRef.current)
          .filter((pane): pane is RendererPaneHandle => pane !== null);

        applyUpdateToPanes(panes, pendingUpdate);
        pendingUpdate = null;
      });
    };

    queueUpdate(store.getState());

    const unsubscribe = store.subscribe(
      selectProbePose,
      (_nextProbePose, _previousProbePose) => {
        queueUpdate(store.getState());
      },
      { equalityFn: probePoseEqual },
    );

    return () => {
      unsubscribe();
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [path, probeModelOptions, selectProbePose, store]);
};
