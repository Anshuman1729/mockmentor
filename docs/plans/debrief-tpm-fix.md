# Debrief generation: TPM rate-limit fix

**Status:** Plan — not yet implemented
**Author:** Planner (Tech pod), 2026-08-27
**Branch to create:** `fix/debrief-tpm-gating`
**Blocks on Anshuman:** nothing in this plan. One decision *exists* nearby (Groq tier) but is deliberately out of scope — see [§8](#8-what-is-anshumans-call-vs-coders).

---

## 1. Confirmation / correction of the reported issue

The report is substantially correct. Corrections and additions below.

### Confirmed

| Claim | Verdict | Actual |
|---|---|---|
| `generateDebrief()` split into two sequential Groq calls | ✅ Confirmed | `lib/groq.ts:547-778` |
| Shared wrapper "around lines 467-528" | ✅ Exact | `runDebriefCompletion()` at `lib/groq.ts:467-528` |
| Scoring call ~2500 max_tokens | ✅ Exact | `lib/groq.ts:644-654`, `max_tokens: 2500` at line 652 |
| Synthesis call ~1800 max_tokens | ✅ Exact | `lib/groq.ts:716-724`, `max_tokens: 1800` at line 722 |
| Calls fire back-to-back with no gap, no backoff | ✅ Confirmed | `lib/groq.ts:655-660` is parse + validate only — sub-millisecond between the two `await`s |
| No retry/rate-limit logic of our own | ✅ Confirmed | `runDebriefCompletion` maps errors to strings and rethrows; it never retries |
| Client retry re-runs BOTH calls | ✅ Confirmed | `components/InterviewRoom.tsx:125-149`; the "Try again" button at line 588 calls the same `generateDebrief` callback, which POSTs `/api/interview/debrief` from scratch |
| Groq TPM is a rolling 60s budget across all calls | ✅ Confirmed | Per Groq's rate-limit docs — TPM is org-level, input **plus** output, and `max_tokens` is counted up front as reserved capacity |

### Corrections

**1. The SDK is already retrying — three requests fire, not two.**
`groq-sdk@0.37.0` defaults `maxRetries: 2` (`node_modules/groq-sdk/core.js:127`) and `shouldRetry()` returns `true` for HTTP 429 (`core.js:411`). So today a 429 on call 2 is already retried twice before the error surfaces. Worse, the retry delay only honours `retry-after` when it is **under 60 seconds** (`core.js:441`); otherwise it falls back to 0.5s → 1s exponential backoff, which is useless against a 60-second TPM window. Net effect: we burn 3 requests and ~1.5s, then fail anyway. The user-visible symptom is identical to "no retry at all", which is why this wasn't noticed.

**2. 413 and 429 are different failures and the code already knows this.**
`lib/groq.ts:492-499` distinguishes them. Groq returns **413** when a *single* request's `prompt + max_tokens` exceeds the TPM ceiling outright (error body reads like `Limit 6000, Requested 6294`), and **429** when the *rolling window* is exhausted. The reported bug is the 429 path. The 413 path is a real, separate failure that only appears if a single call gets big enough on its own — which the `background` bug in correction #4 makes possible.

**3. My own token estimate, derived from the actual prompt content.**
I could not run a tokenizer (no Bash in this seat, and `api.groq.com` is egress-blocked so no live `usage` numbers). These are character-count estimates at ~3.5 chars/token, so treat them as ±15%:

| Component | Est. tokens | Source |
|---|---|---|
| `SIGNAL_ANCHORS` | ~370 | `lib/groq.ts:355-364` |
| `CORE_SCORING_EXAMPLE` | ~420 | `lib/groq.ts:386-414` |
| Scoring instructions + return-schema block | ~900 | `lib/groq.ts:610-642` |
| JD excerpt (3000 char cap) | ~800 | `lib/groq.ts:581` |
| Transcript, 8 answers @ ~180 words | ~2,400 | `lib/groq.ts:557-564` |
| `background` | **0 – 2,000+, uncapped** | `lib/groq.ts:566-568` |
| **Call 1 input** | **~4,900** (+background) | |
| **Call 1 reserved `max_tokens`** | **2,500** | |
| **Call 1 total charged to TPM** | **~7,400** | |
| `SYNTHESIS_EXAMPLE` | ~800 | `lib/groq.ts:416-457` |
| Synthesis instructions + return-schema block | ~1,100 | `lib/groq.ts:672-714` |
| Transcript again (full, duplicated) | ~2,400 | `lib/groq.ts:596-597` |
| Call 1's `skill_analysis` + `question_walkthrough` injected | ~1,600 | `lib/groq.ts:668` |
| **Call 2 input** | **~5,900** (+background again) | |
| **Call 2 reserved `max_tokens`** | **1,800** | |
| **Call 2 total charged to TPM** | **~7,700** | |
| **Combined** | **~15,100** | |

So the reported "~14,300 combined" is the right order of magnitude — I get ~15,100 for a typical 8-question round with no resume attached, and materially more with one. **The failure mechanism described is confirmed:** at an 8,000 TPM ceiling, call 1 consumes ~7,400 of the window, call 2 needs ~7,700 against a remaining ~600 → 429.

**4. New finding — `background` is uncapped and is sent to BOTH calls.**
`lib/groq.ts:566-568`:
```ts
const backgroundLine = session.background
  ? `- Background: ${session.background}\n`
  : "";
```
No `.slice()`. It is interpolated into `sessionHeader` (line 579) *and* `synthesisHeader` (line 595). `session.background` is user-pasted resume text via the TMAY/setup flow — 4,000–8,000 chars is entirely normal, i.e. **1,100–2,300 tokens on each call, ~2,200–4,600 combined**. Note that `generateDomainQuestion` already caps the same field at 500 chars (`lib/groq.ts:265`), and `generateDebrief` caps `jd_content` (line 581) and each answer (`MAX_ANSWER_CHARS`, line 556) — `background` is the one that was missed. This is the single largest uncontrolled input in the whole path and it is very likely what turns a marginal session into a hard failure. It is also a plausible cause of the 413s the existing code comments describe.

**5. New finding — no `maxDuration` is set anywhere in the app.**
`grep maxDuration app/` returns nothing, there is no `vercel.json`, and `@vercel/analytics` is a dependency (`package.json:23`) so this deploys to Vercel. The debrief route does two sequential Groq calls (realistically 10–25s), then 3 DB writes, then an email send — all inside one request. On Vercel's default route-handler duration this is plausibly **already** timing out intermittently, independent of TPM, and a platform timeout is indistinguishable from a 500 on the client. This must be fixed as part of this work because the fix in §4 deliberately adds an inline wait.

**6. `debriefs.reasoning` cannot be used to persist the intermediate state.** See [§5](#5-the-intermediate-persistence-problem) — this was suggested in the task framing and, on inspection, does not work. No schema change is being proposed.

---

## 2. Shape of the fix

Two independent parts. Both are needed; neither is sufficient alone.

- **Part A — shrink the token bill.** Makes 429 uncommon instead of typical. Low risk, independently valuable.
- **Part B — gate call 2 on call 1's rate-limit headers**, wait inline when the wait is short, and fail with a *distinguishable* error when it isn't, preserving call 1's work best-effort so a retry usually only re-runs call 2.

Part A alone gets a typical 8-question session from ~15,100 to ~10,500 combined. That is still over an 8,000 ceiling. Be honest about this: **Part A does not fix the bug on its own.**

Ship as one branch, two commits, so Reviewer can assess them separately.

---

## 3. Part A — token reduction

All edits in `lib/groq.ts`.

### A1. Cap `background` (highest value, ~zero risk)
**Lines 566-568.** Add a `MAX_BACKGROUND_CHARS = 1200` constant next to `MAX_ANSWER_CHARS` (line 556) and slice. 1,200 chars covers a role summary and recent history; the scoring task does not need the full resume, and the transcript is the actual evidence. **Saves ~600–2,600 tokens combined.**

### A2. Reduce the JD excerpt 3000 → 1200 chars
**Line 581.** The scoring task is "rate what the candidate said against BARS anchors", not "audit JD fit". The first ~1,200 chars of a JD reliably carry role, seniority and core requirements; the rest is benefits boilerplate. **Saves ~500 tokens.** (Call 2 already omits the JD — line 588-589 comment. Correct, leave it.)

### A3. Send call 2 a reduced transcript
**Lines 590-597.** The full transcript is currently sent to both calls — ~2,400 tokens paid twice, the largest duplicated cost in the path. Call 2 needs it for exactly one reason: `model_answers[].your_quote` must be a fresh verbatim quote (instruction #3, line 675) that need not already appear in `evidence_quotes`.

Select rather than drop:
1. Compute `weakSignals = scoring.skill_analysis.filter(s => s.rating <= 3).map(s => s.parameter_id)` — `model_answers` may only target weak signals, so no other question can legitimately be quoted.
2. Keep Q&A entries whose `question_walkthrough[].signal_ids` intersect `weakSignals`.
3. Floor at 3 entries and cap at 5. If `question_walkthrough` is empty (it is defaulted to `[]` at line 660) or `weakSignals` is empty, **fall back to the full transcript** — never fail closed on a defensive default.

**Saves ~800–1,400 tokens** on a typical Borderline session.

### A4. Trim `SYNTHESIS_EXAMPLE` (the one trim with real quality risk)
**Lines 416-457, ~800 tokens** — the heaviest fixed block. What it teaches is genuinely load-bearing: the first-person interviewer register and the Observed → Problem → Better structure are the entire point of the "Coaching Cockpit" rework, which per `CLAUDE.md` came from direct user feedback. **Trim, do not delete.**

Keep: `summary.overall_impression`, **one** `priority_risks` entry, **one** full `model_answers` entry (this is where register matters most — `why_it_hurt` and `model_excerpt` are the fields the model most needs an example of).
Drop from the *example only*: the second `priority_risks` entry, `path_to_next_tier`, `behavioral_insights`, `actionable_feedback`. All four are mechanical fields fully specified by instructions #4/#5 (lines 676-677) and the "Return this exact structure" block (lines 680-714) immediately below.

**Saves ~300–350 tokens.** Flag for Reviewer: this is the only Part A change that can degrade output quality, and it cannot be verified in this sandbox (§7).

### A5. Leave `CORE_SCORING_EXAMPLE` and `SIGNAL_ANCHORS` alone
The task framing suggested ~2,700 trimmable tokens in `CORE_SCORING_EXAMPLE` + the rubric block. My read of the actual content is that this overestimates those two specifically — together they are ~790 tokens, and both are already minimal (one signal, one walkthrough entry; eight one-line anchors). The ~2,700 figure is roughly right for *all* of call 1's fixed overhead including the instruction and schema blocks, which are not safely trimmable. **Recommend not touching either** — ~60 tokens of possible saving is not worth risking the evidence-first scoring contract.

### A6. Log per-call token usage
`generateDebrief` returns a *combined* `usage` (lines 771-775), which `debriefs.tokens_used` persists — so the per-call split is unrecoverable today, and every `max_tokens` number in this file is an estimate nobody can check. Add a `console.log` inside `runDebriefCompletion` (after line 520) emitting `label`, `prompt_tokens`, `completion_tokens`. No schema change, no contract change. **This is the instrument that makes the next iteration data-driven** — ship it even if nothing else in Part A lands.

### A7. Do NOT tighten `max_tokens` yet
Reservations are 2,500 (line 652) and 1,800 (line 722) against commented estimates of ~1,600 and ~850 — ~1,850 tokens of pure unused headroom charged to TPM. Tempting, but cutting it too far produces `finish_reason: "length"` → "The report generation ran out of room" (line 517), trading one bug for another. **Wait for real numbers from A6, then tighten in a follow-up.** Do not guess.

**Part A total: ~2,200–4,900 tokens saved**, most of it from A1 when a resume is attached.

---

## 4. Part B — rate-limit-aware gating

### B0. Is it implementable with the current SDK? Yes.

Checked `groq-sdk@0.37.0` directly:

- **Success path:** `node_modules/groq-sdk/core.d.ts:64-67` — `APIPromise<T>.withResponse(): Promise<{ data: T; response: Response }>`. `response` is a standard `Response`, so `response.headers.get("x-ratelimit-remaining-tokens")` works. `chat.completions.create()` returns an `APIPromise`, so this is a one-line change at the call site.
- **Error path:** `node_modules/groq-sdk/error.d.ts:8` — `APIError.headers: Record<string, string | null | undefined>`. Same headers are available on the 429 itself.

**No raw-`fetch` rewrite is needed.** Both paths are typed and supported.

### B1. Header semantics (get this right — it is the likeliest silent bug)

Groq returns `x-ratelimit-limit-tokens`, `x-ratelimit-remaining-tokens`, `x-ratelimit-reset-tokens` (all TPM), plus request-based equivalents (RPD).

- `x-ratelimit-remaining-tokens` — integer string.
- `x-ratelimit-reset-tokens` — a **Go-style duration string**, not a number: `"7.66s"`, `"120ms"`, `"2m59.56s"`. Parsing it with `parseFloat` silently yields `2` for `"2m59.56s"`, i.e. a 180-second wait read as 2ms. This needs a real parser with its own unit tests.
- `retry-after` is only present on a 429.

### B2. New pure helpers in `lib/groq.ts` (exported for testing)

```ts
export function parseGroqResetDuration(v: string | null | undefined): number | null
export function estimateTokens(text: string): number
export type SynthesisGate = { action: "proceed" } | { action: "wait"; ms: number } | { action: "defer"; retryAfterMs: number }
export function decideSynthesisGate(input: {
  remainingTokens: number | null;
  resetMs: number | null;
  needTokens: number;
  maxInlineWaitMs: number;
}): SynthesisGate
```

- `estimateTokens` = `Math.ceil(chars / 3.5)`. **Do not add a tokenizer dependency for this** — the estimate only has to be right within a few hundred tokens to make a go/no-go call, and a `SAFETY_MARGIN` of 500 absorbs the error.
- `decideSynthesisGate` rules:
  - `remainingTokens >= needTokens` → `proceed`
  - else `resetMs <= maxInlineWaitMs` → `wait` (`resetMs + 250ms` cushion)
  - else → `defer`
  - **headers absent (`null`) → `proceed`.** Fail open. A missing header must not break debrief generation; that is strictly today's behaviour.

### B3. Wire into `generateDebrief`

- **Line 467-528, `runDebriefCompletion`:** switch to `.withResponse()`; return `{ raw, usage, headers }` where `headers` is a small `{ remainingTokens, resetMs }` already parsed. Also set `maxRetries: 0` on these two calls specifically — the SDK's default 2 retries (§1 correction 1) cannot succeed against a TPM window and just burn RPM/RPD. In the `catch` at line 485, read `apiErr.headers` on the 429 branch and attach the parsed reset to the thrown error.
- **Between lines 660 and 716:** build `synthesisPrompt` first, then `needTokens = estimateTokens(synthesisPrompt) + SYNTHESIS_MAX_TOKENS + 500`, then call `decideSynthesisGate` with call 1's headers. `wait` → `await sleep(ms)`. `defer` → `throw new DebriefSynthesisDeferredError(retryAfterMs)` (new exported error class).

### B4. `maxDuration` — required, not optional

Add to the top of `app/api/interview/debrief/route.ts`:
```ts
export const maxDuration = 60;
```
Rationale in §1 correction 5. Then set `MAX_INLINE_WAIT_MS = 20_000`, leaving ~40s for the two calls plus DB writes plus email. Coder should confirm `60` is accepted at build time on the actual Vercel plan; if the deployed plan caps lower, drop `maxDuration` to the plan's ceiling and reduce `MAX_INLINE_WAIT_MS` proportionally — **do not** silently exceed it.

### B5. Route changes — `app/api/interview/debrief/route.ts`

Catch `DebriefSynthesisDeferredError` **before** the generic `catch` at line 252 and return a **503**:

```ts
{ error: "<user-safe copy>", code: "SYNTHESIS_DEFERRED", retryAfterMs }
```

Status 503 with a structured `code` rather than folding into the 500 string-matching path (`KNOWN_SAFE_MESSAGES`, lines 258-266) — this mirrors the existing `INCOMPLETE_SESSION` 422 precedent at lines 75-85, so it is not a new pattern.

**Critical: the deferred path must be completely side-effect-free.** It must not reach the `debriefs` INSERT (193-202), the `sessions` status UPDATE (204-206), the `calibration_loops` INSERT (230-233), or `sendDebriefEmail` (236-245). `calibration_loops` has no unique constraint on `session_id`, so a half-completed attempt followed by a retry would produce duplicate calibration rows and quietly corrupt the calibration dataset. Throwing from inside `generateDebrief` already guarantees this — but it must be an explicit test (§7, test 6), not an assumption.

Also add a `debrief_generation_deferred` track event, separate from `debrief_generation_failed` (line 274). A deferral that later succeeds is not a failure and must not pollute the failure funnel.

**User-facing copy:** must not mention rate limits, TPM, Groq, or tokens — `CLAUDE.md` forbids exposing LLM internals in user-facing copy. Something like *"Your report is taking a little longer than usual — hang tight."* is sufficient.

---

## 5. The intermediate-persistence problem

Requirement: a retry should re-run only call 2.

### Why `debriefs.reasoning` does not work
It was suggested as the no-schema-change home for call 1's output. On inspection it does not work, for three independent reasons:
1. It is only written at line 193-202, i.e. **after both calls and after the fatal-flag check** — by definition it does not exist at the moment call 2 fails.
2. Its shape is now `{ signals, fatal_flag }` (per the just-merged `fix/fatal-flag-internal-leak`), and older rows are a bare array. Adding a third shape means every reader has to handle three.
3. `reasoning` lives on a `debriefs` row, and writing a partial `debriefs` row breaks four call sites (see below).

### Options considered

| Option | Schema change? | Verdict |
|---|---|---|
| **1. Partial row in `debriefs` with a sentinel** | No | **Reject.** `app/api/interview/debrief/route.ts:34` early-returns on *any* existing row and would serve the partial as complete; `app/api/sessions/[sessionId]/route.ts:58` renders `debrief_data` to the user; `app/api/sessions/analytics/route.ts:34` and `app/api/sessions/route.ts:28` JOIN it into history and account analytics. All four would need permanent sentinel filters, making a half-written debrief a first-class DB state forever — to solve a problem that lasts 60 seconds. |
| **2. New nullable column on `debriefs`** | **Yes → Article II gated** | **Not proposed.** Flagging that it exists and that I am deliberately not taking it. If Anshuman later wants a *guaranteed* resume, this is the honest route and it needs his sign-off first. |
| **3. In-memory `Map` with TTL, keyed by `session_id`** | No | Works, but best-effort only on Vercel — a retry may land on a different lambda instance. Acceptable as an optimisation, never as the correctness mechanism. |
| **4. Never cross the request boundary — wait inline** | No | **Primary.** Call 1's result lives in a local variable; if TPM resets in ≤20s we sleep and continue in the same request. Nothing to persist. |

### Recommendation: Option 4 primary, Option 3 as a bounded fallback

- The inline wait (B3/B4) handles resets up to `MAX_INLINE_WAIT_MS`. Groq's TPM window is 60s and call 1 typically lands mid-window, so a substantial share of deferrals resolve here with no user-visible failure at all.
- For the remainder, stash `{ sessionId, scoring, expiresAt }` in a module-level `Map` in a **new `lib/debrief-cache.ts`** — TTL 10 min, cap ~200 entries, same eviction discipline and same honest "single-instance, resets on redeploy, known limitation" header comment as `lib/rate-limit.ts:1-9`, which already establishes this pattern in-repo.
- On retry: cache hit → skip call 1 entirely. This is the real payoff — the retry then needs only ~7,700 tokens instead of ~15,100, so it comfortably fits a fresh window. Cache miss → re-run both, which is exactly today's behaviour. **No regression on miss.**
- Only write to the cache after the completeness gate (route.ts:73-85) has passed, so a cached scoring can never correspond to a session that later gains answers. Sessions are effectively immutable once complete, so `session_id` alone is a safe key.

**Be honest in the PR description: this does not *guarantee* retry-only-call-2.** It makes it work most of the time with zero schema change and zero new DB state. A guaranteed version needs either a durable store (schema change → Anshuman) or a job queue (a much larger change). Neither is warranted before the A6 logging tells us how often deferral actually happens.

**No schema change is required by this plan. Coder can build all of it without escalation.**

---

## 6. Client changes — `components/InterviewRoom.tsx`

`generateDebrief` (lines 125-149) currently treats every non-`ok` as terminal → `debrief-failed` (line 147) → manual "Try again" (line 588).

Add, inside the `catch`/response handling around line 142:
- If `dd.code === "SYNTHESIS_DEFERRED"`: stay in `"generating-debrief"`, set a secondary status message, `setTimeout(retryAfterMs + 1000)`, and auto-retry **exactly once**.
- Second failure → fall through to `debrief-failed` as today.
- Guard the auto-retry with a `useRef` counter, not state. **One retry only** — an unbounded auto-retry loop against a rate limit is precisely the failure mode being fixed here.
- Clear the timeout on unmount so a user who navigates away does not fire a stray POST.

`DebriefLoadingScreen` needs either an optional `statusNote` prop or a single extra line. Keep it minimal; copy constraint from §B5 applies.

---

## 7. What Tester must verify

### Cannot be verified in this sandbox
`api.groq.com` is egress-blocked (`CLAUDE.md`); I re-confirmed this session that `console.groq.com` is blocked too. Therefore **no end-to-end debrief, no real header values, no real token counts, and no confirmation that the 429 lands where predicted** can be produced here. Specifically unverifiable:
- Whether the A1–A4 prompt trims preserve output quality — needs a real Groq call and a human read of the register.
- Real per-call token numbers. **A6's logging is the mitigation** — it answers this on the first real production run.
- Actual `x-ratelimit-reset-tokens` value formats in the wild. The parser must therefore be defensive: unknown format → `null` → fail open to `proceed`.

State all of this plainly in the PR description. Do not let "tests pass" read as "verified against Groq".

### Can be verified now — vitest, `test/*.spec.ts`, existing pattern (`npm run test`)

1. **`parseGroqResetDuration`** — `"7.66s"`→7660, `"120ms"`→120, `"2m59.56s"`→179560, `"1m"`→60000, `""`/`null`/`undefined`/`"garbage"`→`null`. Highest-risk new code and it is pure. Table-driven.
2. **`decideSynthesisGate`** — table-driven. Must include: `remaining === need` exactly; `resetMs === maxInlineWaitMs` exactly; `remainingTokens: null` → `proceed` (fail-open); `resetMs: null` with insufficient remaining → `defer`.
3. **`estimateTokens`** — sanity bounds only (monotonic, non-zero for non-empty). Not exactness.
4. **`lib/debrief-cache.ts`** — set/get, TTL expiry (`vi.useFakeTimers()`), eviction above cap, miss returns `undefined`.
5. **Mocked-SDK integration on `generateDebrief`** — `vi.mock("groq-sdk")` with a fake `chat.completions.create` returning an object that is both awaitable and has `.withResponse()`. Assert:
   - (a) headers say proceed → exactly 2 API calls, merged report matches the current shape;
   - (b) headers say defer → exactly 1 API call, `DebriefSynthesisDeferredError` thrown, scoring present in cache;
   - (c) retry with warm cache → exactly **1** API call (synthesis only), final report byte-identical to (a);
   - (d) retry with cold cache → 2 API calls, no crash;
   - (e) headers entirely absent → 2 API calls (fail-open).
6. **Route-level, `app/api/interview/debrief/route.ts`** — on the deferred path: response is 503 with `code: "SYNTHESIS_DEFERRED"` and a numeric `retryAfterMs`; **and** no `INSERT INTO debriefs`, no `UPDATE sessions`, no `INSERT INTO calibration_loops`, no `sendDebriefEmail`. Mock `@/lib/db` and assert the call count is zero for each. This is the test that protects the calibration dataset (§B5).
7. **Client, `components/InterviewRoom.tsx`** — with a mocked `fetch`: a 503+`SYNTHESIS_DEFERRED` triggers exactly one auto-retry after `retryAfterMs`, stays on the loading screen meanwhile, and a second failure lands on `debrief-failed`. Existing `@testing-library/react` + jsdom setup supports this.
8. **Regression** — `npm run test` (existing `rubric-researched` / `fatal-flag` specs) and `npm run test:debrief` (no-LLM seed path) must both still pass untouched.

---

## 8. What is Anshuman's call vs. Coder's

### Anshuman's — noted, not recommended on
**Whether to move off the Groq free tier.** That is a spend decision and explicitly outside this seat's mandate; I am neither recommending it nor pricing it. The only thing worth recording for whoever does decide:

- Every item in this plan is needed **regardless of tier**. A higher TPM ceiling makes deferrals rare; it does not make header-gating, per-call usage logging, `maxDuration`, or the uncapped-`background` bug (§1 correction 4 — a real bug on any tier) wrong.
- The tier does change how load-bearing Part B is. At an 8,000 TPM ceiling, Part A alone leaves a typical 8-question session at ~10,500 combined, still over — so Part B carries the fix. At a higher ceiling, Part B becomes belt-and-braces.

**Also Anshuman's, flagged and deliberately not taken:** any new column on `debriefs` (Article II — schema changes). §5 Option 2 is the honest route to a *guaranteed* retry-only-call-2, and it is not being taken. If the A6 logging later shows deferrals are common enough that best-effort isn't good enough, that is the moment to bring Option 2 to Anshuman with real numbers.

### Coder's — build without escalation
Everything in §3, §4, §5 (Options 3+4), §6. No schema change, no migration, no new dependency, no external credentials, no production data operation. Normal application-level DB writes on the success path are unchanged from today.

### Reviewer's attention
- §A4 (`SYNTHESIS_EXAMPLE` trim) — the only change that can degrade output quality, and it cannot be verified here.
- §B5 side-effect-freedom on the deferred path — the `calibration_loops` duplicate-write risk.
- §6 auto-retry bounded at exactly one.
- Branch + PR only. No push to `main`, no merge without sign-off (Article II).

---

## 9. File / function change list

| File | Lines | Change |
|---|---|---|
| `lib/groq.ts` | 556 (near) | Add `MAX_BACKGROUND_CHARS = 1200` |
| `lib/groq.ts` | 566-568 | Cap `background` (A1) |
| `lib/groq.ts` | 581 | JD excerpt 3000 → 1200 (A2) |
| `lib/groq.ts` | 416-457 | Trim `SYNTHESIS_EXAMPLE` (A4) |
| `lib/groq.ts` | 467-528 | `runDebriefCompletion`: `.withResponse()`, return parsed headers, `maxRetries: 0`, per-call usage log (A6), attach reset to 429 error |
| `lib/groq.ts` | new | `parseGroqResetDuration`, `estimateTokens`, `decideSynthesisGate`, `DebriefSynthesisDeferredError` (B2) |
| `lib/groq.ts` | 590-597 | Reduced transcript for synthesis (A3) |
| `lib/groq.ts` | 660-716 | Gate + inline wait + defer between the two calls (B3) |
| `lib/debrief-cache.ts` | new | TTL `Map` for call 1's scoring, modelled on `lib/rate-limit.ts` (§5 Option 3) |
| `app/api/interview/debrief/route.ts` | 1 (top) | `export const maxDuration = 60` (B4) |
| `app/api/interview/debrief/route.ts` | 87-102 | Pass/read cache around the `generateDebrief` call |
| `app/api/interview/debrief/route.ts` | 252 (before) | Catch `DebriefSynthesisDeferredError` → 503 + `SYNTHESIS_DEFERRED` + `retryAfterMs` + `debrief_generation_deferred` event (B5) |
| `components/InterviewRoom.tsx` | 125-149 | Handle `SYNTHESIS_DEFERRED`, one bounded auto-retry (§6) |
| `components/DebriefLoadingScreen.tsx` | — | Optional `statusNote` line (§6) |
| `test/debrief-tpm.spec.ts` | new | Tests 1-5 (§7) |
| `test/debrief-cache.spec.ts` | new | Test 4 (§7) |
