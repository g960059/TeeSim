import { getStationLabel, PROBE_LIMITS, PSEUDO_TEE_LIMITS, useTeeSimStore } from '../store';

interface SliderControl {
  key: 'sMm' | 'rollDeg' | 'anteDeg' | 'lateralDeg' | 'omniplaneDeg';
  label: string;
  testId: string;
  valueTestId: string;
  min: number;
  max: number;
  step: number;
  displayKey: 's' | 'roll' | 'ante' | 'lateral' | 'omniplane';
}

const sliderControls: SliderControl[] = [
  {
    key: 'sMm',
    label: 'Position (s)',
    testId: 'slider-s',
    valueTestId: 'slider-value-s',
    min: PROBE_LIMITS.sMm.min,
    max: PROBE_LIMITS.sMm.max,
    step: PROBE_LIMITS.sMm.step,
    displayKey: 's',
  },
  {
    key: 'rollDeg',
    label: 'Roll',
    testId: 'slider-roll',
    valueTestId: 'slider-value-roll',
    min: PROBE_LIMITS.rollDeg.min,
    max: PROBE_LIMITS.rollDeg.max,
    step: PROBE_LIMITS.rollDeg.step,
    displayKey: 'roll',
  },
  {
    key: 'anteDeg',
    label: 'Ante / Retro',
    testId: 'slider-ante',
    valueTestId: 'slider-value-ante',
    min: PROBE_LIMITS.anteDeg.min,
    max: PROBE_LIMITS.anteDeg.max,
    step: PROBE_LIMITS.anteDeg.step,
    displayKey: 'ante',
  },
  {
    key: 'lateralDeg',
    label: 'Lateral',
    testId: 'slider-lateral',
    valueTestId: 'slider-value-lateral',
    min: PROBE_LIMITS.lateralDeg.min,
    max: PROBE_LIMITS.lateralDeg.max,
    step: PROBE_LIMITS.lateralDeg.step,
    displayKey: 'lateral',
  },
  {
    key: 'omniplaneDeg',
    label: 'Omniplane',
    testId: 'slider-omniplane',
    valueTestId: 'slider-value-omniplane',
    min: PROBE_LIMITS.omniplaneDeg.min,
    max: PROBE_LIMITS.omniplaneDeg.max,
    step: PROBE_LIMITS.omniplaneDeg.step,
    displayKey: 'omniplane',
  },
];

const cardiacPhaseLabels = [
  'ED',
  'IsoC',
  'Ej-1',
  'Ej-2',
  'Ej-3',
  'ES',
  'IsoR',
  'Fill-1',
  'Fill-2',
  'Fill-3',
  'Fill-4',
  'Fill-5',
] as const;

const formatSliderValue = (key: SliderControl['displayKey'], value: number): string => {
  if (key === 's') {
    return value.toFixed(0);
  }

  return value.toFixed(0);
};

export function ProbeHUD() {
  const probe = useTeeSimStore((state) => state.probe);
  const setProbe = useTeeSimStore((state) => state.probe.setProbe);
  const depthMm = useTeeSimStore((state) => state.ui.depthMm);
  const setDepthMm = useTeeSimStore((state) => state.ui.setDepthMm);
  const motionPhaseCount = useTeeSimStore((state) => state.scene.manifest?.motionPhases?.length ?? 0);
  const cardiacPhase = useTeeSimStore((state) => state.cardiac.cardiacPhase);
  const isPlaying = useTeeSimStore((state) => state.cardiac.isPlaying);
  const cycleMs = useTeeSimStore((state) => state.cardiac.cycleMs);
  const play = useTeeSimStore((state) => state.cardiac.play);
  const pause = useTeeSimStore((state) => state.cardiac.pause);
  const setPhase = useTeeSimStore((state) => state.cardiac.setPhase);
  const station = getStationLabel(probe.sMm);
  const hasMotion = motionPhaseCount > 0;
  const heartRateBpm = Math.round(60000 / cycleMs);
  const maxPhase = Math.max(motionPhaseCount - 1, 0);

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Probe controls</p>
          <h3 className="panel-title">5-DOF pose</h3>
        </div>
        <div className="position-display" data-testid="probe-position-display">
          <span>{station}</span>
          <span>{probe.sMm.toFixed(0)} mm</span>
          <span>{probe.omniplaneDeg.toFixed(0)}°</span>
        </div>
      </div>

      <div className="slider-grid">
        {sliderControls.map((control) => (
          <label className="slider-row" key={control.key}>
            <div className="slider-meta">
              <span>{control.label}</span>
              <span data-testid={control.valueTestId}>
                {formatSliderValue(control.displayKey, probe[control.key])}
              </span>
            </div>
            <input
              className="slider-input"
              data-testid={control.testId}
              max={control.max}
              min={control.min}
              onChange={(event) =>
                setProbe({
                  [control.key]: Number(event.currentTarget.value),
                })
              }
              step={control.step}
              type="range"
              value={probe[control.key]}
            />
          </label>
        ))}

        <label className="slider-row" key="depthMm">
          <div className="slider-meta">
            <span>Depth (cm)</span>
            <span data-testid="slider-value-depth">{(depthMm / 10).toFixed(0)}</span>
          </div>
          <input
            className="slider-input"
            data-testid="slider-depth"
            max={PSEUDO_TEE_LIMITS.depthMm.max}
            min={PSEUDO_TEE_LIMITS.depthMm.min}
            onChange={(event) => {
              setDepthMm(Number(event.currentTarget.value));
            }}
            step={PSEUDO_TEE_LIMITS.depthMm.step}
            type="range"
            value={depthMm}
          />
        </label>

        <div className="motion-panel">
          <div className="motion-header">
            <div>
              <span className="motion-title">Cardiac motion</span>
              <span className="motion-subtitle" data-testid="cardiac-hr">
                {hasMotion ? `${heartRateBpm} bpm` : 'Static labels'}
              </span>
            </div>
            <button
              className="secondary-button motion-toggle"
              data-testid="cardiac-play-pause"
              disabled={!hasMotion}
              onClick={() => {
                if (isPlaying) {
                  pause();
                  return;
                }
                play();
              }}
              type="button"
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
          </div>

          <label className="slider-row" key="cardiacPhase">
            <div className="slider-meta">
              <span>Phase</span>
              <span data-testid="cardiac-phase-value">
                {cardiacPhaseLabels[cardiacPhase] ?? `P${cardiacPhase + 1}`}
              </span>
            </div>
            <input
              className="slider-input"
              data-testid="cardiac-phase"
              disabled={!hasMotion}
              max={maxPhase}
              min={0}
              onChange={(event) => {
                setPhase(Number(event.currentTarget.value));
              }}
              step={1}
              type="range"
              value={cardiacPhase}
            />
          </label>
        </div>
      </div>
    </section>
  );
}
