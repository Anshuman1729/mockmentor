# MockMentor — Session Backlog

> Maintained by Claude Code. Updated at end of each session.
> Each item is tagged: complexity (S/M/L), agent pattern, dependencies.

---

## ✅ Done (This Session — 2026-03-06)

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

*(No critical blockers — debrief schema migration + rubric integration both complete)*

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
