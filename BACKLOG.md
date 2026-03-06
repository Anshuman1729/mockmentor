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

---

## 🔴 Critical (Do Next — Gates Everything Downstream)

### 1. Debrief Schema Migration
**Why**: Current schema `{verdict, overall, strengths[], gaps[], question_highlights, closing}` is completely different from the Tech Arch source-of-truth contract. ALL Week 2 features (signals, hire probability, radar chart) require this first.

**Scope**:
- `lib/groq.ts` → rewrite `generateDebrief()` prompt to produce 8 signals (0-10), hire_probability, hire_recommendation, improvement_actions, weaknesses with fixes
- `components/DebriefReport.tsx` → full rerender: signal grid, hire probability %, strengths/weaknesses with fix text, improvement actions list
- `lib/email.ts` → update HTML email template
- Target schema is in MEMORY.md (Tech Arch contract)

**Complexity**: L | **Agent pattern**: Execution → Review | **Deps**: None (self-contained)

---

### 2. rubric.ts Integration → Hire Probability
**Why**: `rubric.ts` in `interview-prep-week-2/` has only 2 of 8 signals defined. LLM should score signals; TypeScript calculates hire probability deterministically (vibe-proof principle).

**Scope**:
- Move to `mockmentor/lib/rubric.ts`
- Complete all 8 signals with weights
- Export `calculateHireProbability(signals, roundType): number`
- Update `generateDebrief()` to use rubric math (not LLM) for hire_probability

**Complexity**: M | **Agent pattern**: Execution | **Deps**: Debrief schema migration (#1)

---

## 🟡 Pending (Week 2 — After First 10 User Feedbacks)

### 3. Radar Chart (Recharts, 5-axis)
- Install `recharts`
- Add `<RadarChart>` to `DebriefReport.tsx` with 5 highest-weight signals
- User score vs ideal hire benchmark overlay
- **Deps**: #1 (needs 8-signal schema), #2 (needs hire probability)
- **Complexity**: M

### 4. Shadow Scoring Audit
- `ALTER TABLE debriefs ADD COLUMN reasoning JSONB;`
- Ask LLM to include `_reasoning` field in response (not user-facing)
- Strip from API response, store in DB column
- Founder-only audit view (no UI needed yet)
- **Complexity**: S | **Deps**: #1

### 5. Progressive Loading Screen
- Replace static "Generating your debrief…" with cycling messages
- Messages: "Extracting claims...", "Calibrating benchmarks...", "Evaluating signals...", "Generating hire probability...", "Compiling report..."
- Cycle every 2.5s during `generating-debrief` state
- **Complexity**: S | **Deps**: None

### 6. Paywall Teaser (2 signals free, 6 blurred)
- Check `user.plan` from Clerk metadata in session API
- In `DebriefReport.tsx`: blur signals at index ≥ 2 for `plan === "free"`
- Add upgrade CTA below blurred signals
- **Complexity**: S | **Deps**: #1, Clerk plan metadata setup

### 7. TTS Speed Control (1x / 1.5x / 2x) + Mute Toggle
- User feedback: TTS slightly slow; wants speed option and mute
- Add speed multiplier to `useTTS.ts` and `/api/tts` or client-side HTML5 Audio `playbackRate`
- Add mute toggle button in InterviewRoom controls bar
- **Complexity**: S | **Deps**: None

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
