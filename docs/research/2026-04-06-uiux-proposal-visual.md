# TeeSim Visual Design Overhaul Proposal

**Date:** 2026-04-06  
**Author:** UI/UX Review (Senior Product Design)  
**Status:** Proposal  
**Scope:** Complete visual design system, layout architecture, interaction model, and responsive strategy

---

## Executive Summary

TeeSim's current MVP shell is a functional prototype dressed in a developer-console aesthetic. The three-pane grid, five horizontal sliders, text-badge view indicators, and dense header chrome all communicate "engineering demo" rather than "professional medical training tool." This proposal transforms TeeSim into a clinical-grade simulator that fellows and attendings will trust, want to use, and recommend.

The overhaul addresses seven dimensions: layout architecture, visual design language, probe control interaction, view-match feedback, 3D pane improvements, responsive strategy, animation, and reference image comparison. Each section provides concrete CSS tokens, pixel-level specifications, and component designs.

---

## 1. Layout Architecture

### Current State Critique

The current layout uses a rigid `grid-template-columns: 28% 44% 28%` three-pane row above a full-width dock. Problems:

- **The 3D pane is cramped.** At 44% of viewport width (roughly 630px on a 1440px display), the 3D heart anatomy is too small for meaningful spatial understanding. Attendings projecting onto a classroom display need this pane to dominate.
- **The two slice panes compete for attention.** Pseudo-TEE (left) and oblique slice (right) are equally weighted, but during a typical learning session the user is focused on one at a time.
- **The bottom dock is monolithic.** Five sliders + eight preset buttons + position readout form a single horizontal band that scrolls on anything below 1280px wide.
- **The header consumes 140px+ of vertical space.** The title "TeeSim MVP shell", the eyebrow, the summary paragraph, and the status pill strip are development scaffolding that steals space from the visualization.

### Proposed Architecture: "Immersive Center Stage"

```
+--------------------------------------------------------------+
| [logo] TeeSim         [Case ▾]  [View: ME 4C ▾]  [⚙]  [?]  |  <- 48px toolbar
+------+-----------------------------------------------+-------+
|      |                                               |       |
| Left |            3D Anatomy Scene                   | Right |
| Rail |           (probe + sector + mesh)             | Rail  |
| 280px|                                               | 280px |
|      |                                               |       |
|      |     [Match ring overlay at top-center]        |       |
|      |                                               |       |
|      |                                               |       |
|      +-----------------------------------------------+       |
|      |   Probe Control Bar (collapsed: 64px)         |       |
|      |   [Depth ======o======] [Omni ◎] [Flex ✛]    |       |
+------+-----------------------------------------------+-------+
```

#### Key changes

1. **Eliminate the header block entirely.** The app name moves to a compact 48px top toolbar alongside the case selector and settings. No eyebrow, no summary paragraph, no status pills. Those belong in a Help/About overlay.

2. **3D pane takes center stage at `calc(100vw - 560px)` minimum.** On a 1440px display that is 880px. On a 1920px display, 1360px. The 3D scene is the primary learning surface.

3. **Side rails replace equal-weight panes.** The left rail holds the pseudo-TEE slice. The right rail holds the oblique slice. Rails are 280px wide, collapsible to 48px (icon-only toggle). When collapsed, the 3D pane expands to fill.

4. **Probe controls dock to the bottom of the 3D pane**, not the full viewport width. This creates a contained "cockpit" feel. The dock is 64px tall when collapsed (showing depth scrubber + omniplane dial), expandable to 200px for full controls.

5. **View presets become a dropdown/command palette** rather than an always-visible grid. Press `Cmd+K` or click the view selector in the toolbar to open a searchable view picker overlay.

#### CSS grid structure

```css
.app-layout {
  display: grid;
  grid-template-columns: var(--rail-width, 280px) 1fr var(--rail-width, 280px);
  grid-template-rows: var(--toolbar-height) 1fr;
  height: 100vh;
  overflow: hidden;
}

.app-layout[data-left-collapsed="true"] {
  grid-template-columns: 48px 1fr var(--rail-width, 280px);
}

.app-layout[data-right-collapsed="true"] {
  grid-template-columns: var(--rail-width, 280px) 1fr 48px;
}

.app-toolbar {
  grid-column: 1 / -1;
  height: var(--toolbar-height);
}

.center-stage {
  position: relative;
  display: grid;
  grid-template-rows: 1fr auto;
  min-height: 0;
}
```

---

## 2. Visual Design Language

### 2.1 Color Palette

The current palette (`--color-bg: #07111f`, `--color-accent: #79c9d0`) reads as a hacker-terminal. Medical tools need to convey trust, precision, and calm authority. The new palette draws from clinical display standards (DICOM-compliant viewing) and modern medical device interfaces (GE Vivid, Philips EPIQ).

#### Dark theme (primary, for OR/dark room use)

```css
:root[data-theme="dark"] {
  /* Backgrounds - warm charcoal, not cold navy */
  --bg-base:          #141418;
  --bg-surface:       #1c1c22;
  --bg-elevated:      #242430;
  --bg-overlay:       rgba(20, 20, 24, 0.92);

  /* Borders */
  --border-subtle:    rgba(255, 255, 255, 0.06);
  --border-default:   rgba(255, 255, 255, 0.10);
  --border-strong:    rgba(255, 255, 255, 0.18);
  --border-focus:     rgba(110, 180, 255, 0.48);

  /* Text */
  --text-primary:     #ececf0;
  --text-secondary:   #9898a6;
  --text-tertiary:    #6a6a78;
  --text-inverse:     #141418;

  /* Accent - clinical blue (trustworthy, not flashy) */
  --accent-primary:   #6eb4ff;
  --accent-hover:     #8ec4ff;
  --accent-muted:     rgba(110, 180, 255, 0.12);
  --accent-subtle:    rgba(110, 180, 255, 0.06);

  /* Semantic */
  --match-exact:      #4ade80;   /* green-400 - matched view */
  --match-near:       #fbbf24;   /* amber-400 - close to view */
  --match-exploring:  #6a6a78;   /* gray - not near any view */
  --danger:           #f87171;   /* red-400 */
  --info:             #60a5fa;   /* blue-400 */

  /* Station colors (used in depth scrubber and anatomy labels) */
  --station-ue:       #a78bfa;   /* violet - upper esophageal */
  --station-me:       #6eb4ff;   /* blue - mid esophageal */
  --station-tg:       #34d399;   /* emerald - transgastric */
  --station-dtg:      #fbbf24;   /* amber - deep transgastric */

  /* Render surfaces */
  --canvas-bg:        #0a0a0e;
  --canvas-border:    rgba(255, 255, 255, 0.04);

  /* Shadows */
  --shadow-sm:        0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md:        0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg:        0 12px 40px rgba(0, 0, 0, 0.5);
  --shadow-overlay:   0 24px 80px rgba(0, 0, 0, 0.6);
}
```

#### Light theme (for classroom/office use)

```css
:root[data-theme="light"] {
  --bg-base:          #f4f4f6;
  --bg-surface:       #ffffff;
  --bg-elevated:      #ffffff;
  --bg-overlay:       rgba(255, 255, 255, 0.95);

  --border-subtle:    rgba(0, 0, 0, 0.04);
  --border-default:   rgba(0, 0, 0, 0.08);
  --border-strong:    rgba(0, 0, 0, 0.16);
  --border-focus:     rgba(37, 99, 235, 0.48);

  --text-primary:     #1a1a2e;
  --text-secondary:   #5a5a6e;
  --text-tertiary:    #9898a6;
  --text-inverse:     #ffffff;

  --accent-primary:   #2563eb;
  --accent-hover:     #3b82f6;
  --accent-muted:     rgba(37, 99, 235, 0.08);
  --accent-subtle:    rgba(37, 99, 235, 0.04);

  --match-exact:      #16a34a;
  --match-near:       #d97706;
  --match-exploring:  #9898a6;
  --danger:           #dc2626;
  --info:             #2563eb;

  --canvas-bg:        #e8e8ec;
  --canvas-border:    rgba(0, 0, 0, 0.06);

  --shadow-sm:        0 1px 2px rgba(0, 0, 0, 0.06);
  --shadow-md:        0 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-lg:        0 12px 40px rgba(0, 0, 0, 0.10);
  --shadow-overlay:   0 24px 80px rgba(0, 0, 0, 0.15);
}
```

### 2.2 Typography Scale

Replace IBM Plex Sans with **Inter** for UI text and **JetBrains Mono** for numeric readouts. Inter has superior optical sizing at small sizes (critical for labels), wide language support, and a medical-professional feel. JetBrains Mono provides tabular figures for values that change every frame.

```css
:root {
  --font-ui:        'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono:      'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;

  /* Type scale (modular scale ratio 1.2, base 14px) */
  --text-xs:        11px;     /* status badges, micro labels */
  --text-sm:        12px;     /* secondary labels, captions */
  --text-base:      14px;     /* body, controls, slider labels */
  --text-md:        16px;     /* pane titles, section headers */
  --text-lg:        20px;     /* panel headings */
  --text-xl:        24px;     /* overlay titles (unused in main UI) */

  /* Line heights */
  --leading-tight:  1.2;
  --leading-normal: 1.5;
  --leading-loose:  1.7;

  /* Font weights */
  --weight-regular: 400;
  --weight-medium:  500;
  --weight-semibold:600;

  /* Letter spacing */
  --tracking-tight: -0.01em;
  --tracking-normal: 0;
  --tracking-wide:   0.04em;
  --tracking-caps:   0.08em;   /* all-caps kickers */

  /* Numeric values (always monospace, tabular figures) */
  --text-value:     var(--text-base);
  --font-value:     var(--font-mono);
}
```

#### Typography usage map

| Element | Font | Size | Weight | Color | Tracking |
|---------|------|------|--------|-------|----------|
| App title (toolbar) | UI | md | semibold | primary | tight |
| Pane kicker (e.g., "PSEUDO-TEE") | UI | xs | medium | accent | caps |
| Pane title | UI | md | semibold | primary | tight |
| Slider label | UI | sm | medium | secondary | normal |
| Slider value | Mono | base | regular | primary | normal |
| Preset button label | UI | sm | medium | primary | normal |
| Preset button code | Mono | xs | regular | tertiary | normal |
| Match indicator name | UI | base | semibold | primary | tight |
| Match indicator score | Mono | sm | regular | secondary | normal |
| Status badge | UI | xs | medium | secondary | wide |
| Structure chip | UI | xs | medium | primary | normal |
| Anatomy 3D label | UI | xs | semibold | primary (on bg) | wide |

### 2.3 Spacing System (4px base grid)

```css
:root {
  --space-0:   0px;
  --space-1:   4px;
  --space-2:   8px;
  --space-3:   12px;
  --space-4:   16px;
  --space-5:   20px;
  --space-6:   24px;
  --space-8:   32px;
  --space-10:  40px;
  --space-12:  48px;
  --space-16:  64px;
}
```

Layout spacing rules:
- **Toolbar padding:** `0 var(--space-4)` (16px horizontal), 48px tall
- **Rail padding:** `var(--space-3)` (12px) all sides
- **Panel internal padding:** `var(--space-4)` (16px)
- **Gap between rail sections:** `var(--space-2)` (8px)
- **Slider row gap:** `var(--space-3)` (12px)
- **Render surface border-radius:** `var(--radius-md)` (12px)
- **Minimum touch target:** 44px (WCAG 2.5.8)

### 2.4 Border Radius System

```css
:root {
  --radius-xs:    4px;     /* chips, badges */
  --radius-sm:    6px;     /* small buttons, inputs */
  --radius-md:    12px;    /* cards, panels, render surfaces */
  --radius-lg:    16px;    /* overlay panels, modals */
  --radius-xl:    24px;    /* large floating panels */
  --radius-full:  9999px;  /* pills, circular controls */
}
```

Note: The current `--radius-panel: 22px` is too large and creates a bubbly toy-like impression. Reducing to 12px communicates precision without being harsh.

### 2.5 Component Designs

#### Buttons

Three tiers:

```css
/* Primary action (snap to view, load case) */
.btn-primary {
  height: 36px;
  padding: 0 var(--space-4);
  background: var(--accent-primary);
  color: var(--text-inverse);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  cursor: pointer;
  transition: background 100ms ease;
}
.btn-primary:hover {
  background: var(--accent-hover);
}

/* Secondary (toggle labels, settings) */
.btn-secondary {
  height: 36px;
  padding: 0 var(--space-4);
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  cursor: pointer;
  transition: border-color 100ms ease, color 100ms ease;
}
.btn-secondary:hover {
  border-color: var(--border-strong);
  color: var(--text-primary);
}

/* Ghost / icon-only (rail collapse, 3D camera reset) */
.btn-ghost {
  width: 36px;
  height: 36px;
  padding: 0;
  background: transparent;
  color: var(--text-tertiary);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 100ms ease, color 100ms ease;
}
.btn-ghost:hover {
  background: var(--accent-muted);
  color: var(--text-primary);
}
```

#### Sliders (range inputs)

Replace the default browser range with a custom-styled track:

```css
.slider-track {
  position: relative;
  height: 6px;
  background: var(--bg-elevated);
  border-radius: var(--radius-full);
  cursor: pointer;
}

.slider-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: var(--accent-primary);
  border-radius: var(--radius-full);
  transition: width 60ms ease-out;
}

.slider-thumb {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 18px;
  height: 18px;
  background: var(--text-primary);
  border: 2px solid var(--accent-primary);
  border-radius: var(--radius-full);
  cursor: grab;
  box-shadow: var(--shadow-sm);
  transition: box-shadow 100ms ease;
}

.slider-thumb:active {
  cursor: grabbing;
  box-shadow: 0 0 0 4px var(--accent-muted);
}
```

#### Cards / Panels

```css
.panel {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}

/* Render surface - darker than panel, subtle inner glow */
.render-surface {
  background: var(--canvas-bg);
  border: 1px solid var(--canvas-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  position: relative;
}
```

#### Preset buttons (view picker)

```css
.preset-chip {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: 40px;
  padding: 0 var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all 120ms ease;
}

.preset-chip[data-match="exact"] {
  border-color: var(--match-exact);
  background: rgba(74, 222, 128, 0.08);
  color: var(--match-exact);
}

.preset-chip[data-match="near"] {
  border-color: var(--match-near);
  background: rgba(251, 191, 36, 0.06);
  color: var(--match-near);
}

.preset-chip:hover {
  border-color: var(--border-strong);
  background: var(--accent-subtle);
}
```

### 2.6 Icon System

Use **Lucide** icons (open source, MIT, consistent 24px grid, 1.5px stroke). Lucide provides medical-context-appropriate metaphors and is already widely used in React ecosystems via `lucide-react`.

Key icons needed:

| Function | Icon | Size |
|----------|------|------|
| Collapse left rail | `PanelLeftClose` | 20px |
| Expand left rail | `PanelLeftOpen` | 20px |
| Collapse right rail | `PanelRightClose` | 20px |
| Settings | `Settings` | 20px |
| Help | `CircleHelp` | 20px |
| Reset camera | `RotateCcw` | 18px |
| Zoom in | `ZoomIn` | 18px |
| Zoom out | `ZoomOut` | 18px |
| Fullscreen | `Maximize2` | 18px |
| Theme toggle | `Sun` / `Moon` | 18px |
| Case selector | `FileHeart` | 18px |
| Match indicator | `CircleCheck` / `CircleDot` / `CircleDashed` | 16px |
| Probe position | `MoveVertical` | 16px |
| Omniplane angle | `RotateCw` | 16px |
| Keyboard shortcut hint | `Keyboard` | 14px |

---

## 3. Probe Control Redesign

### Current State Critique

Five horizontal `<input type="range">` sliders stacked vertically, each with a label and numeric value. Problems:

- **No spatial metaphor.** Ante/Retro and Lateral flex are orthogonal axes, but they appear as independent linear sliders. Users cannot develop spatial intuition for how combined flex affects the image.
- **Omniplane lacks rotational affordance.** Omniplane angle (0-180 degrees) is a rotation, but the slider is linear. The physical TEE probe has a rotary wheel.
- **Depth has no station context.** Position (s) is a number in millimeters with no indication of which anatomical station (UE/ME/TG/DTG) the probe is in.
- **Too many controls visible at once.** For a cardiology fellow in a 15-minute session, the cognitive load of five simultaneous sliders is high.

### Proposed: Tri-Control Cockpit

Replace five sliders with three purpose-built controls:

#### 3A. Depth Scrubber with Station Markers

A horizontal track with colored station zones. The user drags a handle along the track or clicks directly on a zone.

```
  UE          ME              TG          DTG
  [===|===============|===========|=======]
  0   80     ●118     180       260     320mm
              ↑ current position
```

Implementation:

```css
.depth-scrubber {
  position: relative;
  height: 40px;
  display: flex;
  align-items: center;
}

.depth-track {
  width: 100%;
  height: 8px;
  border-radius: var(--radius-full);
  overflow: hidden;
  display: flex;
  position: relative;
}

/* Each station zone is a colored segment */
.depth-zone {
  height: 100%;
  position: relative;
}
.depth-zone[data-station="UE"] { background: var(--station-ue); flex: 80; opacity: 0.3; }
.depth-zone[data-station="ME"] { background: var(--station-me); flex: 100; opacity: 0.3; }
.depth-zone[data-station="TG"] { background: var(--station-tg); flex: 80; opacity: 0.3; }
.depth-zone[data-station="DTG"]{ background: var(--station-dtg); flex: 60; opacity: 0.3; }

/* Active zone lights up */
.depth-zone[data-active="true"] { opacity: 0.7; }

.depth-thumb {
  position: absolute;
  top: 50%;
  width: 20px;
  height: 20px;
  background: var(--text-primary);
  border: 3px solid var(--accent-primary);
  border-radius: var(--radius-full);
  transform: translate(-50%, -50%);
  cursor: grab;
  z-index: 2;
  box-shadow: var(--shadow-md);
}

/* Station labels appear below the track */
.depth-labels {
  display: flex;
  justify-content: space-between;
  margin-top: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  font-family: var(--font-mono);
}

/* Preset snap points (small dots on the track) */
.depth-snap-marker {
  position: absolute;
  top: 50%;
  width: 6px;
  height: 6px;
  background: var(--text-primary);
  border-radius: var(--radius-full);
  transform: translate(-50%, -50%);
  opacity: 0.4;
  z-index: 1;
}
```

Station label overlays (e.g., "ME 118mm") appear as a floating tooltip above the thumb during drag.

#### 3B. Flexion Trackpad (Ante/Retro + Lateral)

A 2D touch/click-drag surface that maps to ante/retro (Y axis) and lateral (X axis) simultaneously. This mimics the physical sensation of flexing the probe tip.

```
         Ante (+90)
            ↑
            |
  Left  ----●---- Right
  (-90)     |     (+90)
            ↓
         Retro (-90)
```

Implementation:

```css
.flex-trackpad {
  position: relative;
  width: 120px;
  height: 120px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  cursor: crosshair;
  touch-action: none;     /* prevent scroll on touch drag */
  overflow: hidden;
}

/* Crosshair guides */
.flex-trackpad::before,
.flex-trackpad::after {
  content: '';
  position: absolute;
  background: var(--border-subtle);
}
.flex-trackpad::before {
  /* vertical center line */
  left: 50%;
  top: 8px;
  bottom: 8px;
  width: 1px;
}
.flex-trackpad::after {
  /* horizontal center line */
  top: 50%;
  left: 8px;
  right: 8px;
  height: 1px;
}

/* Range rings at 30deg and 60deg */
.flex-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-full);
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.flex-ring[data-deg="30"] {
  width: 40px;
  height: 40px;
}
.flex-ring[data-deg="60"] {
  width: 80px;
  height: 80px;
}

/* Position dot */
.flex-cursor {
  position: absolute;
  width: 14px;
  height: 14px;
  background: var(--accent-primary);
  border: 2px solid var(--text-primary);
  border-radius: var(--radius-full);
  transform: translate(-50%, -50%);
  pointer-events: none;
  box-shadow: 0 0 8px rgba(110, 180, 255, 0.3);
  transition: box-shadow 100ms ease;
}

/* Axis labels (small, outside the pad) */
.flex-label {
  position: absolute;
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  font-family: var(--font-ui);
  font-weight: var(--weight-medium);
  pointer-events: none;
}
.flex-label-top    { top: -16px;  left: 50%; transform: translateX(-50%); }
.flex-label-bottom { bottom: -16px; left: 50%; transform: translateX(-50%); }
.flex-label-left   { left: -28px; top: 50%; transform: translateY(-50%); }
.flex-label-right  { right: -28px; top: 50%; transform: translateY(-50%); }
```

Interaction: click and drag within the pad. The cursor position maps linearly to `[-90, +90]` on each axis. Double-click resets to center (0, 0). On touch devices, drag starts on first touch within the pad area.

#### 3C. Omniplane Rotary Dial

A circular control for omniplane angle (0-180 degrees). Mimics the physical rotary encoder on a TEE probe handle.

```
        0
      ╱   ╲
    ╱       ╲
   |    ●──── |  ← 38 degrees
    ╲       ╱
      ╲   ╱
       180
```

Implementation:

```css
.omni-dial {
  position: relative;
  width: 120px;
  height: 120px;
}

/* Outer track ring */
.omni-track {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--bg-elevated);
  border: 2px solid var(--border-default);
  position: relative;
  overflow: visible;
}

/* Filled arc from 0 to current angle */
/* Rendered as an SVG circle with stroke-dasharray */
.omni-arc {
  position: absolute;
  inset: -2px;
  fill: none;
  stroke: var(--accent-primary);
  stroke-width: 3;
  stroke-linecap: round;
  transform: rotate(-90deg);
  /* stroke-dasharray computed in JS based on angle */
}

/* Center readout */
.omni-value {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-family: var(--font-mono);
  font-size: var(--text-lg);
  font-weight: var(--weight-medium);
  color: var(--text-primary);
  pointer-events: none;
}

.omni-value::after {
  content: '°';
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  vertical-align: super;
}

/* Drag handle on the circumference */
.omni-handle {
  position: absolute;
  width: 16px;
  height: 16px;
  background: var(--text-primary);
  border: 2px solid var(--accent-primary);
  border-radius: var(--radius-full);
  transform: translate(-50%, -50%);
  cursor: grab;
  box-shadow: var(--shadow-sm);
}

/* Tick marks at 0, 30, 60, 90, 120, 150, 180 */
.omni-tick {
  position: absolute;
  width: 1px;
  height: 6px;
  background: var(--text-tertiary);
  transform-origin: center 60px;
  left: calc(50% - 0.5px);
  top: 0;
}
```

Interaction: click on the dial ring and drag clockwise/counterclockwise. Scroll wheel over the dial adjusts by 5-degree increments. The center displays the current angle in large monospace numerals.

#### 3D. Roll Slider (kept as linear)

Roll (-180 to +180) is a rotation around the probe's long axis. It remains a horizontal slider but with a refined visual:

```css
.roll-slider {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.roll-track {
  flex: 1;
  height: 6px;
  background: var(--bg-elevated);
  border-radius: var(--radius-full);
  position: relative;
}

.roll-center-mark {
  position: absolute;
  left: 50%;
  top: -3px;
  bottom: -3px;
  width: 1px;
  background: var(--border-strong);
}
```

#### 3E. Mini Probe Orientation Diagram

A 64x100px schematic diagram in the top-right of the control dock showing a simplified probe silhouette with current flex direction, roll angle, and omniplane fan overlaid. This is a real-time 2D projection of the probe state, rendered as SVG.

```
      ╷
      │  ← probe shaft
      │
      ◇────  ← tip with flex arrow
     /|\
    / | \    ← omniplane sector
```

The diagram updates at 30fps as controls are manipulated. It provides immediate proprioceptive feedback without requiring the user to look at the 3D pane.

#### Control Dock Layout (assembled)

```
+----------------------------------------------------+
| [    Depth scrubber with station zones    ] [  🔄  ]|
|  UE |===== ME ====●====|=== TG ===|= DTG |  Reset  |
+----------+---------+----------+--------------------+
| Flexion  | Omni    | Roll     | Mini Probe         |
| Trackpad | Dial    | Slider   | Diagram            |
| 120x120  | 120x120 |  ====    |  64x100            |
|  [Ante]  |  [38°]  | [-180..  |   ╷                |
|  [Late]  |         |   +180]  |   ◇                |
+----------+---------+----------+--------------------+
```

Total dock height when expanded: ~200px. When collapsed, only the depth scrubber row is visible (40px + 12px padding = 64px total), with the rest accessible via a "Show controls" toggle or simply by clicking the expansion handle.

---

## 4. View Match Feedback Redesign

### Current State Critique

The `ViewMatchIndicator` is a small text badge in the 3D pane header showing "Exploring / ME AV Short-Axis / 0% quality" or "Match / ME Four-Chamber / 100% quality". Problems:

- **Not visible during probe manipulation.** The user's eyes are on the 3D scene, not the header.
- **No spatial guidance.** A text percentage tells you "how far" but not "which direction."
- **Binary feel.** The three states (exploring/near/match) are too coarse. At 85% quality, the user has no idea which parameter to adjust.

### Proposed: Proximity Ring + Parameter Deviation Rosette

#### 4A. Proximity Ring (overlaid on 3D pane)

A thin circular ring at the top-center of the 3D viewport that fills as match quality increases. Think of it like a progress ring around a target reticle.

```
        ╭ ─ ─ ╮
      ╱  ME 4C  ╲       ← view label in center
     │   ◌ 87%   │      ← score
      ╲         ╱
        ╰ ─ ─ ╯
```

```css
.proximity-ring {
  position: absolute;
  top: var(--space-4);
  left: 50%;
  transform: translateX(-50%);
  width: 96px;
  height: 96px;
  z-index: 10;
  pointer-events: none;
}

.proximity-ring-bg {
  fill: none;
  stroke: var(--border-subtle);
  stroke-width: 3;
}

.proximity-ring-fill {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  transform: rotate(-90deg);
  transform-origin: center;
  transition: stroke-dashoffset 200ms ease-out, stroke 200ms ease;
}

.proximity-ring[data-status="match"]     .proximity-ring-fill { stroke: var(--match-exact); }
.proximity-ring[data-status="near"]      .proximity-ring-fill { stroke: var(--match-near); }
.proximity-ring[data-status="exploring"] .proximity-ring-fill { stroke: var(--match-exploring); }

.proximity-label {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  text-align: center;
}

.proximity-view-name {
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
  line-height: var(--leading-tight);
}

.proximity-score {
  font-family: var(--font-mono);
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
}
```

#### 4B. Parameter Deviation Rosette (in expanded dock)

When the user is "near" a view (score 50-99%), show a five-petal rosette diagram indicating which DOF parameters need adjustment. Each petal represents one of the five probe parameters. The petal length indicates how far off that parameter is from the target.

```
           s (depth)
             ╷
             |
  roll ──────●────── ante
             |
             ╷
         omniplane
             |
           lateral
```

Each axis extends outward proportionally to the absolute deviation. All petals collapse to zero when the view is perfectly matched.

```css
.deviation-rosette {
  width: 80px;
  height: 80px;
  position: relative;
}

.rosette-axis {
  position: absolute;
  bottom: 50%;
  left: calc(50% - 1px);
  width: 2px;
  transform-origin: bottom center;
  background: var(--accent-primary);
  border-radius: var(--radius-full);
  opacity: 0.6;
  transition: height 200ms ease-out;
}

.rosette-axis[data-param="s"]          { transform: rotate(0deg); }
.rosette-axis[data-param="roll"]       { transform: rotate(72deg); }
.rosette-axis[data-param="ante"]       { transform: rotate(144deg); }
.rosette-axis[data-param="lateral"]    { transform: rotate(216deg); }
.rosette-axis[data-param="omniplane"]  { transform: rotate(288deg); }

/* When deviation is large, axis glows warm */
.rosette-axis[data-severity="high"]    { background: var(--match-near); opacity: 0.9; }
.rosette-axis[data-severity="medium"]  { background: var(--accent-primary); opacity: 0.7; }
.rosette-axis[data-severity="low"]     { background: var(--match-exact); opacity: 0.4; }
```

#### 4C. Snap Feedback Animation

When the user reaches a match (score >= 95%), play a brief celebration:

1. The proximity ring flashes green and pulses once (scale 1.0 -> 1.08 -> 1.0 over 300ms)
2. The matched preset button in the view picker gains a brief shimmer
3. A subtle haptic pulse fires on devices that support it (`navigator.vibrate(50)`)

```css
@keyframes match-pulse {
  0%   { transform: translateX(-50%) scale(1);    opacity: 1; }
  50%  { transform: translateX(-50%) scale(1.08); opacity: 0.9; }
  100% { transform: translateX(-50%) scale(1);    opacity: 1; }
}

.proximity-ring[data-just-matched="true"] {
  animation: match-pulse 300ms ease-out;
}
```

---

## 5. 3D Pane Improvements

### 5A. Camera Controls Toolbar

A floating toolbar at the bottom-left of the 3D viewport:

```
+-------+-------+-------+-------+
|  🔄   |  🔍+  |  🔍-  |  ⬜   |
| Reset | Zoom+ | Zoom- | Full  |
+-------+-------+-------+-------+
```

```css
.scene-toolbar {
  position: absolute;
  bottom: var(--space-3);
  left: var(--space-3);
  display: flex;
  gap: 2px;
  background: var(--bg-overlay);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: 2px;
  z-index: 10;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.scene-toolbar .btn-ghost {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-xs);
}
```

Buttons:
- **Reset camera:** Returns to default azimuth/elevation
- **Zoom in/out:** Programmatic zoom (for users unfamiliar with scroll-to-zoom)
- **Fullscreen:** Collapses both rails and hides the toolbar, making the 3D pane fill the entire viewport. Press Esc or the same button to restore.

### 5B. Structure Highlighting

When the user hovers over a structure chip (in the right rail), the corresponding mesh in the 3D scene highlights:

- **Highlighted mesh:** Increase opacity to 1.0, apply a subtle emissive color tint (blue outline glow via post-processing or by duplicating the mesh with an additive shader)
- **Non-highlighted meshes:** Reduce opacity to 0.3
- **Label appears:** A floating label in 3D space positioned at the centroid of the highlighted mesh

Implementation approach: The VTK.js actor system supports per-actor opacity. On hover, update the opacity of all actors except the target.

### 5C. Anatomy Labels in 3D

When `labelsVisible` is true, display floating labels in 3D space anchored to structure centroids. Labels should:

- Use `--text-xs` size, `--weight-semibold`
- Have a semi-transparent dark background pill (`--bg-overlay` with `backdrop-filter: blur(4px)`)
- Include a thin line connecting the label to the structure surface
- Auto-hide when the structure is occluded (raycasting test)
- Fade opacity based on distance from camera (closer = more opaque)

```css
.anatomy-label {
  position: absolute;
  pointer-events: none;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.anatomy-label-text {
  padding: 2px 6px;
  background: var(--bg-overlay);
  border-radius: var(--radius-xs);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
  white-space: nowrap;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  border: 1px solid var(--border-subtle);
}

.anatomy-label-line {
  width: 1px;
  height: 12px;
  background: var(--border-strong);
}
```

### 5D. Imaging Plane Visualization

The current sector plane in 3D is a flat polygon. Enhance it:

- Show the sector as a semi-transparent fan with a subtle gradient from the probe tip to the far edge
- Add a pulsing glow at the probe tip origin to indicate the imaging source
- Color the fan edges to match the omniplane angle indicator on the dial

---

## 6. Responsive Strategy

### Breakpoints

```css
/* Tokens */
--bp-desktop:  1280px;   /* Full 3-column layout */
--bp-tablet:   768px;    /* 2-column or stacked */
--bp-mobile:   480px;    /* Single column, minimal controls */
```

### Desktop (>= 1280px): Full Layout

Three columns: left rail (280px) + center stage (fluid) + right rail (280px). All controls visible. Probe dock expanded by default.

### Tablet (768px - 1279px): Collapsed Rails

```css
@media (max-width: 1279px) {
  .app-layout {
    grid-template-columns: 1fr;
    grid-template-rows: var(--toolbar-height) 1fr auto;
  }

  .rail-left, .rail-right {
    display: none;
  }

  .rail-left[data-visible="true"],
  .rail-right[data-visible="true"] {
    display: block;
    position: fixed;
    top: var(--toolbar-height);
    bottom: 0;
    width: 320px;
    z-index: 20;
    background: var(--bg-surface);
    border-right: 1px solid var(--border-default);
    box-shadow: var(--shadow-lg);
    overflow-y: auto;
  }

  .rail-right[data-visible="true"] {
    right: 0;
    left: auto;
    border-right: none;
    border-left: 1px solid var(--border-default);
  }
}
```

Rails become slide-over drawers. The toolbar gains two toggle buttons (left rail, right rail). The 3D scene takes the full width.

Probe controls remain docked at the bottom of the center stage. The depth scrubber takes full width. Flexion trackpad, omniplane dial, and roll slider arrange in a row beneath it.

### Mobile (< 768px): Single Pane + Bottom Sheet

```css
@media (max-width: 767px) {
  .app-layout {
    grid-template-columns: 1fr;
    grid-template-rows: var(--toolbar-height) 1fr;
  }

  .center-stage {
    grid-template-rows: 1fr;
  }

  .probe-dock {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--bg-surface);
    border-top: 1px solid var(--border-default);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    box-shadow: var(--shadow-overlay);
    z-index: 20;
    padding: var(--space-3);
    transform: translateY(calc(100% - 56px));
    transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
  }

  .probe-dock[data-expanded="true"] {
    transform: translateY(0);
  }

  .probe-dock-handle {
    width: 36px;
    height: 4px;
    background: var(--border-strong);
    border-radius: var(--radius-full);
    margin: 0 auto var(--space-3);
  }
}
```

On mobile:
- Only the 3D pane is visible by default
- The probe controls live in a bottom sheet that peeks 56px (showing just the depth scrubber summary and a drag handle)
- Swipe up to reveal full controls
- Pseudo-TEE and oblique views are accessible via a bottom tab bar or swipe gesture
- View presets are in a floating action menu (hold the "Views" button to fan out preset chips)
- The proximity ring shrinks to 64px diameter

### Mobile Control Simplification

On viewports below 768px, the flexion trackpad and omniplane dial are replaced by compact sliders to save space:

```css
@media (max-width: 767px) {
  .flex-trackpad,
  .omni-dial {
    display: none;
  }

  .mobile-slider-fallback {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
}
```

The compact sliders use the same refined styling but are horizontal and stacked. Users who need the trackpad/dial on mobile can rotate to landscape, where the full controls appear.

### Landscape Mobile (< 768px height, > 768px width)

```css
@media (max-height: 600px) and (orientation: landscape) {
  .probe-dock {
    position: fixed;
    right: 0;
    top: var(--toolbar-height);
    bottom: 0;
    left: auto;
    width: 280px;
    transform: translateX(calc(100% - 56px));
    border-top: none;
    border-left: 1px solid var(--border-default);
    border-radius: 0;
  }

  .probe-dock[data-expanded="true"] {
    transform: translateX(0);
  }
}
```

---

## 7. Animation and Transitions

### Guiding Principles

- **Performance:** All animations use `transform` and `opacity` only (compositor-thread properties). No layout-triggering properties.
- **Duration:** Micro-interactions (hover, focus) at 100ms. State transitions (panel open/close) at 200-300ms. Probe snap animations at 400ms.
- **Easing:** Use `cubic-bezier(0.32, 0.72, 0, 1)` (Apple-style spring approximation) for panels. Use `ease-out` for controls.
- **Respect reduced motion:** All animations disabled under `prefers-reduced-motion: reduce`.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### What Should Animate

| Element | Trigger | Animation | Duration | Easing |
|---------|---------|-----------|----------|--------|
| Rail collapse/expand | Click toggle | Width slides from 280px to 48px, content cross-fades | 250ms | spring |
| Probe dock expand/collapse | Click handle or swipe | Height/transform slides | 300ms | spring |
| Probe snap to preset | Click preset button | All five DOF values interpolate linearly to target | 400ms | ease-out |
| Proximity ring score | Probe movement | `stroke-dashoffset` interpolates | 200ms | ease-out |
| Proximity ring match pulse | Score crosses 95% threshold | Scale pulse (1.0 -> 1.08 -> 1.0) | 300ms | ease-out |
| View picker overlay | Open/close | Fade + scale (0.95 -> 1.0) | 200ms | spring |
| Button hover | Mouse enter | Background color, border color | 100ms | ease |
| Slider thumb active | Pointer down | Box shadow ring appears | 100ms | ease |
| Flexion trackpad cursor | Drag | Position (no transition -- immediate response) | 0ms | -- |
| Omniplane dial handle | Drag | Position (no transition -- immediate response) | 0ms | -- |
| Depth thumb drag | Drag | Position (no transition -- immediate response) | 0ms | -- |
| Theme switch | Toggle | Background/text colors cross-fade | 300ms | ease |
| Anatomy label appear | Labels toggled on | Fade in + slight translateY (-4px -> 0) | 200ms | ease-out |
| Structure highlight | Hover on chip | Opacity change on non-target meshes | 150ms | ease |
| Mobile bottom sheet | Swipe gesture | Transform follows finger, settles with spring | varies | spring |
| Loading state | Case loading | Skeleton shimmer pulse on render surfaces | 1500ms loop | ease-in-out |

### Probe Snap Animation (detail)

When the user clicks a preset button (e.g., "ME 4C"), all five probe parameters animate from their current values to the preset values over 400ms. This is done in JavaScript by interpolating the Zustand store values using `requestAnimationFrame`:

```typescript
function animateSnapToView(
  from: ProbePose,
  to: ProbePose,
  duration: number,
  setProbe: (patch: Partial<ProbePose>) => void,
) {
  const start = performance.now();

  function tick(now: number) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic

    setProbe({
      sMm: from.sMm + (to.sMm - from.sMm) * eased,
      rollDeg: from.rollDeg + (to.rollDeg - from.rollDeg) * eased,
      anteDeg: from.anteDeg + (to.anteDeg - from.anteDeg) * eased,
      lateralDeg: from.lateralDeg + (to.lateralDeg - from.lateralDeg) * eased,
      omniplaneDeg: from.omniplaneDeg + (to.omniplaneDeg - from.omniplaneDeg) * eased,
    });

    if (t < 1) {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
}
```

During the snap animation, the 3D pane smoothly sweeps through all intermediate probe positions, giving the user a visceral sense of how the anatomy transforms between views. This is a high-value learning moment.

---

## 8. Reference Comparison

### Current State

There is no reference image comparison. The user sees only the simulator output and must judge correctness from memory or a textbook.

### Proposed: Split-Screen Reference Overlay

#### 8A. Reference Image Panel

Each `ViewPreset` gains an optional `referenceImageUrl` field pointing to a canonical TEE image for that view. When the user is "near" or "matched" to a preset, the right rail can display the reference:

```
+---------------------------+
|  REFERENCE: ME 4C         |
|  [canonical TEE image]    |
|                           |
|  YOUR VIEW                |
|  [current pseudo-TEE]     |
|                           |
|  Tip: Adjust omniplane    |
|  to better align the      |
|  mitral valve annulus.     |
+---------------------------+
```

#### 8B. Swipe Comparison

On the pseudo-TEE pane, overlay the reference image at 50% opacity with a draggable vertical divider:

```
+---------|----------+
| Ref img | Your img |
|    ← drag bar →    |
+---------|----------+
```

```css
.comparison-container {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-md);
}

.comparison-reference {
  position: absolute;
  inset: 0;
  object-fit: cover;
  clip-path: inset(0 var(--compare-clip-right, 50%) 0 0);
  pointer-events: none;
}

.comparison-divider {
  position: absolute;
  top: 0;
  bottom: 0;
  left: var(--compare-position, 50%);
  width: 3px;
  background: var(--text-primary);
  cursor: ew-resize;
  z-index: 5;
}

.comparison-divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  background: var(--bg-overlay);
  border: 2px solid var(--text-primary);
}

/* Left/right arrows inside the handle */
.comparison-divider::after {
  content: '⟨ ⟩';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: var(--text-xs);
  color: var(--text-primary);
  letter-spacing: 4px;
}
```

#### 8C. Labeled Anatomy Overlay on Reference

Each reference image can include annotation data (JSON) mapping anatomical structures to pixel coordinates. When "Show labels" is active, small labeled markers appear on the reference image:

```json
{
  "viewId": "me-4c",
  "annotations": [
    { "label": "LV", "x": 0.45, "y": 0.55 },
    { "label": "RV", "x": 0.65, "y": 0.35 },
    { "label": "LA", "x": 0.40, "y": 0.25 },
    { "label": "RA", "x": 0.70, "y": 0.20 },
    { "label": "MV", "x": 0.48, "y": 0.40 },
    { "label": "TV", "x": 0.62, "y": 0.30 }
  ]
}
```

These render as small circular markers with a label on hover, matching the same `anatomy-label` styling used in the 3D pane.

---

## 9. Complete CSS Token Proposal

Consolidating all tokens from the above sections into a single replacement for the current `tokens.css`:

```css
/* ===== TeeSim Design Tokens v2 ===== */

:root {
  /* --- Scale --- */
  --space-0:   0px;
  --space-1:   4px;
  --space-2:   8px;
  --space-3:   12px;
  --space-4:   16px;
  --space-5:   20px;
  --space-6:   24px;
  --space-8:   32px;
  --space-10:  40px;
  --space-12:  48px;
  --space-16:  64px;

  /* --- Radius --- */
  --radius-xs:    4px;
  --radius-sm:    6px;
  --radius-md:    12px;
  --radius-lg:    16px;
  --radius-xl:    24px;
  --radius-full:  9999px;

  /* --- Typography --- */
  --font-ui:        'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono:      'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;

  --text-xs:        11px;
  --text-sm:        12px;
  --text-base:      14px;
  --text-md:        16px;
  --text-lg:        20px;
  --text-xl:        24px;

  --leading-tight:  1.2;
  --leading-normal: 1.5;
  --leading-loose:  1.7;

  --weight-regular:  400;
  --weight-medium:   500;
  --weight-semibold: 600;

  --tracking-tight:  -0.01em;
  --tracking-normal:  0;
  --tracking-wide:    0.04em;
  --tracking-caps:    0.08em;

  /* --- Layout --- */
  --toolbar-height:  48px;
  --rail-width:      280px;
  --rail-collapsed:  48px;
  --dock-collapsed:  64px;
  --dock-expanded:   200px;

  /* --- Timing --- */
  --duration-fast:    100ms;
  --duration-normal:  200ms;
  --duration-slow:    300ms;
  --duration-snap:    400ms;

  --ease-default:     ease;
  --ease-out:         ease-out;
  --ease-spring:      cubic-bezier(0.32, 0.72, 0, 1);

  /* --- Station Colors (theme-independent) --- */
  --station-ue:       #a78bfa;
  --station-me:       #6eb4ff;
  --station-tg:       #34d399;
  --station-dtg:      #fbbf24;

  /* --- Z-index --- */
  --z-base:       0;
  --z-elevated:   1;
  --z-overlay:    10;
  --z-drawer:     20;
  --z-modal:      30;
  --z-toast:      40;
}

/* Dark theme (default) */
:root,
:root[data-theme="dark"] {
  --bg-base:          #141418;
  --bg-surface:       #1c1c22;
  --bg-elevated:      #242430;
  --bg-overlay:       rgba(20, 20, 24, 0.92);

  --border-subtle:    rgba(255, 255, 255, 0.06);
  --border-default:   rgba(255, 255, 255, 0.10);
  --border-strong:    rgba(255, 255, 255, 0.18);
  --border-focus:     rgba(110, 180, 255, 0.48);

  --text-primary:     #ececf0;
  --text-secondary:   #9898a6;
  --text-tertiary:    #6a6a78;
  --text-inverse:     #141418;

  --accent-primary:   #6eb4ff;
  --accent-hover:     #8ec4ff;
  --accent-muted:     rgba(110, 180, 255, 0.12);
  --accent-subtle:    rgba(110, 180, 255, 0.06);

  --match-exact:      #4ade80;
  --match-near:       #fbbf24;
  --match-exploring:  #6a6a78;
  --danger:           #f87171;
  --info:             #60a5fa;

  --canvas-bg:        #0a0a0e;
  --canvas-border:    rgba(255, 255, 255, 0.04);

  --shadow-sm:        0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md:        0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg:        0 12px 40px rgba(0, 0, 0, 0.5);
  --shadow-overlay:   0 24px 80px rgba(0, 0, 0, 0.6);
}

/* Light theme */
:root[data-theme="light"] {
  --bg-base:          #f4f4f6;
  --bg-surface:       #ffffff;
  --bg-elevated:      #ffffff;
  --bg-overlay:       rgba(255, 255, 255, 0.95);

  --border-subtle:    rgba(0, 0, 0, 0.04);
  --border-default:   rgba(0, 0, 0, 0.08);
  --border-strong:    rgba(0, 0, 0, 0.16);
  --border-focus:     rgba(37, 99, 235, 0.48);

  --text-primary:     #1a1a2e;
  --text-secondary:   #5a5a6e;
  --text-tertiary:    #9898a6;
  --text-inverse:     #ffffff;

  --accent-primary:   #2563eb;
  --accent-hover:     #3b82f6;
  --accent-muted:     rgba(37, 99, 235, 0.08);
  --accent-subtle:    rgba(37, 99, 235, 0.04);

  --match-exact:      #16a34a;
  --match-near:       #d97706;
  --match-exploring:  #9898a6;
  --danger:           #dc2626;
  --info:             #2563eb;

  --canvas-bg:        #e8e8ec;
  --canvas-border:    rgba(0, 0, 0, 0.06);

  --shadow-sm:        0 1px 2px rgba(0, 0, 0, 0.06);
  --shadow-md:        0 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-lg:        0 12px 40px rgba(0, 0, 0, 0.10);
  --shadow-overlay:   0 24px 80px rgba(0, 0, 0, 0.15);
}
```

---

## 10. Implementation Priorities

### Phase 1 - Foundation (1-2 weeks)

1. Replace `tokens.css` with the new token system
2. Implement the new layout architecture (toolbar + center-stage + collapsible rails)
3. Strip the header block, move case selector to toolbar
4. Restyle all panels, buttons, and text to the new design language
5. Add Inter and JetBrains Mono font loading

### Phase 2 - Controls (2-3 weeks)

6. Build the depth scrubber with station markers
7. Build the 2D flexion trackpad
8. Build the omniplane rotary dial
9. Build the mini probe orientation diagram
10. Implement the collapsible dock with expand/collapse animation

### Phase 3 - Feedback (1-2 weeks)

11. Implement the proximity ring overlay on the 3D pane
12. Build the parameter deviation rosette
13. Add probe snap animation (rAF interpolation)
14. Add match pulse celebration

### Phase 4 - Polish (2-3 weeks)

15. Implement responsive breakpoints (tablet drawer, mobile bottom sheet)
16. Add the 3D camera toolbar (reset, zoom, fullscreen)
17. Add structure highlighting on hover
18. Add anatomy labels in 3D
19. Implement theme toggle (dark/light)
20. Add `prefers-reduced-motion` support

### Phase 5 - Reference (1-2 weeks)

21. Add reference image panel in right rail
22. Build swipe comparison on pseudo-TEE pane
23. Add anatomy annotation overlays on reference images
24. Source and curate reference images for all 8 standard views

---

## 11. Persona Alignment Check

| Design decision | Cardiology Fellow | Anesthesia Resident | Attending / Instructor | Educator |
|----------------|-------------------|--------------------|-----------------------|----------|
| Immersive center-stage layout | Faster view finding in 15-min sessions | More anatomy context for learning | Large-screen projection friendly | Clean presentation |
| 2D trackpad for flexion | Builds muscle memory (mimics real probe) | Intuitive for beginners | Good for demos | Reduces complexity |
| Proximity ring + deviation rosette | Real-time "am I close?" feedback | Guided correction | Shows students what correct looks like | Assessable metric |
| Depth scrubber with stations | Quick station navigation | Anatomical context for depth | One-click jump to any station | Curriculum-alignable |
| Reference comparison | Self-assessment against gold standard | Side-by-side learning | Teaching tool in didactics | Built-in assessment |
| Mobile bottom sheet | Study on commute | Quick review on phone | Not primary use case | Trainee accessibility |
| Keyboard shortcuts (1-8 for presets) | Speed in repeated practice | Not critical | Fast demo switching | Exercise design |

---

## Appendix A: Design Rationale for Color Shift

The current palette (`#07111f` navy base, `#79c9d0` teal accent) has two problems:

1. **Navy backgrounds create eye strain under prolonged use.** Medical professionals using the tool in dark rooms (ORs, echo labs) need a neutral dark background. Pure blue-shifted backgrounds cause chromatic aberration at the retinal periphery and are known to cause more fatigue than warm-neutral darks. The proposed `#141418` is nearly achromatic with a very slight warm shift.

2. **Teal accent lacks hierarchy.** The current design uses `#79c9d0` for kicker text, slider accents, border highlights, and structure chips. Everything glows the same teal. The proposed system uses `#6eb4ff` (clinical blue) as the sole accent, with semantic colors (green/amber/gray) for match states and station-specific colors for the depth scrubber. This creates clear visual priority.

## Appendix B: Accessibility Notes

- All text meets WCAG 2.1 AA contrast ratios against its background (4.5:1 for body text, 3:1 for large text)
- The dark theme `--text-primary: #ececf0` on `--bg-base: #141418` achieves 14.8:1 contrast
- The dark theme `--text-secondary: #9898a6` on `--bg-base: #141418` achieves 6.7:1 contrast
- All interactive elements have visible focus indicators (`outline: 2px solid var(--border-focus); outline-offset: 2px`)
- The proximity ring uses both color AND a numeric percentage, not color alone
- The flexion trackpad and omniplane dial have keyboard alternatives (arrow keys adjust by step increments)
- Match states use both color and text labels ("Match" / "Near" / "Exploring")
- All animations respect `prefers-reduced-motion: reduce`
- Touch targets meet 44px minimum on mobile
