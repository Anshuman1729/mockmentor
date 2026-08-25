# Phase 2 — Exhaustive Handoff Prompt

**Branch:** `feat/phase2-ux-revamp` (merged to `main` via PR #17)  
**New branch for this artifact:** `feat/phase2-handoff`  
**Status:** Ready to begin Phase 2 implementation  
**Autonomy setting:** Fully autonomous — proceed through chunks, confirm tests before merge

---

## What Just Completed (Phase 1 + Fixes)

All work merged to `main` (not direct pushes):

| PR | Commit | What |
|----|--------|------|
| #14 | `d869c1b` | Phase 1 audit + critical fix (hire_probability removed from API + UI) |
| #15 | `31db117` | Auth gaps — Clerk auth + session ownership + `lib/session-auth.ts` |
| #16 | `7891a67` | Audit gap scaffolds — Lighthouse + axe-core scripts |
| #17 | `86689b9` | Rebased Phase 2 branch (includes real vitest specs + ESM audit script fixes) |

Audit artifacts (`docs/audit-phase-1/`): 4 reports + `HANDOFF.md` + market research (`docs/phase2-ux-market-research.md`).

---

## Before Editing Any Phase 2 Component

1. **Create feature branch:** `git checkout -b feat/phase2-<chunk-name>`
2. **Read the relevant spec section** in this file (component map + test criteria)
3. **Check `docs/phase2-ux-market-research.md`** — know what's borrowed (Final Round simplicity, Huru rubric transparency, Conversations Chat flow, Pramp frictionless) vs what's unique (evidence-first, outcome calibration, company-specific feedback)
4. **Never expose `hire_probability`** — `CLAUDE.md` non-negotiable. Only 4-bucket recommendation (`Strong Hire` / `Hire` / `Borderline` / `No Hire`).
5. **No direct pushes to `main`** — PR + Vercel preview + test pass → merge.

---

## Component Map (What to Edit)

| Component | File Path | Phase 2 Chunk | Key Changes |
|-----------|-----------|---------------|-------------|
| Landing Page | `app/page.tsx` | 2.1 Hero Redesign | Badge + H1 + CTA tightened; trust bar preserved |
| Setup Form / Role Picker | `components/SetupForm.tsx` | 2.2 Role Picker Flow | Unify onboarding; faster <90s setup |
| Interview Room | `components/InterviewRoom.tsx` | 2.3 Interview Room UI | Progress bar + signal compass + enhanced loading |
| Debrief Report | `components/DebriefReport.tsx` | 2.4 Debrief Clarity | Sticky verdict banner; key metrics visible <5s |
| Global Layout / Responsive Grid | `app/layout.tsx` + component grids | 2.5 Mobile-First Responsive | No horizontal scroll; touch targets ≥44px |

---

## Phase 2 Chunk Sequence (In Order)

### Chunk 2.5 — Mobile-First Responsive Layout (FIRST — affects all others)
**File(s):** `app/page.tsx`, `components/InterviewRoom.tsx`, `components/DebriefReport.tsx`, `components/SetupForm.tsx`, `components/SessionHistory.tsx`, `app/layout.tsx`
**Design principle:** Mobile-first; responsive grid; touch targets ≥44px height.
**Test case (from spec):** Mobile device lab test — no horizontal scroll. Visual check on iPhone SE / Pixel.
**Acceptance:** `npm run build` passes; no layout overflow in `InterviewRoom` (full-screen mode) or `DebriefReport`.

---

### Chunk 2.1 — Landing Page Hero Redesign
**File:** `app/page.tsx`
**Current state (from `CLAUDE.md` / `plan.md`):**
- Badge: `✦ AI Mock Interviews · Built for Indian tech roles`
- H1: `Know exactly where you'd lose the offer — before you walk in.`
- Sub: Voice-first + 8 signals + free to start
- CTA: `Start Free Mock Interview →` / `Go to Dashboard`
- Trust bar: 4 items with blue dots

**What to improve (per market research + spec):**
- Tighter mobile stacking (hero + trust bar must not overflow horizontally)
- Ensure hero CTA button size ≥44px (touch target rule from 2.5 applies here too)
- Preserve the debrief mockup preview — it demonstrates value prop; do not remove the signal grid / evidence quote / metric cards (user feedback: Key Moments valued)

**Test case:** Visual regression test — hero matches design mockup (100% pixel accuracy is aspirational; aim for no overflow, no broken grid, readable text on 375px viewport).
**Pass criteria:** No horizontal scroll; text readable at mobile width; CTA button visible above fold.

---

### Chunk 2.2 — Implement Role Picker Flow (SetupForm)
**File:** `components/SetupForm.tsx`
**Current flow:**
1. Role + Company (required) → 2. YOE + Round Type → 3. Company Stage (optional) + Domain → 4. Resume upload + JD URL / Fallback

**What to improve (per audit + spec):**
- End-to-end setup time <90s (spec test case: 2.2)
- Keep all fields (role, company, yoe, round_type, company_stage, domain, background/resume, jd_content) — they feed the dynamic question engine (`generateNextQuestion` uses role/company/round_type/domain/company_stage/background)
- Ensure mobile form inputs don't overflow; select dropdown works on touch
- Keep resume parsing (`/api/parse-resume`) and JD fetch (`/api/fetch-jd`) intact — don't break existing API contracts

**Test case:** Complete setup in <90s; submit creates session in DB; redirect to `/interview/${sessionId}` works.
**Pass criteria:** `POST /api/sessions` returns valid `sessionId`; `GET /api/sessions` shows new session for user.

---

### Chunk 2.3 — Enhance Interview Room UI
**File:** `components/InterviewRoom.tsx`
**Current features to preserve:**
- Room states: `init`, `tmay`, `loading-question`, `speaking`, `listening`, `submitting`, `generating-debrief`
- TMAY (`profile-setup`) step — speak intro, inject `background` into session
- Progress bar (`progressValue`) — thin bar at top, visual only
- Debrief loading screen (`DEBRIEF_MESSAGES`) — 5 cycling messages
- Camera PiP corner tile
- STT (`useSTT`) + audio recording (`useAudioRecorder`)
- Submit handles Whisper transcription (`/api/transcribe`) + STT fallback

**What to add (per spec + audit):**
- Signal compass / enhanced progress indicator (beyond thin bar) — maybe a visual indicator showing which interview signals are being tested in current round? Per `COMPETITIVE_ANALYSIS.md`, Final Round AI owns simple UX; we must differentiate with evidence + progress.
- Ensure mobile layout: camera tile doesn't overlap transcript; transcript box scrolls; submit button is touch-accessible
- Keep `answer_duration_sec` tracking (`#10`) and `candidateQuestions` tracking (`#11`) — these are live instrumentation, not UI-only

**Test case:** Simulate 3 sessions; verify progress updates; mobile layout has no scroll overflow; submit works with audio.
**Pass criteria:** `roomState` cycles correctly; no `ReferenceError`; progress bar updates per question (`current.questionNumber / current.total`).

---

### Chunk 2.4 — Improve Debrief Page Clarity
**File:** `components/DebriefReport.tsx`
**Current structure (already good — from `CLAUDE.md` / audit):**
- Header with role/company/round/YOE/email
- Verdict banner (`NewDebrief` schema: `Strong Hire` / `Hire` / `Borderline` / `No Hire`)
- Conversational metrics (4 metric cards: Talk/Listen, SNR, Latency, Interruptions)
- 8-Signal Grid (2-column grid with `SIGNAL_META` mapping, rating dots, BARS label)
- Key Moments (positive + critical, derived from `skill_analysis` sort)
- Behavioral Insights (STAR Adherence + Confidence + Red Flags)
- Actionable Feedback (Strengths / Growth Areas / Top Priority Fix)
- Legacy fallback (`LegacyDebrief`) for old schema

**What to improve (per spec test case: key metrics visible in <5s):**
- Ensure sticky/visible verdict banner — it should be visible without scrolling on a standard laptop viewport
- Confirm all metric cards have `MetricStatus` styling (ideal/good/watch/flag) — already implemented; don't break
- Don't expose internal scoring logic (`calculateNormalizedScore` weights, BARS logic) in user-facing copy — `CLAUDE.md` non-negotiable
- Keep evidence quotes (`evidence_quotes`) in Key Moments and Signal cards

**Test case:** Load `/debrief/[sessionId]`; key metrics (Talk Ratio, SNR, Latency, Interruptions, Verdict) visible within 5 seconds; no scroll required for verdict.
**Pass criteria:** `DebriefReport` renders without `loading` error; `isNewDebrief` detects new schema; legacy fallback renders correctly for old sessions.

---

## Critical Dependencies (Don't Break)

- `lib/session-auth.ts` — shared auth helper (must stay; used by 4 routes)
- `lib/email.ts` — debrief email (must not expose `hire_probability`; must keep recommendation pill only)
- `lib/fatal-flag.ts` — fatal flag logic (deterministic; don't add LLM dependency)
- `lib/rubric-researched.ts` — `calculateNormalizedScore()` (deterministic; seniority weights must stay)
- `app/api/interview/debrief/route.ts` — debrief generation (uses `generateDebrief` from `lib/groq.ts`)
- `app/page.tsx` — landing hero (contains the debrief mockup preview — don't remove the signal grid or quote section)

---

## Vercel Preview + Stress Test Protocol

For EVERY Phase 2 chunk:

1. **Branch:** `git checkout -b feat/phase2-<chunk>`
2. **Edit component(s)** per chunk plan above
3. **Local build:** `npm run build` passes (no TypeScript errors, no `vitest/config` import errors — either exclude vitest.config from build or fix package installation)
4. **Local test:** `npm run test` passes (real assertions, not `expect(true).toBe(true)`)
5. **Visual regression:** Check mobile view (`chrome://inspect` or responsive mode) — no horizontal scroll; touch targets ≥44px
6. **Vercel preview:** Push branch → `git push origin feat/phase2-<chunk>` → deploy preview
7. **Stress test:** Manually simulate 3 interview sessions in preview; submit answers; verify progress; generate debrief; confirm no new errors
8. **No direct push to `main`** — create PR from `feat/phase2-<chunk>` → `main`; merge only after all 8 steps pass

---

## What Not to Change (Non-Negotiable from `CLAUDE.md`)

- `hire_probability` must NEVER appear in UI, email, or any user-facing output
- `debriefs.reasoning` must NEVER be returned to client (internal shadow scoring only)
- Don't expose BARS scoring logic weights or rubric internals in user-facing copy
- Don't change metric benchmarks without new research (see table above)
- Don't push directly to `main`

---

## Quick Check Before Starting Each Chunk

```bash
git fetch origin main
git checkout -b feat/phase2-<chunk>
# make edits
npm run build
npm run test
# check mobile layout
# deploy preview
# stress test 3 sessions
git commit -m "feat: phase 2 chunk X — <description>"
git push origin feat/phase2-<chunk>
gh pr create --base main --head feat/phase2-<chunk>
# only merge after preview + stress test pass
```

---

## Handed Over By
- Phase 1 audit: completed (`docs/audit-phase-1/`)
- Critical fixes: merged (`main` via PR #14, #15, #16, #17)
- Auth gaps: fixed (`lib/session-auth.ts` + 4 routes)
- Audit scaffolds: added (`scripts/audit-gaps/` + `test/smoke.spec.ts` replaced by real specs + `vitest.config.mts`)
- Phase 2 market research: `docs/phase2-ux-market-research.md` (borrow what works, build unique evidence/outcomes)
- Rebase: `feat/phase2-ux-revamp` rebased onto current `main`; `main` is clean ancestor

Start with chunk 2.5 (responsive) — affects all other components.
