# Session Handoff — 2026-08-26

## Branch state
Everything below is on `feat/phase2-2.5`, pushed to origin, nothing merged to `main`. Commits this session, newest first: `a455322` (doc drift), `c31373f` (mobile padding), `1cdd263` (accessibility), `c821efa` (TTS bulbul:v3), `7fe5ba8` (HR-screen/round-type question bug), `c5e3ac0` (empty-question root cause + TTS-failure protection), `f0b7519` (control-flow decoupling + VoiceOrb + no-live-transcript).

## Shipped and verified this session
- Fixed the interview-room bug chain: empty questions (gpt-oss-120b reasoning-token starvation), TTS failures stranding the UI (3 separate call sites), debrief-generation failures requiring a re-answer to retry, HR Screen getting senior technical questions (round-type-blind fallback path), question-dump / run-on questions.
- Built `components/VoiceOrb.tsx` — real audio-reactive circle (Web Audio `AnalyserNode` on TTS output while speaking, on mic input while listening), replacing the static emoji avatar. Removed live STT transcript display per request — Whisper still transcribes accurately on submit, just not shown live.
- Upgraded TTS to `bulbul:v3` via Sarvam's HTTP streaming endpoint (`/text-to-speech/stream`).
- Full accessibility pass (live regions, aria-labels, real heading hierarchy in the debrief, `role="alert"`).
- Mobile responsiveness re-audit + consistency fix.
- Fixed real `CLAUDE.md`/`BACKLOG.md` drift (wrong model name, wrong question-count table, two "planned" items that were actually done, etc.).
- Every change validated via `tsc --noEmit`, `npm run build` (compiles; only failure is `DATABASE_URL` unset in this sandbox, unrelated), `npx vitest run` (4/4 pass), `npx eslint`.

## Explicitly NOT done — needs a human decision, not more unattended work
**Sarvam STT realtime WebSocket** (`saaras:v3-realtime`). Full protocol is documented (connection params, message schema, JS/Python examples all available). Blocked on: browser-direct connection exposes `SARVAM_API_KEY` client-side (nothing in Sarvam's docs shows a way to mint short-lived scoped tokens), and a server-proxied alternative needs verifying against the real Vercel deployment's WebSocket support, which can't be done blind. **Needs you to pick a direction and be present to test it live against a real key.**

## Known pre-existing issues, not touched (out of scope each time, still real)
- `components/DebriefReport.tsx`: 8 ESLint errors (`react/no-unescaped-entities` on literal quotes, `@next/next/no-html-link-for-pages` on two `<a href="/">`) — confirmed pre-existing via git history, cheap to fix whenever.
- `hooks/useSTT.ts:66`: a `react-hooks/set-state-in-effect` lint error, also pre-existing, unrelated to anything touched this session.
- `MetricCard` function in `DebriefReport.tsx` (line ~224) is fully built but never rendered — see below, this turns out to be directly relevant to the next phase.

---

## Next phase: product/UI brainstorm (this is what the user asked for at the end of this session)

The user's words: *"This was too good. Now I want you to brainstorm on how we can improve the overall product, because I really don't like the UI as of now. Secondly, the debrief is just a bunch of text put together. There are metrics, but what does each metric entail? There's no walkthrough of what happened and how I can improve it. This is literally no walkthrough, and there's no implication. This is just observation, and there's no implication there. Also, there are no suggested frameworks that someone can use to improve a certain metric, although there are no suggested examples or suggested answers that they could have said."*

### Finding #1 (do this first — near-zero effort, real impact)
`components/DebriefReport.tsx` already has a fully-built `MetricCard` component (~line 224) that renders **What / Benchmark / Yours** for each conversational metric — `buildMetrics()` already computes all of `what`, `why`, `bench`, and `yours` per metric (rich, specific text, e.g. *"At 82%, you triggered the Ceiling Rule: the interviewer may not have been able to finish the structured rubric..."*). **None of it is rendered.** The live render (~line 411) is a stripped-down inline version showing only `label`/`value`/`statusLabel`/`what` — throwing away `why` and `yours`, which is exactly the "what does this mean" and "implication" content the user is asking for. Swap the inline grid for `<MetricCard m={m} />` and half of complaint #1 and a chunk of complaint #3 are solved with no backend changes.

### Finding #2 — no walkthrough (schema gap, real work needed)
Nothing in `DebriefReport` (the `lib/groq.ts` interface) ties feedback back to specific questions. `skill_analysis` is 8 aggregated signal cards; `evidence_quotes` are verbatim from answers but never linked back to *which* question produced them. Two ways in:
- **Cheap**: since `evidence_quotes` are verbatim substrings of `qa_pairs.answer`, match them back client- or server-side to reconstruct which `question_number` each quote came from, then render a per-question timeline (Q1 → what was asked → your answer's key line → which signal it fed). No new LLM call.
- **Better but costs a call**: have `generateDebrief` return a `question_walkthrough: [{question_number, signal_ids, take}]` array directly — more reliable than string-matching, costs more output tokens.

### Finding #3 — observation without implication (prompt fix, no schema change)
The `yours` field on metrics already has implication language (see Finding #1). `skill_analysis[].reasoning`, though, tends to describe behavior ("candidate explained X clearly") without stating the actual interview consequence. Fix: strengthen the `generateDebrief` system prompt (`lib/groq.ts`, search `SIGNAL_ANCHORS`) to explicitly require each `reasoning` to state not just what happened but what it signals to a real interviewer and how it affects the hire decision — same spirit as the "discussion-driven" prompt fix already done for `generateNextQuestion` this session.

### Finding #4 — no suggested frameworks (new, but should be deterministic not LLM)
Nothing exists. Proposal: a static lookup table (`lib/rubric-researched.ts` is the natural home, matches its existing "deterministic where possible" philosophy — same reasoning that keeps `hire_probability` out of the LLM's hands) mapping each of the 8 signal `parameter_id`s to 1-2 canonical frameworks with a short how-to: STAR for `STAR_ALIGNMENT`, answer-first/BLUF for `COMMUNICATION_SNR`, Clarify→Approach→Trade-offs→Validate for `PROBLEM_SOLVING`/`TECHNICAL_DEPTH`, Situation→Complication→Resolution→Impact (with a number) for `RESULT_ORIENTATION`, etc. Surface it on any signal rated ≤3. Zero LLM cost, fully consistent across every debrief.

### Finding #5 — no example answers (needs a new LLM field, grounded in the real question)
Also missing entirely, and this one can't be a static table — it has to reference the actual question asked. Proposal: for the 1-2 weakest signals (or specifically for `top_priority_fix`), add a `model_answer_excerpt` field to the debrief schema — a short, concrete illustration of how a strong answer to *that specific question* might have sounded, using the Finding #4 framework. Needs `qa_pairs.question` text passed into the `generateDebrief` prompt — **confirmed already available**: `lib/groq.ts:477` already builds the debrief prompt with `Q${qa.question_number}: ${qa.question}\nAnswer: ...` for every pair, so this is purely a schema + prompt-instruction addition, no new data plumbing.

### Broader UI/product direction (less scoped, needs a real discussion, not just a build)
- The landing page recently got real design attention (`e42849b feat: redesign homepage`) but the actual product surfaces don't match it — interview room is dark/premium, debrief is light/generic-SaaS-dashboard, dashboard is bare shadcn defaults. Three different products, visually.
- The debrief specifically reads as an analytics dashboard (cards/badges/grids) dumped flat in one long scroll, not as a coaching report. Worth considering: progressive disclosure (summary first, depth on demand — tabs or accordions instead of one long scroll), and leaning into the "Deep Dive: PDF report" monetization tier's implication that this should feel like a shareable, well-typeset document, not a webpage.
- Dashboard/onboarding has no product personality beyond "form to fill" — worth a real look once the debrief redesign lands, since that's the highest-leverage surface (it's what determines whether a free-tier user upgrades).

**This section (Findings #1-5 + broader direction) is the actual deliverable the user asked for at the end of the session — a new session should present it back to the user for prioritization/discussion before writing any code, not start implementing unilaterally.**
