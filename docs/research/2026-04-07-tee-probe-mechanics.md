# TEE Probe Mechanics: Comprehensive Reference for Simulator Development

**Date:** 2026-04-07
**Purpose:** Fix the probe model in TeeSim by documenting exactly how a real TEE probe works
**Audience:** Developers building the probe-model and imaging-plane code in `src/core/probe-model.ts`

---

## 1. Physical Anatomy of the TEE Probe

A TEE probe has three main components:

1. **Probe handle (controller)** -- held outside the patient; contains the large wheel, small wheel, omniplane buttons, and lock switches.
2. **Flexible endoscopic shaft** -- the long tube that passes through the oropharynx into the esophagus and stomach. It has depth markings (in cm from the incisors).
3. **Probe tip (head)** -- distal end containing the phased-array transducer. Adult probes are approximately 14.5 mm wide; pediatric probes are 7.5--10 mm.

The phased-array transducer contains 64 or more piezoelectric crystals arranged in a linear row. The ultrasound beam fires **radially** (perpendicular to the shaft long axis), directed **anteriorly** toward the heart when the probe is inserted with standard orientation. This is the defining feature that makes TEE a **side-firing** device: the beam does not travel along the probe shaft but perpendicular to it, because the heart sits anterior to the esophagus rather than inline with it.

---

## 2. The Five Degrees of Freedom (5-DOF)

### 2.1 Advance / Withdraw (Insertion Depth)

| Property | Detail |
|---|---|
| **What it is** | Pushing the probe shaft deeper into the esophagus/stomach, or pulling it back toward the oropharynx |
| **Controlled by** | The hand at the patient's mouth; measured by depth markings on the shaft |
| **Effect on image** | Moves the transducer to a different cross-sectional level of the anatomy |
| **Typical ranges** | UE: 20--25 cm; ME: 30--40 cm; TG: 40--45 cm; DTG: 45--50 cm from incisors |

**Clinical notes:**
- The probe should be in a neutral (non-flexed) position when advancing or withdrawing to prevent esophageal injury.
- Clinicians rely primarily on the developing image rather than depth markings alone, because anatomy varies between patients.
- Advancing from ME to TG passes through the gastroesophageal junction (GEJ) at approximately 40 cm, where the esophagus transitions into the stomach.

**Simulator mapping (current TeeSim):** `sMm` (arc-length along the centerline in mm). Stations: UE < 80 mm, ME 80--180 mm, TG 180--260 mm, DTG > 260 mm.

### 2.2 Anteflexion / Retroflexion (Large Wheel)

| Property | Detail |
|---|---|
| **What it is** | Bending the distal tip of the probe anteriorly (toward the heart) or posteriorly (toward the spine) |
| **Controlled by** | The large control wheel on the probe handle |
| **Wheel convention** | CCW rotation of the large wheel (away from shaft) = anteflexion; CW rotation (toward shaft) = retroflexion. A notch marks neutral. |
| **Effect on image** | Anteflexion brings the transducer face closer to anterior structures (heart). Retroflexion aims the beam posteriorly. |
| **Typical range** | Approximately +/- 90 degrees of tip deflection, though the exact mechanical range varies by manufacturer. |

**Critical clinical use:**
- **TG views require significant anteflexion** because once the probe enters the stomach, the heart is superior and anterior to the GEJ. The probe tip must be anteflexed to aim the beam back up at the heart.
- Slight retroflexion at the ME level can open foreshortened ventricular views.
- Anteflexion helps "lengthen" the LV in ME four-chamber views.

**Simulator mapping (current TeeSim):** `anteDeg`. Positive = anteflexion (anterior), negative = retroflexion (posterior). Range: -90 to +90 degrees.

### 2.3 Left / Right Lateral Flexion (Small Wheel)

| Property | Detail |
|---|---|
| **What it is** | Bending the distal tip to the patient's left or right |
| **Controlled by** | The small control wheel on the probe handle |
| **Effect on image** | Steers the imaging plane laterally, shifting the field of view toward right- or left-sided structures |
| **Typical range** | Approximately +/- 90 degrees, though typically only small adjustments are used |

**Clinical notes:**
- This is the **least commonly used** DOF in standard TEE examinations. The ASE/SCA literature explicitly notes it is "a rarely used maneuver."
- With multiplane (omniplane) capability, most lateral adjustments that formerly required lateral flexion can now be achieved by combining shaft rotation with omniplane angle changes.
- Used mainly for fine optimization of views, especially the ME RV Inflow-Outflow and ME Bicaval views.

**Simulator mapping (current TeeSim):** `lateralDeg`. Range: -90 to +90 degrees.

### 2.4 Shaft Rotation (Physical Turning of the Probe)

| Property | Detail |
|---|---|
| **What it is** | Physically twisting the entire probe shaft around its long axis using a wrist-turning motion at the handle |
| **Controlled by** | The hand on the probe handle; wrist rotation CW or CCW |
| **Effect on image** | Redirects the transducer face and ultrasound beam to image structures to the patient's right (CW) or left (CCW) |
| **Typical range** | +/- 180 degrees from neutral, though typically only modest rotations are used for standard views |

**Key clinical details:**
- **Clockwise rotation** = the transducer face turns toward the patient's right = **images right-sided structures** (RA, RV, TV, SVC, IVC).
- **Counterclockwise rotation** = the transducer face turns toward the patient's left = **images left-sided structures** (LA, LV, LAA, pulmonary veins).
- At 90 degrees omniplane, turning CCW from the bicaval view brings the two-chamber view into the sector. Further CCW brings the LAA.
- Shaft rotation physically moves the entire imaging plane around the esophageal axis.

**Simulator mapping (current TeeSim):** `rollDeg`. This correctly represents rotation around the shaft (probe long axis). Range: -180 to +180 degrees.

### 2.5 Omniplane Angle (Electronic Transducer Rotation)

| Property | Detail |
|---|---|
| **What it is** | Electronic rotation of the linear phased-array scan line within the probe tip, without any physical movement of the probe |
| **Controlled by** | Two buttons on the probe handle (forward/backward), adjustable in 1-degree increments |
| **Effect on image** | Rotates the 2D imaging plane around the axis of the ultrasound beam (the beam direction perpendicular to the shaft) |
| **Range** | 0 to 180 degrees (some probes extend to -5 degrees) |

**Angle conventions (ASE/SCA 1999):**

| Omniplane Angle | Imaging Plane Orientation | Screen Left Shows |
|---|---|---|
| 0 degrees | Transverse (horizontal), perpendicular to shaft axis | Patient's right |
| 45 degrees | Oblique, between right shoulder and left hip | -- |
| 90 degrees | Longitudinal (vertical), parallel to shaft axis | Patient's inferior/feet |
| 135 degrees | Oblique, between left shoulder and right hip | -- |
| 180 degrees | Mirror of 0 degrees (transverse, flipped) | Patient's left |

**Critical geometric detail:** The omniplane rotation axis is the **central beam direction** (the line from the transducer face toward the heart, perpendicular to the probe shaft). As the omniplane angle increases from 0 to 180, the scan line rotates CCW when viewed from the transducer face looking toward the heart (i.e., looking along the beam direction).

**Simulator mapping (current TeeSim):** `omniplaneDeg`. Range: 0 to 180 degrees.

---

## 3. Shaft Rotation vs. Omniplane: The Critical Distinction

This is the most commonly confused pair of controls and the most important distinction for the simulator.

### 3.1 Geometric Difference

| Aspect | Shaft Rotation | Omniplane |
|---|---|---|
| **What moves** | The entire probe (shaft, tip, transducer) rotates around the shaft long axis | Only the electronic scan line within the transducer rotates; the probe body does not move |
| **Rotation axis** | The shaft long axis (tangent to the esophageal centerline) | The ultrasound beam direction (perpendicular to shaft, pointing anteriorly toward the heart) |
| **What it changes** | Redirects where the beam **aims** (which part of the anatomy the transducer faces) | Changes which **cross-section** of the anatomy is sampled, without changing what the transducer faces |
| **Analogy** | Turning your head left or right | Tilting the plane of a knife while keeping it pointed at the same spot |

### 3.2 When Clinicians Use Each

**Shaft rotation is used to:**
- Shift the imaging window between left-sided and right-sided cardiac structures
- Navigate from the bicaval view (rotated CW) to the two-chamber view (rotated CCW) while at 90 degrees omniplane
- Image the descending aorta (probe turned to face posteriorly/leftward)
- Fine-position the sector over a specific region of interest

**Omniplane is used to:**
- Sweep through all cross-sectional planes at a fixed probe position (e.g., at ME level with the probe facing the mitral valve, rotating from 0 to 180 degrees shows the valve from every angle)
- Transition between standard views at the same station: ME 4C (0--20 degrees) --> ME Commissural (50--70 degrees) --> ME 2C (80--100 degrees) --> ME LAX (120--160 degrees)
- Paired orthogonal views: ME AV SAX (30--60 degrees) and ME AV LAX (120--150 degrees) are obtained by rotating omniplane ~90 degrees at the same probe position

### 3.3 Combined Usage

A "near infinite number of imaging planes" can be obtained by combining physical shaft rotation with omniplane electronic rotation. This is the fundamental power of multiplane TEE. In practice, clinicians position the probe physically (advance, flex, rotate shaft) to center a structure of interest, then sweep the omniplane angle to examine that structure from multiple cross-sectional angles. Once a structure is centered in one omniplane angle, it remains centered across the entire 0--180 degree sweep.

### 3.4 Implications for TeeSim Probe Model

In `probe-model.ts`, the current implementation:
- `rollDeg` rotates the probe frame around the shaft tangent axis (correct for shaft rotation)
- `omniplaneDeg` rotates the imaging plane around the transducer's normal (beam direction) axis

The rotation axis for omniplane must be the **beam direction** (the probe's `normal` vector, pointing anteriorly toward the heart), NOT the shaft tangent. The current code in `computeImagingPlane()` does this:

```typescript
const beamDirection = vec3.normalize(
  rotateVectorAroundAxis(transducerFrame.normal, transducerFrame.tangent, omniplaneRad),
);
```

This rotates the normal (beam direction) around the tangent (shaft axis) -- which is **incorrect** for omniplane. The omniplane rotation should rotate the **scan line** around the **beam direction**, not rotate the beam direction itself. The beam direction should remain fixed for any omniplane change. See Section 8 for the correct computation.

---

## 4. Esophageal Anatomy and Probe Path Continuity

### 4.1 Esophageal Course

The esophagus runs from the cricopharyngeus (C6 level) to the stomach (T11), a length of approximately 23--25 cm. It follows the vertebral column in the posterior mediastinum:

- **Cervical segment:** Behind the trachea, anterior to C6--C8 vertebral bodies
- **Thoracic segment:** Passes posterior to the aortic arch at T4--T5, then enters the posterior mediastinum between the vertebral column and the heart
- **Abdominal segment:** Passes through the esophageal hiatus (right crus of diaphragm) at T10, terminates at the cardia at T11

### 4.2 Curvatures

The esophagus has **two gentle lateral curves** (coronal plane):
1. Deviates slightly to the left from the midline down to the root of the neck, returns to midline at T5
2. Deviates to the left again as it crosses anterior to the descending aorta before reaching the diaphragm

It also follows the **anteroposterior curvature of the vertebral column** (sagittal plane), producing a gentle S-shaped path in the sagittal view.

### 4.3 Relationship to the Heart

- The **left atrium** is the cardiac structure closest to the esophagus (directly anterior), which is why TEE provides exceptional imaging of the LA, mitral valve, and left atrial appendage.
- The esophagus sits **to the right of the descending aorta** superiorly and **anterior to the aorta** inferiorly.
- As the probe advances from the ME level into the stomach, the heart transitions from being directly anterior to being superior and slightly anterior to the cardioesophageal junction. This is why **anteflexion is required for TG views**.

### 4.4 Probe Orientation Continuity (Simulator Implications)

**The probe's anterior-facing direction should change smoothly as it advances.**

When the probe is inserted with the transducer facing anteriorly (toward the heart), this anterior direction does not suddenly jump. The esophageal curvature causes a gradual, smooth change in the probe's orientation. In the simulator:

- The **centerline path** (`CenterlinePath`) defines the esophageal trajectory with a Frenet-like frame (tangent, normal, binormal) at each sample point.
- The **normal vector** at each point should point anteriorly (toward the heart) -- this is the default beam direction.
- The **tangent vector** points along the esophageal centerline in the direction of advancement (caudal/inferior).
- As the probe advances, these vectors should interpolate smoothly. There should be **no discontinuities** at the GEJ or anywhere else.
- The transition from ME to TG involves the tangent vector curving anteriorly and then inferiorly as the esophagus passes through the diaphragm and into the stomach, but this is a smooth geometric transition, not a sudden jump.

**Practical check:** If the user advances the probe slowly from 80 mm to 260 mm with all other DOFs at zero, the imaging plane should sweep smoothly through the anatomy without any sudden flips or jumps in orientation.

---

## 5. Screen Depth in TEE

### 5.1 What "Depth" Means

"Depth" on the echo machine controls **how far from the transducer the display shows** -- it sets the maximum distance displayed on screen. It is NOT the insertion depth of the probe.

- **Near field** (top of sector display) = structures closest to the transducer (posterior structures, closest to esophagus)
- **Far field** (bottom of sector display) = structures farthest from the transducer (anterior structures, farther from esophagus)

The sector is displayed as a **pie-shaped wedge** with the apex (vertex) at the top representing the transducer location.

### 5.2 How Depth Affects the Display

| Depth Setting | Effect |
|---|---|
| Too shallow | Structures of interest may be cut off; only near-field visible |
| Optimal | Structure of interest fills the display; maximum detail and frame rate |
| Too deep | Structures appear small; frame rate decreases (longer round-trip time for pulses); lateral resolution degrades |

**Key principle:** "Set the depth just beyond the structure of interest." Doubling the depth halves the frame rate.

### 5.3 Typical Depth Settings by View

| View Category | Typical Sector Depth | Rationale |
|---|---|---|
| ME four-chamber, ME two-chamber, ME LAX | 12--16 cm | Must include all four chambers or full LV; heart is 2--8 cm anterior to esophagus |
| ME AV SAX, ME AV LAX | 10--14 cm | Aortic valve is in near/mid field |
| TG mid SAX | 6--12 cm | After anteflexion, the LV is close to the probe; minimize depth for detail |
| Descending aorta views | 6--8 cm | Aorta is immediately adjacent to the esophagus |
| ME Bicaval | 10--14 cm | Need to include SVC and IVC |

**Example from literature:** A transgastric mid short-axis view optimized at 6 cm depth (centered on the LV) achieved 47 Hz frame rate. Increasing depth unnecessarily reduced image size and frame rate.

### 5.4 Simulator Implications

The TeeSim simulator should support an adjustable sector depth parameter (in cm). The Virtual TEE (Toronto) simulator includes "change the sector depth" as one of its user controls. This depth parameter:

- Determines how much of the volume is sampled along the beam direction
- Affects the visual size of the sector fan on screen
- Should default to approximately 12--14 cm for ME views and 6--10 cm for TG views

---

## 6. Standard TEE Views: Complete Reference

### 6.1 The 20 Original ASE/SCA Cross-Sectional Views (1999)

Plus 8 additional views added in the 2013 update for a total of 28 recommended views. The basic perioperative exam (2013) covers 11 views.

### 6.2 Key Views with Parameters

| # | View | Abbreviation | Station | Probe Depth (cm) | Omniplane (deg) | Shaft Rotation | Flexion Notes |
|---|---|---|---|---|---|---|---|
| 1 | ME Four-Chamber | ME 4C | ME | 30--35 | 0--20 | Neutral | Slight retroflexion may open LV apex |
| 2 | ME Five-Chamber | ME 5C | ME | 30--35 | 0--10 | Neutral | Slight withdrawal from 4C opens LVOT |
| 3 | ME Two-Chamber | ME 2C | ME | 30--35 | 80--100 | Slight CCW | -- |
| 4 | ME Long-Axis | ME LAX | ME | 30--35 | 120--160 | Neutral | -- |
| 5 | ME Mitral Commissural | ME MC | ME | 30--35 | 50--70 | Neutral | -- |
| 6 | ME AV Short-Axis | ME AV SAX | ME | 30--35 | 25--50 | Neutral to slight CW | Slight withdrawal from 4C |
| 7 | ME AV Long-Axis | ME AV LAX | ME | 30--35 | 120--150 | Neutral to slight CW | -- |
| 8 | ME RV Inflow-Outflow | ME RV I-O | ME | 30--35 | 50--90 | CW rotation | May need rightward flex |
| 9 | ME Bicaval | ME Bicaval | ME | 30--35 | 80--110 | CW rotation | -- |
| 10 | ME Ascending Aorta SAX | ME Asc Ao SAX | ME | 30--35 | 0--45 | Neutral | Slight withdrawal |
| 11 | ME Ascending Aorta LAX | ME Asc Ao LAX | ME | 30--35 | 100--150 | Neutral | -- |
| 12 | TG Mid Papillary SAX | TG SAX | TG | 40--45 | 0--20 | Neutral | **Significant anteflexion required** |
| 13 | TG Basal SAX | TG Basal SAX | TG | 40--45 | 0--20 | Neutral | Less anteflexion than mid |
| 14 | TG Two-Chamber | TG 2C | TG | 40--45 | 80--100 | Neutral | Anteflexion |
| 15 | TG LAX | TG LAX | TG | 40--45 | 90--120 | Neutral | Anteflexion |
| 16 | TG RV Inflow | TG RV | TG | 40--45 | 90--120 | CW rotation | Anteflexion |
| 17 | Deep TG LAX | DTG LAX | DTG | 45--50 | 0--20 | Neutral | Maximum anteflexion |
| 18 | UE Aortic Arch LAX | UE AA LAX | UE | 20--25 | 0 | Neutral | -- |
| 19 | UE Aortic Arch SAX | UE AA SAX | UE | 20--25 | 70--90 | Neutral | -- |
| 20 | Descending Aorta SAX | Desc Ao SAX | ME/TG | Variable | 0 | Turn leftward/posterior | Depth 6--8 cm |
| 21 | Descending Aorta LAX | Desc Ao LAX | ME/TG | Variable | 90--110 | Turn leftward/posterior | Depth 6--8 cm |

### 6.3 Systematic Examination Approach

A comprehensive TEE exam can be performed in 10--15 minutes following a systematic sequence:

1. **ME level, 0 degrees** -- establish the 4-chamber view at ~35 cm
2. **Sweep omniplane 0 --> 165 degrees** in 20--30 degree increments, applying color Doppler at each
3. **Return from 135 --> 0 degrees**, using the aortic valve as reference
4. **GEJ/TG transition** -- advance to ~40 cm, anteflex into stomach
5. **TG views** at 0, 90, 120 degrees
6. **Aortic examination** -- withdraw while imaging descending aorta

---

## 7. Existing TEE Simulator DOF Mappings

### 7.1 HeartWorks (Surgical Science)

- **Physical manikin** with an actual modified TEE probe inserted into an anatomically accurate torso
- **Sensors in the torso** detect probe position and feed back to the Glassworks software
- **Controls available:** Advance/withdraw, anteflexion/retroflexion, lateral flexion, omniplane rotation, shaft rotation
- **Image generation:** Real-time from a 3D heart model; 28 validated imaging planes aligned with international standards
- **Notable:** Uses a real probe handle with all standard controls; torso sensors provide continuous position tracking

### 7.2 Virtual TEE (Toronto / PIE)

- **Web-based simulator** (no physical probe)
- **Controls mapped to UI:** Drag probe handle up/down (advance/withdraw), rotate left/right (shaft rotation), sliders for omniplane angle and probe tip flexion, slider for sector depth
- **DOFs:** 5 DOFs -- advance/withdraw, shaft rotation, omniplane angle, probe tip flexion (combined ante/retro and lateral), sector depth
- **20 recommended standard views** with real-time image generation from a 3D heart model
- **Feedback:** Shows resulting position of ultrasound plane relative to 3D heart model

### 7.3 EchoSim

- Another web/software simulator
- Similar DOF mapping: position, rotation, flexion, omniplane
- Emphasis on automated navigation and reproducibility of positions

### 7.4 Standard DOF Terminology Summary

| DOF | Common Simulator Term | Physical Control | TeeSim Variable |
|---|---|---|---|
| Insertion depth | Advance/Withdraw, Position, Depth (probe) | Shaft push/pull | `sMm` |
| Shaft rotation | Rotation, Turn, Roll | Wrist twist CW/CCW | `rollDeg` |
| Anteflexion/Retroflexion | Ante/Retro, Flexion, Tip Flex (anterior-posterior) | Large wheel | `anteDeg` |
| Lateral flexion | Lateral, Tip Flex (left-right) | Small wheel | `lateralDeg` |
| Omniplane angle | Omniplane, Multiplane Angle, Transducer Rotation | Electronic buttons | `omniplaneDeg` |

---

## 8. Correct Imaging Plane Geometry for the Simulator

This section defines the exact mathematical relationship between the probe DOFs and the resulting imaging plane. This is the most critical section for fixing `probe-model.ts`.

### 8.1 Definitions

Starting from the transducer frame after applying shaft position, flexion, and roll:

- **T** (tangent) = unit vector along the probe shaft, pointing in the direction of advancement (caudal)
- **N** (normal) = unit vector perpendicular to the shaft, pointing anteriorly toward the heart = the **beam direction** = the **depth axis** of the ultrasound image
- **B** (binormal) = T x N = unit vector pointing to the patient's left (when probe is in standard orientation)

### 8.2 The Imaging Plane at Omniplane = 0 degrees

At 0 degrees omniplane:
- The **scan line** runs along the **B** axis (patient's left-to-right direction, i.e., the transverse direction perpendicular to both the shaft and the beam)
- The **depth axis** (image "up" direction, near field to far field) runs along **N** (the beam direction, anteriorly toward the heart)
- The **imaging plane** contains the scan line (B) and the depth axis (N)
- This produces a **transverse** cross-section perpendicular to the shaft

### 8.3 The Imaging Plane at Omniplane = theta degrees

As the omniplane angle increases, the scan line rotates **around the beam direction N** (not around the shaft tangent T). Specifically:

```
scanLine(theta) = cos(theta) * B + sin(theta) * T
```

Wait -- this needs careful definition. The rotation is of the scan line around the N axis. Using the right-hand rule with N as the rotation axis, and with 0 degrees starting at the B direction:

At omniplane angle `theta`:
- **Scan line direction** = rotate B around N by angle theta
  - `scanLine = cos(theta) * B - sin(theta) * T`
  - (The sign convention follows the ASE convention: rotating "forward" from 0 to 90 goes from the transverse plane to the longitudinal plane, with 90 degrees showing the scan line aligned with the shaft axis)

Actually, let us be more precise using the ASE orientation rules:

- At **0 degrees**: scan line is in the transverse plane (perpendicular to shaft). Patient's right appears on screen left.
- At **90 degrees**: scan line is in the longitudinal plane (parallel to shaft). Patient's inferior appears on screen left.
- The rotation from 0 to 90 degrees goes **counterclockwise when viewed from the transducer face looking at the heart** (looking along N).

So the scan line rotates around N:
```
scanLine(theta) = cos(theta) * B + sin(theta) * (-T)
                = cos(theta) * B - sin(theta) * T
```

At theta = 0: scanLine = B (transverse, left-to-right)
At theta = 90: scanLine = -T (longitudinal, pointing cranially along the shaft)

The **imaging plane** is defined by:
- **right** = scanLine(theta) -- this is the lateral axis of the 2D image
- **up** = N -- this is the depth axis (beam direction), always pointing anteriorly toward the heart regardless of omniplane
- **normal** = right x up -- the out-of-plane direction

### 8.4 Key Correction for TeeSim

The current `computeImagingPlane()` code does this:

```typescript
const beamDirection = rotateVectorAroundAxis(
  transducerFrame.normal, transducerFrame.tangent, omniplaneRad
);
const right = transducerFrame.tangent;
const up = beamDirection;
```

This is wrong in two ways:

1. **The beam direction (up/depth axis) should NOT rotate with omniplane.** The omniplane angle does not change where the beam points -- it only rotates the scan line within the plane perpendicular to the beam. The beam always fires anteriorly (along normal N).

2. **The right axis (scan line) should rotate around the beam direction (N), not use the tangent as a fixed right axis.**

The corrected computation should be:

```typescript
const omniplaneRad = degToRad(pose.omniplaneDeg);

// The depth axis (up) is always the beam direction = transducer normal
const up = transducerFrame.normal;  // N, pointing anteriorly

// The scan line at omniplane 0 is the binormal B (patient left-right)
// It rotates around the beam direction N as omniplane increases
const right = rotateVectorAroundAxis(
  transducerFrame.binormal,  // B at omniplane 0
  transducerFrame.normal,    // rotation axis = beam direction N
  omniplaneRad               // omniplane angle
);

// The imaging plane normal
const planeNormal = vec3.cross(right, up);
```

### 8.5 Display Convention Mapping

On the echo machine screen:
- **Screen top** (sector apex) = transducer location = near field
- **Screen bottom** = far field = deepest along the beam direction
- **Screen left** = the "right" direction of the imaging plane (which corresponds to patient's right at 0 degrees omniplane)
- **Screen right** = the "-right" direction (patient's left at 0 degrees)

This means the screen x-axis is the `right` vector (pointing patient-right at 0 degrees), and the screen y-axis (top to bottom) is the `up` vector (beam direction, near to far field).

---

## 9. Summary of Corrections Needed in TeeSim

### 9.1 `computeImagingPlane()` in `probe-model.ts`

| Issue | Current Behavior | Correct Behavior |
|---|---|---|
| `up` / depth axis | Rotates with omniplane (beam direction changes) | Should be fixed as `transducerFrame.normal` (beam always points anteriorly) |
| `right` / scan line | Fixed as `transducerFrame.tangent` | Should rotate around `transducerFrame.normal` by omniplane angle, starting from `transducerFrame.binormal` |
| Omniplane rotation axis | `transducerFrame.tangent` (shaft axis) | `transducerFrame.normal` (beam direction axis) |

### 9.2 Frame Convention

Ensure the transducer frame maintains:
- `tangent` = along the shaft (advancement direction)
- `normal` = perpendicular to shaft, pointing anteriorly toward the heart (beam direction)
- `binormal` = tangent x normal = pointing to patient's left

### 9.3 Centerline Path Continuity

- The centerline path normals should point consistently anteriorly (toward the heart) along the entire esophageal course.
- No discontinuities at the GEJ.
- The transition from ME (esophagus, heart directly anterior) to TG (stomach, heart superior/anterior) should be a smooth curve of the normal and tangent vectors.

### 9.4 Depth Parameter

- Consider adding a sector depth parameter (in cm) as a UI control, independent of the 5 probe DOFs.
- Default to 12--14 cm for ME views, 6--10 cm for TG views.
- This controls how much of the volume is sampled along the depth (beam) direction.

---

## Sources

- [An update on transesophageal echocardiography views 2016: 2D versus 3D TEE views (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5100243/)
- [A systematic approach to performing a comprehensive transesophageal echocardiogram (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC2694155/)
- [Focused Transesophageal Echocardiography (Radiology Key)](https://radiologykey.com/focused-transesophageal-echocardiography/)
- [TEE Basics: The Controls and the Views (Taming the SRU)](https://www.tamingthesru.com/scanning-school/teebasics)
- [Transesophageal Echocardiography (Thoracic Key)](https://thoracickey.com/transesophageal-echocardiography-7/)
- [Instrumentation for Transesophageal Echocardiography (Thoracic Key)](https://thoracickey.com/instrumentation-for-transesophageal-echocardiography/)
- [TEE Image Acquisition and Transducer Manipulation (Anesthesia Key)](https://aneskey.com/transesophageal-echocardiography-image-acquisition-and-transducer-manipulation/)
- [Image Planes and Standard Views (Anesthesia Key)](https://aneskey.com/image-planes-and-standard-views/)
- [Transesophageal Echocardiogram (StatPearls)](https://www.ncbi.nlm.nih.gov/books/NBK442026/)
- [Anatomy, Thorax, Esophagus (StatPearls)](https://www.ncbi.nlm.nih.gov/books/NBK482513/)
- [ASE/SCA 1999 Guidelines for Comprehensive Intraoperative Multiplane TEE](https://onlinejase.com/article/S0894-7317(99)70199-9/fulltext)
- [ASE/SCA 2013 Guidelines for Comprehensive TEE](https://onlinejase.com/article/S0894-7317(13)00562-2/fulltext)
- [ASE/SCA Performing a Comprehensive Multiplane TEE Exam (PDF)](https://www.asecho.org/wp-content/uploads/2013/05/Performing-a-Comprehensive-Multiplane-TEE-Exam.pdf)
- [Techniques and Tricks for Optimizing Transesophageal Images (Radiology Key)](https://radiologykey.com/techniques-and-tricks-for-optimizing-transesophageal-images/)
- [TEE Simulation: Introduction to Probe Manipulation (Virtual TEE Toronto)](http://pie.med.utoronto.ca/TEE/TEE_content/TEE_probeManipulation_intro.html)
- [HeartWorks TEE Simulator (Surgical Science)](https://surgicalscience.com/simulators/heartworks/tee/)
- [Using the TEE Probe and Making Sense of the Views (Medmastery)](https://www.medmastery.com/magazine/using-tee-probe-and-making-sense-views)
- [Three-dimensional transesophageal echocardiography: Principles and clinical applications (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5100241/)
- [Multiplane TEE: Image Orientation (Anaesthetist.com)](https://www.anaesthetist.com/icu/organs/heart/tee/multi.htm)
- [How to Perform Resuscitative TEE in the ED (ACEP Now)](https://www.acepnow.com/article/how-to-perform-resuscitative-transesophageal-echocardiography-in-the-emergency-department/)
