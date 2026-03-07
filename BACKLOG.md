# PrepSignals — Session Backlog

> Maintained by Claude Code. Updated at end of each session.
> Each item is tagged: complexity (S/M/L), agent pattern, dependencies.

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

## 🔴 Critical (Do Next — Gates Everything Downstream)

### A. Switch LLM to Llama 4 Scout
- Update model string in `lib/groq.ts`: `"llama-3.3-70b-versatile"` → `"meta-llama/llama-4-scout-17b-16e-instruct"`
- Run `npm run test:debrief:live` to validate debrief output quality
- **Complexity**: S | **Gates**: #12 (few-shot), #13 (context injection), #14 (token logging)

### B. Switch STT to Whisper Large v3 Turbo
- Update model string in `app/api/transcribe/route.ts`: `"whisper-large-v3"` → `"whisper-large-v3-turbo"`
- Test with a live interview session to confirm accuracy is acceptable
- **Complexity**: S | **Gates**: Nothing downstream, pure cost saving

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

### 7. Adaptive Waveform Animation (Reacts to Mic Input)
- Current waveform is CSS-only (fixed pulse, doesn't reflect actual audio)
- Use `AudioContext` + `AnalyserNode` on the mic stream to get real-time frequency data
- Drive bar heights from `getByteFrequencyData()` on each animation frame
- **Complexity**: S | **Deps**: None (mic stream already available in `useAudioRecorder.ts`)

### 8. TTS Speed Control (1x / 1.5x / 2x) + Mute Toggle
- User feedback: TTS slightly slow; wants speed option and mute
- Add speed multiplier to `useTTS.ts` and `/api/tts` or client-side HTML5 Audio `playbackRate`
- Add mute toggle button in InterviewRoom controls bar
- **Complexity**: S | **Deps**: None

### 9. Outcome Tracking — API + UI pending ✅ (DB done)
- DB columns `actual_outcome TEXT`, `company_type TEXT` added
- Still needed: `/api/sessions/[sessionId]/outcome` POST endpoint + a simple "Did you get the job?" prompt after 2 weeks (email or in-app)
- **Complexity**: M | **Deps**: Done
- **Target**: Start tracking after 50 paying users
### 10. Longest Monologue Tracking
- Capture duration of each individual answer during the interview (start/end timestamp per answer)
- Store `answer_duration_sec` in `qa_pairs` table
- Surface longest monologue in conversational metrics: target <2.5 min; flag if exceeded
- **Complexity**: M | **Deps**: InterviewRoom.tsx instrumentation, DB migration on qa_pairs
- **Why**: High variance between answers (e.g. 5-min vs 10-sec) = lack of consistent communication structure

### 11. Question Rate Tracking
- Track how many questions the candidate asks the interviewer during the session
- Increment a counter in session state when candidate phrases end with "?" or explicit question markers
- Store `candidate_questions_asked` in `sessions` table
- Surface in conversational metrics: target 3–5 questions; below = disinterested, above = distracted
- **Complexity**: M | **Deps**: InterviewRoom.tsx instrumentation, DB migration on sessions
- **Why**: Question rate is a proxy for curiosity and critical thinking — key PM/leadership signal

### 12. Few-Shot Prompting in Debrief Generation
- Add 2–3 few-shot examples to the system prompt in `lib/groq.ts` `generateDebrief()`
- Examples should cover: Strong Hire response (deep technical + structured STAR), No Hire response (vague, no evidence), Borderline response (decent comms, weak depth)
- Each example must include signal name → rating → reasoning → evidence_quote in the exact output JSON format
- **Why**: Scout's MoE architecture anchors to few-shot format — prevents output drift into generic feedback. Critical for maintaining BARS quality after model switch.
- **Complexity**: S | **Deps**: LLM switch to Scout
- **File**: `lib/groq.ts` — modify `DEBRIEF_SYSTEM_PROMPT` or equivalent

### 13. Rich Context Injection in Debrief Prompt
- Currently: JD is already passed to the debrief prompt ✅
- Needed: Explicitly structure the prompt to use JD for company-specific signal evaluation
- Add a "Company Stage" field to `SetupForm.tsx` (Seed / Series A / Series B / Public) — informs culture inference
- Inject stage + company name + role into prompt as a structured `[COMPANY CONTEXT]` block
- Example signal verdict: "Candidate's 'move fast' instinct suits your Series B pace — but lacks the documentation discipline that scales."
- **Why**: Generic debrief = commodity. Company-contextualised debrief = defensible. Scout's 128k window makes this essentially free.
- **Complexity**: M | **Deps**: #12 (do prompting first)
- **Files**: `SetupForm.tsx`, `app/api/sessions/route.ts`, `lib/groq.ts`

### 14. Token Usage Logging
- Log input/output token counts from each Groq API call to a lightweight store (console or DB column)
- Add `tokens_used JSONB` column to `debriefs` table: `{ input, output, model }`
- Use Groq response `usage` field (already returned in API response)
- **Why**: Validate cost projections at scale; catch prompt bloat before it hits PnL
- **Complexity**: S | **Deps**: LLM switch to Scout
- **File**: `app/api/interview/debrief/route.ts`, DB migration

---

## ⬛ Skip / Won't Fix (Not Worth Doing Now)

| Item | Reason |
|---|---|
| `lib/anthropic.ts` rename | Already done — file is `lib/groq.ts` in codebase. Memory was stale. |
| `TOTAL_QUESTIONS` dynamic | Already implemented per round type (screening:5, technical:8, final:10, behavioral:7) |
| `db/schema.sql` create | Already exists at `mockmentor/db/schema.sql` |
| TTS switch ElevenLabs → Sarvam | Already using Sarvam AI (`/api/tts` uses Sarvam bulbul:v2) |

---

## 📋 Week 3 — Monetisation (Not Yet Planned)
- PhonePe payment integration
- Shareable debrief card (LinkedIn/WhatsApp)
- Resume alignment scoring (Deep Dive tier)
- PDF report export (Deep Dive tier)
