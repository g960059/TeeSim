import { useEffect } from 'react';

import { PROBE_LIMITS, useTeeSimStore, VIEW_PRESETS } from '../../store';

const isTextEntryTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
};

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || isTextEntryTarget(event.target)) {
        return;
      }

      const state = useTeeSimStore.getState();
      const { setProbe, snapToView } = state.probe;
      const presets = state.scene.views.length > 0 ? state.scene.views : VIEW_PRESETS;

      if (/^[1-8]$/.test(event.key)) {
        const preset = presets[Number(event.key) - 1];
        if (preset) {
          snapToView(preset);
        }
        event.preventDefault();
        return;
      }

      switch (event.key) {
        case 'ArrowUp':
          setProbe({ sMm: state.probe.sMm + PROBE_LIMITS.sMm.keyboardStep });
          event.preventDefault();
          break;
        case 'ArrowDown':
          setProbe({ sMm: state.probe.sMm - PROBE_LIMITS.sMm.keyboardStep });
          event.preventDefault();
          break;
        case 'q':
        case 'Q':
          setProbe({ rollDeg: state.probe.rollDeg - PROBE_LIMITS.rollDeg.keyboardStep });
          event.preventDefault();
          break;
        case 'e':
        case 'E':
          setProbe({ rollDeg: state.probe.rollDeg + PROBE_LIMITS.rollDeg.keyboardStep });
          event.preventDefault();
          break;
        case 'w':
        case 'W':
          setProbe({ anteDeg: state.probe.anteDeg + PROBE_LIMITS.anteDeg.keyboardStep });
          event.preventDefault();
          break;
        case 's':
        case 'S':
          setProbe({ anteDeg: state.probe.anteDeg - PROBE_LIMITS.anteDeg.keyboardStep });
          event.preventDefault();
          break;
        case 'a':
        case 'A':
          setProbe({ lateralDeg: state.probe.lateralDeg - PROBE_LIMITS.lateralDeg.keyboardStep });
          event.preventDefault();
          break;
        case 'd':
        case 'D':
          setProbe({ lateralDeg: state.probe.lateralDeg + PROBE_LIMITS.lateralDeg.keyboardStep });
          event.preventDefault();
          break;
        case '[':
        case 'ArrowLeft':
          setProbe({ omniplaneDeg: state.probe.omniplaneDeg - PROBE_LIMITS.omniplaneDeg.keyboardStep });
          event.preventDefault();
          break;
        case ']':
        case 'ArrowRight':
          setProbe({ omniplaneDeg: state.probe.omniplaneDeg + PROBE_LIMITS.omniplaneDeg.keyboardStep });
          event.preventDefault();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}
