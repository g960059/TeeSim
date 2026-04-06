# UI/UX Improvement Proposal (Engineering)

Date: 2026-04-06

## Scope

Reviewed:

- `screenshots/ui-review-desktop-initial.png`
- `screenshots/ui-review-desktop-me4c.png`
- `screenshots/ui-review-tablet.png`
- `screenshots/ui-review-mobile.png`
- `src/App.tsx`
- `src/ui/ThreePaneLayout.tsx`
- `src/ui/ProbeHUD.tsx`
- `src/ui/ViewPicker.tsx`
- `src/ui/ViewMatchIndicator.tsx`
- `src/styles/tokens.css`
- `src/styles/app.css`

## Executive Summary

The current shell is technically coherent, but the UI spends too much vertical space on app chrome and too little on the actual simulator. The desktop layout is visually attractive but inefficient. Tablet and mobile are not just "tight"; they are structurally broken because the compact mode preserves the full header, full status strip, and full-height control dock while also collapsing the 3-pane view to one panel at a time.

The highest-value changes are:

1. Collapse the header and remove the always-visible status strip from the main flow.
2. Make the 3D scene the dominant surface and reduce pane chrome/padding.
3. Replace the 5 equal-weight sliders with grouped controls: depth scrubber, bend pad, roll slider, omniplane dial.
4. Fix accessibility semantics for tabs, popovers, focus, and slider labeling.
5. Split `ProbeHUD` into smaller controls and keep high-frequency interactions on an animation-frame budget.

## What The Screenshots Show

### Desktop

- The header and status strip consume roughly the first 140-170 px before the simulator begins.
- The pane cards have large internal padding, so the effective renderable area is smaller than it looks.
- The match indicator is useful, but "100% quality" is misleading because the app is showing nearest-preset pose similarity, not image quality.
- The right-side structure chips are secondary information but occupy persistent space.
- The bottom dock is visually heavy for two panels that are both always open.

### Tablet (`768px`)

- The app collapses to one render pane plus the full dock, but the header and status strip remain full-size.
- The compact mode still behaves like a desktop information architecture. The tabbed pane becomes a narrow strip between top chrome and bottom controls.
- The tab row, status row, and bottom dock compete for the same limited vertical space.

### Mobile (`390px`)

- The render area is too small to support the core learning task.
- The header copy and status chips wrap into multiple rows, pushing the simulator below the fold.
- The dock remains expanded and stacked, so the main view feels like a side element instead of the primary surface.

## 1. Code-Level Improvements

### 1.1 Performance

The current React render path is not catastrophically inefficient. `App.tsx` does not subscribe to live probe pose, and `useSyncManager()` already pushes pose changes to the VTK panes imperatively on `requestAnimationFrame`. That is the right architecture to preserve.

What should change:

- Do not memoize the entire `ProbeHUD`. That would hide the real problem.
- Split `ProbeHUD` into smaller leaf controls so future richer widgets do not force a full control panel rerender for every drag tick.
- Coalesce store reads in `App.tsx` with a shallow selector. The current many-selector pattern is readable, but it creates a large subscription surface for a top-level component.
- Guard `useElementSize()` against no-op size updates. `ResizeObserver` can fire repeatedly with unchanged dimensions.
- For future 2D pad / dial dragging, keep local drag state and commit probe updates on `requestAnimationFrame`, not on every raw pointer event.

Recommended component split:

- `ProbeHUD`
  - `ProbePoseSummary`
  - `DepthScrubber`
  - `BendPad`
  - `RollSlider`
  - `OmniplaneDial`
- `ViewPicker`
  - `PresetGrid`
  - `PresetButton`
- `App chrome`
  - `TopBar`
  - `SimulationStatus`
  - `CaseInfoDrawer`

Impactful snippet: shallow top-level store selection

```tsx
import { useShallow } from 'zustand/react/shallow';

const {
  currentCase,
  currentCaseId,
  caseIndex,
  manifest,
  meshes,
  probePath,
  volume,
  loadPhase,
  structures,
  loadCase,
  loadCaseIndex,
  labelsVisible,
  toggleLabelsVisible,
  selectedPanel,
  setSelectedPanel,
} = useTeeSimStore(
  useShallow((state) => ({
    currentCase: state.scene.currentCase,
    currentCaseId: state.scene.currentCaseId,
    caseIndex: state.scene.caseIndex,
    manifest: state.scene.manifest,
    meshes: state.scene.meshes,
    probePath: state.scene.probePath,
    volume: state.scene.volume,
    loadPhase: state.scene.loadPhase,
    structures: state.scene.structures,
    loadCase: state.scene.loadCase,
    loadCaseIndex: state.scene.loadCaseIndex,
    labelsVisible: state.ui.labelsVisible,
    toggleLabelsVisible: state.ui.toggleLabelsVisible,
    selectedPanel: state.ui.selectedPanel,
    setSelectedPanel: state.ui.setSelectedPanel,
  })),
);
```

Impactful snippet: prevent redundant `ResizeObserver` rerenders

```tsx
import { useLayoutEffect, useState, type RefObject } from 'react';

export function useElementSize<T extends HTMLElement>(ref: RefObject<T | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const updateSize = () => {
      const next = {
        width: element.clientWidth,
        height: element.clientHeight,
      };

      setSize((prev) =>
        prev.width === next.width && prev.height === next.height ? prev : next,
      );
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);

    return () => observer.disconnect();
  }, [ref]);

  return size;
}
```

### 1.2 Accessibility

Current issues:

- `ThreePaneLayout.tsx` uses `role="tablist"` but the buttons are not tabs. They use `aria-pressed` instead of `role="tab"` and `aria-selected`.
- The panels are not marked as `tabpanel`, and there is no `aria-controls` / `aria-labelledby` relationship.
- The tab row has no arrow-key behavior.
- `CaseSelector.tsx` uses a `listbox` container with buttons as children. That is not a correct listbox pattern.
- There are no visible `:focus-visible` styles in `app.css`.
- Slider values are shown visually, but their accessible names do not expose units or keyboard help.
- The match indicator says "`quality`", which overstates what the algorithm does.

Recommended fixes:

- Implement actual tab semantics with roving focus and `hidden` on inactive compact panels.
- Convert `CaseSelector` to a real popover menu or use a native `<select>` in compact layouts.
- Add `aria-live="polite"` to the match indicator so preset changes are announced without forcing focus.
- Add `aria-describedby` for probe controls with units and keyboard hints.
- Keep any custom bend pad / dial paired with explicit range or number inputs. Do not make the custom widget the only accessible control.
- Add `:focus-visible` treatment globally for buttons, sliders, and tab buttons.

Impactful snippet: accessible tab structure

```tsx
const tabs: { id: SelectedPanel; label: string }[] = [
  { id: 'left', label: 'CT slice' },
  { id: 'center', label: '3D scene' },
  { id: 'right', label: 'Oblique' },
];

<div className="pane-tabs" role="tablist" aria-label="Simulator panes">
  {tabs.map((tab) => {
    const selected = selectedPanel === tab.id;

    return (
      <button
        key={tab.id}
        id={`pane-tab-${tab.id}`}
        role="tab"
        aria-selected={selected}
        aria-controls={`pane-panel-${tab.id}`}
        tabIndex={selected ? 0 : -1}
        className="pane-tab"
        onClick={() => onSelectPanel(tab.id)}
        type="button"
      >
        {tab.label}
      </button>
    );
  })}
</div>

<section
  id="pane-panel-center"
  role="tabpanel"
  aria-labelledby="pane-tab-center"
  hidden={selectedPanel !== 'center'}
  className="layout-pane"
>
  {centerPane}
</section>
```

### 1.3 Responsive Layout

The compact breakpoint currently changes the pane grid, but not the information architecture. That is why tablet/mobile feel broken.

Current problem in CSS:

- `@media (max-width: 1179px)` collapses panes to one column, but keeps:
  - full header copy
  - full status strip
  - full dock
  - full preset list
- `.layout-pane` still uses a fixed `min-height: 360px`.
- `.app-shell` still uses `100vh`, which is unreliable on mobile browsers.

Recommended layout rules:

- Use `100dvh` instead of `100vh`.
- Reduce the top chrome to a compact toolbar on all viewports below `1180px`.
- Hide or collapse the status strip into a single-line simulation context row.
- Cap the dock height in compact layouts and make it scroll independently.
- Reduce pane padding and pane-header spacing in compact mode.
- Remove decorative overlay graphics from the render surfaces on compact viewports.

### 1.4 Component Structure

The biggest structural issue is that UI surfaces are grouped by implementation convenience, not by user task.

Suggested structure:

- `TopBar`
  - case switcher
  - labels toggle
  - current case / station summary
- `SimulationViewport`
  - `ThreePaneLayout`
  - match badge overlay
- `ControlDock`
  - `ProbeControlsPanel`
  - `PresetRail`
  - optional compact tabs: `Manipulate | Presets | Info`

Specific merge/split recommendations:

- Split `ProbeHUD.tsx`; it is currently too monolithic for the next interaction model.
- Keep `ViewMatchIndicator.tsx`, but render it as a compact overlay badge, not a full header block.
- Keep `ThreePaneLayout.tsx`, but let it own tab semantics, compact behavior, and panel IDs.
- Rename `labelsVisible` if it only toggles structure chips and pane annotations. The current name suggests renderer labels.

## 2. Interaction Improvements

The current five sliders are functional but not intuitive because they map equally important UI weight to controls that do not have equal cognitive weight. Learners think in:

1. advance / withdraw
2. bend the tip
3. rotate the imaging plane
4. roll the shaft

The UI should match that mental model.

### 2.1 Replace "Position (s)" With A Depth Scrubber

What to build:

- A full-width horizontal scrubber labeled `Depth`.
- Station bands: `UE`, `ME`, `TG`, `DTG`.
- Tick markers for anchor presets in the current case.
- Active station and millimeter value displayed above the thumb.

Behavior:

- Drag = fine millimeter movement.
- `ArrowLeft` / `ArrowRight` = `1 mm`
- `Shift + Arrow` = `5 mm`
- `PageUp` / `PageDown` = jump station boundary
- Clicking a station label jumps to the center of that zone.

Why it helps:

- It makes the station transitions visible.
- It turns the most important linear control into a clinically meaningful map.

### 2.2 Replace Ante/Lateral Sliders With A 2D Bend Pad

What to build:

- A square 2D pad where:
  - vertical axis = anteflex / retroflex
  - horizontal axis = left / right lateral flex
- Center dead zone around neutral.
- Crosshair, axis labels, and numeric readout.

Behavior:

- Pointer drag with pointer capture.
- `W/S` and `A/D` remain valid keyboard shortcuts.
- Focused pad uses arrow keys for fine movement and `Shift + arrow` for coarse movement.
- Double-click or `Home` resets to neutral.

Accessibility rule:

- Keep the current explicit range inputs or number inputs as fallback controls near the pad.
- The bend pad should be an accelerator, not the only way to control bend.

Implementation sketch:

```tsx
function BendPad({
  anteDeg,
  lateralDeg,
  onChange,
}: {
  anteDeg: number;
  lateralDeg: number;
  onChange: (patch: { anteDeg: number; lateralDeg: number }) => void;
}) {
  const padRef = useRef<HTMLDivElement | null>(null);

  const commitPointer = (clientX: number, clientY: number) => {
    const rect = padRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((clientY - rect.top) / rect.height) * 2 - 1;

    onChange({
      lateralDeg: clamp(x * 90, -90, 90),
      anteDeg: clamp(-y * 90, -90, 90),
    });
  };

  return (
    <div className="bend-pad-group">
      <div
        ref={padRef}
        className="bend-pad"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          commitPointer(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (event.buttons !== 1) {
            return;
          }
          commitPointer(event.clientX, event.clientY);
        }}
        role="img"
        aria-label={`Bend pad. Anteflex ${anteDeg} degrees. Lateral ${lateralDeg} degrees.`}
      />

      <div className="bend-pad-fallback">
        <label>
          Ante / Retro
          <input type="range" min={-90} max={90} value={anteDeg} />
        </label>
        <label>
          Lateral
          <input type="range" min={-90} max={90} value={lateralDeg} />
        </label>
      </div>
    </div>
  );
}
```

### 2.3 Replace Omniplane Slider With A Circular Dial

What to build:

- A circular dial for `0-180°`.
- Angle label in the center.
- Tick marks at `0`, `45`, `90`, `135`, `180`.
- Optional view detents if a preset uses a nearby omniplane angle.

Behavior:

- Drag around the circumference.
- `ArrowLeft` / `ArrowRight` = `1°`
- `Shift + Arrow` = `5°`
- `Home` = `0°`, `End` = `180°`

Why it helps:

- A circular control matches the physical omniplane concept better than a flat slider.
- It makes large angle changes and "dialing through" views more legible.

### 2.4 Keep Roll As A Dedicated Linear Control

Roll is still best represented as a linear or compact rotary control because it is a separate manipulation concept from tip bending and omniplane angle. It should remain explicit, but it should take less visual weight than depth and bending.

Recommendation:

- Use a narrow vertical slider or compact horizontal slider.
- Place it adjacent to the bend pad, not as one of five stacked equal rows.

## 3. Visual Improvements

### 3.1 Reduce Header Height Aggressively

Current problem:

- The header reads like a product landing page, not a simulation tool.

Recommendation:

- Use a compact top bar with:
  - product name
  - current case selector
  - labels toggle
  - optional info button
- Move descriptive copy into a dismissible onboarding panel or remove it entirely after initial load.

### 3.2 Replace The Status Strip With A Simulation Context Rail

Current strip content is technically true but not useful during manipulation:

- bundle version
- centerline constraint
- CT-derived slice disclaimer
- asset loaded state

Recommendation:

- Keep only:
  - current case
  - current station
  - nearest preset
  - labels on/off
- Move bundle/debug details into a collapsible `Case info` drawer.
- Change `100% quality` to `100% preset alignment` or `Exact preset match`.

### 3.3 Make The 3D Scene Clearly Dominant

Recommendation:

- Shift desktop pane widths from `28 / 44 / 28` to `22 / 56 / 22`.
- Reduce pane padding and pane-header height.
- Render the match badge inside the scene viewport, not above it.
- Remove decorative pseudo-sector overlays from the slice frames on compact screens.

### 3.4 Compact The Bottom Dock

Recommendation:

- Desktop:
  - left: direct manipulation controls
  - right: presets
- Tablet/mobile:
  - bottom sheet with internal tabs: `Manipulate | Presets | Info`
  - default collapsed height around `88-120 px`
  - expanded max height around `38dvh`

### 3.5 De-Emphasize Structure Chips

Recommendation:

- Hide the structure chips by default.
- Reveal them via an `Anatomy list` button or an expandable side panel.
- Keep the right pane focused on image interpretation, not metadata.

## 4. Concrete CSS Changes

### 4.1 `tokens.css`

Add layout, spacing, and focus tokens:

```css
:root {
  --color-bg: #07111f;
  --color-bg-elevated: rgba(8, 20, 36, 0.92);
  --color-bg-muted: rgba(16, 33, 58, 0.82);
  --color-panel: rgba(10, 24, 42, 0.92);
  --color-panel-strong: rgba(7, 18, 31, 0.98);
  --color-panel-border: rgba(125, 175, 216, 0.2);
  --color-text: #e8f1ff;
  --color-text-muted: #b7c6db;
  --color-text-subtle: #8ea2bc;
  --color-accent: #79c9d0;
  --color-accent-strong: #55e0c7;
  --color-match: #4fd18b;
  --color-near: #f4b24d;
  --color-exploring: #8da2bc;
  --color-danger: #ff7b7b;

  --shadow-panel: 0 22px 54px rgba(2, 8, 18, 0.34);
  --shadow-focus: 0 0 0 3px rgba(121, 201, 208, 0.28);

  --radius-panel: 22px;
  --radius-control: 16px;
  --radius-chip: 999px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;

  --pane-gap: 12px;
  --pane-padding: 12px;
  --pane-padding-compact: 10px;
  --render-frame-padding: 8px;
  --topbar-min-height: 64px;
  --dock-max-height-compact: min(38dvh, 320px);
  --app-max-width: 1800px;
}
```

Notes:

- `--color-text-muted` should be slightly brighter than the current value because it is used on small text and on colored backgrounds.
- Keep raw numeric media-query breakpoints in `app.css`; CSS variables are not usable in normal media queries without extra tooling.

### 4.2 `app.css`

The most important layout changes are below.

```css
.app-shell {
  min-height: 100dvh;
  max-width: var(--app-max-width);
  margin: 0 auto;
  padding: var(--space-5);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--space-4);
}

.app-header {
  min-height: var(--topbar-min-height);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--space-3);
}

.app-heading h1 {
  font-size: clamp(1.5rem, 2vw, 2.25rem);
  line-height: 1;
}

.app-summary {
  display: none;
}

.status-strip {
  display: none;
}

.layout-shell {
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: var(--pane-gap);
}

.pane-grid {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 22fr) minmax(0, 56fr) minmax(0, 22fr);
  gap: var(--pane-gap);
}

.layout-pane {
  min-height: 0;
  padding: var(--pane-padding);
}

.pane-stack {
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: var(--space-3);
}

.pane-header {
  gap: 2px;
}

.render-surface {
  padding: var(--render-frame-padding);
}

.view-match-indicator {
  min-width: 0;
  padding: 10px 12px;
}

.control-dock {
  padding: var(--space-3);
}

.dock-grid {
  grid-template-columns: minmax(320px, 1.2fr) minmax(260px, 0.8fr);
  gap: var(--space-3);
}

.secondary-button:focus-visible,
.case-selector-button:focus-visible,
.pane-tab:focus-visible,
.preset-button:focus-visible,
.case-option:focus-visible,
.slider-input:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}
```

Compact mode needs a real layout change, not just a pane collapse:

```css
@media (max-width: 1179px) {
  .app-shell {
    padding: var(--space-3);
    gap: var(--space-3);
  }

  .app-header {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
  }

  .app-toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    width: 100%;
    gap: var(--space-2);
  }

  .pane-tabs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .pane-grid {
    grid-template-columns: 1fr;
  }

  .layout-pane {
    display: none;
    padding: var(--pane-padding-compact);
  }

  .layout-pane[data-active='true'] {
    display: block;
    min-height: min(52dvh, 420px);
  }

  .render-surface-left::before,
  .render-surface-left::after,
  .render-surface-right::before,
  .render-surface-right::after {
    display: none;
  }

  .control-dock {
    position: sticky;
    bottom: 0;
    max-height: var(--dock-max-height-compact);
    overflow: auto;
    background: rgba(7, 18, 31, 0.94);
    backdrop-filter: blur(16px);
  }

  .dock-grid {
    grid-template-columns: 1fr;
  }

  .preset-grid {
    grid-template-columns: 1fr;
  }
}
```

Phone-specific rules should further reduce chrome:

```css
@media (max-width: 720px) {
  .app-header {
    grid-template-columns: 1fr;
  }

  .eyebrow,
  .panel-kicker,
  .pane-kicker {
    margin-bottom: 4px;
    font-size: 0.68rem;
    letter-spacing: 0.12em;
  }

  .app-toolbar {
    grid-template-columns: 1fr;
  }

  .layout-pane[data-active='true'] {
    min-height: min(48dvh, 360px);
  }

  .panel-card,
  .layout-pane,
  .control-dock {
    border-radius: 18px;
  }

  .panel-header,
  .pane-header-inline {
    flex-direction: column;
    gap: var(--space-2);
  }

  .position-display {
    justify-content: flex-start;
  }
}
```

## 5. Suggested Implementation Order

1. Reduce chrome and fix compact layout in `App.tsx`, `ThreePaneLayout.tsx`, `tokens.css`, and `app.css`.
2. Fix accessibility semantics for tabs, focus states, and case selection.
3. Rename misleading UI copy:
   - `quality` -> `preset alignment`
   - `Position (s)` -> `Depth`
4. Split `ProbeHUD` into smaller components.
5. Implement the depth scrubber.
6. Implement the bend pad and omniplane dial with accessible fallbacks.
7. Move structure chips and case metadata into collapsible secondary surfaces.

## Recommendation

Treat the next UI pass as a simulator-surface optimization, not a restyling exercise. The fastest way to improve the product is to remove non-essential chrome, fix compact layout semantics, and replace the equal-weight slider stack with controls that map to how TEE manipulation is actually taught.
