import { useEffect, useMemo, useRef, type ReactNode } from 'react';

import { getSyntheticShellVolume } from './assets';
import {
  ObliqueSlicePane,
  PseudoTeePane,
  Scene3DPane,
  useSyncManager,
  type ObliqueSlicePaneHandle,
  type PseudoTeePaneHandle,
  type Scene3DPaneHandle,
} from './renderer';
import { CaseSelector } from './ui/CaseSelector';
import { ProbeHUD } from './ui/ProbeHUD';
import { ThreePaneLayout } from './ui/ThreePaneLayout';
import { ViewMatchIndicator } from './ui/ViewMatchIndicator';
import { ViewPicker } from './ui/ViewPicker';
import { useElementSize } from './ui/hooks/useElementSize';
import { useKeyboardShortcuts } from './ui/hooks/useKeyboardShortcuts';
import { selectProbePose, useTeeSimStore } from './store';
import './styles/app.css';

const PlaceholderStatus = ({ text }: { text: string }) => <p className="placeholder-status">{text}</p>;

interface MeasuredRendererSurfaceProps {
  children: (size: { height: number; width: number }) => ReactNode;
  className: string;
}

function MeasuredRendererSurface({ children, className }: MeasuredRendererSurfaceProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const { height, width } = useElementSize(viewportRef);

  return (
    <div className={className}>
      <div className="render-viewport" ref={viewportRef}>
        {width > 0 && height > 0 ? (
          children({ height, width })
        ) : (
          <PlaceholderStatus text="Preparing viewport..." />
        )}
      </div>
    </div>
  );
}

export default function App() {
  useKeyboardShortcuts();

  const caseIndex = useTeeSimStore((state) => state.scene.caseIndex);
  const currentCase = useTeeSimStore((state) => state.scene.currentCase);
  const currentCaseId = useTeeSimStore((state) => state.scene.currentCaseId);
  const manifest = useTeeSimStore((state) => state.scene.manifest);
  const probePath = useTeeSimStore((state) => state.scene.probePath);
  const loadPhase = useTeeSimStore((state) => state.scene.loadPhase);
  const structures = useTeeSimStore((state) => state.scene.structures);
  const loadCaseIndex = useTeeSimStore((state) => state.scene.loadCaseIndex);
  const loadCase = useTeeSimStore((state) => state.scene.loadCase);
  const labelsVisible = useTeeSimStore((state) => state.ui.labelsVisible);
  const toggleLabelsVisible = useTeeSimStore((state) => state.ui.toggleLabelsVisible);
  const selectedPanel = useTeeSimStore((state) => state.ui.selectedPanel);
  const setSelectedPanel = useTeeSimStore((state) => state.ui.setSelectedPanel);

  const pseudoTeePaneRef = useRef<PseudoTeePaneHandle | null>(null);
  const scenePaneRef = useRef<Scene3DPaneHandle | null>(null);
  const obliquePaneRef = useRef<ObliqueSlicePaneHandle | null>(null);
  const paneRefs = useMemo(
    () => [scenePaneRef, pseudoTeePaneRef, obliquePaneRef] as const,
    [],
  );

  useEffect(() => {
    if (caseIndex.length === 0) {
      void loadCaseIndex();
    }
  }, [caseIndex.length, loadCaseIndex]);

  useEffect(() => {
    if (!currentCaseId && caseIndex[0]) {
      void loadCase(caseIndex[0].id);
    }
  }, [caseIndex, currentCaseId, loadCase]);

  useSyncManager({
    paneRefs,
    path: probePath,
    selectProbePose,
    store: useTeeSimStore,
  });

  const shellVolume = useMemo(
    () => (manifest ? getSyntheticShellVolume(manifest.caseId) : null),
    [manifest],
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-heading">
          <p className="eyebrow">Browser-based 3D TEE simulator</p>
          <h1>TeeSim MVP shell</h1>
          <p className="app-summary">
            Probe controls, nearest-preset guidance, and a renderer-ready three-pane shell wired to the
            existing core probe model.
          </p>
        </div>

        <div className="app-toolbar">
          <CaseSelector />
          <button className="secondary-button" type="button" onClick={toggleLabelsVisible}>
            {labelsVisible ? 'Hide labels' : 'Show labels'}
          </button>
        </div>
      </header>

      <section className="status-strip" aria-label="Simulator status">
        <span className="status-pill">Case {currentCase?.title ?? 'not loaded'}</span>
        <span className="status-pill">Bundle {manifest?.bundleVersion ?? currentCase?.bundleVersion ?? 'n/a'}</span>
        <span className="status-pill">Probe constrained to esophageal centerline</span>
        <span className="status-pill">CT-derived anatomical slice, not ultrasound</span>
        {shellVolume ? (
          <span className="status-pill">Synthetic shell volume until public `heart_roi.vti` ships</span>
        ) : null}
        {loadPhase === 'loading' ? (
          <span className="status-pill loading-pill" data-testid="loading-indicator">
            Loading case...
          </span>
        ) : null}
      </section>

      <ThreePaneLayout
        selectedPanel={selectedPanel}
        onSelectPanel={setSelectedPanel}
        leftPane={
          <div className="pane-stack">
            <div className="pane-header">
              <p className="pane-kicker">Pseudo-TEE</p>
              <h2 className="pane-title">CT-derived anatomical slice</h2>
            </div>

            <MeasuredRendererSurface className="render-surface render-surface-left">
              {({ height, width }) => (
                <PseudoTeePane
                  appearance={{ slabThicknessMm: 4 }}
                  height={height}
                  ref={pseudoTeePaneRef}
                  volume={shellVolume}
                  width={width}
                />
              )}
            </MeasuredRendererSurface>

            {labelsVisible ? (
              <p className="pane-note">
                Wave 2 wiring is live. The renderer is currently fed by a synthetic teaching volume until
                the public case bundle ships a real `heart_roi.vti`.
              </p>
            ) : null}
          </div>
        }
        centerPane={
          <div className="pane-stack">
            <div className="pane-header pane-header-inline">
              <div>
                <p className="pane-kicker">3D anatomy</p>
                <h2 className="pane-title">Probe + sector scene</h2>
              </div>
              <ViewMatchIndicator />
            </div>

            <MeasuredRendererSurface className="render-surface render-surface-center">
              {({ height, width }) => (
                <Scene3DPane
                  height={height}
                  ref={scenePaneRef}
                  width={width}
                />
              )}
            </MeasuredRendererSurface>
          </div>
        }
        rightPane={
          <div className="pane-stack">
            <div className="pane-header">
              <p className="pane-kicker">Oblique slice</p>
              <h2 className="pane-title">Probe imaging plane</h2>
            </div>

            <MeasuredRendererSurface className="render-surface render-surface-right">
              {({ height, width }) => (
                <ObliqueSlicePane
                  height={height}
                  ref={obliquePaneRef}
                  volume={shellVolume}
                  width={width}
                />
              )}
            </MeasuredRendererSurface>

            {labelsVisible ? (
              <div className="structures-panel">
                <p className="structures-title">Structures in current case manifest</p>
                <div className="structure-list">
                  {structures.map((structure) => (
                    <span className="structure-chip" key={structure}>
                      {structure}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        }
        dock={
          <div className="dock-grid">
            <ProbeHUD />
            <ViewPicker />
          </div>
        }
      />
    </div>
  );
}
