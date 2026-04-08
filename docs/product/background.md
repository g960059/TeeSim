# Background

## The Training Gap

TEE is a complex skill requiring both anatomical knowledge and manual dexterity. Traditional training involves:

- Supervised procedures on real patients — limited exposure, patient safety concerns
- Expensive physical phantoms — not widely available, require lab access
- Static 2D educational materials — difficult to convey 3D spatial relationships

No freely available, browser-based 3D TEE simulator currently exists that is both anatomically grounded and accessible without installation.

## Public Data Landscape

A detailed survey of available public datasets was conducted in April 2026. See [`docs/research/2026-04-06-tee-simulator-public-data-survey.md`](../research/2026-04-06-tee-simulator-public-data-survey.md) for the full analysis.

Key findings:

- **Thoracic anatomy** is well-served by open-licensed data: Open Anatomy Project thorax atlas, HRA 3D reference organs, Visible Human / SIO, and TotalSegmentator CT dataset (CC BY 4.0, 1228 cases) together provide a strong foundation for probe corridor, chest geometry, and canonical anatomy.
- **Cardiac detail** is harder: MM-WHS, MITEA, EchoNet-Dynamic, and MVSeg2023 have non-commercial or no-redistribution terms, so they stay in the internal research lane.
- **TEE-specific appearance** (ultrasound texture, chordae, high-fidelity leaflet motion) is not yet well-covered by bundle-safe public data. The public bundle can ship derived parametric valve leaflets, but product-grade valve realism will still require licensed or self-collected 3D/4D TEE data.

## Data Architecture Decision

Data is managed in three tiers from day one:

1. **Bundle-safe open** — can be shipped in the public web app after attribution tracking
2. **Internal research only** — used to train priors and validate methods; never shipped raw
3. **Licensed / owned** — contract or self-collected clinical data for production-grade detail

## Technical Constraints

- **Browser rendering limits**: GLB meshes must be decimated; volume data must fit in GPU memory (target < 256 MB for a scene)
- **No backend in MVP**: all assets served statically; no server-side computation at runtime
- **WebGL2 baseline**: WebGPU is a future upgrade path, not an MVP requirement
- **Asset pipeline**: 3D Slicer + SlicerHeart used offline as the asset factory; not bundled in the browser
