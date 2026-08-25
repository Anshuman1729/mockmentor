# Phase 2 — Market Research: Interview Platform UX
**Branch:** `feat/phase2-ux-revamp`  |  **Status:** Research complete — ready for design

---

## What Works (Borrow)

| Source | Pattern | Why It Works | Borrow For Phase 2 |
|--------|---------|--------------|-------------------|
| **Final Round AI** | Simple one-sentence pitch; freemium funnel | Low friction, viral shareability | **2.1 Hero** — clearer value prop; **2.2 Role Picker** — faster setup |
| **Huru.ai** | Published rubric (trust); voice/speech coaching | Transparency builds credibility | **2.4 Debrief** — sticky verdict + evidence quotes (already ours) |
| **Interviews Chat** | Conversational realism (not scripted Q&A) | User engagement, fast iteration loop | **2.3 Interview Room** — keep conversational, add progress bar / signal compass |
| **Pramp** | Free/low friction; peer vibe | Viral growth | **2.5 Responsive** — mobile-first removes device friction |
| **Exponent** | Role-specific content; human credibility | PM/Design users feel tailored | **2.2 Role Picker** — company + stage + domain fields already exist |

---

## What We Must Build Unique (Don't Copy)

1. **Evidence-first UI** — Every score linked to verbatim quote (our 8-signal rubric; competitors hide this)
2. **Outcome calibration** — Show what the score predicts (no competitor shows this; build the progress dashboard / weekly loop per gap 4 in COMPETITIVE_ANALYSIS.md)
3. **Company-specific feedback** — Not generic "you need more confidence"; tie to actual JD (already in `SetupForm`; need to surface results visibly in 2.4)
4. **Progressive loading screen** — Already implemented (`InterviewRoom.tsx`); enhance with per-step progress (2.3 enhancement)

---

## Design Principles for Phase 2

- **Evidence over vibes** — Lead with quote, not score. Keep 4-bucket badge (Strong Hire / Hire / Borderline / No Hire) only; never expose % (fixed in Phase 1).
- **Mobile-first** — 2.5 must come first because interview happens on phones (camera + mic usage).
- **Clear value prop** — "Know exactly where you'd lose the offer — before you walk in." Hero must make the test-case input (quote + score + recommendation) visible immediately.
- **Progressive disclosure** — Don't overwhelm new users; show only role/company/round first, expand to details.

---

## Phase 2 Chunk Order (Confirmed)

| Chunk | Task | Design Focus | Test Case (from spec) |
|-------|------|-------------|----------------------|
| **2.5** | Mobile-First Responsive | Grid, no horizontal scroll, touch targets ≥44px | Mobile lab test |
| **2.1** | Landing Hero Redesign | Badge + H1 + CTA + trust bar (existing); tighter mobile stack | Visual regression |
| **2.2** | Role Picker Flow | Unified onboarding; TMAY step already present | End-to-end <90s |
| **2.3** | Interview Room UI | Progress bar + signal compass + loading messages | 3 sessions, progress updates |
| **2.4** | Debrief Clarity | Sticky verdict banner + actionable feedback + metric cards | Key metrics visible <5s |

---

## Vercel Preview Plan

- Branch `feat/phase2-ux-revamp` → Deploy to Vercel preview URL
- Stress test: mobile device lab + Lighthouse + visual regression before merge
- Merge only after all Phase 2 test cases pass (per spec decision criteria)
