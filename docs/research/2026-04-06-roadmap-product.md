# TeeSim Product Roadmap

**Date:** 2026-04-06  
**Status:** Proposal  
**Author:** Product strategy analysis  
**Scope:** 12-month roadmap from current MVP to conference-ready educational product

---

## 0. Honest Assessment: Where We Stand

TeeSim is not yet a teaching tool. It is an architecturally sound spatial-reasoning prototype with the right bones but insufficient flesh. The clinical validation is clear: 7 PARTIAL, 1 FAIL across 8 views. The 3D scene pane (8/8 PASS) is the strongest asset. The pseudo-TEE pane -- the thing trainees actually need to learn to read -- shows undifferentiated tissue blobs where chambers should be.

A cardiologist looking at this today would say: "The 3D view is interesting, but the echo image doesn't look like anything I'd show a fellow." That is the gap between a tech demo and a teaching tool.

The good news: the architecture is right, the probe model is clinically accurate, the omniplane fix works, and the foundation supports everything in this roadmap. The work ahead is image quality, educational scaffolding, and community credibility -- not architectural rework.

---

## 1. The Core Question: What Makes This ACTUALLY USEFUL?

A trainee learning TEE has three sequential challenges:

1. **Spatial model** -- "Where is the probe relative to the heart, and how does moving it change what I see?"
2. **View acquisition** -- "Can I manipulate the probe to find a specific standard view?"
3. **Image interpretation** -- "What am I looking at in this echo image?"

TeeSim is currently strongest at challenge #1 (the 3D scene is excellent) and weakest at challenge #3 (chambers are not visible in pseudo-TEE). Challenge #2 works mechanically (the view matcher scores correctly) but lacks the educational scaffolding to be useful.

**The strategic insight:** TeeSim should lean hard into #1 (spatial reasoning) and #2 (view finding) NOW, where it has genuine advantages over everything else. Challenge #3 (image interpretation) requires either (a) contrast-enhanced CT data or (b) real ultrasound physics simulation -- both are larger investments that should follow once the spatial trainer has proven its value.

This means: **TeeSim v1 is a spatial reasoning and view-finding trainer, not an echo image interpretation tool.** Frame it that way, be honest about it, and excel at it.

---

## 2. Competitive Landscape: Learning from Virtual TEE Toronto

The University of Toronto Virtual TEE (pie.med.utoronto.ca/tee/) is the closest free competitor. Understanding its strengths and gaps is critical.

### What Toronto Does Well
- **20 standard ASE/SCA views + 19 alternative views** -- comprehensive coverage
- **Real ultrasound images** -- actual echo images, not CT-derived approximations
- **Pathology cases** -- calcific AS, cardiac myxoma, sinus of Valsalva aneurysm
- **Spectral and color Doppler** -- things TeeSim explicitly does not attempt
- **10 languages** -- massive accessibility advantage
- **iPad apps** -- dedicated mobile experience
- **Established credibility** -- used in medical schools worldwide since the Flash era
- **Quiz/assessment modules** -- built-in formative testing

### Where Toronto Falls Short (TeeSim's Opportunity)
- **Pre-recorded images, not volumetric** -- Toronto shows canned echo clips for each view. You cannot freely explore the space between standard views. You tap a button and see a video. There is no continuous probe manipulation.
- **No spatial reasoning** -- No 3D anatomy scene. No visualization of where the probe is or how the imaging plane intersects the heart. The connection between probe position and image is taught through text and diagrams, not through interactive exploration.
- **No free-form view finding** -- You cannot "discover" a view by manipulating controls. You select it from a menu. The motor/spatial learning loop of "move probe, see image change, recognize view" does not exist.
- **Flash-to-HTML5 conversion** -- Functional but visually dated. The UX carries legacy UI patterns from the Flash era.
- **No progress tracking** -- No sense of session accomplishment or longitudinal skill development.

### TeeSim's Differentiation Strategy

**Do not try to replicate Toronto.** Toronto wins on image fidelity and content breadth. TeeSim wins on spatial interactivity and the continuous probe-to-image feedback loop. These are complementary, not competing.

Position TeeSim as: **"The spatial reasoning and probe manipulation trainer that prepares you to get the most out of supervised TEE cases and image-based learning tools."**

Concretely, this means:
- TeeSim teaches you WHY the probe goes where it does
- Toronto (and textbooks) teach you WHAT you see when it gets there
- Supervised clinical cases teach you HOW to do it on a real patient

---

## 3. Phased Roadmap

### Phase 0: Image Quality Emergency (Weeks 1-3)

**Goal:** Make the pseudo-TEE pane minimally credible. A cardiologist should look at ME Four-Chamber and say "I can see four chambers" even if the image quality is rough.

This phase is a hard prerequisite for everything else. No amount of educational scaffolding can overcome invisible chambers.

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 0.1 | **Narrow CT window** for pseudo-TEE: center=50 HU, width=120 HU. Current 420 HU range wastes dynamic range on irrelevant density differences. | S | HIGH -- immediate chamber visibility improvement with zero data changes |
| 0.2 | **Reduce depth attenuation** from coefficient 1.18 to 0.3-0.5. Current attenuation destroys far-field structures. | S | HIGH -- makes LV/RV visible in far field |
| 0.3 | **Find and integrate one contrast-enhanced cardiac CTA** from public datasets (MM-WHS, ACDC, or ImageCAS). Blood-iodine contrast (300+ HU) vs myocardium (80 HU) would transform all 8 views. | L | CRITICAL -- the single highest-impact change for the entire project |
| 0.4 | **Fix TG SAX** -- verify CT volume inferior extent, adjust anteflexion to 25-30 deg, verify centerline extends through GE junction into gastric fundus. | M | HIGH -- recovers the most important intraoperative TEE view |
| 0.5 | **Add sector frame, depth markers, orientation labels** to pseudo-TEE pane (A/P/L/R labels, cm tick marks). Makes it look like a real echo display. | M | MEDIUM -- professionalism and clinical grounding |

**Exit criterion:** A cardiologist reviews the ME 4C view and can point to where LA, LV, RA, RV are.

### Phase 1: Spatial Reasoning Trainer (Weeks 4-8)

**Goal:** Make TeeSim genuinely useful as a standalone spatial reasoning tool. A fellow should be able to open TeeSim, spend 20 minutes, and understand the relationship between probe position and imaging plane better than they did before.

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 1.1 | **Guided onboarding** -- 90-second first-run tour: "This is the esophagus. This is your probe. Move the depth slider and watch the image change." Progressive DOF disclosure (Position only, then add Omniplane, then Flex). | L | CRITICAL -- transforms first impression from confusion to comprehension |
| 1.2 | **UI redesign P0** -- collapse header to 1-line TopBar, remove "MVP shell" text, replace 5 sliders with grouped controls (primary: Position + Omniplane; secondary: Flex + Roll behind expander). | L | HIGH -- first impression becomes "medical education tool" not "developer prototype" |
| 1.3 | **View-finding proximity feedback** -- replace small badge with full-width proximity bar. "Getting warmer/cooler" gradient. Directional hints when near: "Try advancing 15mm" / "Rotate omniplane +20 deg". | M | HIGH -- transforms passive scoring into active tutoring |
| 1.4 | **Session progress tracker** -- "Views found: 3/8" with checkmarks on matched preset buttons. Persists for the session. Creates collect-them-all motivation. | S | MEDIUM -- gamification without gamification |
| 1.5 | **Anatomical labels on pseudo-TEE** -- when matched (>=85%), overlay chamber labels (LA, LV, RA, RV, etc.) on the pseudo-TEE sector. Toggleable. | M | HIGH -- bridges the gap between spatial learning and anatomy identification |
| 1.6 | **Per-view educational notes** -- when a view is matched, show a 1-2 sentence clinical context: "The ME 4C view is used to assess mitral and tricuspid valve function. Note the crux of the heart at center." Authored in views.json. | S | MEDIUM -- connects spatial exercise to clinical relevance |

**Exit criterion:** A cardiac anesthesia resident with no TEE background completes the onboarding and finds 4+ views in their first 15-minute session, and reports that they understand how probe manipulation maps to image changes.

### Phase 2: Structured Learning Modules (Weeks 9-14)

**Goal:** Make TeeSim curriculum-aligned. An attending echocardiographer should be able to say "Use TeeSim to practice the core 4 views before your next case" and the fellow knows exactly what to do.

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 2.1 | **Challenge mode** -- timed view-finding challenges. "Find ME Four-Chamber in under 60 seconds." Timer, score, best-time tracking. Starts with single-view challenges, progresses to "find all 4 core views." | L | HIGH -- the core engagement loop for repeat use |
| 2.2 | **ASE curriculum alignment** -- organize views into the standard ASE learning progression: Level 1 (ME 4C, ME 2C, ME LAX, TG SAX), Level 2 (AV SAX, AV LAX, RV I-O, Bicaval), Level 3 (remaining 20 views as they're added). | M | HIGH -- maps directly to how TEE is actually taught |
| 2.3 | **Expand to 20 ASE standard views** -- add 12 more views with validated probe parameters. Priority: ME Asc Aortic SAX, Desc Aortic SAX/LAX, TG 2C, TG LAX, UE Aortic Arch LAX/SAX, ME Modified Bicaval TV, Deep TG LAX. | XL | HIGH -- moves from "subset" to "comprehensive" |
| 2.4 | **Second and third CT cases** -- add 2 more TotalSegmentator cases (ideally contrast-enhanced CTA). Different body habitus, different cardiac anatomy. Fellows learn that the same view looks different in different patients. | L | HIGH -- prevents overfitting to one anatomy |
| 2.5 | **Probe manipulation tutorial sequences** -- guided exercises: "Starting from ME 4C, rotate omniplane to 60 deg to find ME 2C. Notice how the RV disappears and the LAA appears." These teach the ASE systematic exam approach: hold position, rotate omniplane through standard angles. | L | HIGH -- teaches the actual technique of performing a TEE exam |
| 2.6 | **"Anatomy explorer" mode** -- freely rotate the 3D heart with labeled structures. Click a structure (e.g., mitral valve) to highlight it and see which views display it. This is the reference/study mode. | M | MEDIUM -- supplements textbook learning |

**Exit criterion:** An attending echocardiographer assigns "Complete Level 1 challenge" to their fellow, the fellow does it independently, and the attending can see the completion record.

### Phase 3: Community and Credibility (Weeks 15-20)

**Goal:** Build the social proof and community infrastructure needed for adoption. An echo lab director should find TeeSim through a conference poster or colleague recommendation and immediately see credibility signals.

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 3.1 | **Clinical advisory board** -- recruit 3-5 board-certified echocardiographers / cardiac anesthesiologists to review and validate views, provide educational content, and lend their names. Start with personal network, echo Twitter/X community, SCA/ASE early-career faculty. | M (calendar-bound) | CRITICAL -- no medical education tool succeeds without clinician endorsement |
| 3.2 | **User feedback system** -- in-app feedback button: "Was this helpful? What's confusing?" plus optional email for follow-up. Pipe to a simple form (Google Forms or Tally). No login required. | S | HIGH -- early signal on what works and what doesn't |
| 3.3 | **Conference abstract submission** -- target ASE Scientific Sessions (June) or SCA Annual Meeting (January). Abstract: "TeeSim: An Open-Source Browser-Based TEE Spatial Reasoning Trainer." Focus on: (a) technical approach, (b) educational design, (c) preliminary user feedback. | M (writing) | CRITICAL -- the single most important credibility event |
| 3.4 | **Landing page with educator testimonials** -- a simple page at teesim.app (or similar) with: 30-second demo video, 3 educator quotes, "Try it now" button. This is the sharing artifact. | M | HIGH -- without this, word-of-mouth has no landing pad |
| 3.5 | **Open-source community setup** -- CONTRIBUTING.md, issue templates, discussion board (GitHub Discussions), "good first issue" labels. Medical educators who find data bugs or want to contribute view descriptions should have a clear path. | S | MEDIUM -- foundation for sustainability |
| 3.6 | **Embed mode** -- allow TeeSim to be embedded as an iframe in LMS systems (Moodle, Canvas, Blackboard) and blog posts. Provide an embed snippet. Many programs would use this in their online curriculum if embedding were trivial. | M | HIGH -- distribution through existing educational infrastructure |

**Exit criterion:** TeeSim has been presented at one national conference (poster or oral), has 3+ educator endorsements, and has received feedback from 50+ unique users.

### Phase 4: Advanced Features and Sustainability (Weeks 21-30)

**Goal:** Features that make headlines at conferences and establish long-term viability.

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 4.1 | **Pathology cases** -- LV systolic dysfunction (dilated LV, reduced wall motion), mitral regurgitation (annular dilation), aortic stenosis (calcified AV). These require modified anatomy meshes or synthetic deformations applied to existing cases. | XL | CRITICAL for Phase 4 -- this is what every educator asks for |
| 4.2 | **NBE PTEeXAM practice mode** -- map TeeSim exercises to the content domains of the PTEeXAM (the board certification exam for perioperative TEE). Domain 1: Physics/Knobology, Domain 2: Anatomy, Domain 3: Standard views. Provide a "PTEeXAM Prep" mode that covers the anatomy and view-finding components of the exam. | L | HIGH -- directly serves a high-stakes need |
| 4.3 | **Progress tracking with optional accounts** -- anonymous by default, optional account creation (email/Google) to persist progress across devices. Dashboard showing: views mastered, challenge times, sessions completed, streak. Export as PDF for training documentation. | L | HIGH -- longitudinal engagement and program reporting |
| 4.4 | **Cardiac motion** -- retarget a cardiac motion model onto the static anatomy. Even simple systolic contraction (LV wall thickening, MV opening/closing) would be visually compelling. This was cut from MVP but is the #1 feature for visual impact. | XL | HIGH for wow-factor -- makes the simulator feel alive |
| 4.5 | **Instructor dashboard** -- web interface for attending echocardiographers to create a "class," invite fellows (via link), assign exercises, and view aggregate progress. No login required for fellows (cookie-based tracking). Minimal viable version: shared link with progress board. | L | HIGH -- enables programmatic adoption |
| 4.6 | **Tablet-optimized experience** -- iPad is the ideal device for fellows studying in the call room. Two-pane layout (pseudo-TEE + 3D), touch-optimized controls, landscape orientation. Not a native app -- responsive web. | M | HIGH -- matches the actual study context |
| 4.7 | **Multilingual support** -- start with Japanese (developer's native market), then English (already done), then Spanish and Mandarin (largest medical trainee populations). Internationalize all UI strings and educational content. | M | MEDIUM -- significant market expansion |

---

## 4. What to Pursue: Strategic Focus Areas

### YES: Spatial reasoning trainer (PRIMARY)
This is TeeSim's unique advantage. No other free tool lets you continuously manipulate a virtual probe and see the imaging plane move through a 3D heart in real time. The 3D scene pane is already 8/8 PASS. Double down on this.

**Concrete expression:** "Given a target view, can you manipulate the probe to find it?" This is the core gameplay loop. Make it smooth, make it tutored, make it rewarding.

### YES: View-finding practice (PRIMARY)
Directly follows from spatial reasoning. The challenge mode (timed view-finding) is the engagement loop that drives repeat use. This maps to real clinical skill -- the #1 question on a TEE rotation is "Can you get me a 4-chamber?"

### YES: Anatomy education (SECONDARY)
The 3D scene and anatomy explorer mode serve this well. Labeling structures, clicking to highlight, and showing which views display which structures are all valuable. But anatomy education is a crowded space (textbooks, Toronto, Medmastery). TeeSim's angle is always spatial: "Where is this structure relative to the probe?"

### DEFER: Procedure rehearsal
Pre-procedural rehearsal (TAVR planning, MitraClip, LAAO) requires patient-specific DICOM data, valve-level anatomy detail, and hemodynamic context. This is the long-term vision (Phase 2 goals mention it) but is 2+ years away. Do not discuss it in marketing materials yet.

### DEFER: Doppler simulation
Explicitly a non-goal (correctly). Color flow and spectral Doppler require hemodynamic modeling. Acknowledge the gap honestly: "TeeSim focuses on anatomy and probe manipulation. For Doppler, use supervised cases."

---

## 5. Curriculum Integration Strategy

### ASE Alignment

The ASE Guidelines for Performing a Comprehensive TEE Exam (Hahn et al., JASE 2013) define 28 standard views organized by esophageal station. TeeSim should mirror this organization exactly:

| ASE Level | Views | TeeSim Status |
|-----------|-------|---------------|
| Core 4 | ME 4C, ME 2C, ME LAX, TG mid SAX | 4/4 authored (TG SAX needs fix) |
| Extended | ME AV SAX, ME AV LAX, ME RV I-O, ME Bicaval | 4/4 authored |
| Comprehensive (20 views) | Add 12 more | Phase 2 target |
| Complete (28 views) | Add remaining 8 | Phase 4 target |

Label each view with its ASE number and name. Group exercises by ASE learning level. Use ASE terminology everywhere.

### NBE PTEeXAM Integration

The Perioperative Transesophageal Echocardiography Examination tests five content areas. TeeSim can address three:

| PTEeXAM Domain | TeeSim Coverage | Phase |
|----------------|-----------------|-------|
| 1. Physics and instrumentation | Omniplane angle concept, sector geometry | Phase 1 (partial) |
| 2. Anatomy and physiology | 3D anatomy explorer, structure identification | Phase 2 |
| 3. Standard views | View-finding challenges, 20-view exam | Phase 2 |
| 4. Pathology | Pathology cases | Phase 4 |
| 5. Clinical decision-making | Out of scope | -- |

Do not claim "PTEeXAM prep" until Domains 1-3 are reasonably covered (Phase 2 exit).

### Integration with Training Programs

The practical integration path for residency/fellowship programs:

1. **Week 1 of TEE rotation:** Attending sends fellow a link to TeeSim. "Complete the Level 1 challenge (4 core views) before your first supervised case." (Phase 1 feature)
2. **Weekly echo didactics:** Attending uses TeeSim on a projector to demonstrate probe-to-image relationships. "Watch what happens when I rotate the omniplane from 0 to 60 degrees." (Phase 0-1, already partially possible)
3. **Self-study:** Fellow uses TeeSim in 15-minute sessions on their iPad during downtime. Challenge mode provides structure. (Phase 2)
4. **Program tracking:** Program director can see which fellows have completed which modules. (Phase 4)

---

## 6. User Feedback Collection Strategy

### Phase 0-1: Guerrilla Feedback (Pre-Conference)

| Channel | Method | Target |
|---------|--------|--------|
| Personal network | Share link with 5-10 cardiologists/anesthesiologists personally known to the developer. Ask for 15-min video call or written feedback. | 5-10 expert users |
| Echo Twitter/X | Post a 30-second screen recording. Tag #EchoFirst, #TEE, #CardioTwitter, #MedEd. Ask "Would this be useful for your fellows?" | Awareness + inbound interest |
| r/echocardiography, r/anesthesiology | Post a demo with honest framing: "Building an open-source TEE spatial trainer. Looking for feedback from educators." | 10-20 early adopters |
| SCA/ASE early-career mailing lists | Email through a connected faculty member. | Program-level interest |

### Phase 2-3: Structured Feedback

| Channel | Method |
|---------|--------|
| In-app feedback widget | "Was this view helpful? [thumbs up/down]" + optional text. No login. Fires to a webhook (Tally or Google Forms). |
| Post-session survey | After completing a challenge, show a 3-question survey: (1) "Did this help you understand probe manipulation?" (2) "What was confusing?" (3) "Would you recommend this to a colleague?" |
| Educator interviews | Schedule 30-minute calls with 5 attending echocardiographers who have tried it. Semi-structured: "What would you change?" "Would you assign this to fellows?" "What's missing?" |

### Metrics to Track

| Metric | Target (6 months) | Why |
|--------|-------------------|-----|
| Unique monthly users | 500 | Proves awareness |
| Session duration (median) | >8 min | Proves engagement (not just a glance) |
| Views found per session | >3 | Proves educational utility |
| Return visitors (7-day) | >20% | Proves repeat value |
| NPS from educators | >40 | Proves teaching endorsement |
| Conference citations | >=1 | Proves academic credibility |

---

## 7. Monetization and Sustainability

### Principle: Open core, free for individuals, paid for institutions

TeeSim should remain free and open-source for individual learners. This is both the ethical choice (medical education should be accessible) and the strategic choice (adoption requires zero friction). The open-source license also builds trust with the medical education community, which is deeply skeptical of vendor lock-in.

### Revenue Model (Phase 3-4)

| Tier | Price | Features |
|------|-------|----------|
| **Free (Individual)** | $0 | All cases, all views, challenge mode, progress tracking (local). Open-source. |
| **Institutional** | $500-2,000/year per program | Instructor dashboard, class management, aggregate analytics, LMS embed license, priority support, custom cases. |
| **Enterprise** | Custom | DICOM integration (bring your own CTA data), custom branding, on-premise deployment, SLA. |

### Why This Works

- **Free tier** drives adoption. A fellow at Johns Hopkins and a fellow in rural India both get the same tool. This is the moral imperative and the growth engine.
- **Institutional tier** captures the budget that programs already spend on simulation ($5,000-50,000/year for HeartWorks, CAE VimedixAR). At $500-2,000/year, TeeSim is an order of magnitude cheaper.
- **Enterprise tier** serves hospitals that want to use their own patient CTA data for pre-procedural planning or site-specific teaching. This is the DICOM integration path from Phase 2 goals.

### Alternative Revenue Streams

| Stream | Feasibility | Notes |
|--------|-------------|-------|
| Grants (NIH R21, ASE Foundation) | HIGH | "Open-source TEE education tool validated against ASE curriculum" is fundable. R21 exploratory mechanism is $275K over 2 years. |
| Sponsorship (GE, Philips, Siemens) | MEDIUM | Echo machine vendors sponsor medical education. TeeSim could carry a "Supported by GE Healthcare Medical Education" badge. Conflicts of interest must be disclosed. |
| CME credit partnership | MEDIUM | Partner with an accredited CME provider. Fellows earn CME credits for completing TeeSim modules. The CME provider handles accreditation; TeeSim provides the platform. |
| Donations/GitHub Sponsors | LOW | Open-source medical tools rarely sustain on donations alone. Nice supplement, not a strategy. |

### Recommended First Step

Apply for an ASE Foundation Education Grant (typically $10,000-50,000) or an FAER (Foundation for Anesthesia Education and Research) grant. These are specifically designed for medical education technology and would provide both funding and credibility.

---

## 8. Community Building

### Target Communities

| Community | Why | How to Reach |
|-----------|-----|-------------|
| SCA (Society of Cardiovascular Anesthesiologists) | Primary home of perioperative TEE education | Annual meeting abstract, TEE workshop participation, SCA Connect forum |
| ASE (American Society of Echocardiography) | Defines TEE standards, large educator network | Scientific Sessions abstract, EchoSAP integration discussion |
| #EchoFirst / #CardioTwitter | Active medical education community on X/Twitter | Demo posts, educator engagement, "build in public" thread |
| FATE/FEEL community | Focused echo in critical care -- adjacent audience | Cross-posting, ICU-focused view subsets |
| Medical simulation societies (SSH, IMSH) | Broader simulation education community | Conference poster, simulation journal publication |

### Community Flywheel

1. **Clinician validates views** (advisory board) -- their name goes on the project
2. **Educator assigns TeeSim** to fellows -- fellows use it, provide feedback
3. **Fellows share with peers** -- word of mouth at other programs
4. **Programs adopt** -- institutional tier revenue funds development
5. **Developer ships improvements** -- educators see responsiveness, increase trust
6. **Loop accelerates**

### Open-Source Community

The codebase is TypeScript/React/VTK.js -- accessible to the medical informatics community. Contributions to pursue:

| Contributor Type | Contribution | Incentive |
|------------------|-------------|-----------|
| Medical student / CS student | New view authoring, educational content | Research credit, open-source portfolio |
| Echo educator | Clinical validation, educational notes, pathology case design | Co-authorship on publications |
| Imaging researcher | Better pseudo-TEE rendering, ultrasound physics simulation | Research collaboration |
| Internationalization volunteer | Translation to their language | Making TEE education accessible in their country |

---

## 9. Mobile Strategy

### The Reality

Fellows study on iPads in the call room and on phones during commutes. Mobile is not optional -- it is the primary study context for the target persona.

### What to Build (and What Not To)

**DO: Responsive web app, not native app.**
- No App Store approval process, no platform-specific code, instant updates
- PWA was correctly cut from MVP (service worker debugging risk). Revisit in Phase 3 if offline use is requested.

**DO: Tablet-first for interactive use.**
- iPad in landscape is the ideal form factor: large enough for two panes, touch-friendly for probe controls
- Two-pane layout: pseudo-TEE (45%) + 3D scene (55%), controls in bottom sheet
- Touch targets 48px minimum

**DO: Phone as "flashcard mode" only.**
- On a phone, free-form probe manipulation is frustrating (too little screen, too imprecise touch)
- Phone mode = preset viewer: tap a view button, see the pseudo-TEE image with labels, read the educational note, swipe to next view
- This is the "study on the subway" experience -- recognition, not manipulation

**DO NOT: Build a native app.**
- The App Store imposes a 30% revenue cut on institutional subscriptions
- Native apps require separate development and maintenance
- The web app already runs on all platforms

**DO NOT: Require WebXR/AR for mobile.**
- AR probe visualization is a conference demo, not a daily study tool. If built, it is a feature on top of the responsive web app, not a separate product.

### Mobile Rollout Timeline

| Phase | Mobile Feature | Effort |
|-------|---------------|--------|
| Phase 1 | Fix viewport overflow, make controls scrollable, add `100dvh` | S |
| Phase 2 | Tablet 2-pane layout, bottom sheet controls, touch-optimized sliders | M |
| Phase 2 | Phone "flashcard mode" -- preset viewer with swipe navigation | M |
| Phase 3 | Test on iPad Air, iPad Pro, iPhone 14+, Samsung Galaxy Tab. Fix rendering perf issues. | M |
| Phase 4 | Revisit PWA (offline case caching) if user feedback requests it | M |

---

## 10. Conference-Headline Features

The question is: what would make someone at ASE Scientific Sessions or the SCA Annual Meeting stop at your poster and say "I need to tell my program about this"?

### Tier 1: "That's clever" (Phase 1-2)

- **"Free browser-based TEE probe manipulation trainer with real CT anatomy"** -- the headline itself. Zero cost, zero install, real data. Most TEE simulation requires $50,000+ hardware.
- **Guided view-finding with directional hints** -- "the simulator tells you which way to move the probe." This does not exist in any free tool.
- **ASE-aligned curriculum mapping** -- "exercises organized by ASE standard view progression." Educators love curriculum alignment.

### Tier 2: "I want to try this" (Phase 2-3)

- **Timed view-finding challenges with leaderboards** -- gamified learning is catnip for conference demos. "Can you find all 20 ASE views in under 5 minutes?" Let attendees try at the poster session.
- **Side-by-side: your probe position vs. the expert** -- show the trainee's probe position next to the ideal position in the 3D view. Ghost-probe visualization. Makes spatial errors visible.
- **Embed in your LMS** -- "Add TeeSim to your Moodle/Canvas course with one line of code." Program directors' eyes light up.

### Tier 3: "This changes how we teach" (Phase 4+)

- **Pathology cases** -- "here's what aortic stenosis looks like from every standard view." This is what every echo educator has been asking simulation companies for.
- **Cardiac motion** -- a beating heart in the simulator. The visual impact at a poster is enormous. Even simple systole/diastole cycling transforms the demo from static anatomy to living simulation.
- **AI-generated unlimited cases** -- if volumetric cardiac models can be generated from segmented CTs automatically, TeeSim could offer "a new heart every session." This is the long-term research angle.
- **Comparison with real echo** -- split-screen: TeeSim's CT-derived slice on the left, a real echo image of the same view on the right. Trainee learns to map between the clean anatomical cross-section and the noisy ultrasound image. This bridges TeeSim's spatial teaching to real clinical pattern recognition.

### Conference Targeting

| Conference | Date | Submission Deadline | Format | Priority |
|------------|------|-------------------|--------|----------|
| SCA Annual Meeting 2027 | Jan 2027 | ~Sep 2026 | Abstract + poster | HIGH -- primary TEE education audience |
| ASE Scientific Sessions 2027 | Jun 2027 | ~Feb 2027 | Abstract + poster/oral | HIGH -- largest echo meeting |
| IMSH (Intl Meeting on Simulation in Healthcare) 2027 | Jan 2027 | ~Aug 2026 | Abstract + workshop | MEDIUM -- broader simulation audience |
| AHA Scientific Sessions 2026 | Nov 2026 | ~Jun 2026 | Late-breaking abstract | REACH -- massive audience, hard to get accepted |

**Recommended first submission:** SCA 2027 (abstract deadline ~Sep 2026). This gives 5 months from today to reach Phase 2 features and collect preliminary user feedback. The SCA audience is exactly TeeSim's target user base.

---

## 11. 12-Month Summary Timeline

```
Month 1-2   PHASE 0: Image Quality Emergency
            - CT windowing fix
            - Contrast-enhanced CTA case
            - TG SAX repair
            - Pseudo-TEE display polish

Month 2-4   PHASE 1: Spatial Reasoning Trainer
            - Guided onboarding
            - UI redesign (TopBar, grouped controls)
            - Proximity feedback with hints
            - Session progress tracking
            - Anatomical labels

Month 4-6   PHASE 2: Structured Learning
            - Challenge mode (timed view-finding)
            - ASE curriculum levels
            - Expand to 20 views
            - 2-3 additional cases
            - Probe manipulation tutorials
            - Tablet layout

            >>> SCA 2027 abstract submission (Month 5) <<<

Month 6-8   PHASE 3: Community and Credibility
            - Clinical advisory board recruitment
            - In-app feedback system
            - Landing page with educator quotes
            - LMS embed support
            - Open-source community setup
            - Phone flashcard mode

            >>> ASE 2027 abstract submission (Month 10) <<<

Month 8-12  PHASE 4: Advanced Features
            - Pathology cases (2-3)
            - PTEeXAM practice mode
            - Optional accounts + progress sync
            - Instructor dashboard (minimal)
            - Cardiac motion (if feasible)
            - Institutional pricing pilot
```

---

## 12. The Minimum Viable Teaching Tool

Cutting through everything above, here is the absolute minimum that gets a cardiologist to say **"I'd use this to teach fellows"**:

1. **Chambers must be visible** in at least the 4 core views (ME 4C, ME 2C, ME LAX, TG SAX). This means contrast-enhanced CTA data or dramatically better windowing. Without this, nothing else matters.

2. **Onboarding must exist.** A fellow who opens TeeSim for the first time must know what to do within 10 seconds. "Find ME Four-Chamber. Use the depth slider." Not "Here are 5 sliders and 3 panes, figure it out."

3. **The proximity feedback must feel like a tutor.** "You're 15mm too deep, withdraw the probe" is teaching. "62% match" is a score that teaches nothing.

4. **It must not look like a prototype.** Remove "MVP shell." Remove bundle versions. Remove status pills. A clinical dark theme with clean typography and minimal chrome. The pseudo-TEE pane should look like an echo machine display.

5. **It must work on iPad.** Full stop. This is where fellows study.

That is 5 things. Phase 0 + Phase 1. Approximately 8 weeks of focused work. Everything else is scale and refinement.

---

## 13. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| No public contrast-enhanced cardiac CTA is available with suitable license | MEDIUM | CRITICAL -- blocks chamber visibility | Fallback: narrow windowing + synthetic contrast enhancement (map HU ranges to pseudo-contrast). Also explore MM-WHS dataset (CC BY-NC-SA) and direct outreach to dataset authors. |
| Clinical advisory board recruitment fails | LOW | HIGH -- blocks credibility | Start with the developer's existing network. Offer co-authorship on conference abstracts as incentive. Echo educators are generally enthusiastic about free tools. |
| VTK.js performance on iPad is poor | MEDIUM | HIGH -- blocks mobile strategy | Test early (Phase 1). Fallback: reduce mesh complexity, use lower-resolution volumes for mobile, disable 3D scene on phones. |
| HeartWorks or CAE releases a free web-based competitor | LOW | HIGH -- undermines differentiation | Ship fast. Open-source moat: community contributions, transparency, no vendor lock-in. Commercial simulators have never gone free. |
| User feedback reveals that spatial reasoning is not what trainees want | MEDIUM | HIGH -- invalidates strategy | Listen and pivot. If trainees want image interpretation, accelerate contrast-CTA and labeling work. The architecture supports this pivot. |
| Solo developer burnout | HIGH | CRITICAL | Scope ruthlessly. Phase 0 + Phase 1 only are mandatory. Everything else is optional growth. Get the core right first. |

---

## 14. Decision Framework: When to Say No

Every feature request should be tested against:

1. **Does it help a trainee find a standard TEE view?** If yes, prioritize.
2. **Does it help an educator teach probe manipulation?** If yes, consider.
3. **Does it require new infrastructure (auth, database, backend)?** If yes, defer unless it unlocks institutional revenue.
4. **Does it require expertise we don't have (ultrasound physics, hemodynamic modeling)?** If yes, defer or find a collaborator.
5. **Does it make the landing page more compelling?** If yes, consider for conference timeline.
6. **Does it only help power users?** If yes, defer. Serve beginners first.

---

## Appendix A: Feature Comparison Matrix

| Feature | TeeSim (Current) | TeeSim (Phase 2) | Virtual TEE Toronto | HeartWorks (Commercial) |
|---------|-----------------|-------------------|---------------------|------------------------|
| Cost | Free | Free (individual) | Free | ~$50,000+ |
| Platform | Browser | Browser + tablet-optimized | Browser + iPad app | Dedicated hardware |
| Continuous probe manipulation | YES | YES | NO (preset selection) | YES (physical mannequin) |
| 3D spatial visualization | YES (excellent) | YES | NO | YES |
| Real ultrasound images | NO (CT-derived) | NO (CT-derived, better windowed) | YES (real echo clips) | YES (real-time rendering) |
| Standard views | 8 | 20 | 20 + 19 alternative | 28+ |
| Pathology cases | NO | NO | YES (3 cases) | YES (many) |
| Doppler | NO | NO | YES | YES |
| Guided learning | NO | YES (onboarding, hints, challenges) | YES (quizzes) | Varies by institution |
| Progress tracking | NO | YES (local + optional account) | NO | Varies |
| Curriculum alignment | Partial (ASE names) | YES (ASE levels, PTEeXAM) | YES (ASE views) | YES |
| Languages | English | English + Japanese | 10 languages | English |
| Open source | YES | YES | NO | NO |
| Cardiac motion | NO | Phase 4 goal | NO (static clips) | YES |
| LMS integration | NO | YES (embed mode) | NO | Some |

---

## Appendix B: Key References

- Hahn RT et al. Guidelines for Performing a Comprehensive Transesophageal Echocardiographic Examination. JASE 2013.
- Reeves ST et al. Basic Perioperative TEE Examination: A Consensus Statement of the ASE and SCA. Anesth Analg 2013.
- Virtual TEE, University of Toronto: http://pie.med.utoronto.ca/tee/
- NBE PTEeXAM Content Outline: https://www.echoboards.org/EchoBoards/PTEeXAM.aspx
- ASE Foundation Education Grants: https://www.asefoundation.org/grants/
- FAER Research Grants: https://faer.org/grants/
