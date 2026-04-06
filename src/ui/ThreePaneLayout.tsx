import type { ReactNode } from 'react';

import type { SelectedPanel } from '../store';

interface ThreePaneLayoutProps {
  leftPane: ReactNode;
  centerPane: ReactNode;
  rightPane: ReactNode;
  dock: ReactNode;
  selectedPanel: SelectedPanel;
  onSelectPanel: (panel: SelectedPanel) => void;
}

const tabs: { id: SelectedPanel; label: string }[] = [
  { id: 'left', label: 'CT slice' },
  { id: 'center', label: '3D scene' },
  { id: 'right', label: 'Oblique' },
];

export function ThreePaneLayout({
  leftPane,
  centerPane,
  rightPane,
  dock,
  selectedPanel,
  onSelectPanel,
}: ThreePaneLayoutProps) {
  return (
    <div className="layout-shell">
      <div className="pane-tabs" role="tablist" aria-label="Simulator panes">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            aria-pressed={selectedPanel === tab.id}
            className="pane-tab"
            onClick={() => onSelectPanel(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="pane-grid">
        <section
          className="layout-pane"
          data-active={selectedPanel === 'left'}
          data-testid="pane-left"
          data-pane="left"
        >
          {leftPane}
        </section>

        <section
          className="layout-pane"
          data-active={selectedPanel === 'center'}
          data-testid="pane-center"
          data-pane="center"
        >
          {centerPane}
        </section>

        <section
          className="layout-pane"
          data-active={selectedPanel === 'right'}
          data-testid="pane-right"
          data-pane="right"
        >
          {rightPane}
        </section>
      </div>

      <section className="control-dock" data-testid="probe-control-dock">
        {dock}
      </section>
    </div>
  );
}
