# PrepSignals — Claude Code Instructions

## What This App Is
PrepSignals is an AI-powered mock interview platform. Tagline: "Know exactly where you'd lose the offer — before you walk in."
Stack: Next.js 16 (App Router), TypeScript, Tailwind CSS, Neon Postgres, Groq API (Llama 4 Scout 17B MoE + Whisper v3 Turbo), Sarvam AI TTS, Resend, Clerk auth.

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
- **Round-dynamic question counts**: screening=5, technical=8, final=10, behavioural=7
- **Lazy Groq client**: instantiated on first use to avoid build-time env var errors
- **Signal-Seeking Seeding** (planned — `feat/intelligence-db-fatal-flag`): question route fetches a verified seed from `question_bank` (company + round_type match, excluding already-used seeds). Seed passed to `generateNextQuestion` which LLM-adapts it to target uncovered signals.
- **Fatal Flag** (planned): `lib/fatal-flag.ts` — deterministic, no LLM. Zero signal = null answer, <10 words, or "I don't know" phrases. >30% skip rate → force "No Hire", cap hire_probability ≤30.

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
```
- Loading screen preview: `http://localhost:3000/dev/loading`
- Test sessions use `user_email = 'test@prepsignals.dev'`

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
| Mobile responsiveness | ❓ Not verified |
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

### Intelligence DB (`feat/intelligence-db-fatal-flag`)
| Item | Status |
|---|---|
| companies + question_bank + calibration_loops tables | ✅ Done (PR 1) |
| qa_pairs.seed_question_id column | ✅ Done (PR 1) |
| Fatal Flag: >30% zero-signal → force No Hire | ✅ Done (PR 1) |
| Missing-signal rawScores defaulted to 0 | ✅ Done (PR 1) |
| CC0 ingestion script (`scripts/seed-intelligence.ts`) | ⬜ PR 2 |
| Signal-Seeking Seeding in `generateNextQuestion` | ⬜ PR 2 |
| Calibration loop logging per session | ⬜ PR 2 |

### Week 3+ — Monetisation
- Free (₹0): 1 mock, basic debrief, limited signals
- Sprint (₹1,999/30 days): unlimited mocks, all analytics
- Deep Dive (₹2,999/30 days): everything + resume alignment, PDF report

## Key User Feedback
- Entry #1: Key Moments / specific question highlights explicitly valued — do not remove
- Entry #4: TTS slightly slow (BACKLOG #8 pending). Loading time praised.
- Entry #1: "baaki this is pretty good man"
