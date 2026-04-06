# Overview

TeeSim is a browser-based 3D TEE (Transesophageal Echocardiography) simulator for cardiology and cardiac anesthesia education.

## What It Does

TeeSim renders a 3D anatomical scene of the thorax, heart, and esophagus in the browser. Users manipulate a virtual TEE probe along the esophageal centerline using 5 degrees of freedom (position, axial roll, anteflexion/retroflexion, lateral flex, omniplane angle). The simulator produces synchronized outputs:

- A **pseudo-TEE image** — a 2D ultrasound-like cross-section derived from anatomy labels and intensity volumes
- A **3D anatomy view** — the thoracic scene with the probe position and imaging sector plane visualized
- An **oblique slice** — an arbitrary reformat at the current probe plane

## Who It's For

| User | Need |
|------|------|
| Cardiology fellow | Practice identifying ASE standard TEE views before supervised procedures |
| Cardiac anesthesiology resident | Structured introduction to TEE anatomy and probe manipulation |
| Attending echocardiographer | Teaching demonstrations with labeled anatomy |
| Medical educator | Build structured TEE curricula and view-finding exercises |

## Core Value

- Zero cost, zero hardware — runs in any modern browser with no installation
- Anatomically grounded — built from real segmented CT/MR anatomy
- Open foundation — uses open-licensed datasets wherever possible
- Educator-friendly — standard view presets with ASE-aligned naming
