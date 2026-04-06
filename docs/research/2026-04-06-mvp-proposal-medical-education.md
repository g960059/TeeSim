# MVP Architecture Proposal: Medical-Education-First Perspective

**Date:** 2026-04-06
**Status:** Draft
**Author:** Claude (medical education lens)
**Feeds into:** ADR-0001

---

## 1. Executive Summary

TEE is one of the hardest imaging modalities to learn. The trainee must simultaneously master (a) 3D cardiac anatomy, (b) the spatial mapping between a probe inside the esophagus and a 2D ultrasound image, and (c) the manual dexterity to navigate five degrees of freedom in real time. Current training is bottlenecked by access to patients, expensive phantoms, and the cognitive overload of doing all three tasks at once under time pressure.

TeeSim's educational architecture must decompose that cognitive load into layered, repeatable exercises that a trainee can practice alone, at their own pace, with immediate formative feedback. The simulator is not a game and not a PACS viewer -- it is a **spatial reasoning tutor** built around the ASE standard view framework.

This proposal defines the educational content layer of the MVP: which views to teach first and why, how to scaffold the learning progression, what feedback to give and when, and how to structure exercises for the four target personas. Every design decision below is grounded in two principles from the product document: **education-first interactions** and **progressive complexity**.

**Key recommendations:**

- **10 anchor views** selected for pedagogical progression, not alphabetical completeness. The first 4 views (ME 4C, ME 2C, ME LAX, TG mid-SAX) form a "core loop" that teaches the fundamental probe maneuvers -- advance/withdraw, omniplane rotation, anteflexion. The remaining 6 views expand to right-heart, aortic, and bicaval anatomy.
- **Three interaction modes:** Guided Tutorial, Free Explore, and Assessment. MVP ships Guided Tutorial and Free Explore. Assessment is Phase 2 but the data model is designed for it now.
- **Proximity-based view scoring** using a distance metric in the 5-DOF probe parameter space, with per-view tolerance windows calibrated by an expert echocardiographer.
- **Anatomical landmark labeling** that is always-on in Tutorial mode, toggle-on in Free Explore, and hidden in Assessment mode -- using a consistent color vocabulary tied to ASE structure naming.
- **Learning progression tracking** that records time-to-view, probe path efficiency, and cumulative view-set completion -- not a score that punishes exploration.

---

## 2. Architecture Diagram (ASCII) -- Learning Flow and Content Layers

```
+===========================================================================+
|                        EDUCATIONAL CONTENT LAYER                          |
+===========================================================================+
|                                                                           |
|  +------------------+    +------------------+    +-------------------+    |
|  | VIEW CATALOG     |    | EXERCISE ENGINE  |    | PROGRESS TRACKER  |    |
|  | - 10 anchor views|    | - Guided Tutorial|    | - Per-view mastery|    |
|  | - ASE metadata   |    | - Free Explore   |    | - Session logs    |    |
|  | - Difficulty tier |    | - (Assessment)   |    | - Time-to-view    |    |
|  | - Tolerance zones |    |                  |    | - Path efficiency |    |
|  +--------+---------+    +--------+---------+    +---------+---------+    |
|           |                       |                        |              |
|           v                       v                        v              |
|  +--------+---------------------------------------------------+------+   |
|  |                    TUTORIAL ENGINE                                 |   |
|  |  - Step sequencer (ordered instruction cards)                     |   |
|  |  - Probe guidance overlay (ghost probe, direction arrows)         |   |
|  |  - "Getting warmer" proximity indicator                           |   |
|  |  - View match detector (triggers success state)                   |   |
|  |  - Hint system (progressive: text -> arrow -> ghost -> auto-snap) |   |
|  +--------+---------------------------------------------------+------+   |
|           |                                                    |          |
+-----------+----------------------------------------------------+----------+
            |                                                    |
            v                                                    v
+===========================================================================+
|                        VIEW SCORING ENGINE                                |
+===========================================================================+
|                                                                           |
|  +------------------+    +------------------+    +-------------------+    |
|  | PROXIMITY METRIC |    | LANDMARK CHECKER |    | IMAGE QUALITY     |    |
|  | - 5-DOF distance |    | - Required struct.|   | HEURISTIC         |    |
|  | - Per-view weight|    |   visible in FOV  |    | - Sector coverage |    |
|  | - Tolerance band |    | - Aspect ratios   |    | - Centering score |    |
|  +--------+---------+    +--------+---------+    +---------+---------+    |
|           |                       |                        |              |
|           +-----------+-----------+------------------------+              |
|                       |                                                   |
|                       v                                                   |
|              +--------+---------+                                         |
|              | COMPOSITE SCORE  |   0.0 (lost) --- 0.7 (close) --- 1.0   |
|              | "View Match %"   |   Thresholds: match > 0.85             |
|              +------------------+   near-match > 0.60                     |
|                                                                           |
+===========================================================================+
            |
            v
+===========================================================================+
|                     ANATOMICAL LANDMARK SYSTEM                            |
+===========================================================================+
|                                                                           |
|  +------------------+    +------------------+    +-------------------+    |
|  | LABEL REGISTRY   |    | VISIBILITY RULES |    | COLOR VOCABULARY  |    |
|  | - Structure name |    | - Tutorial: ON   |    | - LV/LA = Red     |    |
|  | - ASE abbrev.    |    | - Explore: TOGGLE|    | - RV/RA = Blue    |    |
|  | - 3D centroid    |    | - Assess: OFF    |    | - Aorta = Yellow  |    |
|  | - Label anchor pt|    | - Proximity fade |    | - Valves = Green  |    |
|  | - Importance tier|    |   (show when near)|   | - Veins = Purple  |    |
|  +------------------+    +------------------+    +-------------------+    |
|                                                                           |
+===========================================================================+
            |
            v
+===========================================================================+
|                    PROBE & RENDERING LAYER (below this doc's scope)       |
|  5-DOF probe model  |  Pseudo-TEE rendering  |  3D scene  |  Oblique     |
+===========================================================================+
```

---

## 3. Component Breakdown

### 3.1 Tutorial Engine

**Purpose:** Deliver step-by-step guided instruction for finding each standard view, mimicking a senior echocardiographer standing behind a trainee saying "now rotate omniplane to 90 degrees."

**Design:**

Each tutorial is a sequence of **instruction cards**. A card contains:

| Field | Type | Example |
|-------|------|---------|
| `step_id` | string | `"me4c_step_03"` |
| `instruction_text` | string | `"Rotate the omniplane angle to approximately 0-10 degrees."` |
| `target_dof` | object | `{ omniplane: { min: 0, max: 15 } }` |
| `anatomy_note` | string | `"At 0 degrees, the imaging plane cuts through all four chambers simultaneously."` |
| `hint_level_1` | string | `"The omniplane dial is at the bottom of the probe controls."` |
| `hint_level_2` | string | Arrow overlay pointing to omniplane slider. |
| `hint_level_3` | action | Auto-animate omniplane to target value. |
| `success_condition` | function | View scoring composite > 0.85 for target view. |
| `labels_to_highlight` | string[] | `["LV", "RV", "LA", "RA", "MV", "TV"]` |

**Hint escalation:** If the trainee has not progressed after 30 seconds, offer hint level 1 (text). After 60 seconds, hint level 2 (visual arrow). After 90 seconds, hint level 3 (auto-animate). The trainee can skip ahead or replay any step.

**Tutorial sequence per view:** Each anchor view tutorial follows a 4-step pattern:
1. **Orient** -- Start from a known position (usually ME 4C as "home base"). Show the 3D anatomy and explain what station the probe is at.
2. **Navigate** -- Step-by-step probe manipulation instructions. One DOF change per step where possible.
3. **Identify** -- Label the structures visible in the pseudo-TEE image. Quiz: "Which structure is at the 3 o'clock position?"
4. **Verify** -- Show the ASE reference image side by side. Highlight correspondences.

**MVP scope:** Tutorials authored for all 10 anchor views. Each tutorial is 4-8 instruction cards. Total: approximately 50-70 cards.

### 3.2 View Scoring Engine

**Purpose:** Continuously evaluate how close the current probe position is to each standard view and report a match score.

**Algorithm:**

The scoring engine computes a **weighted distance** in the normalized 5-DOF parameter space for each anchor view:

```
d(current, target) = sqrt(
    w_s   * ((s - s_target)   / range_s)^2   +
    w_r   * ((roll - roll_t)  / range_roll)^2 +
    w_a   * ((ante - ante_t)  / range_ante)^2 +
    w_l   * ((lat - lat_t)    / range_lat)^2  +
    w_o   * ((omni - omni_t)  / range_omni)^2
)
```

Where:
- `w_s`, `w_r`, `w_a`, `w_l`, `w_o` are per-view importance weights (some views are more sensitive to omniplane than to position, etc.)
- `range_*` are the full ranges of each DOF for normalization
- The composite score = `max(0, 1 - d)`, clamped to [0, 1]

**Per-view tolerance windows:** Each anchor view has an expert-calibrated tolerance ellipsoid in 5-DOF space. This is critical because:
- ME 4C has narrow tolerance on omniplane (must be near 0) but moderate tolerance on position
- TG mid-SAX has narrow tolerance on position (must be in the stomach) and anteflexion (must flex anteriorly) but moderate tolerance on omniplane (0-20 degrees)
- ME Aortic Arch LAX tolerates a wider position range (moves along the arch) but is sensitive to omniplane (0 degrees)

**Landmark visibility check:** In addition to DOF distance, the scorer verifies that required anatomical structures are within the imaging sector field of view. For ME 4C, the four chambers and both AV valves must be visible. If structures are missing, the score is penalized even if DOF values are close to the target.

**Thresholds:**

| Score | Label | UI Feedback |
|-------|-------|-------------|
| >= 0.85 | **Match** | Green checkmark, view name displayed, confetti-free success state |
| 0.60 - 0.84 | **Near** | Amber indicator, "Getting warmer" text, closest view name shown |
| < 0.60 | **Exploring** | No match indicator, "Keep exploring" or show distance to nearest view |

**Important design decision:** The scorer runs continuously in Free Explore mode and reports the nearest matching view as a passive label in the corner of the screen. It does NOT interrupt the user or force them toward a view. In Tutorial mode, the scorer drives the step-completion logic.

### 3.3 Anatomical Landmark Labeling System

**Purpose:** Overlay structure names on the pseudo-TEE image and 3D scene to build the trainee's ability to identify cardiac anatomy.

**What to label (MVP, 10-view scope):**

| Category | Structures | Color | ASE Abbreviation |
|----------|-----------|-------|-------------------|
| Left heart chambers | Left Ventricle, Left Atrium | Red (#D32F2F) | LV, LA |
| Right heart chambers | Right Ventricle, Right Atrium | Blue (#1976D2) | RV, RA |
| Atrioventricular valves | Mitral Valve, Tricuspid Valve | Green (#388E3C) | MV, TV |
| Semilunar valves | Aortic Valve, Pulmonic Valve | Green (#66BB6A, lighter) | AV, PV |
| Great vessels | Aorta (ascending, arch, descending), Pulmonary Artery, SVC, IVC | Yellow/Amber (#F9A825) | Ao, PA, SVC, IVC |
| Septa | Interatrial Septum, Interventricular Septum | Gray (#757575) | IAS, IVS |
| Veins | Pulmonary Veins (if visible), Coronary Sinus | Purple (#7B1FA2) | LUPV, RUPV, CS |
| Pericardium | Pericardium | Light gray outline | Peri |

**Labeling rules:**

1. **Labels attach to the 2D pseudo-TEE image, not just the 3D scene.** This is pedagogically critical. Trainees must learn to read the ultrasound image, and labels on the 3D model alone do not build that skill.
2. **Leader lines** connect the label text to the structure boundary to avoid ambiguity.
3. **Priority tiers:** Not all labels show at once. Tier 1 (chambers, valves) always shows when labels are on. Tier 2 (septa, great vessels) shows on hover or when zoomed. Tier 3 (veins, pericardium) shows only when explicitly toggled or when relevant to the current tutorial step.
4. **Fade-on-proximity:** In Free Explore mode, labels for structures within the current imaging plane fade in as the probe approaches a standard view. This teaches the trainee to associate probe position with visible anatomy.

**Color coding rationale:** The left-heart = red, right-heart = blue convention matches standard echocardiography teaching and is used by ASE educational materials, Hahn's TEE textbook, and most fellowship programs. Green for valves distinguishes them from chambers. Yellow/amber for great vessels avoids confusion with Doppler color conventions (which are not simulated in MVP).

### 3.4 Progress Tracker

**Purpose:** Record the trainee's learning trajectory and surface it in a way that motivates continued practice without creating anxiety.

**Metrics tracked per session:**

| Metric | Definition | Why It Matters |
|--------|-----------|----------------|
| `views_found` | Set of anchor views matched (score >= 0.85) during this session | Core competency: can you find the view? |
| `time_to_view` | Seconds from session start (or from previous view match) to each view match | Efficiency improves with practice |
| `probe_path_length` | Total distance traveled in normalized 5-DOF space | Shorter path = more efficient navigation = better spatial model |
| `hint_count` | Number of hints used per view in Tutorial mode | Tracks independence vs. reliance on guidance |
| `near_miss_count` | Number of times score entered 0.60-0.84 range before achieving match | Measures how much "searching" happens near the target |
| `session_duration` | Total time spent in the simulator | Engagement metric |

**Metrics tracked across sessions (cumulative):**

| Metric | Definition | Competency Signal |
|--------|-----------|-------------------|
| `views_mastered` | Views found without hints in under 60 seconds | Mastery = unassisted + fast |
| `exploration_map` | Heat map of 5-DOF space visited | Shows probe manipulation comfort zones and blind spots |
| `view_set_completion` | Fraction of 10 anchor views mastered | Overall progress toward MVP competency |
| `streak` | Consecutive sessions with at least 1 new view mastered | Engagement hook |
| `total_practice_time` | Cumulative hours | Correlates with NBE TEE exam readiness in literature |

**Competency tiers (displayed to trainee):**

| Tier | Criteria | Label |
|------|----------|-------|
| 1 - Novice | 0-3 views mastered | "Learning the basics" |
| 2 - Developing | 4-6 views mastered | "Building your repertoire" |
| 3 - Proficient | 7-9 views mastered | "Approaching competency" |
| 4 - Competent | 10/10 views mastered, average time-to-view < 45s | "Ready for supervised cases" |

**Design decision: NO leaderboards.** Medical education is not a competition. Trainees already face enough performance anxiety. The progress tracker is private to the individual and visible to their assigned educator (if one exists). Comparative metrics are explicitly excluded from MVP.

### 3.5 Exercise Modes

**3.5.1 Guided Tutorial Mode**

- Linear step-by-step instruction
- Labels always visible
- Probe guidance overlays active
- Hint escalation enabled
- Score feedback continuous
- Typical session: 20-30 minutes for one view tutorial

**Pedagogical flow for a single view tutorial:**

```
START -> "Welcome to the ME Four-Chamber View"
  |
  v
[Context Card]  "The ME 4C is the most common starting view in a TEE exam.
                 It shows all four chambers and both AV valves."
  |
  v
[Orient Card]   "The probe is currently at the mid-esophageal station.
                 Look at the 3D view -- the probe tip is behind the left atrium."
                 [3D view highlights probe position, LA glows]
  |
  v
[Navigate Card 1] "Ensure the omniplane angle is at 0 degrees."
                   [Omniplane slider highlighted, target zone shown]
  |
  v
[Navigate Card 2] "Gently retroflex the probe to bring the LV apex into view."
                   [Ante/retro slider highlighted, direction arrow shown]
  |
  v
[Identify Card]  "Label the structures you see."
                  [Interactive: trainee taps on structures in pseudo-TEE image,
                   selects from a list. Correct answers highlight green.]
  |
  v
[Verify Card]    "Compare your view to the ASE reference."
                  [Side-by-side: trainee's pseudo-TEE vs. reference ME 4C image]
                  [Overlay: matched structures connected with lines]
  |
  v
[Success Card]   "You found the ME 4C! Key structures: LV, RV, LA, RA, MV, TV."
                  [Mark view as found in progress tracker]
  |
  v
[Transition]     "Next: ME Two-Chamber View. You'll rotate the omniplane to ~60 degrees."
```

**3.5.2 Free Explore Mode**

- No step sequence
- All probe DOFs unlocked
- Labels togglable (default: Tier 1 visible)
- Passive view matching indicator in corner ("Nearest view: ME 4C, 78%")
- View catalog panel (collapsible): shows all 10 views with thumbnails, tap to auto-navigate to that view's preset position
- "Snap to nearest view" button: if score > 0.60, auto-adjusts probe to nearest match
- Bookmark button: save current probe position with a custom label

**Pedagogical rationale:** Free exploration builds the internal spatial model that no amount of guided instruction can replace. The trainee needs to see what happens when they rotate omniplane from 0 to 180 degrees at a fixed position. They need to experience the continuous transformation of anatomy across the imaging plane. The passive view indicator provides scaffolding without constraining exploration.

**3.5.3 Assessment Mode (Phase 2, data model defined now)**

- Random or educator-selected view target presented
- No labels, no hints, no guidance overlays
- Timer starts
- Trainee navigates to the target view
- Score recorded on match (or timeout at 120 seconds)
- Results visible to educator dashboard

Assessment mode is Phase 2 because it requires the educator persona infrastructure (accounts, assignment, dashboard). However, the scoring engine, progress tracker, and view catalog are all designed in MVP to support this mode without refactoring.

---

## 4. Data Flow: From Probe Position to Educational Feedback

```
[User Input]                    [Probe Model]                [Rendering]
 Slider / drag / keyboard  -->  5-DOF state update   ------> Pseudo-TEE image
                                {s, roll, ante, lat, omni}   3D scene update
                                        |                    Oblique slice
                                        |
                                        v
                               [View Scoring Engine]
                                        |
                          +-------------+--------------+
                          |             |              |
                          v             v              v
                    [5-DOF distance] [Landmark      [Image quality
                     to each of 10   visibility      heuristic]
                     anchor views]   check]
                          |             |              |
                          +------+------+--------------+
                                 |
                                 v
                        [Composite Score per view]
                                 |
                    +------------+------------+
                    |            |            |
                    v            v            v
              score >= 0.85  0.60-0.84    < 0.60
              VIEW MATCH     NEAR MATCH   EXPLORING
                    |            |            |
                    v            v            v
            [Tutorial Engine]  [UI Feedback]  [UI Feedback]
             advance to       "Getting       "Keep exploring"
             next step        warmer:        or show distance
                              ME 4C 72%"     to nearest
                    |
                    v
            [Progress Tracker]
             log: view found,
             time, path length,
             hints used
                    |
                    v
            [Local Storage / JSON export]
             session history,
             cumulative metrics,
             competency tier
```

**Latency requirement:** The loop from probe state change to score update to UI feedback must complete in under 50ms (one frame at 20fps). The scoring function itself is trivial (weighted Euclidean distance + structure visibility lookup), so this is not a performance concern. The rendering pipeline is the bottleneck, not the education layer.

**Label update flow:** When the probe moves, the landmark labeling system checks which structures intersect the current imaging plane (derived from the probe model's sector geometry). Labels for intersected structures are activated. This list is compared against the per-view required-structure list to drive the landmark visibility check in the scoring engine.

---

## 5. Tech Stack Choices for Education Features

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Tutorial step sequencer** | JSON-driven state machine, rendered by React | Tutorials are content, not code. Authored as JSON, interpreted at runtime. Easy for educators to modify without touching source. |
| **View scoring** | Pure TypeScript function, no dependencies | Must run every frame. No library overhead. Unit-testable in isolation. |
| **Progress tracker** | `localStorage` + optional JSON export | No backend in MVP. Trainee data stays on their device. JSON export enables offline educator review. |
| **Landmark labels (2D overlay)** | HTML/CSS overlay on top of VTK.js canvas | VTK.js label rendering is limited. HTML labels with CSS positioning give full typographic control, accessibility (screen readers), and easy internationalization. |
| **Landmark labels (3D scene)** | VTK.js `vtkBillboardWidget` or HTML overlay with 3D-to-2D projection | 3D labels must track camera rotation. HTML overlay with `worldToDisplay` projection is simpler and more performant than VTK.js widget system. |
| **Tutorial content authoring** | JSON files in `content/tutorials/` | Flat files, version-controlled, no CMS. Educators can submit PRs or use a future web-based editor. |
| **Color vocabulary** | CSS custom properties (design tokens) | Single source of truth for structure colors across 2D labels, 3D highlights, tutorial cards, and progress dashboard. |
| **Session recording** | Append-only array of `{timestamp, probe_state, score, event}` | Enables replay, path analysis, and future ML on trainee behavior. Stored in `localStorage`, exportable as JSON. |
| **Competency dashboard** | React component reading from `localStorage` | Simple bar chart showing views mastered, time trends, practice hours. No charting library needed at MVP scale -- CSS bars or inline SVG. |

**Framework alignment:** All education layer components are pure data + pure functions + React UI. They are decoupled from the rendering engine (VTK.js). If the rendering layer changes (e.g., to Three.js/R3F for lightweight mode, or WebGPU), the education layer is unaffected.

---

## 6. MVP Scope: The 10 Anchor Views

### 6.1 View Selection Rationale

The ASE/SCA 2013 comprehensive TEE guidelines define 28 standard views. For an MVP with a pedagogical focus, we select 10 views that:

1. **Cover the most clinically important assessments** (LV function, valvular disease screening, volume status)
2. **Exercise all 5 probe DOFs** so the trainee builds complete manipulation skill
3. **Progress from simple to complex probe maneuvers** to scaffold learning
4. **Span all probe stations** (ME, TG) to build spatial awareness of the full exam
5. **Include at least one view for each major structure** (LV, RV, LA, RA, AV, MV, TV, aorta, SVC/IVC)

### 6.2 The 10 Anchor Views in Learning Order

| Order | View | ASE Name | Station | Omniplane | Primary DOF Exercised | Difficulty | Pedagogical Role |
|-------|------|----------|---------|-----------|----------------------|------------|------------------|
| 1 | **ME 4C** | Mid-Esophageal Four-Chamber | ME | 0-10 deg | Position (s), slight retroflexion | Beginner | **Home base.** First view learned. All four chambers visible. Teaches basic probe position and the concept of omniplane at 0 degrees. Every tutorial starts here. |
| 2 | **ME 2C** | Mid-Esophageal Two-Chamber | ME | 60-70 deg | Omniplane rotation | Beginner | **First rotation.** Same probe position as ME 4C, only omniplane changes. Teaches that rotating omniplane changes the imaging plane without moving the probe. LA and LV only -- trainee learns to distinguish from 4C. |
| 3 | **ME LAX** | Mid-Esophageal Long-Axis | ME | 120-140 deg | Omniplane rotation | Beginner | **Completing the rotation triad.** Continues omniplane rotation from ME 2C. LVOT and aortic valve come into view. Teaches the "3 views from one position" concept that is fundamental to efficient TEE examination. |
| 4 | **TG mid-SAX** | Transgastric Mid Short-Axis | TG | 0-20 deg | Position (advance into stomach), anteflexion | Beginner-Intermediate | **First station change.** Trainee advances probe into the stomach and anteflexes. Dramatic change in anatomy (cross-section of LV, papillary muscles). Teaches that probe station fundamentally changes the imaging perspective. |
| 5 | **ME AV SAX** | Mid-Esophageal Aortic Valve Short-Axis | ME | 30-50 deg | Position (withdraw slightly from 4C), omniplane | Intermediate | **Aortic valve focus.** Introduces the aortic valve, the "Mercedes-Benz sign" of the three cusps, and relationships to RA, LA, RV, IAS, TV, PV. Critical view for aortic stenosis assessment. |
| 6 | **ME AV LAX** | Mid-Esophageal Aortic Valve Long-Axis | ME | 120-140 deg | Omniplane from AV SAX position | Intermediate | **Paired with AV SAX.** Teaches the concept of viewing the same structure (aortic valve) from orthogonal planes. LVOT, aortic root, proximal ascending aorta visible. Essential for aortic regurgitation and root pathology. |
| 7 | **ME RV Inflow-Outflow** | Mid-Esophageal RV Inflow-Outflow | ME | 60-90 deg | Omniplane, slight lateral flex toward RV | Intermediate | **Right heart introduction.** First view focused primarily on right-sided structures. TV, RV, RVOT, PV visible. Teaches that the right heart requires deliberate effort to image -- it is often undertaught. |
| 8 | **ME Bicaval** | Mid-Esophageal Bicaval | ME | 80-110 deg | Omniplane, slight clockwise rotation (roll) | Intermediate | **Interatrial septum and venous return.** SVC, IVC, RA, IAS visible. Critical for ASD evaluation and catheter/wire visualization. Teaches axial roll as a DOF. |
| 9 | **ME Asc Aortic SAX** | Mid-Esophageal Ascending Aortic Short-Axis | UE-ME | 0-10 deg | Position (withdraw toward UE), slight rotation | Intermediate-Advanced | **Great vessel relationships.** Ascending aorta, SVC, PA, right PA visible. Teaches upper esophageal anatomy and the spatial relationship of the great vessels. |
| 10 | **ME Desc Aortic SAX/LAX** | Mid-Esophageal Descending Aortic Short-Axis and Long-Axis (combined) | ME | 0 deg (SAX) / 90 deg (LAX) | Position (rotate probe posteriorly / leftward), omniplane toggle | Advanced | **Aortic assessment.** Teaches imaging a structure posterior to the probe (descending aorta is directly behind the esophagus). The SAX-to-LAX toggle at a single position reinforces the omniplane concept. Important for aortic dissection, atheroma. |

### 6.3 Why These 10, Not Others

**Included and why:**

- **ME 4C / 2C / LAX triad (views 1-3):** These three views from a single probe position are the cornerstone of the TEE exam. They assess LV systolic function (wall motion in three orthogonal planes), mitral valve (all segments), and LVOT/aortic valve. The ASE comprehensive exam begins here. Teaching these first establishes the home base and the omniplane rotation concept.
- **TG mid-SAX (view 4):** The only transgastric view in MVP. It provides an orthogonal perspective to the ME views, shows the LV in short-axis for regional wall motion assessment (the 16-segment model), and forces the trainee to learn the advance-and-anteflex maneuver. Without it, the trainee never leaves mid-esophageal.
- **ME AV SAX / LAX (views 5-6):** The aortic valve is the second most assessed structure after the mitral valve. These two views teach the paired SAX/LAX concept that recurs throughout TEE.
- **ME RV Inflow-Outflow (view 7):** Right heart assessment is consistently underperformed by trainees. Including it early in the curriculum corrects this bias.
- **ME Bicaval (view 8):** Interatrial septum visualization is critical for structural heart procedures (ASD closure, transseptal puncture for MitraClip/TEER). Also teaches the roll DOF.
- **ME Asc Aortic SAX (view 9):** Extends the trainee's spatial model upward into the great vessels. PA and SVC are important for intraoperative monitoring.
- **Desc Aortic SAX/LAX (view 10):** The descending aorta is uniquely easy to image (right behind the probe) but conceptually challenging (posterior structure, reversed orientation). Teaching it completes the aortic assessment chain.

**Deferred to Phase 2 and why:**

- **Deep Transgastric Long-Axis (DTG LAX):** Technically challenging (deep in the stomach, extreme anteflexion). Important for Doppler alignment but Doppler is not in MVP. Defer.
- **TG Two-Chamber / TG LAX / TG RV Inflow:** Additional transgastric views add value but not until the trainee is comfortable with TG mid-SAX. Phase 2.
- **UE Aortic Arch views (LAX, SAX):** Important for aortic surgery but specialized. The ME Asc Aortic SAX provides entry to great vessel anatomy without requiring upper esophageal navigation. Phase 2.
- **ME LAA / Pulmonary Vein views:** Critical for AF ablation and LAAO but require fine anatomical detail (LAA lobes, PV ostia) that is not well served by bundle-safe public data at MVP. Phase 2.
- **ME Mitral Commissural:** Valuable for mitral valve assessment but the ME 4C/2C/LAX triad already covers all mitral segments. Commissural view adds nuance, not fundamentals. Phase 2.

### 6.4 Difficulty Progression Map

```
BEGINNER (Views 1-3)                INTERMEDIATE (Views 4-8)           ADVANCED (Views 9-10)
"The Omniplane Triad"               "Station Changes & New Structures"  "Spatial Mastery"
                                    
ME 4C ----omniplane----> ME 2C     TG mid-SAX  (station change)        ME Asc Ao SAX (UE/ME)
  |                        |        ME AV SAX   (position + omni)       Desc Ao SAX/LAX
  |       omniplane        |        ME AV LAX   (paired view)           (posterior anatomy)
  |                        |        ME RV I/O   (lateral flex)
  +-------> ME LAX <------+        ME Bicaval   (roll DOF)
                                    
DOFs introduced:                    DOFs introduced:                    DOFs introduced:
  - Position (s)                      - Anteflexion (TG SAX)              - Position range (UE-ME)
  - Omniplane (0-140 deg)             - Lateral flex (RV I/O)             - Posterior orientation
  - Slight retroflexion               - Roll (Bicaval)                    - Combined maneuvers
                                      - Position + omniplane combos
```

---

## 7. Directory Structure for Educational Content

```
src/
  education/
    scoring/
      viewScorer.ts            # Composite scoring function
      viewScorer.test.ts       # Unit tests: known probe states -> expected scores
      dofDistance.ts            # 5-DOF weighted Euclidean distance
      landmarkVisibility.ts    # Check which structures are in the imaging sector
      types.ts                 # ScoreResult, ViewMatch, ToleranceWindow types
    
    tutorial/
      TutorialEngine.tsx       # React component: step sequencer + UI
      TutorialCard.tsx         # Single instruction card renderer
      HintSystem.tsx           # Progressive hint escalation logic + UI
      ProbeGuidance.tsx        # Ghost probe overlay, direction arrows
      types.ts                 # TutorialStep, HintLevel, TutorialState types
    
    landmarks/
      LabelOverlay.tsx         # HTML overlay for 2D pseudo-TEE labels
      LabelOverlay3D.tsx       # HTML overlay for 3D scene labels (worldToDisplay)
      LabelRegistry.ts         # Structure name, abbreviation, color, tier, centroid
      visibilityRules.ts       # Per-mode label show/hide logic
      colorTokens.ts           # Design tokens for structure color vocabulary
    
    progress/
      ProgressTracker.ts       # Session recording, localStorage read/write
      CompetencyDashboard.tsx  # React component: progress bars, time trends
      SessionReplay.tsx        # (Phase 2 stub) Replay recorded probe path
      types.ts                 # SessionRecord, CumulativeMetrics, CompetencyTier types
      exportSession.ts         # JSON export for offline educator review

    exercises/
      ExerciseRouter.tsx       # Mode selector: Tutorial / Free Explore / (Assessment)
      FreeExplore.tsx          # Free explore mode UI: passive scoring, view catalog
      ViewCatalog.tsx          # Panel showing all 10 views with thumbnails
      SnapToView.tsx           # "Snap to nearest view" button logic
      AssessmentMode.tsx       # (Phase 2 stub) Assessment mode UI

content/
  tutorials/
    me-4c.json                 # Tutorial steps for ME Four-Chamber
    me-2c.json                 # Tutorial steps for ME Two-Chamber
    me-lax.json                # Tutorial steps for ME Long-Axis
    tg-mid-sax.json            # Tutorial steps for TG Mid Short-Axis
    me-av-sax.json             # Tutorial steps for ME AV Short-Axis
    me-av-lax.json             # Tutorial steps for ME AV Long-Axis
    me-rv-io.json              # Tutorial steps for ME RV Inflow-Outflow
    me-bicaval.json            # Tutorial steps for ME Bicaval
    me-asc-ao-sax.json         # Tutorial steps for ME Ascending Aortic SAX
    desc-ao.json               # Tutorial steps for Descending Aortic SAX/LAX
  
  views/
    anchor-views.json          # 10 anchor view definitions: target DOF, tolerances,
                               #   required structures, difficulty tier, ASE reference
    view-metadata.json         # ASE names, descriptions, clinical relevance text
  
  landmarks/
    structure-registry.json    # All labelable structures: name, abbreviation, color,
                               #   tier, 3D centroid (per case), 2D anchor rules
  
  progress/
    competency-tiers.json      # Tier definitions, criteria, display labels
    scoring-weights.json       # Per-view DOF weights and tolerance windows
```

**Note on case-specific content:** The `content/` directory contains case-independent educational content. Case-specific data (landmark centroids, probe paths, view preset DOF values) lives in the per-case asset directory defined in the data survey (`cases/adult_normal_f01/views.json`, `cases/adult_normal_f01/landmarks.json`). The tutorial steps reference view IDs that are resolved against the current case's `views.json`.

---

## 8. Risks and Mitigations

### 8.1 Clinical Accuracy

| Risk | Severity | Likelihood | Mitigation |
|------|----------|-----------|------------|
| Anchor view DOF presets do not match real ASE views when rendered on the anatomy | **Critical** | Medium | Expert validation workflow (see below). Each view is reviewed by a board-certified echocardiographer against ASE reference images before release. |
| Pseudo-TEE rendering looks too different from real ultrasound, confusing trainees | High | High (in MVP) | Set clear expectations in UI: "This is a CT-derived anatomical cross-section, not a real ultrasound image." Use it as a teaching strength -- trainees can see anatomy more clearly than on real echo. |
| Landmark labels are incorrectly placed (e.g., LV label on RV) | **Critical** | Low | Automated test: for each anchor view, assert that the correct structures are in the imaging sector. Manual QA pass for each case. |
| Scoring tolerances are too tight (trainees can never "find" the view) or too loose (false matches) | High | Medium | Iterative calibration. Ship with generous tolerances. Collect telemetry (opt-in) on score distributions. Tighten based on real usage data. |

**Expert validation workflow:**

1. For each of the 10 anchor views on each case, the echocardiographer:
   a. Navigates to the auto-generated preset DOF values
   b. Confirms the pseudo-TEE image matches the expected ASE view anatomy (correct structures visible, correct orientation)
   c. Adjusts DOF values if needed and saves the corrected preset
   d. Defines the tolerance window (how much can each DOF deviate before the view is "wrong"?)
   e. Approves or rejects the view
2. Approval is recorded in the case manifest (`case_manifest.json`) with validator name, date, and approval status
3. No case ships with unapproved views

**Who validates:** A cardiologist or cardiac anesthesiologist with board certification in echocardiography (NBE-certified or equivalent). For an open-source project, this means recruiting at least one clinical advisor. This is a hard dependency for clinical credibility.

### 8.2 Trainee Frustration

| Risk | Severity | Likelihood | Mitigation |
|------|----------|-----------|------------|
| Trainee cannot find any view and gives up | High | Medium (especially beginners) | Progressive hint system with auto-snap as final fallback. "View Catalog" panel with one-tap auto-navigate. Never leave the trainee stuck for more than 90 seconds. |
| 5-DOF probe manipulation is overwhelming | High | High (for anesthesia residents) | Tutorial mode introduces one DOF at a time. The first 3 views only use position + omniplane. Anteflexion introduced at view 4. Lateral flex at view 7. Roll at view 8. |
| Progress feels invisible | Medium | Medium | Competency dashboard with clear visual progress (views mastered out of 10). Per-session summary showing views found and time improvement. |
| "I found the view but the system didn't recognize it" | High | Medium | Show the composite score numerically (not just pass/fail) so the trainee sees they are at 0.82 and can fine-tune. Make tolerances generous. |
| Tutorial feels too rigid / school-like | Medium | Low | Free Explore mode is always available. Tutorials are optional. No forced progression gates. |

### 8.3 Scope Creep

| Risk | Severity | Likelihood | Mitigation |
|------|----------|-----------|------------|
| Attempting all 28 views in MVP | High | Medium | Hard cap at 10 views. The data model supports 28 (the view catalog is extensible) but only 10 have authored tutorials, calibrated tolerances, and expert-validated presets. |
| Building Assessment mode in MVP | Medium | High | Assessment mode requires educator accounts, assignment infrastructure, and a reporting dashboard. The scoring engine and progress tracker are designed for it, but the UI and backend are Phase 2. |
| Adding Doppler simulation | High | Low (non-goal is clear) | Doppler is explicitly a non-goal. The pseudo-TEE renderer produces anatomical cross-sections only. |
| Building a full LMS (learning management system) | High | Medium | TeeSim is a simulator, not an LMS. Progress tracking is local-first. Educator features are JSON export, not a dashboard with user management. Keep the scope at "spatial reasoning tutor." |
| Pathology cases in MVP | Medium | Medium | The 10 anchor views are defined on normal anatomy. Pathology (e.g., MR jet, AS calcification, pericardial effusion) requires appearance modeling that is not ready. Phase 2. |

---

## 9. Effort Estimates (T-Shirt Sizes)

| Component | Size | Estimate | Dependencies | Notes |
|-----------|------|----------|-------------|-------|
| **View Scoring Engine** | S | 2-3 days | Probe model, view presets JSON | Pure function. Main effort is calibrating per-view weights and tolerances. |
| **Landmark Label Registry** | S | 2-3 days | Structure segmentation data, color tokens | JSON authoring + TypeScript types. Per-case centroids come from the asset pipeline. |
| **Label Overlay (2D + 3D)** | M | 5-7 days | Rendering canvas dimensions, worldToDisplay projection | HTML/CSS overlay. Leader line layout is the tricky part. |
| **Tutorial Engine (step sequencer)** | M | 5-7 days | View scoring, label overlay | JSON-driven state machine. React components. Progressive hint system. |
| **Tutorial Content Authoring (10 views)** | L | 10-15 days | Tutorial engine, expert echocardiographer input | 50-70 instruction cards. Each requires clinical review for accuracy. This is the biggest content bottleneck. |
| **Free Explore Mode** | S-M | 3-5 days | View scoring, label overlay, view catalog | Passive scoring indicator + view catalog panel. |
| **Progress Tracker** | S | 2-3 days | View scoring events | localStorage CRUD + JSON export. |
| **Competency Dashboard** | S-M | 3-5 days | Progress tracker | React component with bar charts. No charting library -- CSS/SVG. |
| **Probe Guidance Overlay** | M | 5-7 days | Probe model, tutorial engine | Ghost probe rendering, direction arrows, "getting warmer" indicator. Requires 3D overlay on VTK.js canvas. |
| **Expert Validation Workflow** | M | 5-7 days (engineering) + 3-5 days (clinical reviewer time) | All 10 view presets defined, rendering working | Validation tool in 3D Slicer or browser. Approval metadata in case manifest. Clinical reviewer is a hard external dependency. |
| **View Preset Calibration (10 views x 4 cases)** | M | 5-7 days | Probe model, rendering, asset pipeline complete for all cases | 40 presets to define and tune. Requires visual verification. Should be done by someone with TEE knowledge. |
| **Session Recording / Replay** | S | 2-3 days | Probe model events | Append-only array. Replay is Phase 2 but recording starts in MVP. |
| **Assessment Mode (Phase 2)** | L | 10-15 days | Everything above + educator accounts | Deferred. Data model ready. |

**Total MVP education layer estimate:** approximately 45-65 engineering days + 3-5 days clinical reviewer time.

**Critical path:** Tutorial content authoring and expert validation are sequential dependencies. The clinical reviewer cannot validate until rendering and view presets are working. Content cannot be authored until the tutorial engine exists. Plan for these to be the last items before release.

**Parallel work:** View scoring, label overlay, progress tracker, and free explore mode can be built in parallel once the probe model and rendering are functional.

---

## Appendix A: ASE 28 Standard Views Reference

For reference, the full ASE 28 standard adult TEE views from the 2013 ASE/SCA Guidelines for Performing a Comprehensive Transesophageal Echocardiographic Examination (Hahn et al., JASE 2013;26:921-64):

| # | View Name | Station | Omniplane | In MVP? |
|---|-----------|---------|-----------|---------|
| 1 | ME Four-Chamber | ME | 0-10 | **Yes (1)** |
| 2 | ME Two-Chamber | ME | 60-70 | **Yes (2)** |
| 3 | ME Long-Axis | ME | 120-140 | **Yes (3)** |
| 4 | ME Mitral Commissural | ME | 50-70 | No |
| 5 | ME AV Short-Axis | ME | 30-50 | **Yes (5)** |
| 6 | ME AV Long-Axis | ME | 120-140 | **Yes (6)** |
| 7 | ME RV Inflow-Outflow | ME | 60-90 | **Yes (7)** |
| 8 | ME Bicaval | ME | 80-110 | **Yes (8)** |
| 9 | ME Ascending Aortic Short-Axis | UE-ME | 0-10 | **Yes (9)** |
| 10 | ME Ascending Aortic Long-Axis | UE-ME | 100-140 | No |
| 11 | ME Right Pulmonary Vein | ME | 0 | No |
| 12 | ME Left Atrial Appendage | ME | 0-30 | No |
| 13 | ME Coronary Sinus | ME | 0 | No |
| 14 | ME Modified Bicaval TV | ME | 80-110 | No |
| 15 | TG Mid Short-Axis | TG | 0-20 | **Yes (4)** |
| 16 | TG Two-Chamber | TG | 80-100 | No |
| 17 | TG Long-Axis | TG | 90-120 | No |
| 18 | TG RV Inflow | TG | 100-120 | No |
| 19 | TG Basal Short-Axis | TG | 0-20 | No |
| 20 | Deep TG Long-Axis | DTG | 0-20 | No |
| 21 | UE Aortic Arch Long-Axis | UE | 0 | No |
| 22 | UE Aortic Arch Short-Axis | UE | 90 | No |
| 23 | Desc Aortic Short-Axis | ME | 0 | **Yes (10)** |
| 24 | Desc Aortic Long-Axis | ME | 90 | **Yes (10)** |
| 25 | ME LA/PV | ME | 0-30 | No |
| 26 | ME IVC Long-Axis | ME | 80-110 | No |
| 27 | ME Hepatic Vein | ME | 80-110 | No |
| 28 | TG Apical Short-Axis | TG | 0-20 | No |

Note: Views 23 and 24 (Descending Aortic SAX and LAX) are combined as a single learning unit in our MVP (view 10) because they are obtained from the same probe position with only an omniplane change, and teaching them together reinforces the SAX/LAX pairing concept.

---

## Appendix B: Content Structure for the 4 Personas

### Cardiology Fellow

- **Entry point:** Free Explore mode (they likely have some echo background)
- **Primary workflow:** Use view catalog to jump to a target view, then practice navigating there from home base (ME 4C) without auto-snap
- **Key metric:** Time-to-view improvement across sessions
- **Tutorial use:** Optional, for unfamiliar views only
- **Session length:** 15-30 minutes
- **Content emphasis:** Probe manipulation efficiency, view optimization (fine-tuning to get the "best" version of each view)

### Cardiac Anesthesiology Resident

- **Entry point:** Guided Tutorial mode (they may have no echo background)
- **Primary workflow:** Complete tutorials in order (views 1-10). Spend extra time on the Identify step -- reading the pseudo-TEE image and naming structures.
- **Key metric:** Views mastered (found without hints), structure identification accuracy
- **Tutorial use:** Primary learning mode for first 5-10 sessions
- **Session length:** 20-30 minutes
- **Content emphasis:** Anatomical understanding first, probe manipulation second. Heavy use of 3D view to build spatial mental model.

### Attending Echocardiographer / Instructor

- **Entry point:** Free Explore mode with all labels visible
- **Primary workflow:** Jump to any view via catalog. Toggle labels on/off for teaching demonstrations. Use 3D view to show spatial relationships.
- **Key metric:** Not applicable (they are not the learner)
- **Tutorial use:** May walk through tutorials to evaluate their quality and accuracy
- **Session length:** Variable (during didactic sessions, 5-60 minutes)
- **Content emphasis:** Anatomical accuracy, label completeness, view preset correctness. This persona is the primary QA reviewer.
- **Special features:** "Presentation mode" -- hides progress tracker, enlarges labels, optimizes for projector/large screen.

### Medical Educator / Curriculum Developer

- **Entry point:** View catalog + tutorial content files
- **Primary workflow:** Review and customize tutorial JSON files. Export trainee progress data (JSON). Define which views to include in an exercise set.
- **Key metric:** Trainee completion rates across their program (requires JSON export analysis, not in-app dashboard at MVP)
- **Tutorial use:** Authoring, not consuming
- **Session length:** Variable
- **Content emphasis:** Customizability, exportability, standards alignment. Wants to map views to ACGME milestones and NBE PTEeXAM objectives.
- **MVP limitation:** No web-based curriculum editor. Educator modifies JSON files or submits requests. Phase 2 adds a web editor and educator dashboard.

---

## Appendix C: Glossary of Education-Specific Terms

| Term | Definition |
|------|-----------|
| Anchor view | One of the 10 MVP standard TEE views that serves as a learning milestone |
| Composite score | Weighted combination of DOF distance, landmark visibility, and image quality heuristic, ranging from 0.0 to 1.0 |
| Competency tier | One of four levels (Novice, Developing, Proficient, Competent) reflecting cumulative mastery of anchor views |
| Home base | ME Four-Chamber view; the starting position for all tutorials and the reference point for navigation |
| Instruction card | A single step in a guided tutorial, containing text, target DOF, anatomy notes, and hints |
| Mastered view | An anchor view that the trainee has found without hints in under 60 seconds |
| Near match | Composite score 0.60-0.84; the trainee is close but has not achieved the view |
| Omniplane triad | ME 4C, ME 2C, ME LAX -- three views obtained from the same probe position by rotating the omniplane angle |
| Tolerance window | The per-view acceptable range for each DOF; defines when a view is considered "matched" |
| View match | Composite score >= 0.85; the trainee has successfully found the target view |

---

## Related Documents

- Product overview: [`docs/product/overview.md`](../product/overview.md)
- Personas: [`docs/product/personas.md`](../product/personas.md)
- Goals and non-goals: [`docs/product/goals-non-goals.md`](../product/goals-non-goals.md)
- Public data survey: [`docs/research/2026-04-06-tee-simulator-public-data-survey.md`](2026-04-06-tee-simulator-public-data-survey.md)
- ADR-0001: [`docs/decisions/ADR-0001-mvp-architecture.md`](../decisions/ADR-0001-mvp-architecture.md)
