# PrepSignals — Claude Code Instructions

## What This App Is
PrepSignals is an AI-powered mock interview platform. Tagline: "Know exactly where you'd lose the offer — before you walk in."
Stack: Next.js 16 (App Router), TypeScript, Tailwind CSS, Neon Postgres, Groq API (`openai/gpt-oss-120b` + Whisper v3 Turbo — Llama 4 Scout was swapped out after Groq decommissioned Llama 3.3; gpt-oss defaults to `reasoning_effort: "medium"`, which the question-generation calls override to `"low"` to avoid burning the token budget on hidden reasoning before the answer), Sarvam AI TTS (`bulbul:v3` via the `/text-to-speech/stream` HTTP streaming endpoint), Resend, Clerk auth.

## Non-Negotiable Rules

### Git
- **NEVER push directly to main.** Always create a feature branch + PR.
- Branch naming: `feat/<short-description>`
- Git repo root is `mockmentor/` — not the parent `InterviewPrep/` directory

### Hire Probability
- `hire_probability` is computed deterministically via `calculateNormalizedScore()` in `lib/rubric-researched.ts`
- It is stored in `debriefs.debrief_data` and `debriefs.reasoning` but **never shown in the UI**
- Only the 4-bucket recommendation badge is shown: Strong Hire / Hire / Borderline / No Hire
- Do not expose the % to users under any circumstance — liability risk

### Debrief Schema
- The live contract is in `lib/groq.ts` (`DebriefReport` interface) — that is the source of truth
- `docs/debrief-schema-migration.md` is the planning doc — may be slightly stale
- The old schema (`verdict / overall / strengths / gaps / question_highlights / closing`) is legacy — only rendered in the backward-compat fallback in `DebriefReport.tsx`

### Internal vs User-Facing
- `debriefs.reasoning` (JSONB column) — internal shadow scoring only, never returned to client
- Conversational metrics (Talk ratio, SNR, Latency, Interruptions) — shown with research-backed benchmarks, not raw numbers alone
- Do not expose LLM internals (BARS scoring logic, rubric weights, signal IDs) in user-facing copy

## Key Architecture Decisions
- **Evidence-first scoring**: LLM extracts verbatim quotes per signal; TS calculates hire_probability (vibe-proof)
- **Seniority modifiers**: `calculateNormalizedScore()` applies Junior/Mid/Senior weights from `lib/rubric-researched.ts`
- **Round-dynamic question counts** (`QUESTIONS_BY_ROUND` in `app/api/interview/question/route.ts`): technical_screen=5, technical_deep_dive=8, system_design=6, behavioural=7, final=8, hr_screen=5, case_study=5. (This line previously said "screening=5, technical=8, final=10, behavioural=7" — final was wrong (10 vs actual 8), and several round types weren't listed at all.)
- **Lazy Groq client**: instantiated on first use to avoid build-time env var errors
- **Signal-Seeking Seeding** (done — landed via `feat/intelligence-db-fatal-flag`, this line previously said "planned" which contradicted the PRD Status table below marking it ✅ Done): question route fetches a verified seed from `question_bank` (domain → company → generic match, excluding already-used seeds), only for technical-style rounds (see `seedRoundType()` — HR/behavioral rounds never use domain-seeded generation, since it has no round-type awareness of its own). Seed passed to `generateNextQuestion` which LLM-adapts it to target uncovered signals.
- **Fatal Flag** (done, same stale-"planned" fix as above): `lib/fatal-flag.ts` — deterministic, no LLM. Zero signal = null answer, <10 words, or "I don't know" phrases. >30% skip rate → force "No Hire", cap hire_probability ≤30.

## Metric Benchmarks (research-backed — do not change without new research)
| Metric | Target | High Risk | Low Risk |
|---|---|---|---|
| Talk Ratio | 60–75% | >78% Monologuing (Ceiling Rule) | <55% Passive (Floor Rule → biased No Hire) |
| Latency | 1.2–2.0s | >3.5s Indecisive | <0.5s Interruptive |
| Interruptions | <2 | >2 Dominating | 0 + low talk = Submissive |
| SNR | >15% | — | <5% Verbosity flag |

## Testing
```bash
npm run test:debrief         # seed mock session + debrief (no LLM, instant)
npm run test:debrief:live    # seed + call real API (dev server must be running)
npm run test:debrief:clean   # delete test sessions, seed fresh
npm run test                 # vitest unit tests (lib/rubric-researched.ts, lib/fatal-flag.ts)
npm run test:coverage        # vitest with coverage
```
- Loading screen preview: `http://localhost:3000/dev/loading`
- Test sessions use `user_email = 'test@prepsignals.dev'`
- `scripts/audit-gaps/lighthouse-check.mjs` and `axe-core-check.mjs` exist for perf/a11y checks against a running dev server — not wired into CI yet, run manually

## DB Schema Notes
- `debriefs` columns: `debrief_data` (JSONB, user-facing), `reasoning` (JSONB, internal), `actual_outcome` (TEXT), `company_type` (TEXT), `tokens_used` (JSONB: `{input_tokens, output_tokens, model}`)
- `qa_pairs` columns: `answer_duration_sec` (FLOAT), `seed_question_id` (UUID FK→question_bank — column exists, not yet populated)
- `sessions` columns: `candidate_questions_asked` (INTEGER DEFAULT 0), `company_stage` (TEXT)
- **Live tables** (Intelligence DB — created `feat/intelligence-db-fatal-flag`):
  - `companies`: `id` (TEXT PK), `name`, `industry`
  - `question_bank`: `id` (UUID), `company_id` (FK), `question_text`, `round_type`, `tags` (TEXT[]), `difficulty` (INT), `ideal_keywords` (TEXT[]), `expected_signals` (TEXT[])`
  - `calibration_loops`: `id` (UUID), `session_id` (UUID), `ai_score` (FLOAT), `llm_reasoning` (JSONB), `discrepancy_score` (FLOAT), `actual_outcome` (TEXT)
- **Fatal Flag**: `lib/fatal-flag.ts` — >30% zero-signal → force "No Hire", cap hire_probability ≤30
- Seed data source: CC0 `realabbas/big-companies-interview-questions` — see `docs/resource-licensing.md`
- Ingestion script (planned PR 2): `scripts/seed-intelligence.ts` — run once with `REPO_PATH=/tmp/realabbas-repo npm run seed:intelligence`

## PRD Status (as of 2026-03-07)

### Week 1 — Must Have
| Item | Status |
|---|---|
| User auth (Clerk) | ✅ Done |
| Session history | ✅ Done |
| Profile/TMAY step | ✅ Done |
| STT fix + error handling | ✅ Done |
| Mobile responsiveness | 🟡 Addressed (98e1877, then a consistency pass 2026-08-26) — fixed via static code analysis only; still needs a real visual pass in a browser against a live session (interview room / debrief with real content) before calling it verified |
| Landing page with CTA | ❓ Not tracked |

### Batch Implementation (2026-03-07)
| Item | Status |
|---|---|
| LLM → Llama 4 Scout | ✅ Done |
| STT → Whisper v3 Turbo | ✅ Done |
| Outcome tracking API (#9) | ✅ Done |
| Answer duration tracking (#10) | ✅ Done |
| Question rate tracking (#11) | ✅ Done |
| Few-shot prompting (#12) | ✅ Done |
| Company stage context injection (#13) | ✅ Done |
| Token usage logging (#14) | ✅ Done |

### Week 2 — V1.5
| Item | Status |
|---|---|
| 8-signal BARS scoring (evidence-first) | ✅ Done |
| Hire probability (deterministic, internal) | ✅ Done |
| Conversational metrics with benchmarks | ✅ Done |
| Key Moments (derived from skill_analysis) | ✅ Done |
| Shadow scoring (reasoning column) | ✅ Done |
| Progressive loading screen | ✅ Done |
| Radar chart | ⬛ De-prioritised |
| Shareable debrief card | ⬛ Not started |
| PhonePe payment | ⬛ Not started |

### Debrief/UI Redesign (overnight session on `feat/phase2-2.5`)
| Item | Status |
|---|---|
| MetricCard (What/Benchmark/Yours) actually rendered | ✅ Done — was fully built but never wired in |
| Question-by-question walkthrough (`question_walkthrough`) | ✅ Done — new `DebriefReport` field, one entry per answered question |
| Deterministic framework-per-signal (`SIGNAL_FRAMEWORKS` in `lib/rubric-researched.ts`) | ✅ Done — surfaced on any signal rated ≤3 |
| Model answer excerpts (`model_answers`) grounded in the actual question | ✅ Done — 1-2 entries, weakest signal(s) only |
| `skill_analysis[].reasoning` states hire-decision implication, not just behavior | ✅ Done — prompt requirement in `lib/groq.ts` |
| Every signal explains itself regardless of score (`SIGNAL_META.blurb`) | ✅ Done — jargon (STAR/SNR) no longer unexplained on high scores |
| Fixed double-navbar (homepage nav + generic shared header both rendering) | ✅ Done — root layout split into bare shell + `(app)` route-group layout |
| Fixed dark-mode badge colors on light `SessionHistory` cards (also: "Hire" fell through to the red badge) | ✅ Done |
| Fixed verdict banner permanently stuck via unbounded `sticky` (covered content for the entire scroll, both mobile and desktop) | ✅ Done — found via persona review, was a real severe bug |
| Above-the-fold summary (bottom-line fix + quick nav) so a long report isn't "nothing to grab onto" before scrolling | ✅ Done |
| `/dev/debrief` mock preview (+ `?scenario=strong` / `?scenario=nohire`) for DB-free visual QA | ✅ Done |
| Longest-monologue / candidate-question-rate surfaced in metrics cards (Backlog #10/#11) | ✅ Done — plain ungraded stats, no invented benchmark |

### Debrief "Coaching Cockpit" Rework (same branch, following direct user product feedback)
Direct critique after the redesign above landed: the report was optimized for producing an
impressive artifact, not for closing the gap between "I messed this up" and "here's exactly
what to do differently." Reworked within the existing architecture; see git log on
`feat/phase2-2.5` for the full rationale per change.
| Item | Status |
|---|---|
| `priority_risks` — 2-3 consolidated root causes replacing "8 separate scores" as the primary read | ✅ Done — every signal rated ≤3 must be explained by one, enforced in the prompt |
| `ModelAnswer` enriched with `your_quote` + `why_it_hurt` (Observed → Problem → Better) | ✅ Done — up to 3 entries, one per priority_risk |
| `path_to_next_tier` — the counterfactual ("what would move the verdict") | ✅ Done |
| `confidence_rationale` — ties Confidence to something concrete instead of bare metadata | ✅ Done |
| `overall_impression` in the interviewer's first-person voice, elevated as the verdict banner's centerpiece quote | ✅ Done |
| SNR/verbosity contradiction fix: "Signal-to-Noise" renamed "Content Density", copy explicitly separates density from structure | ✅ Done |
| Frameworks consolidated 8→3 canonical (`CANONICAL_FRAMEWORKS` in `lib/rubric-researched.ts`) | ✅ Done |
| `SIGNAL_META.bars` rewritten from generic tier words ("Proficient") to specific behavioral descriptions | ✅ Done — "false precision" fix |
| Signal Analysis demoted to collapsed (`<details>`) supporting evidence, no longer the primary read | ✅ Done |
| Retry/drill loop (rewrite an answer, get rescored) | ⬛ Deferred — new interaction model, not a redesign, needs its own scoping |
| Cross-session trend tracking (same weakness across interviews) | ⬛ Deferred — needs new cross-session queries + UI, needs its own scoping |

### Intelligence DB (`feat/intelligence-db-fatal-flag`)
| Item | Status |
|---|---|
| companies + question_bank + calibration_loops tables | ✅ Done (PR 1) |
| qa_pairs.seed_question_id column | ✅ Done (PR 1) |
| Fatal Flag: >30% zero-signal → force No Hire | ✅ Done (PR 1) |
| Missing-signal rawScores defaulted to 0 | ✅ Done (PR 1) |
| CC0 ingestion script (`scripts/seed-intelligence.ts`) | ✅ Code complete (PR 2) — needs live seed run to verify |
| Signal-Seeking Seeding in `generateNextQuestion` | ✅ Done (PR 2) — seed fetched in question route (domain→company→generic), injected into prompt, `seed_question_id` persisted |
| Calibration loop logging per session | ✅ Done — debrief route logs `ai_score` + `llm_reasoning`; outcome API backfills `actual_outcome`/`discrepancy_score` into `calibration_loops` (commit `9bfe87b`) |

### Week 3+ — Monetisation
- Free (₹0): 1 mock, basic debrief, limited signals
- Sprint (₹1,999/30 days): unlimited mocks, all analytics
- Deep Dive (₹2,999/30 days): everything + resume alignment, PDF report

## Key User Feedback
- Entry #1: Key Moments / specific question highlights explicitly valued — do not remove
- Entry #4: TTS slightly slow. Speed control + mute (BACKLOG #8) shipped since (was already done, backlog was stale); TTS also upgraded to `bulbul:v3` via the streaming endpoint (2026-08-26) as a further latency attempt — unverified against real user perception. Loading time praised.
- Entry #1: "baaki this is pretty good man"
