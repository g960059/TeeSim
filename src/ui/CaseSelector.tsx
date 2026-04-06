import { useState } from 'react';

import { useTeeSimStore } from '../store';

export function CaseSelector() {
  const [open, setOpen] = useState(false);
  const caseIndex = useTeeSimStore((state) => state.scene.caseIndex);
  const currentCase = useTeeSimStore((state) => state.scene.currentCase);
  const currentCaseId = useTeeSimStore((state) => state.scene.currentCaseId);
  const loadCase = useTeeSimStore((state) => state.scene.loadCase);
  const loadPhase = useTeeSimStore((state) => state.scene.loadPhase);

  return (
    <div className="case-selector">
      <button
        className="case-selector-button"
        data-testid="case-selector"
        disabled={caseIndex.length === 0}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span>Case</span>
        <strong>{currentCase?.title ?? (caseIndex.length === 0 ? 'Loading cases...' : 'Select a case')}</strong>
      </button>

      {open ? (
        <div className="case-menu" role="listbox" aria-label="Available cases">
          {caseIndex.map((entry) => (
            <button
              aria-selected={currentCaseId === entry.id}
              className="case-option"
              data-testid="case-option"
              key={entry.id}
              onClick={() => {
                void loadCase(entry.id);
                setOpen(false);
              }}
              type="button"
            >
              <span>{entry.title}</span>
              <small>{entry.bundleVersion}</small>
            </button>
          ))}
        </div>
      ) : null}

      {loadPhase === 'error' ? <p className="case-error">Case manifest could not be resolved.</p> : null}
    </div>
  );
}
