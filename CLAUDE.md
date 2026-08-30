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

### Agent Org
- This repo has an AI agent org defined in `.claude/agents/` — Phase 0 built 2026-08-27: Chief of Staff, the full Tech pod (Planner/Coder/Tester/Debugger/Reviewer), and the remaining 6 department heads (Director of Compliance, Director of Analytics, VP Product, Marketing Director, Sales Head, VP of Monetization), all reporting to Chief of Staff rather than directly to Anshuman
- Phase 1 built 2026-08-28: Legal (Compliance Associate, Senior Compliance Counsel, Specialist Counsel) and Analytics (Junior Analyst, Senior Analyst, Data Engineer). Neither department is flat under its Director — see `docs/autonomy-charter.md`'s org map for the actual reporting chain (a Senior seat sits between the Director and the junior-most seat in each department; one seat per department reports to the Director directly)
- Full reference: `docs/autonomy-charter.md` — access tiers, org map, phased rollout
- **The Article II gate list applies to every agent seat regardless of tier or which session is running it**: real money spent, a message reaching a real external person, anything legal (ToS/filings/contracts), pricing changes, prod DB writes, a push to `main` or a merge without Reviewer's sign-off, any user-facing `hire_probability`/BARS/rubric exposure (this repeats the two rules above — the point is it's not re-litigated per department), hiring/contracts. No automated seat holds real external-system credentials (email send, payments, ad platforms) — only the interactive session Anshuman is driving does.

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
- `debriefs` columns: `debrief_data` (JSONB, user-facing), `reasoning` (JSONB, internal — now `{ signals, fatal_flag }`, was a bare array), `actual_outcome` (TEXT), `company_type` (TEXT), `tokens_used` (JSONB: `{input_tokens, output_tokens, model}`)
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
| Retry/drill loop (rewrite an answer, get rescored) | 🟡 Built — `POST /api/interview/drill` + `scoreDrillAttempt()` in `lib/groq.ts`, ephemeral (no DB write) by design. Untested against a live `GROQ_API_KEY` — needs a smoke test before considering it verified. |
| Cross-session trend tracking (same weakness across interviews) | 🟡 Built — `GET /api/sessions/[sessionId]` now returns `history` (zero schema changes), rendered as "Your Recurring Pattern" in `DebriefReport.tsx`. Untested against real multi-session data — needs a smoke test with an actual repeat user. |

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

### ICP-First Redesign (`feat/icp-dashboard`) — reframing for first-time interview candidates
Direct product ask: the ICP is young professionals / college students who haven't interviewed much, not
people who already have. Researched actual first-timer pain points (knowledge/expectation gaps vs.
recruiters, campus-placement anxiety in the India market) and competitor gaps (Pramp/Final Round
AI/Huru — see PR description) before building.
| Item | Status |
|---|---|
| BARS jargon removed from user-facing copy | ✅ Done — was leaking on the homepage ("BARS framework: ...") and in `DebriefReport.tsx`'s Signal Analysis subhead; this was already a non-negotiable-rules violation independent of the ICP work |
| Jargon/tone pass (STAR, EQ, FAANG, "Ceiling/Floor Rule", Dominating/Submissive, etc.) | ✅ Done — rewritten in plain language across `DebriefReport.tsx`, `InterviewRoom.tsx`, `DrillPractice.tsx`, `DebriefLoadingScreen.tsx`; `lib/groq.ts` few-shot examples also detoxified so future LLM output doesn't imitate the jargon-heavy register |
| "This is practice, not a real hiring decision" framing | ✅ Done — added under the verdict banner and as a reassurance note on the TMAY step (camera-use is also disclosed as self-view-only, never recorded) |
| Homepage founder note / real face | 🟡 Built — section shipped with a placeholder photo block; the Higgsfield connector needed to generate the agreed AI stand-in photo was signed out mid-session, so the actual image still needs to be dropped in (swap the gradient block in `app/page.tsx` for a real `<Image>`) |
| First-timer testimonial + softened section copy | ✅ Done |
| `/dashboard` vs `/progress` split (Backlog: "this is bad product design") | ✅ Done — `/dashboard` is now start-a-new-interview only; new `/progress` page merges the past-interviews list with account-wide trend analytics |
| `GET /api/sessions/analytics` (account-wide signal history) | ✅ Done |
| Shared trend math (`lib/signals.ts`) | ✅ Done — `computeSignalTrends`/`SIGNAL_META` extracted out of `DebriefReport.tsx` so the per-session "Your Recurring Pattern" and the account-level `/progress` page can't disagree about the same underlying data |
| `/dev/progress` DB-free preview | ✅ Done — same pattern as `/dev/debrief`; `SessionHistory` and `ProgressDashboard` both take an optional `initialSessions` prop for this |
| Chronic-weak / improving signals, per-signal averages, round-type & company-stage breakdowns | ✅ Done — all on a 1–5 rating basis, no hire_probability % surfaced anywhere on the page (non-negotiable rule) |

### Conversion Flow Rework (`claude/prepsignals-conversion-flow-uvlbke`) — following direct user feedback on PR #19
Four-item follow-up after the ICP-first redesign above: real AI preview response, don't gate the setup
form behind login, dashboard needed proof content, and a discussion on whether to merge the form into
the landing hero. Branched from `claude/prepsignals-icp-dashboard-oqk70y` (PR #19, still open/unmerged
at the time) — the two branches were merged together so this work has that PR's SetupForm
wizard/InteractivePreview/landing redesign as its base.
| Item | Status |
|---|---|
| InteractivePreview real AI reveal (was a hardcoded canned response) | 🟡 Built — new public `POST /api/preview-analysis` (rate-limited ~5/hr/IP via `lib/rate-limit.ts`, 20-600 char input cap, fixed sample question, `reasoning_effort: "low"`, small `max_tokens`) calling a new `scorePreviewAnswer()` in `lib/groq.ts`. End-to-end wiring verified live (loading state, error state, rate-limit 429 all confirmed via a running dev server) — the actual Groq response content is **unverified**: this sandbox's egress policy blocks `api.groq.com` outright (403 "host not in allowlist"), so the call itself has never successfully completed anywhere it's been built |
| Setup form no longer gated behind login | ✅ Done — real gate was `proxy.ts` (`clerkMiddleware`, not `middleware.ts`), not a page-level check; `/dashboard` added to its public routes. `SetupForm.tsx` now lets anonymous visitors fill all 3 steps; the final-step CTA becomes "Sign up to start" / "Log in to start" when signed out. Draft (form + resolved JD text) persists to `sessionStorage` across the Clerk redirect round-trip via `redirect_url=/dashboard`; on return, a resume effect auto-creates the session and redirects into the interview — no re-click needed. `POST /api/sessions` stays server-side auth-gated, unchanged. Visually confirmed through step 3 in a live dev server; the final signed-out CTA render itself is **unverified** — Clerk's client SDK never finished loading (`isLoaded` stayed false) in this sandbox, most likely the same kind of network-egress restriction as the Groq block above, not a code issue (the `!isLoaded` fallback state itself was confirmed to render safely) |
| Fix: landing CTAs still jumped straight to `/sign-up` (user-reported after a live test — "Start Interview" took them to Clerk, then home, then they had to click "Go to Dashboard" again) | ✅ Done — the `/dashboard`-ungating above didn't touch the landing page's own CTAs: hero, top nav "Start free", bottom CTA, and `InteractivePreview`'s reveal CTA all still pointed straight at `/sign-up` when signed out, defeating the whole point. All four now point at `/dashboard`, confirmed via rendered HTML (`href="/dashboard"` on all three landing CTAs, no remaining `href="/sign-up"`) |
| Fix: debrief generation failing (user-reported after a live test interview, no error visible to them) | ✅ Done, root cause **unconfirmed live** (no working `GROQ_API_KEY` egress in this sandbox to reproduce) — `generateDebrief()`'s `max_tokens: 7000` predates `question_walkthrough`/`priority_risks`/`model_answers`/`path_to_next_tier` being added to the schema; a full 8-question-round report can plausibly exceed that and silently truncate mid-JSON, and `JSON.parse` was throwing with zero diagnostic info, caught generically as "Failed to generate debrief" with no way to tell truncation from a malformed/incomplete response. gpt-oss-120b supports 32K output tokens on Groq (confirmed via Groq's docs), so bumped to 12000; also now explicitly checks `finish_reason === "length"`, wraps the parse with a specific error + raw-response server-side logging, and guards a parsed-but-missing `summary`/`skill_analysis`. The three known-safe messages are now surfaced to the client instead of only ever the generic one. If this wasn't the actual cause, the added logging (raw response on parse failure, truncation detection) should make the real one visible next time it fails |
| Dashboard as a real conversion surface | ✅ Done — trust rail (4 items, reused from the landing page's honest/verifiable set) + one testimonial alongside the form on `/dashboard`, two-column on desktop / stacked-form-first on mobile. Visually confirmed at both breakpoints |
| Hero-embedded form vs. two-step landing→dashboard (strategic question, opinion requested) | Decided: **keep the two-step flow**. Recommendation given and accepted: a multi-field wizard competing with the hero's headline/trust/photo either guts the persuasive copy or pushes the form below the fold anyway, and duplicates `InteractivePreview`'s job as the hero's "give value before signup" element. The actual fix for "dashboard feels empty" was the trust-rail item above, not merging pages. Flagged, not touched: `/dashboard` reads oddly as a URL for a page now reachable pre-auth — a rename (e.g. to `/start`) is a real but separate, larger change (ripple through links/redirects) |

## Key User Feedback
- Entry #1: Key Moments / specific question highlights explicitly valued — do not remove
- Entry #4: TTS slightly slow. Speed control + mute (BACKLOG #8) shipped since (was already done, backlog was stale); TTS also upgraded to `bulbul:v3` via the streaming endpoint (2026-08-26) as a further latency attempt — unverified against real user perception. Loading time praised.
- Entry #1: "baaki this is pretty good man"
