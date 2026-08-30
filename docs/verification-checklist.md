# Live Verification Checklist — 5 Unverified Features

**Why this exists:** five features are code-complete but have never run against real credentials.
Every agent sandbox so far blocks `api.groq.com` egress and can't load Clerk's client SDK, so
"typecheck clean" is as far as verification has gone. This is the run-it-yourself pass that closes them.

**Who runs it:** Anshuman. Items 2, 4 and 7 write/delete rows in whatever DB `DATABASE_URL` points at —
that's a deliberate manual action by you, not something an agent should do.

**Time:** items 1–6 are ~15 min if nothing fails. Item 8 (two full real interviews) does **not** fit —
it's a separate ~40 min session, deferred by design.

---

## 0. Setup (do once, ~3 min, before the clock starts)

Run against **local dev** (`npm run dev`, `http://localhost:3000`) — fastest to restart and you can see
server logs. A deployed preview works too; the differences are called out per item.

**`.env.local` must have:**

| Var | Needed for | Note |
|---|---|---|
| `GROQ_API_KEY` | items 1, 3, 4 | The whole point. Must be a working key. |
| `DATABASE_URL` | items 2, 3, 4, 5 | Real Neon DB. |
| `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | items 3, 4, 5, 6 | |
| `DEV_TEST_ALLOWED_EMAIL` | item 4 only | Must **exactly** equal your Clerk account's primary email. Route fails closed (403) if unset or mismatched. |
| `MIXPANEL_TOKEN` | item 6 (server events) | |
| `NEXT_PUBLIC_MIXPANEL_TOKEN` | item 6 (client events) | **Inlined at build time.** On Vercel, setting it requires a redeploy before it takes effect. |
| `RESEND_API_KEY` | any `next build` | `lib/email.ts` instantiates its client eagerly — `next build` fails outright without it. Not needed for `npm run dev`. |

**Two known gotchas before you start:**
- If your shell has `HTTPS_PROXY`/`HTTP_PROXY` set, `mixpanel@0.23.0`'s `init()` throws (`HttpsProxyAgent
  is not a constructor`). `track()` swallows it, so server events silently vanish with no error. Unset the
  proxy vars for this run.
- Use a browser profile **without** an ad blocker. uBlock/Brave shields block `api-js.mixpanel.com`, which
  kills every client-side event in item 6.

Open Mixpanel now: **Events → Live View**, so it's already streaming.

---

## 1. `POST /api/preview-analysis` — real Groq response content (~2 min)

Only the response *content* is unverified; loading/error/429 states were already confirmed live.
Public + unauthenticated, so do this first — no login, no DB.
**Rate limit is 5 requests/hour/IP.** Don't burn them. (In-memory per process — restarting `npm run dev`
resets it; on a deployed build each serverless instance has its own counter.)

1. Open `http://localhost:3000/` in a **signed-out/incognito** window.
2. Scroll to the **"TRY IT — NO SIGNUP"** section (sample question: *"Tell me about a time you had to
   debug a critical issue under pressure."*).
3. Type a **specific, technical** answer, 3–4 sentences, 20–600 chars. Include one distinctive phrase you
   can grep for, e.g. *"I traced it to a connection-pool leak in the payments worker and capped the pool at 20."*
4. Click **"See a sample read"**.

**PASS:**
- A **"YOUR READ"** block appears with a **Technical Depth** bar and a number **1–5** (expect 4 or 5 for the
  answer above).
- The quoted excerpt is **verbatim text you typed** — your distinctive phrase, not a generic sentence and
  not the old hardcoded canned response.
- The feedback paragraph is 2–3 sentences that reference **your actual content** (names the tool/metric you
  mentioned), in plain language with no jargon.

**FAIL / triage:**
- `"Couldn't generate a sample read — try again."` = 500. Check the server log for `[POST /api/preview-analysis]`
  — a 401/403 there is the key, a `SyntaxError` is a JSON-parse failure on the model's output (`max_tokens: 300`
  is tight; a truncated response looks exactly like this).
- Optional 20s extra, if you have spare rate-limit budget: submit a deliberately vague answer
  (*"I fixed the bug and everyone was happy about it."*) — score should drop to **1–2**. That's the check that
  it's actually reading, not returning a constant.

---

## 2. Seed a baseline session (~2 min, no LLM, sets up items 3 and 5)

`scripts/seed-test-debrief.mjs` inserts a complete session + 5 QA pairs + a full mock debrief instantly.
It seeds under `test@mockmentor.dev`, which your Clerk account can't open (`assertSessionOwner` matches on
email). Point it at yourself for this run:

```bash
cd /home/user/mockmentor
sed -i 's/test@mockmentor\.dev/YOUR_CLERK_EMAIL/g' scripts/seed-test-debrief.mjs
npm run test:debrief
```

Copy the printed `http://localhost:3000/debrief/<uuid>` — call this **SEEDED_URL**.

Revert the script immediately so it never gets committed:
```bash
git checkout -- scripts/seed-test-debrief.mjs
```
(The seeded row keeps your email; only the script file reverts.)

**PASS:** script prints `Mock debrief inserted (no LLM call).` and a URL. Nothing else to check yet.

> This session is `round_type: 'technical'`, `status: 'completed'`, with `EDGE_CASE_MASTERY: 2` and a
> `model_answers` entry on Q4 — which is exactly what items 3 and 5 need.

---

## 3. Drill / retry loop (~3 min) — real Groq call

1. Open **SEEDED_URL** (signed in as the same email you sed'd in).
2. Jump to section **"Moments That Hurt You"** (quick-nav at the top of the report).
3. Under the Q4 model answer, click **"Try it yourself →"**.
4. In the textarea, write a rewrite that **deliberately fixes the flagged gap** (`EDGE_CASE_MASTERY`, scored
   2/5) — i.e. proactively name a risk. e.g. *"Before committing to the mobile MVP I'd name the failure
   mode: the 31% survey signal could be response bias from the angriest churned users, so I'd validate with
   a small paid-ads landing test before spending a quarter of engineering time."* Must be ≥20 chars.
5. Click **"See how this lands"**.

**PASS (all four):**
- Button shows **"Checking…"**, then a result block appears.
- The rating pair reads **`2/5 → N/5`**, with the new number in **green** if higher (expect 3 or 4 for the
  rewrite above), grey if equal, red if lower.
- The one-sentence reasoning **references your rewritten content specifically** — it should mention the risk
  you named, not generic praise.
- Network tab: `POST /api/interview/drill` → **200**, body `{ new_rating, new_reasoning }` only.

**Then confirm it's ephemeral by design (10s):** hard-reload SEEDED_URL. The drill result is gone and the
signal still reads **2/5**. No DB row was written — that's correct, not a bug.

**FAIL / triage:**
- `"Give it a real attempt — at least a couple of sentences."` = your text was <20 chars (client-side guard).
- 404 `Session not found` = the email in step 2's `sed` doesn't match your Clerk primary email.
- `"Failed to score your attempt"` = 500; server log `[POST /api/interview/drill]` — same Groq-key/parse
  triage as item 1 (`max_tokens: 400` here).
- Also click **"Try again"** — form should reset empty. (Cheap, confirms the retry loop, not just one shot.)

---

## 4. `/dev/quick-test` — hidden production debrief shortcut (~3 min) — real Groq call

Requires `DEV_TEST_ALLOWED_EMAIL` set to your Clerk primary email. Route fails closed if it's unset.

1. Signed in, go to **`http://localhost:3000/dev/quick-test`** (not linked from anywhere — type the URL).
2. Leave all three fields blank (defaults: Software Engineer / Test Co / a canned strong answer).
3. Click **"Generate Test Debrief"**.
4. The debrief loading screen shows while the real pipeline runs (one full `generateDebrief` call — expect
   20–60s).

**PASS:**
- You land on **`/debrief/<uuid>`** with a fully rendered report: verdict banner with a first-person
  `overall_impression`, an above-the-fold summary, and **Signal Analysis** (collapsed `<details>`) listing
  all 8 signals.
- **No `hire_probability` %** anywhere on the page or in the `GET /api/sessions/<id>` network response
  (spot-check the JSON — `summary` should have `recommendation` + `overall_impression`, no percentage).
- Keep this URL — call it **QUICKTEST_URL**, used in item 5.

**FAIL / triage:**
- **403 "Not authorized for this test route."** → `DEV_TEST_ALLOWED_EMAIL` is unset or ≠ your Clerk primary
  email. This is the most likely failure; fix the env var and restart the dev server.
- **503 "Your report is taking a little longer than usual"** → Groq TPM deferral; retry in a minute. (This
  also fires `debrief_generation_deferred` — worth noting in item 6.)
- **"…ran out of room and was cut off"** / **"…came back malformed"** → the truncation/parse path from PR #23.
  Server log now prints the raw response; grab it, that's the diagnostic this route exists to produce.

> Note: a 1-question `quick_test` session is intentionally excluded from `/progress`, `GET /api/sessions`,
> and cross-session history — so this never pollutes your real analytics.

---

## 5. Cross-session trend — "Your Recurring Pattern" (~1 min, free rider on items 2 + 4)

The seeded session from item 2 is a completed, non-`quick_test`, debriefed session under your email — which
is exactly what `GET /api/sessions/[sessionId]`'s `history` query looks for. So the quick-test debrief from
item 4 already has a repeat-user history to render against.

1. Open **QUICKTEST_URL**.
2. Look for **"05 — Your Recurring Pattern"** in the quick-nav strip and in the body.

**PASS:**
- The section renders (it's hidden entirely when `signalTrends` is empty — its presence *is* the join working).
- At least one signal shows **two points**: one labelled with the seed's date (e.g. `Aug 27`) and one labelled
  **`Today`**. `EDGE_CASE_MASTERY` / "Edge Case Awareness" is the near-certain one (seeded at 2, so it's
  surfaced regardless of today's score).
- Points show **1–5 ratings only** — no percentage anywhere.
- A signal that improved is labelled as improving, not as a recurring pattern (mutually exclusive by design).

**What this does and doesn't prove:** it verifies the DB join, `computeSignalTrends`, and the render against
real rows. One of the two data points is a seeded mock debrief rather than an LLM-generated one. The
fully-real version is item 8.

---

## 6. The 6 new Mixpanel funnel events (~4–5 min)

**Which 6 are new/unverified.** Already confirmed firing in production: `session_started`,
`session_completed`, `drill_used` (server-side, `lib/analytics.ts`). The six unverified ones are all
**client-side**, added with `lib/analytics-client.ts` + `components/MixpanelProvider.tsx`:

| # | Event | Fires where | Expected properties |
|---|---|---|---|
| 1 | `landing_page_viewed` | `components/LandingPageView.tsx`, once on mount of `/` | — |
| 2 | `cta_clicked` | `components/TrackedCta.tsx` | `cta_location`: `top_nav` \| `hero` \| `bottom` \| `preview_post_reveal` |
| 3 | `basics_submit` | `SetupForm.tsx` step 1 → Continue | — |
| 4 | `personalisation_submit` | `SetupForm.tsx` step 2 → Continue | — |
| 5 | `jd_submit` | `SetupForm.tsx` final step | `auth_state`: `signed_in` \| `signed_out` |
| 6 | `sign_up_completed` / `sign_in_completed` | `SetupForm.tsx` resume effect after the Clerk round-trip | — (one ternary picks which) |

Plus **two new properties** on the already-verified `session_completed`: `interview_depth` and
`session_duration_sec`. And two new server-side events on the failure paths:
`debrief_generation_failed` (`{ reason }`) / `debrief_generation_deferred` (`{ retry_after_ms }`) — only
observable if item 4 errored.

**Run (single incognito pass, Mixpanel Live View open in another window):**

1. Open **`http://localhost:3000/`** in a fresh incognito window → expect **`landing_page_viewed`**.
2. Click the **hero** CTA ("Start free" / the main button) → expect **`cta_clicked`** with `cta_location: hero`.
   (Optional +15s: go back and click the top-nav CTA for `cta_location: top_nav`.)
3. On `/dashboard`, fill **step 1** (role, company, YOE, round type — all four required) → **Continue** →
   expect **`basics_submit`**.
4. Fill **step 2** → **Continue** → expect **`personalisation_submit`**.
5. On **step 3**, paste a JD (or use manual entry) and click the final CTA. Signed out, it reads
   **"Log in to start" / "Sign up to start"** → expect **`jd_submit`** with `auth_state: signed_out`.
6. Log in with your existing account. On return to `/dashboard` the form auto-resumes and creates the session
   with no extra click → expect **`sign_in_completed`**, immediately followed by **`session_started`**.

**PASS:** all 6 events appear in Live View within ~10s of each action, on a **single distinct_id** — the
post-login events must be attributed to your Clerk `userId`, not a stray anonymous device id. That merge is
the thing most likely to be broken, so check it specifically.

**Notes:**
- `sign_up_completed` shares one line with `sign_in_completed` (a single ternary on the stored auth mode), so
  verifying the sign-in branch covers the code path. If you want the literal event, redo steps 1–6 with a
  throwaway email — that creates a real Clerk user, so only do it if you'll clean it up.
- `cta_location: preview_post_reveal` fires from the CTA revealed under item 1's result — if you still had
  that tab open, it's a one-click add.
- Nothing in Live View at all → check the Network tab for `api-js.mixpanel.com` requests. Missing = ad
  blocker or `NEXT_PUBLIC_MIXPANEL_TOKEN` absent at build time. 4xx = wrong token.
- You can leave the interview at step 6 immediately — `session_started` is the event under test here.

---

## 7. Cleanup (~1 min)

Deletes only the rows this checklist created. **Read the `WHERE` clauses before running** — this is a real
delete against your live DB.

```sql
-- The seeded baseline session from item 2 (relies on FK cascade, same as npm run test:debrief:clean)
DELETE FROM sessions WHERE role = 'Product Manager' AND company = 'Acme Corp' AND user_email = 'YOUR_CLERK_EMAIL';

-- Every quick_test session from item 4
DELETE FROM sessions WHERE round_type = 'quick_test' AND user_email = 'YOUR_CLERK_EMAIL';
```

Also confirm `git status` is clean (item 2's `sed` was reverted).

---

## 8. Deferred — does NOT fit in 15 minutes

**Fully-real cross-session trend + a real `session_completed`.** Requires two complete mock interviews under
one account (`technical_screen` = 5 questions each, plus TMAY/setup, plus two debrief generations) —
realistically **35–45 min**, and it needs `SARVAM_API_KEY` for TTS and a working mic for STT, neither of which
items 1–7 touch.

Do it as its own session. What it adds beyond item 5: both history points come from genuine LLM-generated
debriefs, `session_completed` fires with real `interview_depth` / `session_duration_sec` values (item 4's
quick-test version carries `is_test: true` and `interview_depth: 1`), and it exercises the full audio path.

---

## Scoreboard

| # | Item | Est. | Result |
|---|---|---|---|
| 1 | `POST /api/preview-analysis` real Groq content | 2 min | ☐ |
| 2 | Seed baseline session | 2 min | ☐ |
| 3 | Drill / retry loop | 3 min | ☐ |
| 4 | `/dev/quick-test` | 3 min | ☐ |
| 5 | "Your Recurring Pattern" | 1 min | ☐ |
| 6 | 6 client-side funnel events | 4–5 min | ☐ |
| 7 | Cleanup | 1 min | ☐ |
| 8 | Two real interviews (deferred) | 35–45 min | ☐ separate session |
