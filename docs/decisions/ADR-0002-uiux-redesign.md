# ADR-0002: UI/UX Redesign

**Date:** 2026-04-06
**Status:** Proposed
**Synthesized from:** 4 independent UI/UX proposals (Opus education, Opus visual, Codex engineering, Gemini general) + user requirements

---

## Context

The current TeeSim MVP UI is functional but has critical UX problems:

1. **Header + status bar consume ~20% of vertical space** — technical info (bundle version, asset loading) is useless during simulation
2. **5 stacked sliders are unintuitive** — they don't match the mental model of TEE probe manipulation
3. **3-pane split wastes space** — all panes get equal weight, but the pseudo-TEE is the primary learning surface
4. **Looks like a developer tool** — dark theme with debug info, not a clinical education product
5. **Mobile/tablet are broken** — content overflows, controls take too much space
6. **No learning guidance** — no indication of *how* to reach a target view

**Target users:**
- Residents learning TEE for the first time
- Anesthesiologists / cardiologists with some TEE experience

**Design goals:** Simple, intuitive, clinically grounded, visually polished.

---

## Decision

### 1. Layout: Simulation-First, Two-Zone Architecture

Replace the current header-heavy 3-column grid with a **two-zone layout**: a dominant **simulation stage** and a compact **control dock**.

```
Desktop (≥1180px):
┌─────────────────────────────────────────────────────────┐
│ ┌ TopBar ─────────────────────────────────────────────┐ │
│ │ TeeSim   Case: LCTSC S1-006 ▾    ME · 97mm · 0°    │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │                 SIMULATION STAGE                     │ │
│ │  ┌──────────┐  ┌──────────────────┐  ┌──────────┐  │ │
│ │  │ Pseudo-  │  │                  │  │ Oblique  │  │ │
│ │  │ TEE      │  │   3D Anatomy     │  │ Slice    │  │ │
│ │  │ (Echo)   │  │   (probe+scene)  │  │          │  │ │
│ │  │          │  │                  │  │          │  │ │
│ │  │  25%     │  │      50%         │  │   25%    │  │ │
│ │  └──────────┘  └──────────────────┘  └──────────┘  │ │
│ │  [View Match Badge overlaid on 3D pane top-right]   │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ CONTROL DOCK (compact, max 160px height)             │ │
│ │ ┌──────────┐ ┌────────┐ ┌─────┐ ┌────────────────┐ │ │
│ │ │ Depth    │ │ Flex   │ │Omni │ │  View Presets   │ │ │
│ │ │ Scrubber │ │ Pad    │ │Dial │ │  [8 buttons]    │ │ │
│ │ │ UE ME TG │ │  ·     │ │ ◠   │ │                 │ │ │
│ │ │ ──●───── │ │        │ │     │ │  Roll: ──●──    │ │ │
│ │ └──────────┘ └────────┘ └─────┘ └────────────────┘ │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘

Tablet (768-1179px):
┌──────────────────────────────┐
│ TopBar (1 line)              │
│ ┌──────────┐ ┌─────────────┐│
│ │ Pseudo-  │ │ 3D Anatomy  ││
│ │ TEE      │ │             ││
│ │  40%     │ │    60%      ││
│ └──────────┘ └─────────────┘│
│ [Oblique: swipe-tab]        │
│ ┌──────────────────────────┐│
│ │ Control Dock (bottom)    ││
│ └──────────────────────────┘│
└──────────────────────────────┘

Mobile (<768px):
┌──────────────────┐
│ TopBar (minimal) │
│ ┌──────────────┐ │
│ │  Pseudo-TEE  │ │
│ │  (Hero, 60%) │ │
│ └──────────────┘ │
│ ┌──────────────┐ │
│ │  3D (mini)   │ │
│ └──────────────┘ │
│ [Bottom Sheet]   │
│ Controls/Presets │
└──────────────────┘
```

**Key change:** TopBar is 1 line (48px). Status strip removed. Simulation stage gets ~80% of viewport.

### 2. TopBar: Minimal, Clinical

```
┌────────────────────────────────────────────────────────┐
│ ⬡ TeeSim    Case: LCTSC S1-006 ▾    ME · 97mm · 0°  │
└────────────────────────────────────────────────────────┘
```

- Left: logo + product name (small)
- Center: case selector (dropdown)
- Right: current station + depth + omniplane angle (live, monospace)
- No description text, no bundle version, no asset loading status
- Info button (ⓘ) opens a drawer with technical details if needed

### 3. Probe Controls: Match the Physical Probe

Replace 5 stacked sliders with 4 distinct control widgets that mirror the real probe's manipulation model:

#### 3a. Depth Scrubber (horizontal rail)

```
  UE        ME          TG       DTG
  ├─────────┼───────────┼────────┤
            ●━━━━━━━━━━━○
          97mm
```

- Full-width horizontal rail with station markers
- Preset positions shown as dots on the rail
- Drag or arrow keys for fine control
- Click station label to jump to center of that zone
- Current station highlighted

#### 3b. Flex Pad (2D trackpad, 120×120px)

```
      Ante (+)
        ↑
  Left ← · → Right
        ↓
      Retro (-)
```

- Square touchpad: X = lateral, Y = ante/retro
- Crosshair shows current position
- Center snap on double-click
- Light grid lines at ±30° and ±60°
- Subtle probe-tip icon showing bend direction

#### 3c. Omniplane Dial (semicircular, 120×80px)

```
    0°   45°  90°  135°  180°
     ╲    |    |    |    ╱
      ╲   |    |   ╱
       ╲  |   ╱
        ● ← drag along arc
```

- 180° arc with tick marks at 0°, 45°, 90°, 135°, 180°
- Drag along arc to set angle
- View preset angles shown as small dots on the arc
- Current angle displayed in center

#### 3d. Roll (compact horizontal slider)

```
Roll: ──────●────── 0°
```

- Single compact slider, less prominent than others
- Most views use roll ≈ 0°, so it's secondary

### 4. View Match: Proximity Guidance

Replace the static text badge with a **multi-signal feedback system**:

#### 4a. Match Badge (overlaid on 3D pane, top-right corner)

```
┌─────────────────────┐
│ ● ME Four-Chamber   │  ← green dot when match
│   98% alignment     │
└─────────────────────┘
```

- Green background pulse when ≥85% (Match)
- Amber when 60-84% (Near) — shows nearest view name
- Hidden when <60% (Exploring) — just show "Exploring"
- "alignment" not "quality" (per engineering review)

#### 4b. Directional Hints (when Near, optional toggle)

When within 60-84% of a view, show subtle text hints:

```
→ Omniplane +12°     (arrow pointing toward correct direction)
↓ Withdraw 5mm       (arrow for depth)
```

- Only shown when explicitly in "Guided" mode (toggle in TopBar)
- Not shown in free-explore mode by default

#### 4c. Preset Button Feedback

```
┌─────────────┐  ┌─────────────┐
│ ME 4C    ●  │  │ ME 2C       │  ← green dot on matched preset
│ matched     │  │             │
└─────────────┘  └─────────────┘
```

### 5. Visual Design: Clinical Dark Theme

**Not** developer dark. **Clinical dark** — inspired by modern echo machine UIs (GE Vivid, Philips EPIQ).

#### Color Palette

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#0a0f18` | App background |
| `--surface` | `#111927` | Panel backgrounds |
| `--surface-elevated` | `#1a2538` | Cards, controls |
| `--border` | `rgba(100, 160, 200, 0.15)` | Subtle borders |
| `--text` | `#e4edf5` | Primary text |
| `--text-muted` | `#8a9bb0` | Secondary text |
| `--accent` | `#4dc9f6` | Interactive elements, links |
| `--match` | `#34d399` | Green match state |
| `--near` | `#fbbf24` | Amber near state |
| `--exploring` | `#6b7280` | Gray exploring state |

#### Typography

- **Font:** Inter (clean, medical-grade readability) or IBM Plex Sans
- **Values/numbers:** JetBrains Mono (monospace, prevents layout jitter)
- **Scale:** 11px labels, 13px body, 16px headings, 20px page title
- **Weight:** 400 body, 500 labels, 600 headings

#### Spacing

- 4px base grid
- 8px small gap, 12px medium, 16px large
- Panel padding: 12px
- Panel border-radius: 12px (softer than current 22px)
- Subtle `backdrop-filter: blur(12px)` on control dock for glassmorphism effect

### 6. Pseudo-TEE Pane Improvements

The pseudo-TEE is the **primary learning surface**. Make it feel clinical:

- **Sector frame:** thin white arc outline around the fan shape (like real echo monitors)
- **Depth markers:** tick marks along the sector sides showing depth in cm
- **Orientation markers:** A/P/L/R letters at sector edges
- **CT-derived disclaimer:** small italic text at bottom: "Anatomy-derived • Not diagnostic"
- **Dark surround:** area outside the sector is pure black (not gray)

### 7. Responsive Strategy

| Viewport | Layout | Controls |
|----------|--------|----------|
| ≥1180px | 3-pane side-by-side + bottom dock | Full controls visible |
| 768-1179px | 2-pane (pseudo-TEE + 3D) + tab for oblique | Bottom sheet, collapsible |
| <768px | Single hero (pseudo-TEE) + mini 3D below | Bottom sheet with tabs: Controls / Presets |

- Use `100dvh` not `100vh`
- Landscape prompt on mobile
- Touch targets ≥44px for all controls

### 8. Keyboard Shortcuts (unchanged from current)

| Key | Action |
|-----|--------|
| `1-8` | Jump to view presets |
| `↑/↓` | Advance/withdraw probe |
| `W/S` | Ante/retro flex |
| `A/D` | Lateral flex |
| `Q/E` | Roll |
| `[/]` | Omniplane |
| `R` | Reset flex to neutral |
| `Space` | Toggle guided mode |

### 9. Onboarding (Phase 1.5, not MVP)

First-run experience for residents:
1. Welcome overlay: "Welcome to TeeSim. Let's find your first standard view."
2. Highlight the depth scrubber: "This controls probe depth in the esophagus."
3. Highlight the flex pad: "Drag to bend the probe tip."
4. Guided task: "Find ME Four-Chamber. Follow the green indicators."
5. Success celebration on first match.

---

## Implementation Priority

| Priority | Change | Effort |
|----------|--------|--------|
| **P0** | Collapse header to 1-line TopBar, remove status strip | S |
| **P0** | Replace 5 sliders with Depth Scrubber + Flex Pad + Omniplane Dial + Roll slider | L |
| **P0** | Pane ratio 25/50/25, reduce padding, maximize render area | S |
| **P1** | View match badge as 3D pane overlay (not header block) | S |
| **P1** | Pseudo-TEE: sector frame, depth markers, orientation labels | M |
| **P1** | New color tokens + typography (Inter + JetBrains Mono) | M |
| **P1** | Responsive tablet/mobile layouts | M |
| **P2** | Directional hints in guided mode | M |
| **P2** | Glassmorphism on control dock | S |
| **P2** | Onboarding flow | L |

**Total P0+P1 effort:** ~5-7 days

---

## What This Does NOT Change

- VTK.js rendering pipeline (untouched)
- Zustand store architecture (untouched)
- Core probe kinematics (untouched)
- Asset loading (untouched)
- E2E test structure (tests updated to match new data-testids)

---

## Related Proposals

- [Education UX](../research/2026-04-06-uiux-proposal-education.md) (Opus)
- [Visual Design](../research/2026-04-06-uiux-proposal-visual.md) (Opus)
- [Engineering](../research/2026-04-06-uiux-proposal-engineering.md) (Codex)
- [General UX](../research/2026-04-06-uiux-proposal-gemini.md) (Gemini)
