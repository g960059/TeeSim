# Principles

Design and engineering principles that guide decisions in this repository:

1. **Anatomical fidelity over visual polish** — A correctly oriented oblique slice from real anatomy beats a stylized render. Never sacrifice spatial accuracy for aesthetics.

2. **Education-first interactions** — Every UI decision should make it easier to learn correct probe technique and anatomy, not just look impressive.

3. **Open data and open source** — Prefer bundle-safe open-licensed datasets. When proprietary data is needed for accuracy, isolate it in the internal pipeline and ship only derived assets.

4. **Browser-native, no install required** — The simulator must run in a modern browser with no plugins, no native app, and no server-side computation in MVP.

5. **Progressive complexity** — Start with a minimal, correct canonical case and 8–10 anchor views. Add patient variability, pathology, and interactivity in layers. Don't over-engineer the MVP.

6. **Offline-capable asset factory** — The data ingestion and processing pipeline (3D Slicer + SlicerHeart) runs offline. The browser runtime is read-only against pre-built static assets.

7. **Explicit data governance** — Every dataset is classified (bundle-safe / maybe / internal / licensed) before use. When in doubt, keep it internal.
