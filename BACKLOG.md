# PrepSignals — Session Backlog

> Maintained by Claude Code. Updated at end of each session.
> Each item is tagged: complexity (S/M/L), agent pattern, dependencies.

---

## ✅ Done (Overnight session — `feat/phase2-2.5`, debrief/UI redesign)

Worked autonomously per user direction from the end of the previous session's brainstorm
(`docs/session-handoff-2026-08-26.md`, Findings #1-5). Verified via `tsc`/`eslint`/`vitest`
after every change, plus persona-based review agents (4 total, across senior-engineer,
career-switcher, new-grad, and PM personas) actually browsing the rendered pages via
Playwright and reporting back real UX friction — not just self-review.

| Task | Notes |
|---|---|
| **Finding #1 — render the already-built MetricCard** | Was fully built (`what`/`why`/`bench`/`yours` per metric) but the live render only showed a stripped inline version. Swapped in. |
| **Finding #2 — question walkthrough** | New `question_walkthrough` field on `DebriefReport` (`lib/groq.ts`) — one entry per answered question, each stating what happened AND its hire-decision implication. Rendered as a numbered timeline, first content section after the verdict. |
| **Finding #3 — implication, not just observation** | `generateDebrief` system prompt now requires every `skill_analysis[].reasoning` to state the interview consequence, not just describe behavior. |
| **Finding #4 — deterministic frameworks** | New `SIGNAL_FRAMEWORKS` table in `lib/rubric-researched.ts` (same "deterministic where possible" philosophy as `hire_probability`) — one framework + steps per signal, surfaced on any rating ≤3. |
| **Finding #5 — model answers** | New `model_answers` field — 1-2 entries for the weakest signal(s), each a concrete rewritten answer grounded in the actual question asked (reuses the transcript context `generateDebrief` already had). |
| **Debrief visual redesign** | Restrained emerald/amber/red/gray palette replacing the blue-heavy generic-SaaS look; numbered section headings; every signal card explains itself via a plain-English blurb regardless of score (jargon like STAR/SNR was previously unexplained on high-scoring cards). |
| **Fixed: permanently-stuck verdict banner** | `position: sticky` with no bounded parent height pinned the black "Interview Outcome" card over all content for the entire scroll, both mobile and desktop. Caught independently by two persona reviews before a real user would have. Removed. |
| **Fixed: double navbar on homepage** | Root layout's generic header was rendering on top of the homepage's own custom nav. Split into a bare root layout + `(app)` route-group layout for dashboard/debrief/interview/sign-in/sign-up. |
| **Fixed: SessionHistory badge contrast + "Hire" mis-colored** | `RecommendationBadge` used dark-mode text colors on a white card (illegible), and any non-"Strong Hire"/non-"Borderline" result — including plain "Hire" — fell through to the red/danger badge. |
| **Above-the-fold summary** | A "Bottom line" line in the verdict banner + a quick-nav anchor row, so a first-time reader has something to act on before scrolling a long report (flagged by PM-persona review). |
| **`/dev/debrief` mock preview** | New DB-free preview route (`?scenario=strong` / `?scenario=nohire` variants) mirroring the `/dev/loading` pattern — lets the whole redesign be visually verified without a live database or LLM call. |
| **`DebriefLoadingScreen` deduplication** | Was byte-identical in `InterviewRoom.tsx` and `/dev/loading` — extracted to `components/DebriefLoadingScreen.tsx` so the two can't drift. |
| **#10/#11 UI surfacing** | `answer_duration_sec` (longest monologue) and `candidate_questions_asked` now injected into `debrief.metrics` in the debrief route and rendered as plain, ungraded stat tiles — no invented benchmark, since neither has research backing yet unlike the four existing metric cards. |

### Still open from this pass
- **Sarvam STT realtime WebSocket** — deliberately not attempted (see previous handoff); needs a human present to decide browser-direct-vs-proxied architecture and test against a real key.
- Dashboard/`SetupForm` got a lighter consistency pass (dropped the generic blue "AI Setup" pill, matched card styling to the homepage) but wasn't redesigned as deeply as the debrief — the highest-leverage surface for now was the debrief per explicit user feedback.

---

## ✅ Done (Session — 2026-03-06, Landing Page)

| Task | Notes |
|---|---|
| **Landing page redesign** | Full rewrite of `app/page.tsx` — 8-section conversion-optimised page: hero (eyebrow badge, big H1, trust bar), pain section (dark full-width), how it works (numbered cards), features deep-dive (3 cards with badges), debrief preview mockup card, testimonials (from FeedbackLog #1 and #4), pricing teaser (Free/Sprint/Deep Dive), bottom CTA. Blue-600 accent, mobile-first grid layout. |
| **Pricing teaser** | 3-tier pricing UI: Free tier highlighted (blue border), Sprint + Deep Dive greyed out with disabled "Coming soon" buttons. No payment integration. |

### Known Bugs — Landing Page
| Bug | Location | Notes |
|---|---|---|
| "Start here" button in Free pricing card doesn't redirect | `app/page.tsx` — Pricing Teaser section, Free tier `<Button asChild>` + `<Link href="/sign-up">` | Investigate: may be a Clerk middleware redirect or `asChild` + Link interaction on the pricing card specifically |

---

## 📝 Decision Record — LLM Model (2026-03-07)

### LLM Model Decision Record

| Aspect | Llama 3.3 70B Versatile | Llama 4 Scout 17B (16E MoE) |
|---|---|---|
| Input pricing | $0.59/M tokens | $0.11/M tokens (81% cheaper) |
| Output pricing | $0.79/M tokens | $0.34/M tokens |
| Throughput | ~394 TPS | ~594 TPS (~50% faster) |
| Context window | 128k | 128k |
| Architecture | Dense 70B | MoE 17B active / 109B total |
| Cost per debrief (~20k tokens) | ~₹1.05 | ~₹0.19 |
| At 2,000 debriefs/month | ~₹2,100 | ~₹380 (saves ~₹1,720/month) |

**Decision**: Switch to Scout. 81% cheaper per debrief, 50% faster. MoE architecture benefits from few-shot anchoring — prompt engineering required to match or exceed Llama 3.3 output quality. See #12 and #13 below.

**Scout Optimization Strategy**:
- Scout's MoE routing benefits from few-shot examples — anchors the model to our 8-signal BARS format
- 128k context window enables rich company context injection (JD + handbook snippet + company stage) at minimal cost
- Target: company-specific debrief feedback, not generic interview feedback — this is the defensibility moat

---

## 📝 Decision Record — STT Model (2026-03-07)

### Whisper Large v3 vs Whisper Large v3 Turbo — Decision Record

| Aspect | Whisper Large v3 | Whisper Large v3 Turbo |
|---|---|---|
| Pricing | $0.111/hour | $0.04/hour |
| Cost per 45-min interview | $0.0833 = ₹7.60 | $0.03 = ₹2.73 |
| Speed | Standard (189x faster than realtime) | ~5.4x faster than v3 |
| Accuracy | 8.4% WER (short-form) | Slightly lower (optimized for speed) |
| Architecture | Full 1550M parameters | Reduced decoder layers (4 vs 32) |
| Best For | Maximum accuracy needed | Speed + cost-sensitive applications |

**Decision**: Switched to Turbo. 64% cheaper per interview. At 2,000 interviews/month saves ₹9,740/month (₹1,16,880/year). Accuracy tradeoff acceptable for interview transcription use case.

---

## ✅ Done (Session — 2026-03-07, Batch Implementation: Model Swaps + Instrumentation + Context)

| Task | Notes |
|---|---|
| **#A: LLM → Llama 4 Scout** | `lib/groq.ts` MODEL constant swapped to `meta-llama/llama-4-scout-17b-16e-instruct`. 81% cheaper, ~50% faster. Branch: `feat/batch-1-model-swaps` |
| **#B: STT → Whisper v3 Turbo** | `app/api/transcribe/route.ts` model swapped to `whisper-large-v3-turbo`. 64% cheaper per interview. Branch: `feat/batch-1-model-swaps` |
| **#9: Outcome Tracking API** | New `app/api/sessions/[sessionId]/outcome/route.ts` — POST `{ actual_outcome, company_type }` → UPDATE debriefs. No UI yet. Branch: `feat/batch-2-instrumentation` |
| **#10: Longest Monologue Tracking** | DB: `qa_pairs.answer_duration_sec FLOAT`. InterviewRoom records `answerStartTimeRef` on listen start, computes `answer_duration_sec` on submit. Answer API stores it. Branch: `feat/batch-2-instrumentation` |
| **#11: Question Rate Tracking** | DB: `sessions.candidate_questions_asked INTEGER DEFAULT 0`. InterviewRoom counts `?`-ending answers. PATCHes session before debrief trigger. PATCH handler extended. Branch: `feat/batch-2-instrumentation` |
| **#12: Few-Shot Prompting** | `FEW_SHOT_EXAMPLES` constant in `lib/groq.ts` — 3 calibrated examples (Strong Hire/No Hire/Borderline) injected before scoring rubric in `generateDebrief()`. Anchors Scout to BARS JSON format. Branch: `feat/batch-2-instrumentation` |
| **#13: Company Stage Context** | DB: `sessions.company_stage TEXT`. SetupForm: optional Seed/Series A/Series B/Public dropdown. Sessions route stores it. `SessionContext` extended. `[COMPANY CONTEXT]` block injected into debrief prompt. Branch: `feat/batch-3-context-tokens` |
| **#14: Token Usage Logging** | DB: `debriefs.tokens_used JSONB`. `generateDebrief()` now returns `{ report, usage }`. Debrief route stores `{ input_tokens, output_tokens, model }` in `tokens_used`. Branch: `feat/batch-3-context-tokens` |

---

## ✅ Done (Session — 2026-03-07, Name Change)

| Task | Notes |
|---|---|
| **Rename: MockMentor → PrepSignals** | Updated all user-facing text, metadata, email templates, docs, and code comments. PR `name-update` merged to main. Vercel URL (`mockmentor-mu.vercel.app`) left unchanged until redeployment under new name. |

---

## ✅ Done (Session — 2026-03-06, Week 2 Features)

| Task | Notes |
|---|---|
| STT: whisper-large-v3 model swap | `app/api/transcribe/route.ts` — simple swap |
| STT: Prompt biasing | Injects role/company/round into Whisper `prompt` param |
| STT: "Rough Draft" label | Shows on live transcript, disappears after Whisper result |
| TMAY profile-setup step | `InterviewRoom.tsx` — new `tmay` state; PATCH `/api/sessions/[sessionId]` |
| STT: network error handling | `useSTT.ts` + `InterviewRoom.tsx` — stop retry loop on Chrome network error, show "Recording in progress" message |
| **Debrief Schema Migration (complete)** | DB columns added (`reasoning`, `actual_outcome`, `company_type`); `lib/groq.ts` new `DebriefReport` interface + 8-signal BARS prompt; `debrief/route.ts` deterministic `hire_probability` via `calculateNormalizedScore()`; `DebriefReport.tsx` full UI rewrite with signal grid, metrics row, behavioral insights, backward compat for legacy sessions; `lib/email.ts` updated template with hire probability + signal highlights |
| **Shadow scoring** | `reasoning` JSONB column in DB; LLM reasoning stored separately, not in user-facing `debrief_data` |
| **Hire probability hidden from UI** | % computed internally + stored in DB; only 4-bucket recommendation badge shown to user |
| **Metric cards with research-backed benchmarks** | Talk ratio target 60–75%, Ceiling Rule >78%, Floor Rule <55%; Latency 1.2–2.0s; Interruptions <2 = Dominating; each card has What/Benchmark/Personalised verdict |
| **Key Moments restored** | Derived from skill_analysis highs (≥4) and lows (≤2); shows signal name + verbatim evidence quote + reasoning |
| **Test seeder** | `scripts/seed-test-debrief.mjs`; `npm run test:debrief` (mock, no LLM), `test:debrief:live` (real pipeline), `test:debrief:clean` (cleanup) |

---

## 🔴 Critical (Do Next)

### Intelligence DB: Grounded Questioning & Signal-Seeking Calibration
- **Branch**: `feat/intelligence-db-fatal-flag`
- **Plan**: `docs/plans/2026-03-07-intelligence-db-fatal-flag.md`
- **Scope**:
  1. Merge `intelligence-db/schema.sql` into Neon (`companies`, `question_bank`, `calibration_loops` + `qa_pairs.seed_question_id`)
  2. CC0 ingestion script `scripts/seed-intelligence.ts` — reads `realabbas/big-companies-interview-questions`, Groq-enriches, inserts into `question_bank`
  3. Refactor `generateNextQuestion` to pull a verified seed from DB, LLM-adapts to target uncovered signals
  4. Fatal Flag: >30% skipped/zero-signal questions → force "No Hire", cap hire_probability ≤30
  5. Log session-level calibration data to `calibration_loops` per debrief
- **Why**: Closes sparse-data loophole; moves from prompt-only to grounded intelligence
- **Complexity**: L | **Prereq**: `git clone https://github.com/realabbas/big-companies-interview-questions /tmp/realabbas-repo`

---

## 🟡 Pending (Week 2 — After First 10 User Feedbacks)

### 3. Radar Chart (Recharts, 5-axis) ⬛ De-prioritised
- Install `recharts`
- Add `<RadarChart>` to `DebriefReport.tsx` with 5 highest-weight signals
- User score vs ideal hire benchmark overlay
- **Deps**: #1 (needs 8-signal schema), #2 (needs hire probability)
- **Complexity**: M
- **Note**: De-prioritised — not blocking anything; revisit post-monetisation

### 4. Shadow Scoring Audit — Founder View ✅ (DB done, UI pending)
- DB column `reasoning JSONB` done, LLM reasoning stored per-session
- Still needed: founder-only query/dashboard to read it
- **Complexity**: S | **Deps**: Done

### 5. Progressive Loading Screen ✅ Done
- 5 cycling messages (2.5s each, 300ms fade) during `generating-debrief` state
- Progress dots show position
- Dev preview at `/dev/loading`
- Intentionally omits internal copy (no "Scoring 8 signals", "Computing hire probability")

### 6. Paywall Teaser (2 signals free, 6 blurred)
- Check `user.plan` from Clerk metadata in session API
- In `DebriefReport.tsx`: blur signals at index ≥ 2 for `plan === "free"`
- Add upgrade CTA below blurred signals
- **Complexity**: S | **Deps**: #1, Clerk plan metadata setup

### 7. Adaptive Waveform Animation (Reacts to Mic Input) ✅ Done (2026-08-26)
- Built as `components/VoiceOrb.tsx` — canvas-based, not the originally-imagined bars, but same mechanism: real `AnalyserNode.getByteFrequencyData()` amplitude driving the animation on every `requestAnimationFrame`, not a fixed CSS pulse.
- Goes further than the original ask: reacts to the mic stream (`useAudioRecorder.ts`'s new `analyserRef`) while listening AND to the TTS output (`useTTS.ts`'s new `analyserRef`, tapped off the `<audio>` element via `createMediaElementSource`) while speaking. Falls back to a gentle synthetic breathing animation when no analyser is available yet, so it never looks frozen.

### 8. TTS Speed Control (1x / 1.5x / 2x) + Mute Toggle ✅ Done
- Already implemented (see commit `1fe9319`, predates this backlog check) — `useTTS.ts` has `cycleRate`/`rate` (0.75x/1x/1.25x/1.5x, persisted to localStorage) and `toggleMute`/`muted`, both exposed as buttons in `InterviewRoom.tsx`'s controls bar. This item was stale in the backlog, not actually pending.

### 9. Outcome Tracking ✅ Done (API complete, UI pending)
- `/api/sessions/[sessionId]/outcome` POST endpoint done
- Still needed: "Did you get the job?" prompt after 2 weeks (email or in-app)
- **Target**: Start tracking after 50 paying users

### 10. Longest Monologue Tracking ✅ Done (2026-08-27)
- `qa_pairs.answer_duration_sec` stored per answer; debrief route now takes the max across the
  session and injects it as `debrief.metrics.longest_monologue_sec`, rendered as a plain stat
  tile in `DebriefReport.tsx`'s Conversational Metrics section.

### 11. Question Rate Tracking ✅ Done (2026-08-27)
- `sessions.candidate_questions_asked` stored; debrief route now injects it as
  `debrief.metrics.candidate_questions_asked`, rendered alongside #10 above.

### 12. Few-Shot Prompting ✅ Done
- 3 examples (Strong Hire / No Hire / Borderline) injected in `generateDebrief()` system prompt

### 13. Rich Context Injection ✅ Done
- `company_stage` field in SetupForm, sessions table, and debrief prompt

### 14. Token Usage Logging ✅ Done
- `debriefs.tokens_used JSONB` stores `{ input_tokens, output_tokens, model }` per debrief

---

## ⬛ Skip / Won't Fix (Not Worth Doing Now)

| Item | Reason |
|---|---|
| `lib/anthropic.ts` rename | Already done — file is `lib/groq.ts` in codebase. Memory was stale. |
| `TOTAL_QUESTIONS` dynamic | Already implemented per round type (screening:5, technical:8, final:10, behavioral:7) |
| `db/schema.sql` create | Already exists at `mockmentor/db/schema.sql` |
| TTS switch ElevenLabs → Sarvam | Already using Sarvam AI (`/api/tts` uses Sarvam bulbul:v2) |

---

## 📋 Engagement Loop: Competence-Based Gamification (Blocked on Analytics)

### Prerequisite: Product Analytics / Event Tracking
- **Why**: Codebase has zero event-level analytics — checked `app/api/sessions/analytics/route.ts`, it re-derives trends from `sessions`/`debriefs` at read time; nothing is tracked as an event anywhere. Any retention/engagement hypothesis below is unfalsifiable without this.
- **Scope (undecided — needs its own PRD before building)**: pick an approach (lightweight custom `events` table vs. a tool like PostHog), instrument at minimum: session start, session complete, debrief viewed, drill-loop used, return session (2nd+ completed session by the same `user_email`).
- **Complexity**: TBD — depends on build-vs-buy decision
- **Status**: Not started. Blocks the item below.

### Feature: Rings / Referral / Help-Credit Loop (Discovery stage complete, paused here)
Surfaced from a product-design discussion (2026-08-26): PrepSignals has no return mechanic today — one session, one debrief, nothing pulls the user back. Discussed and refined into a specific proposal, grounded in the `product-design-principles` skill's gamification research (Sailer et al. 2017 — engagement mechanics build autonomy/relatedness but not competence, which is the thing this product should actually build).

- **Hypothesis**: Replacing "no return mechanic" with a competence-anchored closure loop increases 2nd-session return rate without degrading trust signals (session abandonment, qualitative feedback).
- **Mechanic** — kept to 2 systems total, per the research's "feature-richness ceiling" (stacking 3+ mechanics tends to reduce engagement, not increase it):
  1. **Closure rings** — one ring per `priority_risks` entry from the user's first debrief (2-3 signals, already computed, no new data needed). Closes when the drill loop (`POST /api/interview/drill`) brings that signal back above threshold.
  2. **Reward moment** — partial ring closure unlocks a referral-bonus ask, bundled into the *same* screen as the milestone badge (not a separate ask) — leans on commitment-consistency, asking for advocacy while the "I'm improving" self-signal is fresh. Full closure grants help-credits.
- **Explicitly scoped OUT of live sessions**: help-credit hints spend only inside the existing ephemeral drill loop (`POST /api/interview/drill`, never writes to `qa_pairs`/`debrief_data`) — never in a live scored session, because `hire_probability` is deterministically computed from the candidate's own verbatim answers (`lib/rubric-researched.ts`), and a hinted answer scored through that same pipeline would silently corrupt the signal.
- **Non-goals**: not a funnel/acquisition fix (ICP-first redesign's job), not a monetization mechanism yet (credit→free-month conversion blocked on pricing, which isn't decided), doesn't re-litigate debrief quality.
- **Open detail**: help-credit cap = `floor(0.7 × total_questions_in_round)`, all questions counted in the denominator including intro questions (e.g. 8-question round → 5 hint-eligible drill attempts).
- **Complexity**: M/L (rings UI + badge/referral flow + credit ledger) once the analytics prerequisite unblocks measurable success criteria
- **Status**: PDLC Stage 1 (Discovery) complete. Paused here per user direction — defining success metrics (Stage 2) without a way to measure them isn't useful; resume once the analytics prerequisite above is scheduled.

---

## 📋 Week 3 — Monetisation (Not Yet Planned)
- PhonePe payment integration
- Shareable debrief card (LinkedIn/WhatsApp)
- Resume alignment scoring (Deep Dive tier)
- PDF report export (Deep Dive tier)
