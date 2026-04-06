# UI/UX Redesign Proposal: Medical Education Perspective

**Date:** 2026-04-06
**Status:** Draft
**Author:** UI/UX design review (medical education lens)
**Scope:** Comprehensive redesign of TeeSim's interface for cardiology trainees

---

## 0. Executive Summary

TeeSim's current UI is a functional engineering prototype: it correctly renders three synchronized panes, exposes all five degrees of freedom, and provides basic view matching feedback. However, it presents itself as "TeeSim MVP shell" -- a developer dashboard -- rather than the spatial reasoning tutor it needs to be. A cardiology fellow opening this for the first time sees a dark control panel with technical jargon, five unlabeled sliders, eight buttons with abbreviated codes, and three rendering panes of equal visual weight with no indication of where to start.

This proposal reframes every interface surface around a single question: **"What should the trainee do next?"** It addresses ten dimensions of the UI/UX, ordered by educational impact, and provides specific, implementable recommendations for each.

**Top three priorities for immediate action:**

1. Add a first-run onboarding flow that teaches the core loop in under 90 seconds
2. Replace the 5-slider control panel with a grouped, context-aware probe control that surfaces only the relevant DOF for the current learning task
3. Redesign the view match feedback from a small text badge to a full-width, multi-sensory proximity indicator

---

## 1. Learning Flow: Guiding a First-Time Fellow

### Problem

The current UI loads directly into a "free explore" state with all controls visible, all panes active, and no guidance. The header reads "TeeSim MVP shell" with a developer-facing subtitle. The status strip shows technical information ("Bundle 0.1.0", "Probe constrained to esophageal centerline") that is meaningless to a trainee. There is no indication of what to do first.

The cardiac anesthesiology resident persona (first exposure to TEE, no prior echo background) would see this screen and have no mental model for what any of the three panes represent, what the sliders control, or what the preset buttons mean.

### Recommended First-Session Flow

```
+------------------------------------------------------------------+
|  STEP 1: Welcome Screen (modal overlay)                          |
|                                                                  |
|  "Welcome to TeeSim"                                             |
|  "Practice TEE probe manipulation on real CT anatomy."           |
|                                                                  |
|  [illustration: simplified probe-in-esophagus diagram]           |
|                                                                  |
|  Choose your experience:                                         |
|  [Guided Tour - 3 min]  [Free Explore]  [I know TEE already]    |
|                                                                  |
+------------------------------------------------------------------+

+------------------------------------------------------------------+
|  STEP 2: Guided Tour - Anatomy Orientation (30s)                 |
|                                                                  |
|  Center pane highlighted, others dimmed.                         |
|  Tooltip: "This is the 3D view of the thorax. The green line    |
|  is the esophagus. The blue marker is your TEE probe."          |
|                                                                  |
|  Auto-rotate the 3D scene 90 degrees to show spatial context.   |
|  [Next -->]                                                      |
+------------------------------------------------------------------+

+------------------------------------------------------------------+
|  STEP 3: Guided Tour - The Imaging Plane (30s)                   |
|                                                                  |
|  Left pane and center pane highlighted, right dimmed.            |
|  Tooltip: "The left pane shows what the probe 'sees' -- a       |
|  cross-section of the heart at the probe's current position.    |
|  Move the probe and watch the image change in real time."        |
|                                                                  |
|  Animate the Position slider slowly. Trainee sees the slice     |
|  change. This is the "aha" moment -- probe movement maps to     |
|  image change.                                                   |
|  [Next -->]                                                      |
+------------------------------------------------------------------+

+------------------------------------------------------------------+
|  STEP 4: Guided Tour - Find Your First View (60s)                |
|                                                                  |
|  "Try to find the ME Four-Chamber view."                         |
|  "Use the Position slider to advance the probe."                 |
|                                                                  |
|  Only the Position slider is enabled. Other DOFs are grayed      |
|  out with a label: "We'll unlock these next."                   |
|                                                                  |
|  View match indicator glows as trainee gets closer.              |
|  When matched: celebration state + "You found it!" overlay.     |
|  [Continue to Free Explore -->]                                  |
+------------------------------------------------------------------+
```

### Key Principles

- **Progressive disclosure of complexity.** Do not show all five DOFs simultaneously on first run. Start with Position only, then add Omniplane, then Ante/Retro, then Roll and Lateral.
- **Animate the connection.** The moment a trainee moves a slider and sees the pseudo-TEE image change is the foundational learning moment. The onboarding must make this happen within the first 15 seconds.
- **Celebrate success.** A green checkmark and "100% quality" text is insufficient. The first successful view match should feel like an achievement: brief animation, confetti-free but satisfying color pulse, and a clear "what's next" prompt.

### Implementation Notes

- Store onboarding state in `localStorage` (key: `teesim-onboarding-v1`). Show welcome screen only if key is absent.
- The guided tour is a lightweight step-sequencer overlay, not a separate route. It dims inactive regions with a semi-transparent scrim and highlights the active area.
- Provide a "Reset tutorial" option in a settings/help menu for returning users who want to re-run it.

---

## 2. Cognitive Load: Progressive Disclosure Strategy

### Problem

The current UI presents simultaneously:
- 3 rendering panes (pseudo-TEE, 3D anatomy, oblique slice)
- 5 DOF sliders with numeric values
- 8 preset view buttons
- A status strip with 5-6 technical pills
- A case selector
- A labels toggle
- A view match indicator with percentage
- Structure chips listing anatomy components

This is approximately 25 interactive or informational elements on a single screen. For reference, the ASE recommends that TEE training begin with **four** views (ME 4C, ME 2C, ME LAX, TG mid-SAX). The interface should mirror this pedagogical progression.

### Recommended Disclosure Tiers

**Tier 0 -- Always visible (the "cockpit instruments"):**
- Pseudo-TEE pane (primary learning output)
- 3D anatomy pane (spatial context)
- View match indicator (formative feedback)
- Active probe controls (only the DOFs relevant to current task)

**Tier 1 -- Visible by default, collapsible:**
- All 5 DOF controls
- Preset view buttons (8 buttons)
- Current position readout (station, depth, angle)

**Tier 2 -- Hidden by default, accessible via toggle or tab:**
- Oblique slice pane (useful for advanced learners, not essential for beginners)
- Structure list chips
- Technical status strip (bundle version, load state, disclaimers)
- Case selector (after initial selection)

**Tier 3 -- Accessible via settings/help menu:**
- Keyboard shortcut reference
- Labels toggle
- Tutorial reset
- Technical disclaimers

### Layout Implications

The oblique slice pane (right panel) is currently given 28% of screen width. For most trainees, this pane duplicates information available in the pseudo-TEE pane and the 3D scene. It should become an expandable panel rather than a permanent third of the layout.

**Proposed default layout (desktop, 1440px+):**

```
+---------------------------------------------+
| [TeeSim]  [Case: LCTSC S1-006]   [?] [cog]  |
+---------------------------------------------+
|                    |                         |
|   PSEUDO-TEE       |     3D ANATOMY          |
|   (40%)            |     (60%)               |
|                    |                         |
|                    |                         |
|                    |                         |
|   "CT-derived      |     Probe + sector      |
|    cross-section"  |     scene               |
|                    |                         |
+--------------------+-------------------------+
| [VIEW MATCH: ME Four-Chamber -- 87% match]  |
+---------------------------------------------+
| Probe Controls                              |
| [Position ====|========] 97mm  ME station   |
| [Omniplane ====|======] 25deg               |
|                                             |
| [v More controls: Roll, Ante, Lateral]      |
|                                             |
| Anchor Views                                |
| [ME 4C*] [ME 2C] [ME LAX] [TG SAX]        |
| [ME AV SAX] [ME AV LAX] [ME RV I-O] [Bica] |
+---------------------------------------------+
```

### Rationale for 2-Pane Default

- **Pseudo-TEE is the primary learning output.** It should be larger than 28%. Trainees are learning to read this image.
- **3D anatomy is the spatial context.** It helps trainees understand what the probe is doing in 3D space.
- **Oblique slice is a reference tool.** It is useful for advanced users who want to see the raw cross-section without sector masking, but it is not essential for the core learning task of view finding.
- The oblique slice pane can be toggled on via an "Oblique" tab/button that expands the layout to a 3-pane mode for users who want it.

---

## 3. Probe Control UX: Beyond Sliders

### Problem

Five horizontal range sliders are a developer's abstraction of a physical probe. They are:

1. **Non-spatial.** Moving a horizontal slider left-right does not map intuitively to advancing a probe deeper into the esophagus (which is a vertical/depth action in the trainee's mental model).
2. **Undifferentiated.** All five sliders look identical -- same width, same style, same accent color. There is no visual distinction between "primary" controls (Position, Omniplane -- the two most-used DOFs) and "secondary" controls (Roll, Ante/Retro, Lateral).
3. **Missing physical metaphor.** Real TEE probes have a large wheel (ante/retro), a small wheel (lateral), a rotation lock, and omniplane buttons. The UI should at least conceptually reference these physical controls.
4. **No directional labels.** "Ante / Retro" does not tell the trainee which direction is "ante." The slider has no indication of what happens when you move left vs. right.

### Recommended Alternatives

**Phase 1 (MVP improvement): Enhanced slider panel with grouping and context**

```
+-------------------------------------------------------+
| PROBE CONTROLS                                        |
|                                                       |
| POSITION                              Station: ME     |
| Upper Esoph.  [====|===============]  Deep TG         |
|               97 mm                                   |
|                                                       |
| IMAGING ANGLE                                         |
| 0 deg         [=====|=============]  180 deg          |
|               25 deg (omniplane)                      |
|                                                       |
| [v] FLEXION CONTROLS                                  |
|   Retro (-90) [===========|=======]  Ante (+90)       |
|               -5 deg                                  |
|                                                       |
|   Left (-90)  [===========|=======]  Right (+90)      |
|               0 deg (lateral)                         |
|                                                       |
| [v] ROTATION                                          |
|   CCW (-180)  [===========|=======]  CW (+180)        |
|               0 deg (roll)                            |
+-------------------------------------------------------+
```

Key improvements:
- **Directional labels at slider endpoints** (e.g., "Upper Esoph." / "Deep TG" for position; "Retro" / "Ante" for flexion). This tells the trainee what happens when they drag.
- **Grouped by conceptual category.** Position and Omniplane are always visible (primary). Flexion and Rotation are in collapsible groups (secondary).
- **Station indicator** next to Position, showing UE/ME/TG/DTG dynamically.
- **Larger touch targets** for the two primary sliders.

**Phase 2 (post-MVP): Virtual probe handle**

A more ambitious alternative replaces sliders with a 2D interactive probe visualization:

- **Vertical drag** on a probe silhouette controls Position (advance/withdraw).
- **Rotation gesture** (circular drag around probe axis) controls Roll.
- **Horizontal tilt** controls Lateral flex.
- **Vertical tilt** (up/down arrows on the probe tip) controls Ante/Retro flex.
- **Semicircular arc** at the bottom controls Omniplane (matching the real TEE omniplane button behavior).

This maps probe manipulation to spatial gestures, building transferable motor intuition. However, this is a significant design and engineering effort, and should not block MVP.

**Phase 3 (future): Gamepad/touch support**

Map a game controller's joysticks to probe DOFs:
- Left stick vertical = Position
- Left stick horizontal = Roll
- Right stick vertical = Ante/Retro
- Right stick horizontal = Lateral
- Triggers = Omniplane

This maps naturally to the bimanual nature of real TEE probe control.

### Keyboard Shortcut Improvements

The current keyboard mapping (Arrow keys, WASD, Q/E, brackets) is functional but undiscoverable. Recommendations:

- Add a persistent keyboard shortcut hint below the slider panel: "Arrow Up/Down = Position | Left/Right = Omniplane | W/S = Flex | A/D = Lateral | Q/E = Roll | 1-8 = Views"
- Consider making the shortcut hint dismissible after first view.
- Add a `?` key to toggle a full shortcut overlay (like Gmail's `?` shortcut).

---

## 4. View Finding Experience: "Getting Warmer/Cooler" Feedback

### Problem

The current view match indicator is a small badge (approximately 180px wide) in the top-right of the center pane. It shows:
- Status text: "Match" / "Near" / "Exploring"
- Preset name: "ME Four-Chamber"
- Quality percentage: "100% quality"
- Color coding: green border (match), amber border (near), gray border (exploring)

This is too small, too static, and too cerebral for the core feedback loop of a spatial reasoning tutor. The trainee's eyes are on the pseudo-TEE image and the 3D scene, not on a tiny text badge in the corner.

### Recommended Redesign: Full-Width Proximity Bar

```
EXPLORING (far from all presets):
+-------------------------------------------------------------+
|  [dim gray bar, minimal presence]                           |
|  Exploring -- nearest: ME Four-Chamber (32%)                |
+-------------------------------------------------------------+

GETTING WARMER (approaching a preset):
+-------------------------------------------------------------+
|  [amber gradient bar, pulsing gently]                       |
|  Getting closer to ME Four-Chamber                          |
|  [==========|.........................] 62%                  |
|  Hint: Try adjusting omniplane angle                        |
+-------------------------------------------------------------+

ALMOST THERE (very close):
+-------------------------------------------------------------+
|  [bright amber-to-green gradient, pulse faster]             |
|  Almost there! ME Four-Chamber                              |
|  [========================|...........] 87%                  |
|  Fine-tune: Omniplane +8 deg                                |
+-------------------------------------------------------------+

MATCH:
+-------------------------------------------------------------+
|  [solid green bar, brief glow animation]                    |
|  ME Four-Chamber -- MATCHED                                 |
|  [==================================] 100%                  |
|  Great! This view shows all four chambers.                  |
+-------------------------------------------------------------+
```

### Design Details

**Position:** Full width, between the pane area and the control dock. This is the natural eye-rest position when looking between the images and the controls.

**Visual language:**
- A continuous gradient from gray (cold) through amber (warm) to green (match), applied as the background tint of the bar.
- A horizontal progress bar showing the match percentage.
- Gentle CSS pulse animation (`@keyframes`) that increases in frequency as score increases: 2s period at 60%, 1s at 80%, 0.5s at 90%, solid at 100%.

**Textual feedback tiers:**

| Score Range | Status Text | Guidance Text | Emotional Tone |
|---|---|---|---|
| 0-39% | "Exploring" | "Nearest preset: [name]" | Neutral, no urgency |
| 40-59% | "Getting closer" | "Try adjusting [most-off DOF]" | Encouraging |
| 60-79% | "Almost there" | "Fine-tune [most-off DOF] by ~[delta]" | Warm, specific |
| 80-89% | "Very close!" | "[DOF]: just [N] deg off" | Exciting, precise |
| 90-99% | "Nearly perfect" | "Tiny adjustment needed" | Satisfying |
| 100% | "Matched!" | "[educational note about view]" | Celebration |

**Directional hints:** When the score is between 40-89%, the indicator should show which DOF is most off-target and in which direction. Example: "Try advancing the probe ~15mm deeper" or "Rotate omniplane +20 degrees." This transforms the indicator from a passive score display into an active tutor.

**Audio feedback (optional, off by default):** A subtle tonal shift as the match score changes -- higher pitch as score increases. This provides ambient feedback without requiring the trainee to look at any specific UI element. Must be togglable and off by default to avoid annoyance in shared spaces.

### Implementation Notes

- The directional hint requires computing which single DOF contributes most to the distance from the target. This is a simple per-DOF delta calculation already available from the `matchViews()` function's internals.
- The educational note at 100% match (e.g., "This view shows all four chambers and is used to assess mitral and tricuspid valve function") should be authored per-view in `views.json`.

---

## 5. 3-Pane Balance: Layout Recommendations

### Current State

The current layout is `28% / 44% / 28%` with fixed proportions. At 1440px, this gives approximately 390px / 610px / 390px for the three panes. The pseudo-TEE pane is too small for a trainee to read anatomy. The oblique slice pane consumes space that most trainees will not use during initial learning.

### Recommended Layouts

**Default (2-pane + expandable oblique):**

```
Desktop >= 1440px:
+-------------------+---------------------------+
|                   |                           |
|   PSEUDO-TEE      |      3D ANATOMY           |
|   42%             |      58%                  |
|                   |                           |
+-------------------+---------------------------+
|  [View match proximity bar - full width]      |
+-----------------------------------------------+
|  [Controls dock - full width]                 |
+-----------------------------------------------+

Desktop >= 1440px with oblique expanded:
+---------------+--------------------+----------+
|               |                    |          |
|  PSEUDO-TEE   |   3D ANATOMY       | OBLIQUE  |
|  35%          |   45%              | 20%      |
|               |                    |          |
+---------------+--------------------+----------+
|  [View match proximity bar - full width]      |
+-----------------------------------------------+
|  [Controls dock - full width]                 |
+-----------------------------------------------+
```

**Rationale:**
- The pseudo-TEE pane is the primary output. Increasing it from 28% to 42% gives it ~600px at 1440px -- enough to read sector anatomy.
- The 3D scene at 58% (~830px) provides ample space for orbit controls and the probe visualization.
- An "Oblique" toggle button (top-right of the pane area) expands the third pane. This toggle should be visually subtle -- a small icon button, not a tab.

**Resizable panes:**

Adding drag-to-resize handles between panes is desirable but lower priority than other changes. If implemented:
- Use a 4px drag handle with a visible grip indicator on hover.
- Enforce minimum widths: pseudo-TEE >= 280px, 3D scene >= 380px, oblique >= 200px.
- Persist pane proportions in `localStorage`.
- Snap back to default proportions on double-click of the handle.

**Pane focus mode:**

Double-clicking any pane title should expand it to ~80% width, compressing the others. This is useful for the attending echocardiographer persona who wants to project a single pane on a large screen. Press Escape or double-click again to restore.

---

## 6. Color and Visual Hierarchy

### Problem

The current dark theme uses a deep navy background (`#07111f`) with teal accents (`#79c9d0`). While dark themes are appropriate for medical imaging viewers (PACS systems use dark backgrounds to preserve perceptual contrast of grayscale images), the current implementation has several issues:

1. **Developer aesthetic.** Large rounded corners (22px panel radius), gradient overlays, conic-gradient sector fans, and "status pills" look like a SaaS dashboard, not a medical education tool.
2. **Low information hierarchy.** All text uses similar sizes and weights. Pane titles, section headers, labels, and values do not form a clear visual hierarchy.
3. **Accent color overuse.** The teal accent (`#79c9d0`) is used for: eyebrow text, slider accent, structure chip backgrounds, panel borders, pseudo-CSS-art overlays, and the oblique slice crosshairs. When everything is accented, nothing is accented.
4. **The pseudo-TEE rendering surface** has decorative CSS pseudo-elements (dashed circles, conic gradients) that serve no educational purpose and will visually conflict with actual rendered content.

### Recommended Color System

**Background layers:**

| Layer | Current | Proposed | Rationale |
|---|---|---|---|
| App background | `#07111f` (deep navy) | `#0c1219` (near-black) | Darker base improves rendered image contrast |
| Panel background | `rgba(10,24,42,0.92)` | `#151c24` (dark charcoal) | Opaque, no transparency effects -- simpler rendering |
| Pane render surface | Complex gradient | `#000000` | Pure black for maximum contrast of CT imagery |
| Control dock | Same as panels | `#1a2230` (slightly elevated) | Subtle lift to separate controls from content |

**Text hierarchy:**

| Role | Current | Proposed | Size | Weight |
|---|---|---|---|---|
| App title | `clamp(2-3.4rem)` | 1.25rem | Medium 500 | Far too large currently; title is not the focus |
| Pane title | 1.12rem | 0.875rem, uppercase | Medium 500 | Small and quiet -- panes are identified by content, not title |
| Section header | 1.12rem | 1rem | Semibold 600 | "Probe Controls", "Anchor Views" |
| Body/label text | Inherited | 0.875rem | Regular 400 | Slider labels, status text |
| Caption/muted | 0.9rem | 0.75rem | Regular 400, 60% opacity | Technical notes, disclaimers |
| Value readout | Inherited | 0.9375rem, tabular-nums | Medium 500 | Numeric values should be monospaced for alignment |

**Accent colors (reduced to three functional roles):**

| Role | Color | Usage |
|---|---|---|
| Interactive | `#5ba8b5` (muted teal) | Buttons, links, active slider track |
| Feedback-positive | `#4fd18b` (green) | View match, success states |
| Feedback-caution | `#f4b24d` (amber) | Near-match, warnings |
| Feedback-neutral | `#6b7a8d` (gray) | Exploring state, disabled |
| Danger | `#e5534b` (red) | Errors only |

**Remove decorative CSS art.** The `::before` and `::after` pseudo-elements on `.render-surface-left`, `.render-surface-right`, and `.render-surface-center` should be removed entirely. They create dashed circles, conic gradients, crosshairs, and blob shapes that will conflict with actual rendered content and have no educational purpose.

### Typography

- **Primary font:** Keep IBM Plex Sans -- it is a strong choice for technical/medical interfaces.
- **Monospaced numerics:** Add `font-variant-numeric: tabular-nums` to all numeric readouts so values align vertically in the slider panel.
- **Reduce font size range.** Current range is 0.73rem to 3.4rem (a 4.6x ratio). Reduce to 0.75rem to 1.25rem (a 1.67x ratio). The content, not the typography, should dominate visual attention.

### Spacing

- **Reduce panel border-radius** from 22px to 8px. Large radii waste corner space and look informal. Medical interfaces use subtle radii.
- **Reduce chip border-radius** from 999px (pill) to 6px. Pill-shaped elements suggest interactivity (tags, filters). The status pills and structure chips are informational.
- **Standardize padding** to an 8px grid: 8px, 12px, 16px, 24px. Current padding values include 7px, 9px, 10px, 12px, 14px, 16px, 18px -- too many distinct values.

---

## 7. Pseudo-TEE Pane: Making the CT Cross-Section Readable

### Problem

The pseudo-TEE pane is labeled "CT-derived anatomical slice" (correct per ADR-0001's framing guidance). The current rendering shows a grayscale fan-shaped sector image on a dark background. For a trainee, this image needs to be readable as cardiac anatomy -- they need to identify chambers, valves, and walls.

### Recommendations

**7a. Sector overlay annotations (always-on in tutorial mode):**

When a trainee is viewing a recognized standard view (match >= 85%), overlay subtle anatomical labels on the pseudo-TEE image. These labels should:
- Use a semi-transparent background pill (e.g., `rgba(0,0,0,0.6)` with white text).
- Be positioned at the centroid of the corresponding anatomical structure in the slice.
- Use standard ASE abbreviations: LV, RV, LA, RA, MV, AV, TV, etc.
- Be toggleable via the existing "Labels" button.
- Fade in when match quality reaches green threshold, fade out when it drops below amber.

**7b. Sector shape and orientation:**

- The sector apex should be at the top of the pane (matching standard TEE image convention where the transducer is at the top).
- Add a subtle depth scale on the side of the sector (e.g., marks at 2cm intervals) to help trainees develop a sense of scale.
- Add a small omniplane angle indicator in the corner (a semicircle with the current angle marked), matching what appears on a real TEE machine display.

**7c. Image quality enhancements:**

- The CT-derived cross-section should use a windowed grayscale colormap tuned for soft tissue contrast (window center ~40 HU, width ~400 HU), not the full dynamic range of the CT volume.
- Consider adding a subtle Gaussian smoothing at sector edges to reduce aliasing at the sector boundary.
- The "thick-slab" reslice (3-5mm per ADR) helps, but the UI should also offer a "thin slice / thick slice" toggle for advanced users who want to compare.

**7d. Image orientation markers:**

Real TEE images display orientation markers. Add small, fixed labels at the sector edges indicating anatomical orientation relative to the current omniplane angle. For a 0-degree image: "Left" and "Right" at the sector edges. For 90 degrees: "Anterior" and "Posterior." These change dynamically with omniplane rotation.

---

## 8. Mobile/Tablet Strategy

### Problem

The current mobile view (< 1180px) collapses to a single pane with tab switching. The screenshots show:

- **Tablet:** The 3D scene pane is visible. Below it, the 5 DOF sliders are stacked vertically, followed by 8 single-column preset buttons. This is functional but requires extensive scrolling. The tabs ("CT slice", "3D scene", "Oblique") are small and undifferentiated.

- **Mobile (phone):** The layout is similar to tablet but severely compressed. The 3D rendering viewport is extremely small (~300px wide). The sliders are difficult to manipulate on a narrow screen. The entire experience requires significant scrolling.

### Mobile Strategy: "Viewer Mode" vs "Controller Mode"

Do not try to replicate the full desktop experience on mobile. Instead, offer two distinct mobile modes:

**Viewer Mode (default on mobile):**
```
+----------------------------------+
| TeeSim            [case] [mode]  |
+----------------------------------+
|                                  |
|                                  |
|        PSEUDO-TEE                |
|        (full width, 60vh)        |
|                                  |
|                                  |
+----------------------------------+
| [VIEW MATCH INDICATOR - compact] |
+----------------------------------+
| ME 4C | ME 2C | ME LAX | TG SAX |
| AV SAX| AV LAX| RV I-O | Bicav  |
+----------------------------------+
```

In Viewer Mode, the trainee taps preset buttons to jump between standard views. The pseudo-TEE pane fills most of the screen. This is the "flashcard" mode -- good for learning to recognize views, not for learning to find them.

**Controller Mode (toggled via button):**
```
+----------------------------------+
| TeeSim            [case] [mode]  |
+----------------------------------+
|                                  |
|     PSEUDO-TEE (40vh)            |
|                                  |
+----------------------------------+
| [VIEW MATCH - compact]           |
+----------------------------------+
| Position  [======|=====] 97mm    |
| Omniplane [====|=======] 25 deg  |
|                                  |
| [v] More controls                |
+----------------------------------+
```

In Controller Mode, the pseudo-TEE pane is smaller but still visible. The two primary sliders (Position and Omniplane) are always visible. Secondary controls are behind an expander. The 3D scene is not shown at all on mobile -- it requires too much screen space and GPU resources.

**Tablet (768-1179px):**

Tablets get a hybrid layout:

```
+-------------------+----------------------+
|                   |                      |
|   PSEUDO-TEE      |    3D ANATOMY        |
|   45%             |    55%               |
|                   |                      |
+-------------------+----------------------+
| [View match indicator - full width]      |
+------------------------------------------+
| Position [=======|========] 97mm         |
| Omniplane [====|==========] 25 deg       |
| [v] More controls                        |
+------------------------------------------+
| [ME 4C] [ME 2C] [ME LAX] [TG SAX]       |
| [AV SAX] [AV LAX] [RV I-O] [Bicaval]    |
+------------------------------------------+
```

Two panes side-by-side (not tabbed), with simplified controls below. This matches the iPad usage pattern described in the personas doc ("Uses mobile or laptop" for the cardiology fellow).

### Touch Interaction

- Sliders on touch devices should have a **48px minimum touch target height** (current HTML range inputs are typically ~20px).
- Add a `touch-action: none` on the slider container to prevent accidental scroll while dragging.
- Consider implementing swipe gestures: horizontal swipe on the pseudo-TEE pane controls omniplane, vertical swipe controls position. This is intuitive but needs a clear visual affordance (e.g., directional arrows at the edges of the pane).

---

## 9. Accessibility

### Current State Assessment

The current implementation has some accessibility foundations:
- `role="tablist"` on the mobile pane tabs
- `role="listbox"` on the case menu
- `aria-pressed` on tab buttons
- `aria-selected` on case options
- `aria-label` on the status section

However, several critical gaps exist.

### Color Contrast

**Failing elements (estimated against WCAG 2.1 AA, 4.5:1 for normal text):**

| Element | Foreground | Background | Estimated Ratio | Required |
|---|---|---|---|---|
| Eyebrow/kicker text | `#79c9d0` | `#07111f` | ~4.8:1 | 4.5:1 -- borderline pass, but only at 0.73rem which is too small for reliable reading |
| Muted text | `#a6b8d1` | `#07111f` | ~5.9:1 | Passes |
| Status pills | `#a6b8d1` on `rgba(9,24,42,0.72)` | Depends on compositing | ~4.2:1 estimated -- FAIL |
| Structure chips | `#e8f1ff` on `rgba(121,201,208,0.1)` | Depends on compositing | Likely passes |
| Slider labels (muted) | `#a6b8d1` | `#0a182a` | ~5.5:1 | Passes |

**Recommendations:**
- Remove transparency from background colors. Compute the composited color and use it directly. Transparent backgrounds make contrast ratios unpredictable.
- Increase the minimum font size from 0.73rem (~11.7px) to 0.75rem (~12px). WCAG does not define a minimum font size, but text below 12px is extremely difficult for users with low vision.
- Ensure the view match indicator's colored states (green, amber) maintain contrast against both the indicator text and the surrounding panel.

### Screen Reader Support

**Missing ARIA attributes:**

- **Sliders:** The `<input type="range">` elements have no `aria-label` or `aria-valuetext`. Screen readers will announce them as "slider, 97" rather than "Probe position, 97 millimeters, mid-esophageal station." Add:
  ```html
  <input type="range"
    aria-label="Probe position"
    aria-valuetext="97 millimeters, mid-esophageal station"
    aria-valuemin="0" aria-valuemax="320" />
  ```

- **View match indicator:** Should be an ARIA live region (`aria-live="polite"`) so screen readers announce match status changes without requiring focus.
  ```html
  <div role="status" aria-live="polite" aria-atomic="true">
    Match: ME Four-Chamber, 100% quality
  </div>
  ```

- **Preset buttons:** Should have `aria-label` that includes the full view name: `aria-label="Jump to ME Four-Chamber view"`.

- **3D rendering panes:** The three `<canvas>` elements should have `role="img"` and `aria-label` descriptions of their content. The 3D scene should have `aria-label="3D anatomy view showing probe position in the thorax"`.

### Keyboard Navigation

The current keyboard shortcuts (WASD, arrows, Q/E, brackets, 1-8) are well-designed for probe control but have issues:

- **Tab order.** There is no visible focus indicator on buttons or sliders beyond the browser default. Add a custom focus ring: `outline: 2px solid #5ba8b5; outline-offset: 2px;` on all interactive elements.
- **Escape key.** Should close any open menus (case selector dropdown).
- **Focus trapping.** The onboarding modal (proposed in Section 1) must trap focus within the modal while it is open.
- **Skip link.** Add a "Skip to probe controls" link at the top of the page for keyboard users to bypass the header and panes.

### Reduced Motion

Add a `prefers-reduced-motion` media query to disable:
- The CSS pulse animation on the view match indicator
- The hover `translateY(-1px)` transitions on buttons
- Any future celebratory animations on view match

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 10. Onboarding: First-Run Experience

### Detailed Onboarding Sequence

The welcome screen and guided tour described in Section 1 need further specification.

**Step 0: Case loading (automatic)**

While the default case loads in the background, show a branded splash:

```
+------------------------------------------+
|                                          |
|              [TeeSim logo]               |
|                                          |
|     3D TEE Simulator for Education       |
|                                          |
|     Loading anatomy...                   |
|     [========|...............] 40%        |
|                                          |
|     Powered by CT data from              |
|     TotalSegmentator                     |
|                                          |
+------------------------------------------+
```

This replaces the current experience where the user sees a half-loaded interface with "Loading case..." in a status pill.

**Step 1: Welcome modal**

Appears once the case is loaded. Three options:
- "Guided Introduction" (recommended, highlighted)
- "Free Explore" (secondary)
- "I've used TeeSim before" (tertiary, skips everything)

**Step 2-5: Guided tour** (as described in Section 1)

Each step uses a **spotlight pattern**: the target UI element is at normal brightness, the rest of the screen has an 80% opacity dark overlay. A tooltip card (max 280px wide) with clear instructional text is anchored to the spotlighted element.

**Tooltip card design:**

```
+-------------------------------+
| Step 2 of 5                   |
|                               |
| THE 3D VIEW                   |
| This shows the thorax with    |
| the esophagus (green line)    |
| and your probe (blue marker). |
|                               |
| Try orbiting the view by      |
| clicking and dragging.        |
|                               |
| [Back]              [Next ->] |
+-------------------------------+
      ^
      | (arrow pointing to 3D pane)
```

**Step 6: Contextual tooltips (persistent, dismissible)**

After the guided tour ends, key UI elements retain small "?" icons that show a tooltip on hover/tap:
- Slider labels: "This controls the probe's depth in the esophagus"
- View match indicator: "Shows how close you are to a standard ASE view"
- Preset buttons: "Click to jump directly to this standard view"

These tooltips disappear after the user has interacted with the element 3 times (stored in `localStorage`).

### In-Context Help System

Beyond the first-run onboarding, provide ongoing contextual help:

- **`?` key** toggles a keyboard shortcut overlay (translucent overlay listing all shortcuts, organized by control group).
- **Help icon** in the header opens a slide-out panel with:
  - "About TEE views" -- brief explanation of the ASE standard view framework
  - "Probe controls" -- diagram of what each DOF does
  - "Keyboard shortcuts" -- full reference
  - "About this case" -- dataset information, disclaimers
- **Per-view educational content.** When a view is matched, show a brief educational note in the view match indicator. This content is authored in `views.json` per ADR-0001's data model, in a new `educationalNote` field.

---

## 11. Additional Recommendations

### 11a. Header Redesign

**Current:** "TeeSim MVP shell" with a large heading (up to 3.4rem) and a developer subtitle. This is the first thing a user sees and it says "this is a prototype."

**Proposed:**

```
+------------------------------------------------------------------+
| [T] TeeSim                    [Case: LCTSC S1-006 v] [?] [gear]  |
+------------------------------------------------------------------+
```

- Small logo mark + "TeeSim" in 1rem semibold. No subtitle.
- Case selector moves into the header bar, compact format.
- Help (`?`) and settings (gear icon) buttons in the top-right.
- Remove the "status strip" entirely. Move technical disclaimers into the help panel. The "CT-derived anatomical slice, not ultrasound" disclaimer can appear as a small caption below the pseudo-TEE pane title.

### 11b. View Preset Button Redesign

**Current:** 8 buttons in a 2-column grid, each showing the view label and ASE code. All buttons look identical except for match highlighting.

**Proposed:**

- Add a **thumbnail preview** to each preset button showing a representative pseudo-TEE image for that view. This gives the trainee a visual target -- "I'm trying to make my pseudo-TEE look like this thumbnail."
- Organize buttons into **two groups**: "Core Views" (ME 4C, ME 2C, ME LAX, TG SAX) and "Advanced Views" (AV SAX, AV LAX, RV I-O, Bicaval). This mirrors the pedagogical progression.
- Add a **checkmark overlay** on views the trainee has successfully matched in the current session. This creates a collect-them-all motivation.
- Show the **keyboard shortcut number** on each button (small badge: "1", "2", etc.).

```
CORE VIEWS
+----------+----------+----------+----------+
| [thumb]  | [thumb]  | [thumb]  | [thumb]  |
| ME 4C    | ME 2C    | ME LAX   | TG SAX   |
| [1]      | [2]      | [3]      | [4]      |
+----------+----------+----------+----------+

ADVANCED VIEWS
+----------+----------+----------+----------+
| [thumb]  | [thumb]  | [thumb]  | [thumb]  |
| AV SAX   | AV LAX   | RV I-O   | Bicaval  |
| [5]      | [6]      | [7]      | [8]      |
+----------+----------+----------+----------+
```

### 11c. Session Progress Indicator

Add a subtle progress indicator that tracks which views have been successfully matched in the current session:

```
Session progress: 3/8 views found  [** ** ** . . . . .]
```

This appears in the header or just above the preset buttons. It provides a sense of accomplishment and a clear goal without being a formal assessment.

### 11d. Loading States

The current loading indicator is a status pill that says "Loading case..." Replace with:

- A skeleton loader in the pane areas (gray placeholder shapes that pulse).
- A determinate progress bar if asset sizes are known (volume + meshes + manifests).
- The loading state should appear within the panes, not as a separate status pill.

---

## 12. Implementation Priority

### Phase 1: Critical UX Fixes (1-2 weeks)

These changes have the highest educational impact and lowest implementation cost:

| # | Change | Effort | Impact |
|---|---|---|---|
| 1 | Remove decorative CSS pseudo-elements from render surfaces | S | Removes visual noise, prepares for real rendered content |
| 2 | Redesign header: remove "MVP shell", reduce title size, clean toolbar | S | First impression transformation |
| 3 | Add directional labels to sliders (endpoint labels, grouped layout) | M | Immediately improves probe control comprehension |
| 4 | Expand view match indicator to full-width proximity bar with gradient | M | Core learning feedback becomes visible |
| 5 | Remove transparency from panel backgrounds, fix contrast issues | S | Accessibility compliance |
| 6 | Reduce border-radius from 22px to 8px across all panels | S | Professional medical tool aesthetic |
| 7 | Remove status strip, move disclaimers to help panel | S | Reduces cognitive clutter |

### Phase 2: Learning Flow (2-3 weeks)

| # | Change | Effort | Impact |
|---|---|---|---|
| 8 | First-run welcome modal and guided tour (5-step overlay) | L | Transforms first-time experience |
| 9 | Switch to 2-pane default layout (pseudo-TEE 42% + 3D 58%) with oblique toggle | M | Better visual hierarchy |
| 10 | Collapsible DOF groups (primary: Position + Omniplane; secondary: Flex + Roll) | M | Progressive disclosure of complexity |
| 11 | Directional hints in view match indicator ("Try adjusting omniplane +20 deg") | M | Transforms passive score into active tutor |
| 12 | Preset button thumbnails and keyboard shortcut badges | M | Visual targets for view finding |
| 13 | Session progress indicator (views found: 3/8) | S | Motivation and goal clarity |

### Phase 3: Mobile and Polish (2-3 weeks)

| # | Change | Effort | Impact |
|---|---|---|---|
| 14 | Tablet layout: 2-pane side-by-side with simplified controls | M | iPad usability for fellows |
| 15 | Mobile layout: Viewer mode and Controller mode | L | Phone usability |
| 16 | ARIA improvements: slider labels, live regions, focus management | M | Accessibility compliance |
| 17 | Reduced-motion media query | S | Accessibility |
| 18 | Contextual "?" tooltips on key elements | M | Ongoing learning support |
| 19 | Loading splash and skeleton loaders | M | Perceived performance |
| 20 | Keyboard shortcut overlay (? key) | S | Discoverability |

### Phase 4: Advanced Interactions (future)

| # | Change | Effort | Impact |
|---|---|---|---|
| 21 | Virtual probe handle (spatial 2D interaction model) | XL | Motor skill transfer |
| 22 | Per-view anatomical label overlays on pseudo-TEE | L | Anatomical learning |
| 23 | Omniplane angle indicator on pseudo-TEE pane | M | Matches real TEE display conventions |
| 24 | Depth scale on pseudo-TEE sector | S | Scale awareness |
| 25 | Gamepad controller support | L | Alternative input modality |
| 26 | Audio proximity feedback (optional) | M | Multi-sensory learning |

---

## 13. Design Principles Summary

These principles should guide all future UI decisions for TeeSim:

1. **The image is the interface.** The pseudo-TEE rendering is the primary output. Every other UI element exists to help the trainee understand, navigate to, and learn from that image. Maximize image real estate.

2. **One task at a time.** At any given moment, the trainee should be clear on what they are trying to do. "Find ME Four-Chamber" is a task. "Explore five degrees of freedom while reading three panes and eight buttons" is not.

3. **Feedback is teaching.** The view match indicator is not a score display -- it is a tutor. It should tell the trainee what to do next, not just how they are doing.

4. **Progressive complexity.** Start with Position. Add Omniplane. Add Flex. Add Roll. This mirrors how TEE is taught clinically: "first, learn to advance and withdraw the probe."

5. **Medical, not technical.** Use clinical language ("Advance the probe deeper"), not engineering language ("Increase sMm parameter"). Use ASE standard terminology. Avoid exposing internal state names.

6. **Respect the context.** Fellows study in 15-30 minute sessions, often tired, often on a phone or tablet. The UI must load fast, work on touch, and not require a tutorial to use basic functions.

7. **Dark for a reason.** The dark background exists to maximize contrast of the grayscale CT imagery, not as an aesthetic choice. Every non-black pixel on the screen should earn its place.

---

## Appendix A: Component-Level Specification Sketch

### A1. ProximityBar component (replacing ViewMatchIndicator)

```
Props:
  score: number (0-1)
  presetLabel: string
  presetAseCode: string
  status: 'exploring' | 'near' | 'match'
  hint: string | null  // e.g., "Try advancing the probe ~15mm"
  educationalNote: string | null  // shown at 100% match

Visual behavior:
  - Full width of the layout area
  - Height: 48px (compact) to 72px (when hint or note is shown)
  - Background: horizontal gradient from left (gray) to current-score position
    - 0-39%: #1a1f26 (dark gray)
    - 40-79%: linear-gradient to #3d2f14 (warm amber tint)
    - 80-99%: linear-gradient to #1a3324 (green tint approaching)
    - 100%: #1a3324 with brief 300ms glow animation
  - Text layout: left-aligned label, right-aligned percentage
  - Hint text: appears below the main line in muted color
  - Pulse animation: CSS keyframe, period = 3s - (score * 2.5s), min 0.5s
  - prefers-reduced-motion: no pulse, instant color transitions

Accessibility:
  role="status"
  aria-live="polite"
  aria-atomic="true"
  aria-label="View match: [presetLabel], [score]% quality. [hint]"
```

### A2. Revised ProbeHUD layout

```
Props: (unchanged from current)

Structure:
  <section class="probe-controls">
    <header>
      <h3>Probe Controls</h3>
      <div class="station-badge">[ME] [97mm] [25 deg]</div>
    </header>

    <div class="primary-controls">
      <ProbeSlider
        label="Position"
        leftLabel="Upper"
        rightLabel="Deep"
        unit="mm"
        value={97}
        ...
      />
      <ProbeSlider
        label="Omniplane"
        leftLabel="0 deg"
        rightLabel="180 deg"
        unit="deg"
        value={25}
        ...
      />
    </div>

    <details class="secondary-controls">
      <summary>Flexion and rotation</summary>
      <ProbeSlider label="Ante / Retro" leftLabel="Retro" rightLabel="Ante" ... />
      <ProbeSlider label="Lateral" leftLabel="Left" rightLabel="Right" ... />
      <ProbeSlider label="Roll" leftLabel="CCW" rightLabel="CW" ... />
    </details>
  </section>
```

### A3. Keyboard shortcut overlay

Triggered by `?` key. Semi-transparent overlay (80% black) with a centered card:

```
+------------------------------------------------+
|           KEYBOARD SHORTCUTS                   |
|                                                |
|  PROBE POSITION                                |
|  Arrow Up / Down     Advance / Withdraw        |
|                                                |
|  IMAGING ANGLE                                 |
|  Arrow Left / Right  Omniplane rotate          |
|  [ / ]               Omniplane rotate (alt)    |
|                                                |
|  FLEXION                                       |
|  W / S               Ante / Retro              |
|  A / D               Left / Right lateral      |
|                                                |
|  ROTATION                                      |
|  Q / E               Roll CCW / CW             |
|                                                |
|  VIEWS                                         |
|  1-8                 Jump to preset view        |
|                                                |
|  Press ? or Esc to close                       |
+------------------------------------------------+
```

---

## Appendix B: CSS Token Revisions

Proposed replacement for `tokens.css`:

```css
:root {
  /* Background layers */
  --bg-base: #0c1219;
  --bg-surface: #151c24;
  --bg-elevated: #1a2230;
  --bg-render: #000000;

  /* Borders */
  --border-default: #2a3544;
  --border-hover: #3d4f63;
  --border-focus: #5ba8b5;

  /* Text */
  --text-primary: #e2e8f0;
  --text-secondary: #94a3b8;
  --text-caption: #64748b;

  /* Functional colors */
  --color-interactive: #5ba8b5;
  --color-interactive-hover: #7cc4cf;
  --color-match: #4fd18b;
  --color-match-bg: #0f2d1e;
  --color-near: #f4b24d;
  --color-near-bg: #2d2210;
  --color-exploring: #64748b;
  --color-danger: #e5534b;

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;
  --space-2xl: 32px;

  /* Radii */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* Shadows */
  --shadow-panel: 0 4px 12px rgba(0, 0, 0, 0.3);
  --shadow-elevated: 0 8px 24px rgba(0, 0, 0, 0.4);

  /* Typography */
  --font-sans: 'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', 'Menlo', monospace;

  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.8125rem;  /* 13px */
  --text-base: 0.875rem; /* 14px */
  --text-md: 1rem;       /* 16px */
  --text-lg: 1.125rem;   /* 18px */
  --text-xl: 1.25rem;    /* 20px */
}
```

---

## Related Documents

- [Product overview](../product/overview.md)
- [Personas](../product/personas.md)
- [ADR-0001: MVP Architecture](../decisions/ADR-0001-mvp-architecture.md)
- [Medical education proposal](./2026-04-06-mvp-proposal-medical-education.md)
