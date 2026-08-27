# PrepSignals — Session Backlog

> Maintained by Claude Code. Updated at end of each session.
> Each item is tagged: complexity (S/M/L), agent pattern, dependencies.

---

## ✅ Done (Session — 2026-08-27, Agent Org Phase 0)

Built the "Autonomy Charter" agent org designed earlier in the same session (originally
sketched from the user's own CSV, revised on direct feedback — a Chief of Staff was
added so department heads don't all report straight to the founder, and the build order
switched to "hire senior first": bring department heads online before any of their
reports exist, each head's first job being to spec its own team).

| Task | Notes |
|---|---|
| 12 subagents in `.claude/agents/` | Chief of Staff + full Tech pod (Planner, Coder, Tester, Debugger, Reviewer) + the remaining 6 department heads (Director of Compliance, Director of Analytics, VP Product, Marketing Director, Sales Head, VP of Monetization). Three-tier access (Read-Only/Write/Full-Auto) enforced via each file's `tools:` allowlist, not just prose — e.g. Reviewer has no `Edit`/`Write`/`Bash` at all. |
| Legal mandate correction | Director of Compliance's job is finding where PrepSignals is *exposed* under Indian law (DPDP Act 2023, IT Act + IT Rules 2021, Consumer Protection Act + E-Commerce Rules, Contract Act, RBI recurring-payment rules), not finding loopholes to exploit — the original CSV draft had this inverted. |
| No MCP servers wired to any seat | Explicit user instruction. Marketplace skills (`legal`, `sales`, `marketing`, `operations`, `data`, `small-business` — searched live, found real, not yet installed) bundle MCP servers (Gmail, Stripe, HubSpot, etc.) together with their skills; only the skill content gets referenced in agent prompts, never the bundled external-system access. Only the interactive session gets real send/spend/pay credentials. |
| `docs/autonomy-charter.md` | Versioned reference doc — access tiers, Article II gate list, full org map including unbuilt Phase 2-4 departments, build sequence. Durable source of truth; an earlier artifact was the presentation layer at design time. |
| `ops/` handoff folders | File-based handoff between departments (`ops/<department>/<subfolder>/`) rather than live agent-to-agent chat — simplest reliable mechanism, and what Chief of Staff's weekly brief reads from once more than one department is active. |
| `CLAUDE.md` — new Agent Org section | Article II gate list now lives in this repo's own non-negotiable rules, not just in individual subagent prompts, so it binds future sessions the same way the existing rules do. |

### Still open
- Phase 1+ (each head building its own reports) not started — waits on Anshuman reviewing each head's Phase 0 hiring spec first.
- Marketplace plugins (`legal`, `operations`, `data`, etc.) identified but not installed — installing is an account-level action the user hasn't triggered yet.
- Not verified: whether `main` actually has GitHub branch protection enabled — the real backstop behind Coder's "never push to main" instruction. Flagged, not checked. No branch-protection tool exists in the available GitHub MCP toolset either — this has to be done manually by Anshuman via GitHub's own Settings → Branches UI.

## ✅ Done (Session — 2026-08-27, standing 24/7 access + stale-session fix)

Built round-the-clock access to Chief of Staff outside of an active Claude Code session
(a persistent Claude Code Remote session + a daily push-notified Routine), then found and
fixed a real bug in it via the user's own verification test.

| Task | Notes |
|---|---|
| Persistent Chief of Staff session | Reachable from any device via claude.ai/code, no laptop or active terminal required. Runs Sonnet (downgraded from the original Opus design — explicit user cost decision, "no seat gets a pass"), same downgrade applied to `chief-of-staff.md`'s `model:` field so the source of truth matches. |
| Daily push-notified check-in (Routine) | Fires ~8:33am IST into a fresh session, reads `ops/`+git+PRs+`BACKLOG.md`, frames anything pending as an explicit decision ("ship these? yes/no") rather than a passive status report. No MCP connectors on the Routine — verified by the platform itself at creation, not just by instruction. |
| Bug found: stale session couldn't invoke any department head | User ran a real verification test (invoke `director-of-compliance` + `reviewer`, report raw output) against the persistent session and got `Agent type not found` for both, even after merging the PR that added them. Root cause confirmed by direct check: `main` had all 12 files; the *session* was stale, created before the merge, and a session's Agent-tool roster doesn't self-refresh against upstream changes. |
| Fix | `chief-of-staff.md`: durable-state principle (re-check `git`/`ops/`/PRs/`BACKLOG.md` every turn; trust the mandate/gate-list/org-map only once, at session start — targets both the staleness bug and token cost) + explicit MCP-vs-git clarification (no connector needed to see a git push, the real fix is fetching fresh). `docs/autonomy-charter.md`: new standing operating rule — any agent-org file change on `main` requires recreating every persistent monitoring session, not just merging the PR. |

### Still open
- New persistent Chief of Staff session (replacing the stale one) needs the same two-seat verification test re-run for real before being trusted.
- The daily Routine's own environment source should be confirmed/pinned to `main` the same way — not yet independently verified as of this entry.

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
| Mixpanel Session Replay | Considered 2026-08-26, declined. Requires the JS browser SDK (a different capability than the server-side event tracking above — records actual on-screen DOM activity, not events) and would capture resume/JD text, spoken-answer transcripts, and personal background during practice sessions. That's a meaningfully different privacy surface than the "camera is self-view-only, never recorded" commitment already made in CLAUDE.md. Explicitly declined by user rather than silently skipped — revisit only with a real need and a scoped/sampled + sensitive-screen-excluded plan. |

---

## 📋 Engagement Loop: Competence-Based Gamification (Blocked on Analytics)

### Prerequisite: Product Analytics / Event Tracking ✅ Done (2026-08-26)
- **Why**: Codebase had zero event-level analytics — `app/api/sessions/analytics/route.ts` only re-derives trends from `sessions`/`debriefs` at read time. Any retention/engagement hypothesis is unfalsifiable without this.
- **Decision**: Mixpanel free tier over GA4 — GA4 is traffic/marketing-attribution first (and `@vercel/analytics`, already installed, already covers pageviews for free); Mixpanel is purpose-built for funnels/retention/cohorts on custom events tied to a user ID, which is what the return-rate hypothesis actually needs.
- **Implementation**: `lib/analytics.ts` — lazy-init wrapper (`MIXPANEL_TOKEN` env var) matching the `lib/groq.ts`/`lib/db.ts` convention; `track()` never throws, so a missing token or Mixpanel outage silently drops events instead of breaking the product. Server-side only, no client-side script.
  - `session_started` — `POST /api/sessions`, includes `session_number` (so return-usage is queryable directly from this one event, no separate "return session" event needed)
  - `session_completed` — `POST /api/interview/debrief`, `{ round_type, recommendation }` only — never `hire_probability` or raw signal scores, per the non-negotiable rule; that number doesn't leave this app for a third-party vendor either
  - `drill_used` — `POST /api/interview/drill`, `{ parameter_id, original_rating, new_rating }`
- **Baseline**: `npm run analytics:baseline` (`scripts/analytics-baseline.mjs`) computes return-usage and completion-funnel numbers from existing DB rows retroactively — a real "before" number without waiting for new events to accumulate. No historical drill-usage data exists (the drill loop is intentionally ephemeral/no DB write), so that one starts at zero going forward.
- **Refined against Mixpanel's own Node.js implementation guide** (2026-08-26, fetched from `storage.googleapis.com/cdn-mxpnl-com/libs/mixpanel-skill/{skill,reference}.md`): `distinct_id` switched from `user_email` to Clerk's stable `userId` (emails can change and fragment a profile — the guide calls this out explicitly); added `$insert_id` on all three events for dedup against client retries (content-hashed for `drill_used` via new `stableInsertId()`, so an exact-duplicate retry dedupes but a genuinely different attempt still counts); `track()` now drops null/undefined properties centrally instead of sending `null`; `session_completed`'s `recommendation` property is lowercased/snake_cased for the analytics value only (UI copy untouched); added `setProfile()` (one `people.set()` call at session creation) so users read as their email in the Mixpanel UI. EU/CA consent-gating from the guide was deliberately not implemented — no consent infrastructure exists in this app and there's no stated EU/CA audience (ICP is India-market per CLAUDE.md); flagging this rather than silently skipping it in case that assumption is wrong.
- **`MIXPANEL_TOKEN` added** to `.env.local` (gitignored, not committed) using the real project token provided by the user. **Still needed**: the same token added to Vercel's production env vars — `.env.local` only covers local dev.
- **Verified**: typecheck/lint/vitest clean. The fail-open design was verified against a real failure, not just designed: `Mixpanel.init()` throws in this sandbox (`HttpsProxyAgent is not a constructor` — the installed `mixpanel@0.23.0` is incompatible with `https-proxy-agent@7.x`'s new export shape, and only triggers when `HTTPS_PROXY`/`HTTP_PROXY` is set, which this sandbox's outbound proxy does). Confirmed `track()`/`setProfile()` caught it and returned normally rather than crashing the request. This bug is specific to environments with an HTTPS_PROXY env var set — unlikely to affect Vercel/local dev unless behind a corporate proxy, so left unpatched (it's an upstream package issue, not this app's code) — but worth knowing about if it's ever hit for real.
- **Live delivery confirmed** (2026-08-26, post-merge via PR #26): first production test hit a stale deployment still on the pre-merge `main` build (session created fine, 200 OK, but no `track()` call existed in that code — confirmed via a Vercel log export, not a guess). After merging #26 and redeploying, a fresh interview session registered a real user/event in Mixpanel. The gap between "code is correct" and "event actually lands" — the thing this whole sub-thread was about — is now closed for real, not just by design.
- **Status**: Done. `session_started` verified live. `session_completed`/`drill_used` still need one real pass each (finish an interview; use the drill/retry feature) to confirm the same, but there's no reason to expect them to behave differently — same `track()` path. Unblocks the item below; a baseline run (`npm run analytics:baseline`) is the next actionable step whenever the rings/referral feature is picked back up.

### End-to-End Acquisition Funnel (2026-08-27) — landing visit → session start
Direct ask, after the engagement-loop work above was set aside: build the real funnel from anonymous
landing-page visit through to whatever the current real end-point is (purchase doesn't exist yet — no
payment gateway, no pricing decided — so the funnel stops at interview completion for now).

- **Architecture change**: the three events above were all server-side/post-auth. Anonymous visitors
  never hit an authenticated API route, so genuine top-of-funnel data requires the **Mixpanel browser
  SDK** (`mixpanel-browser`) for the first time — added as `lib/analytics-client.ts` (same lazy-init/
  fail-open/omit-null philosophy as the server wrapper) plus `components/MixpanelProvider.tsx`, mounted
  in `app/layout.tsx` next to `<Analytics />`. Session Replay explicitly disabled at init
  (`record_sessions_percent: 0`, `autocapture: false`) — enforces the considered-and-declined decision
  above in code, not just in this doc. `NEXT_PUBLIC_MIXPANEL_TOKEN` added to `.env.local` (same public
  project token as the server var — safe to expose client-side by design, per Mixpanel's own docs).
- **Identity linking**: `MixpanelProvider` calls `identify(clerkUserId)` on every page load where a user
  is signed in (not just at first signup) — otherwise client events during a normal already-signed-in
  visit would stay on an anonymous device id. The signup-flow resume effect in `SetupForm.tsx` also
  calls `identify()` directly (cheap, idempotent) immediately before firing the conversion event, to
  remove any doubt about effect-ordering on the exact redirect-return render.
- **Funnel events, in order**:
  1. `landing_page_viewed` — `components/LandingPageView.tsx`, fire-once on mount
  2. `cta_clicked` (`{ cta_location: top_nav | hero | bottom | preview_post_reveal }`) — one event +
     property rather than 4 near-identical event names, via new `components/TrackedCta.tsx`
  3. `basics_submit`, `personalisation_submit` — per-wizard-step, fired in `SetupForm.tsx`'s
     `handleContinue()` (step key-driven, not magic step-number literals)
  4. `jd_submit` (`{ auth_state: signed_in | signed_out }`) — final-step commit, both the direct-submit
     path and the auth-redirect path
  5. `sign_up_completed` / `sign_in_completed` — **not one event**: the resume effect reads back which
     auth mode the visitor was sent to (new `PENDING_AUTH_MODE_KEY` sessionStorage key, set by
     `startAuthRedirect`) so a returning user logging back in isn't miscounted as a fresh signup
  6. `session_started`, `session_completed` — already existed; `session_completed` gained two new
     properties this pass: `interview_depth` (= `totalQuestions`, reusing the debrief route's already-
     normalized local variable rather than a fresh lookup) and `session_duration_sec`
     (`session_completed` time − `sessions.created_at`)
  7. *(Purchase)* — still not built, same as noted above
- **Two real things this surfaced, not fixed as part of this pass**:
  - `lib/email.ts`'s Resend client is instantiated eagerly at module load (unlike `lib/groq.ts`'s lazy
    pattern) — `next build` fails outright without a real `RESEND_API_KEY` present. Found running a
    verification build; out of scope for this task, but worth fixing given it's a real build-time
    landmine for any environment/CI that doesn't already have that key set.
  - `app/api/interview/question/route.ts` and `app/api/interview/debrief/route.ts` each carry their own
    round-type-normalization map, and **they don't agree**: the debrief route treats old `"screening"`/
    `"technical"` values as their own legacy round types (5 and 8 questions respectively), while the
    question route folds both into `technical_screen` (5 questions) instead. Found while deciding where
    to source `interview_depth` from — deliberately did *not* consolidate these into one shared helper,
    since I don't know which behavior is intended for old in-flight sessions and didn't want to guess at
    something with real Fatal-Flag-threshold implications. `interview_depth` sources only from the
    debrief route's copy (the one already exercised in production), so this pass didn't change behavior
    anywhere — just surfaced a pre-existing inconsistency.
- **`debrief_generation_failed` added (2026-08-27)** — a real production test hit the Groq-TPM-capacity
  failure message (from PR #23, merged separately) and correctly produced zero Mixpanel events, because
  `track("session_completed", ...)` only ever runs in the success path, right before the function's
  final `return`. Any exception — this one included — jumped straight to `catch` with no tracking call
  at all, making a backend failure indistinguishable in the funnel from a user silently closing the tab.
  Fixed: `sessionId`/`userId` hoisted out of the `try` block (previously try-scoped `const`s, unreachable
  from `catch`); `KNOWN_SAFE_MESSAGES` changed from a `Set` to a `Map` so each known failure message also
  carries a short `reason` code (`transcript_too_large`, `rate_limited`, `truncated`, etc., `"unknown"`
  for anything else); catch block now fires `debrief_generation_failed` with that reason before
  returning the error response. Also fixed, found while hoisting: `assertSessionOwner(sessionId)` was
  being called before the `!sessionId` presence check (masked previously by `req.json()`'s untyped
  `any` — surfaced immediately once `sessionId` got an explicit type). typecheck/lint/vitest clean.
- **Open interpretation questions** (implemented my best reading, flagged for confirmation): "interview
  depth" — read as question count per round (`totalQuestions`), not YOE/seniority, since
  `technical_deep_dive` already uses "depth" in exactly this sense. "Interview time" and "interview
  completion time" — read as the same ask (`session_duration_sec`, start-to-completion elapsed time),
  not two separate properties, since a session can't be marked completed at all without every question
  answered (the completeness gate blocks partial completion outright, so there's no separate
  "completion rate" to track).
- **Status**: Code complete — typecheck/lint/vitest all clean. **Not yet verified live** — same
  "MIXPANEL_TOKEN added ≠ event confirmed in Live View" gap as before, now for six new client-side
  events plus two new server-side properties. Needs a real click-through (visit → CTA → all 3 wizard
  steps → sign-up → finish an interview) against a deployed build with `NEXT_PUBLIC_MIXPANEL_TOKEN` set.

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

## 🔴 Fixed (2026-08-27) — Debrief generation hitting Groq TPM ceiling regardless of interview length

Real production bug, reported live: a *short* interview hit the same 413 ("transcript too large") as a
long one — proof it wasn't actually about transcript size. Root-caused and fixed in `lib/groq.ts`.

- **Root cause, quantified, not guessed**: Groq's TPM rate limiter counts the reserved `max_tokens`
  toward the budget, not just actual prompt tokens. `generateDebrief()`'s single call had
  `max_tokens: 12000` — 1.5x the account's entire 8000 TPM ceiling *by itself*, before a single prompt
  token was counted. Measured the fixed prompt overhead directly from source (few-shot examples ~2,300
  tokens, rubric ~420, instructions+schema ~2,200 ≈ ~5,000 tokens fixed, present on every call regardless
  of transcript length) — confirms why a short interview failed identically to a long one: the fixed
  overhead dominated, not the transcript.
- **Fix**: split `generateDebrief()` into two Groq calls along the real dependency boundary —
  1. **Scoring** (`skill_analysis`, `metrics`, `question_walkthrough` — evidence read directly off the
     transcript), `max_tokens: 2500`
  2. **Synthesis** (`priority_risks`, `model_answers`, `overall_impression`, `behavioral_insights`,
     `actionable_feedback` — reasons *about* the scoring), `max_tokens: 1800`, receives Call 1's
     `skill_analysis`/`question_walkthrough` as grounding context, and drops the JD block entirely
     (synthesis doesn't need the JD text again — role/company/round_type plus the transcript and Call 1's
     scoring already ground it; the JD was the single largest reusable chunk not worth paying for twice).
  Extracted the shared call+error-handling (`runDebriefCompletion`) and JSON-parse (`parseDebriefJson`)
  logic so the 413/rate-limit/bad-request mapping isn't duplicated across both call sites.
- **`max_tokens` right-sized from measurement, not guesswork**: simulated realistic output JSON for both
  calls — scoring actually needs ~1,570 tokens (8 signals + 8 question_walkthrough entries), synthesis
  ~850 (3 risks + 3 model_answers). Original values (12000 single-call; my first draft's 4000/3500 split)
  were reserving far more than ever gets used — every unused reserved token is TPM budget taken directly
  from the transcript's headroom.
- **Verified quantitatively across 3 scenarios** (simulated prompts with realistic data, same method used
  to diagnose the bug — this sandbox has no live `GROQ_API_KEY` to test end-to-end):
  | Scenario | Call 1 (scoring) | Call 2 (synthesis) | Fits 8000 TPM? |
  |---|---|---|---|
  | Short (5q, ~40w/answer) — the reported bug | ~5,252 | ~5,784 | ✅ |
  | Typical (8q, ~150w/answer) | ~6,786 | ~7,518 | ✅ (smallest margin ~480 tokens) |
  | Verbose (8q, ~700w/answer, near the existing 4000-char/answer cap) | ~13,071 | ~13,803 | ❌ |
- **Known residual risk, not solved here**: a genuinely verbose interview (~5,000 total words across
  answers, near the per-answer cap) can still overflow. Deliberately not addressed in this pass —
  tightening `MAX_ANSWER_CHARS` further trades against legitimate long, substantive answers (the whole
  reason that cap is 4000 chars and not smaller), and that's a product-quality call, not an engineering
  one to make silently.
- **Verified**: typecheck/lint/vitest clean. Not verified against the live Groq API (no working
  `GROQ_API_KEY` egress in this sandbox — same limitation noted elsewhere in this file). Needs a real
  interview run through to confirm no regression in report quality from the prompt split, in addition to
  confirming the 413 is actually gone.

---

## 🔴 Added (2026-08-27) — Hidden quick-test route for the debrief pipeline

Direct ask: testing debrief-generation changes (like the TPM fix above) required a full 5-8 question
interview every time — too slow to iterate on. Built a hidden shortcut that generates a real 1-question
debrief through the actual production pipeline.

- **Materially different from the existing `/dev/*` tools** (`app/dev/debrief`, DB-free mock preview
  using fake data) — this one writes real rows into production `sessions`/`qa_pairs`/`debriefs` and calls
  the real, paid Groq API each time. Flagged this distinction explicitly before building, since an
  obscure-URL-only "hidden" route calling a paid LLM API is a real cost/abuse surface, not just a
  convenience.
- **Access control**: `POST /api/dev/quick-test` requires a signed-in Clerk session (default-protected —
  not added to `proxy.ts`'s `isPublicRoute`) *and* the caller's email must exactly match
  `DEV_TEST_ALLOWED_EMAIL` (fails closed if that env var isn't set) — identity-based, not a secret token
  in the URL (which can leak via browser history/referrer headers/logs). Set to
  `khare.anshuman47@gmail.com` in `.env.local`; **still needed**: the same var added to Vercel.
- **New round_type**: `quick_test` → 1 question, added as a real, explicit entry in
  `app/api/interview/debrief/route.ts`'s `QUESTIONS_BY_ROUND` (not a bypass hack around the completeness
  gate — same map, same code path).
- **Reuses the real pipeline, not a parallel one**: `app/api/dev/quick-test/route.ts` inserts 1 session +
  1 `qa_pairs` row directly, then internally calls `POST /api/interview/debrief` (forwarding cookies for
  auth) — same Groq calls, same error handling, same `debrief_generation_failed` tracking as a real user
  would hit. `/dev/quick-test` (page) is a small form (role/company/answer, all optional) reusing
  `DebriefLoadingScreen`, redirects to the real `/debrief/[sessionId]` page on success — and shows the
  *actual* error message inline on failure, useful for testing the error path too.
- **Kept out of real analytics**: `round_type != 'quick_test'` added to `GET /api/sessions`, `GET
  /api/sessions/analytics`, and the cross-session `history` query in `GET /api/sessions/[sessionId]` —
  repeated test runs won't clutter the real session list or skew `/progress` trend data. Mixpanel events
  from quick-test sessions carry `is_test: true` instead of being suppressed entirely — still checkable in
  Live View, still filterable out of real funnel analysis.
- **Status**: Code complete, typecheck/lint/vitest clean. Not yet used for a real test run.

---

## 📋 Week 3 — Monetisation (Not Yet Planned)
- PhonePe payment integration
- Shareable debrief card (LinkedIn/WhatsApp)
- Resume alignment scoring (Deep Dive tier)
- PDF report export (Deep Dive tier)
