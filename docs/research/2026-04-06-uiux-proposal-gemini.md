# TeeSim UI/UX Redesign Proposal

**Date:** April 6, 2026  
**Status:** Research / Proposal  
**Goal:** Transform the TeeSim MVP from a developer-centric visualization tool into a polished, intuitive medical education product.

---

## Executive Summary
The current TeeSim interface effectively demonstrates the core simulation engine but suffers from "layout sprawl" and non-intuitive control mapping. To reach a clinical audience (cardiology fellows, anesthesiologists), the UI must pivot from "data visualization" to "clinical simulation." 

The primary focus is **Screen Real Estate Optimization** and **Physical Control Intuition**.

---

## 1. Layout & Workspace Management

### 1.1 Header & Status De-cluttering
*   **Current State:** The `.app-header` and `.status-strip` occupy ~15-20% of vertical space with descriptive text and technical metadata (bundle versions, loader phases).
*   **Problem:** Reduces the vertical "stage" for the 3D and ultrasound views. Technical info like "Public heart_roi.vti loaded" is irrelevant to a student.
*   **Proposed Solution:**
    *   **Collapsible HUD:** Move "TeeSim MVP shell" branding to a small corner logo.
    *   **Info Overlay:** Move technical status pills into a "System Info" modal or a drawer.
    *   **Clinical Mode:** By default, hide everything except the Case Title and a "Reset Probe" button.
*   **Priority:** P0

### 1.2 The "Stage" approach
*   **Current State:** Rigid 3-pane grid (`.pane-grid`).
*   **Problem:** Equal weighting for "Oblique Slice" and "Pseudo-TEE" wastes space. The ultrasound result (Pseudo-TEE) is the "Hero" and should be largest.
*   **Proposed Solution:**
    *   **Hero View:** Make the Pseudo-TEE (Ultrasound) the primary viewport.
    *   **Picture-in-Picture (PiP):** The 3D Anatomy view should be a draggable/resizable overlay or a secondary pane that can be toggled (Spatial Reference).
    *   **Theater Mode:** A button to hide all UI chrome and focus solely on the probe/result.
*   **Priority:** P1

---

## 2. Probe Controls: From Sliders to "Virtual Probe"

### 2.1 2D Flex Pad
*   **Current State:** "Ante/Retro" and "Lateral" are two separate HTML range sliders.
*   **Problem:** In a real TEE probe, these are controlled by two concentric wheels on the handle. Sliders don't capture the "joypad" feel of the probe tip.
*   **Proposed Solution:**
    *   **Trackpad Control:** A square 2D input area where dragging $(x, y)$ controls both flex degrees simultaneously.
    *   **Visual Feedback:** A "ghost" icon of the probe tip bending in real-time within the control.
*   **Priority:** P0

### 2.2 Rotational Dial (Omniplane)
*   **Current State:** 0-180° range slider.
*   **Problem:** Medical students think of Omniplane in terms of "fanning" through the heart.
*   **Proposed Solution:**
    *   **Semi-Circular Dial:** A 180-degree gauge UI. Users click and drag along the arc.
    *   **Snapping:** Optional "snap-to" common angles (0°, 45°, 90°, 135°).
*   **Priority:** P1

### 2.3 Depth & Rotation (The "Shaft")
*   **Current State:** "Position (s)" and "Roll" sliders.
*   **Problem:** These represent physical movement of the probe shaft in the esophagus.
*   **Proposed Solution:**
    *   **Vertical Scrubber:** A vertical rail representing the esophagus. Sliding up/down controls Depth ($s$).
    *   **Station Markers:** Visual ticks on the rail labeled "UE" (Upper Esophageal), "ME" (Mid Esophageal), "TG" (Transgastric).
*   **Priority:** P1

---

## 3. Visual Design & Clinical Aesthetic

### 3.1 Color Palette: "Echo-Dark"
*   **Current State:** Generic dark theme with gradients.
*   **Proposed Solution:** 
    *   **Base:** Deep charcoal (`#0B0E14`) to minimize eye strain.
    *   **Accents:** Medical Blue (`#007AFF`) for controls, Phosphor Green (`#32D74B`) for successful matches.
    *   **UI Surface:** Use "Glassmorphism" (backdrop-filter: blur) for HUD panels to make them feel like modern medical software (e.g., modern GE Echo machines).
*   **Priority:** P2

### 3.2 Typography
*   **Current State:** IBM Plex Sans.
*   **Proposed Solution:** Continue using IBM Plex Sans (highly legible) but increase contrast for label text. Use a monospaced font for numerical coordinates to prevent layout jitter during movement.
*   **Priority:** P2

---

## 4. View Matching: "The Homing HUD"

### 4.1 "Warmer/Cooler" Guidance
*   **Current State:** Static Green/Amber/Gray pills.
*   **Problem:** Doesn't tell the user *how* to get to Green.
*   **Proposed Solution:**
    *   **Directional Cues:** If the user is at ME 4-Chamber but Omniplane is off, show a small arrow: "Rotate Omniplane +15°".
    *   **Proximity Glow:** The border of the Pseudo-TEE viewport should "pulse" faster/brighter as the match quality (RMSE) improves.
    *   **Ghost Overlay:** A faint, semi-transparent "ideal slice" overlaid on the user's current slice when they are "Near" (Amber).
*   **Priority:** P1

---

## 5. Responsive Strategy

### 5.1 Tablet (768px - 1024px)
*   **Current State:** Stacks vertically, rendering panes become too small.
*   **Proposed Solution:**
    *   **Landscape-only requirement:** Prompt the user to rotate.
    *   **Split View:** Left 60% is Pseudo-TEE, Right 40% is a tabbed panel for (3D / Controls).
*   **Priority:** P1

### 5.2 Mobile (< 768px)
*   **Current State:** Effectively broken/unusable.
*   **Proposed Solution:** 
    *   **Single-Pane HUD:** Mobile should focus exclusively on the "Result" (Pseudo-TEE). 
    *   **Gyroscope Integration:** Allow users to "Roll" the probe by physically rotating their phone.
*   **Priority:** P2

---

## 6. Onboarding: "The First Probe"

### 6.1 Interactive Tutorial
*   **Problem:** New users don't know the 5-DOF mapping.
*   **Proposed Solution:**
    *   **Guided Task:** "Your first mission: Find the Mid-Esophageal 4-Chamber view. Follow the arrows."
    *   **Tooltip Sequence:** Point out the 2D Flex pad vs. the Omniplane dial.
*   **Priority:** P1

---

## 7. Accessibility

### 7.1 Key Mappings
*   **Requirement:** Ensure all 5-DOF are mapped to predictable keys (e.g., `WASD` for Flex, `QE` for Roll, `ArrowUp/Down` for Depth).
*   **Screen Readers:** Label all 3D canvases with "Live Ultrasound Simulation" and provide "Current View" descriptions (e.g., "Current view matches ME 4-Chamber with 92% accuracy").
*   **Priority:** P2

---

## Action Plan (Implementation Waves)

1.  **Wave 1 (Layout):** Implement "Hero View" for Pseudo-TEE and reduce header height. (Estimated: 2 days)
2.  **Wave 2 (Controls):** Replace Sliders with 2D Flex Pad and Omniplane Dial. (Estimated: 3 days)
3.  **Wave 3 (Guidance):** Implement Ghost Overlays and Directional Cues for View Matching. (Estimated: 3 days)
