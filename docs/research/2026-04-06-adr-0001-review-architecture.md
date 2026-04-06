# Critical Architecture Review of ADR-0001

Line references below refer to the current repository versions of the cited files.

## 1. Overall Assessment

ADR-0001 is directionally right on the big bets: browser-only MVP, offline asset factory, constrained 5-DOF probe interaction, VTK.js-first rendering, and governance-aware public bundles. That is the good news. The bad news is that the ADR is still not a buildable contract. It leaves critical interfaces unresolved (`ProbePose.s` units, release/asset versioning, clinical validation state), promotes optional or high-risk work into MVP without a hard defer rule (motion, PWA/service worker, Phase 2 source abstractions), and smooths over source-proposal conflicts exactly where the conflicts were warning signs. As written, two competent implementers could follow this ADR and still build incompatible systems.

## 2. Strengths

- The ADR keeps the architectural center of gravity in the right place: one probe pose, one imaging plane derivation path, and React outside the frame loop ([ADR-0001:36-50], [web-rendering:12-15], [web-rendering:227-237]).
- Splitting intensity and label volumes into two VTIs is the correct call. It matches real runtime consumers and avoids scalar-type abuse ([ADR-0001:73-78], [data-pipeline:147-156]).
- Isolating probe math into `@teesim/core` with zero runtime deps is a durable decision worth keeping. That boundary is testable and reusable ([ADR-0001:137-157], [platform-architecture:145-173], [CLAUDE.md:80-83]).
- Preset-first, centerline-constrained interaction is consistent with the product principles. This avoids the usual "cool demo, bad training tool" trap ([ADR-0001:127-135], [docs/product/principles.md:5-16]).
- Governance is treated as architecture, not legal afterthought. Requiring source declaration and CI enforcement is the right posture for a public medical-education bundle ([ADR-0001:94-107], [survey:87-106]).

## 3. Weaknesses & Gaps

### 3.1 `ProbePose.s` is still undefined in a way that matters

**Problem:** ADR-0001 claims all proposals agree on the core `ProbePose` model, but they do not agree on what `s` actually means. ADR-0001 just says "position on esophageal centerline" ([ADR-0001:36-50]). The data-pipeline proposal authors views with `s` in millimeters (`"s": 134.0`) and ships `arcLengthMm` in `probe_path.json` ([data-pipeline:370-408]). The platform proposal's Zustand store shape says `s` is normalized `[0, 1]` ([platform-architecture:1018-1027]).

**Why it matters:** This is not cosmetic. View presets, tolerance windows, station markers, interpolation, cross-case portability, and view scoring all change depending on whether `s` is arc length in mm, normalized parametric position, or sample index.

**Suggested fix:** Resolve it now in the durable contract. Use `sMm` as the authored/runtime source of truth and derive a normalized `u` only for UI widgets if needed. Put the unit in `views.json`, `probe_path.json`, and `@teesim/core` types.

### 3.2 Motion is promoted into MVP without a credible MVP use case

**Problem:** ADR-0001 bakes `motion.bin` into the pipeline and effort model ([ADR-0001:79-90], [ADR-0001:219-237]). That ignores the fact that the platform proposal explicitly deferred motion animation to fast-follow ([platform-architecture:491-502], [platform-architecture:963-964]) and the web-rendering proposal made motion lazy and off by default ([web-rendering:136-137], [web-rendering:170-175], [web-rendering:436-444]). The data-pipeline proposal also names motion retargeting as one of the three highest-uncertainty tasks in the whole MVP ([data-pipeline:696-709]).

**Why it matters:** This is classic schedule self-harm. You are pulling a high-uncertainty algorithmic lane into MVP while the actual educational value of the MVP is view-finding, not subtle chamber motion.

**Suggested fix:** Cut motion from MVP acceptance criteria. Keep at most an optional schema slot for `motion.bin`, but ship static anatomy first. If motion survives as MVP scope, define its runtime behavior, visual acceptance criteria, and memory budget explicitly instead of treating it as an inevitable asset.

### 3.3 The implementation sequence is backwards

**Problem:** ADR-0001 prioritizes the pseudo-TEE pane ahead of the first end-to-end asset pipeline integration ([ADR-0001:202-215]). That is the wrong critical path. The data-pipeline proposal is explicit: the first real case pays the integration tax and the browser runtime should stay simple against validated bundles ([data-pipeline:12-29], [data-pipeline:699-709]).

**Why it matters:** A pseudo-TEE pane built before a real canonical bundle exists will be validated against assumptions, not against the actual bundle geometry, coordinate alignment, label coverage, and landmark quality. The first real case will break the browser contract anyway.

**Suggested fix:** Reorder milestones. `@teesim/core` plus manifest/schema plus one canonical case plus oblique slice parity should come before pseudo-TEE styling work. The first irreversible milestone should be "browser renders authored bundle correctly," not "pseudo-TEE looks plausible on synthetic inputs."

### 3.4 Clinical validation is acknowledged as a dependency but not encoded as a release gate

**Problem:** ADR-0001 says clinical expert availability is a hard dependency ([ADR-0001:237], [ADR-0001:259]) but it does not turn that into an actual ship gate. The medical-education proposal was much stricter: every anchor view should be reviewed by a board-certified echocardiographer, approval should be written into the case manifest, and no case ships with unapproved views ([medical-education:529-545]).

**Why it matters:** This is an education product. A technically "working" preset that teaches the wrong view is worse than a missing feature.

**Suggested fix:** Add validation metadata to `case_manifest.json` or `views.json` now: `validatedBy`, `validatedAt`, `approvalStatus`, and per-view approval. CI for the public bundle should fail if required MVP views are unapproved.

### 3.5 The scoring contract is too weak for the claims being made

**Problem:** ADR-0001 adopts weighted 5-DOF distance and simple color thresholds as MVP scoring ([ADR-0001:127-135], [ADR-0001:163-173]). That drops the medical proposal's required-structure visibility check and optional image-quality heuristic from the composite score ([medical-education:157-172], [medical-education:321-360], [medical-education:681-689]).

**Why it matters:** A numerically close probe pose can still produce the wrong educational view if required structures are clipped, rotated out of sector, or miscentered because the case geometry differs. DOF-only scoring is not robust enough to be described as "view scoring" across cases.

**Suggested fix:** Either downgrade MVP to a "nearest preset indicator" and stop pretending it is a meaningful scoring engine, or include geometry-aware checks in the durable contract: required structures, visibility thresholds, and validator-approved tolerances per view.

### 3.6 Asset publication and versioning are still hand-waved

**Problem:** ADR-0001 says `cases/` is git-ignored and served statically, and that deployment uses Cloudflare Pages + R2 with immutable versioned asset paths ([ADR-0001:137-161]). That is not enough. The data-pipeline proposal already did the hard work: bundle manifest, schema version, bundle version, case version, per-asset hashes, internal build vs public validation split, and versioned publication layout ([data-pipeline:417-475], [data-pipeline:648-680]).

**Why it matters:** Cache invalidation, provenance, rollback, reproducibility, and public CI validation all depend on these details. "Immutable versioned asset paths" without a manifest contract is vague architecture theater.

**Suggested fix:** Promote the asset publication contract into durable docs now, either by expanding ADR-0001 or by writing a follow-up ADR immediately. Minimum required: `/cases/<bundleVersion>/<caseId>/...`, `bundle_manifest.json`, `caseVersion`, per-asset hashes, and explicit separation between internal artifact generation and public artifact validation.

### 3.7 The ADR is over-abstracting the MVP while claiming the abstractions are free

**Problem:** ADR-0001 says Phase 2 extension interfaces "cost nothing to ship" ([ADR-0001:190-198]). They do not. `VolumeSource`, `CaseSource`, and `ScoringSink` add indirection, testing burden, and mental overhead before the MVP even has a second implementation. Combined with a four-package monorepo, Turborepo, service worker, PWA, and visual regression, this is the exact over-engineering the product principles warn against ([docs/product/principles.md:13-16]).

**Why it matters:** Every abstraction introduced before the second real implementation is a tax. The MVP does not need a fake pluggable DICOM future to render one static bundle correctly.

**Suggested fix:** Keep the one abstraction that already pays for itself: `@teesim/core`. Defer the rest until there is a second concrete implementation. If ADR-0002 is meant to cover the DICOM route, let it introduce the source abstractions there.

### 3.8 The 10-view decision is not costed honestly

**Problem:** ADR-0001 chooses 10 views for pedagogy ([ADR-0001:52-71]) but retains the 10-14 week calendar estimate from the platform proposal ([ADR-0001:219-237]). That only looks plausible because the ADR cut tutorial authoring from MVP, yet it kept the expensive parts that still scale with view count: preset authoring, tolerance calibration, per-case validation, visual regression, and expert review ([medical-education:534-545], [medical-education:577-589], [data-pipeline:693-709]).

**Why it matters:** The ADR is pretending it removed the cost while keeping most of the surface area. That is how teams miss schedule by months.

**Suggested fix:** Either cut MVP GA to 8 required validated views or explicitly stage the release: 8 views are hard release blockers, the extra 2 ship only if clinically validated within schedule. Do not hide the calendar cost inside "same total estimate."

### 3.9 The performance budget is unresolved, not decided

**Problem:** ADR-0001 sets `scene.glb` hard cap at 200K triangles and total visible triangles at 600K ([ADR-0001:175-188]). The data-pipeline proposal budgets `scene.glb` at 500K and whole-case total at 800K ([data-pipeline:121-156]). The platform proposal uses yet another set of numbers ([platform-architecture:1062-1070]).

**Why it matters:** This is not harmless variance. It changes what anatomy can be included, how aggressively the canonical case must be decimated, and whether the 3D center pane remains a teaching aid or a skeletal wireframe.

**Suggested fix:** Run one proof case and pick one budget table. Tie the budget to the actual structure list and state whether the numbers refer to loaded geometry, visible geometry, or worst-case simultaneously rendered geometry. Right now the ADR has merged incompatible budgets into a fake consensus.

## 4. Contradictions Between ADR and Source Proposals

- ADR-0001 says all proposals agree on the core `ProbePose`, but the proposals disagree on whether `s` is millimeter arc length or normalized `[0, 1]` ([ADR-0001:36-50], [data-pipeline:370-408], [platform-architecture:1018-1027]).
- ADR-0001 makes motion part of the MVP pipeline, while web-rendering makes it optional/lazy and platform architecture defers runtime animation to fast-follow ([ADR-0001:79-90], [web-rendering:136-137], [web-rendering:170-175], [platform-architecture:491-502], [platform-architecture:963-964]).
- ADR-0001 carries PWA/service worker scope in repo structure and effort estimate ([ADR-0001:145-149], [ADR-0001:231]), but the platform proposal itself deferred asset caching and streaming from MVP ([platform-architecture:491-502], [platform-architecture:732-750]).
- ADR-0001 adopts 10 views from the medical proposal but strips away the tutorial engine and progress layer that justified the pedagogical sequence in the first place ([ADR-0001:52-71], [ADR-0001:163-173], [medical-education:20-24], [medical-education:384-430], [medical-education:577-589]).
- ADR-0001 changes the view set from the web/data proposals' `ME Aortic Arch Long-Axis` to `ME Asc Aortic SAX` plus combined descending aortic SAX/LAX, but it never explains the substitution or the anatomy-detail implications ([ADR-0001:52-71], [web-rendering:287-298], [data-pipeline:548-560], [medical-education:423-429], [medical-education:621-624]).
- ADR-0001's governance table incorrectly lists SlicerHeart inside the MVP bundle, even though the survey classifies it as tooling rather than shippable data ([ADR-0001:98-105], [survey:49-52]).
- ADR-0001 says deployment uses immutable versioned asset paths, but it does not actually adopt the data-pipeline proposal's bundle-manifest and version-layer model that makes immutable paths operationally meaningful ([ADR-0001:159-161], [data-pipeline:417-475]).

## 5. Missing Considerations

- None of the proposals defines a Slicer-to-browser oracle for coordinate fidelity. Visual regression is not enough. You need an authoritative export of plane matrices, landmark intersections, and expected visible structures from the authoring environment so the browser can be numerically checked against the source of truth before human review.
- None of the proposals defines runtime failure handling. What happens on corrupt VTI, WebGL context loss, GPU budget overflow, stale cached asset/schema mismatch, or partial case load? "Progressive loading" is not an error policy.
- None of the proposals meaningfully addresses accessibility and demo-operability. Keyboard shortcuts exist, but there are no requirements for focus management, ARIA labeling, color-blind-safe label palettes, control sizing, or projector-safe presentation mode in MVP.
- None of the proposals closes the loop on end-user attribution and disclaimers. Governance is internal and CI-oriented, but the shipped product still needs a visible "not for clinical use" boundary and case-level source/license attribution surface.

## 6. Verdict

**Reject.**

The ADR is close enough in direction to salvage, but not sound enough to implement against as-is. The unresolved `s` contract alone is enough to poison `@teesim/core`, `views.json`, and scoring. Add the missing clinical release gate, strip motion and speculative Phase 2 abstractions out of MVP, adopt the data publication/versioning contract explicitly, and either cut the view set to 8 or restate the schedule honestly. After that, this becomes an acceptable foundation. Until then, it is a synthesis document pretending to be an executable architecture decision.
