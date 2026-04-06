import { useTeeSimStore } from '../store';

const presetTestIds: Record<string, string> = {
  'me-4c': 'preset-me-4c',
  'me-2c': 'preset-me-2c',
  'me-lax': 'preset-me-lax',
  'tg-sax': 'preset-tg-sax',
  'tg-mid-sax': 'preset-tg-sax',
  'me-av-sax': 'preset-me-av-sax',
  'me-av-lax': 'preset-me-av-lax',
  'me-rv-io': 'preset-me-rv-io',
  'me-bicaval': 'preset-me-bicaval',
};

export function ViewPicker() {
  const snapToView = useTeeSimStore((state) => state.probe.snapToView);
  const presets = useTeeSimStore((state) => state.scene.views);
  const bestMatch = useTeeSimStore((state) => state.viewMatch.bestMatch);

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Anchor views</p>
          <h3 className="panel-title">Preset-first navigation</h3>
        </div>
        <p className="panel-caption">Keys 1-8 jump directly to these presets.</p>
      </div>

      <div className="preset-grid">
        {presets.map((preset) => {
          const isBestMatch = bestMatch?.preset.id === preset.id;
          const presetTestId = presetTestIds[preset.id] ?? `preset-${preset.id}`;

          return (
            <button
              className="preset-button"
              data-highlighted={isBestMatch}
              data-match-status={isBestMatch ? bestMatch?.status ?? 'exploring' : undefined}
              data-testid={presetTestId}
              key={preset.id}
              onClick={() => snapToView(preset)}
              type="button"
            >
              <span>{preset.label}</span>
              <small>{preset.aseCode ?? preset.station}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}
