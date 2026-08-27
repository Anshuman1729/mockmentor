# PMF Measurement Plan — Small, Narrow Cohort

**Author**: Director of Analytics
**Date**: 2026-08-27
**Scope**: Measurement/instrumentation proposal only. No code touched. No events fired, no schema changed.
**Constraint acknowledged**: this plan is written for tens-to-low-hundreds of users, not thousands — every threshold below is chosen for that scale, not scaled down from a "real" growth-stage PMF framework.

---

## 0. Bottom line

We can partially answer "did we find PMF" today using DB-derived numbers alone (`npm run analytics:baseline` — I could not run it live in this sandbox, no `DATABASE_URL`; Anshuman or a session with real env vars should run it as the literal first step here). But two of the three things that actually matter for *this* product — (a) did they come back before a real interview, not just come back at all, and (b) would they be gutted if it disappeared — are not measurable at all right now. Neither is a code problem; both are a "nobody has asked the question yet" problem. Section 3 has the concrete gap list; Section 1 has the fix, and it's mostly non-engineering (a form, a manually-sent email, a cohort-selection decision).

---

## 1. What retention/activation should mean for THIS product

A generic SaaS activation/retention framework (D1/D7/D30 return, "N events in first week") is close to meaningless here. Nobody uses a mock-interview tool on a recurring cadence the way they use a note-taking app — usage is bursty and event-driven: a person has an interview coming up, preps hard for a window of days, then stops until the next interview cycle (next semester's placements, next job search). Retention has to be defined against *that* rhythm, not calendar time.

Proposed definitions, in priority order — each one existing DB tables can already answer some way once the concrete gaps in Section 3 are closed:

1. **Activation** = completed one full mock interview through to a rendered debrief. Not "signed up," not "started a session." The product's entire value proposition is the debrief; a session that stalls before `status = 'completed'` never delivered it. This is directly what the debrief-route completeness gate already enforces (any skipped question blocks debrief generation outright — `app/api/interview/debrief/route.ts`), so "activated" and "has a row in `debriefs`" are already the same thing in the DB. `scripts/analytics-baseline.mjs`'s `debriefed_sessions / total_sessions` is this number today, retroactively.

2. **Core retention signal ("did it work when it mattered")** = the user came back and started (ideally completed) a second mock **specifically because a real interview was approaching**, not just "came back at some point." This is the one generic funnel tools cannot give you, and it's the single most important number for this product category — a user who does one mock, likes it, and never returns because they didn't have another interview lined up is not a retention failure; a user who has three interviews this month and only ever does one mock with us *is*. Distinguishing these two cases requires knowing something about the user's actual interview calendar, which nothing in this codebase currently asks for (see Gap 1, Section 3).

3. **Depth-of-use signal** = used the drill/retry loop (`POST /api/interview/drill`) after a debrief, i.e. treated a weak signal as something to go fix rather than just reading the report and leaving. This is a much stronger PMF tell than a second full session for a cohort this small, because it's evidence the user found a *specific* piece of feedback credible and actionable enough to act on immediately — not just "liked the product enough to try it again someday."

4. **Referral/advocacy signal** = told someone else to use it. No referral mechanic exists in the product yet (`BACKLOG.md`'s "Rings / Referral" feature is explicitly paused at the Discovery stage). For a cohort this small, don't wait for a built referral feature — ask directly in the PMF survey (Section 2) and, if the cohort is genuinely tens of people, it's reasonable for Anshuman to just watch for unprompted "hey can my friend use this too" messages, which the DB/Mixpanel can't capture at all.

5. **Outcome signal ("did it actually help them get the offer")** = `actual_outcome` on `debriefs`/`calibration_loops`. This is the deepest signal available but the slowest and leakiest to collect — real interview outcomes land weeks after the mock, response rates on any "did you get the job?" ask will be low, and it's confounded by everything else that determines whether someone gets an offer. Treat it as directional color, not a primary PMF metric at this stage. Worth noting: the collection endpoint for this already exists (`POST /api/sessions/[sessionId]/outcome`) but has **no UI** anywhere in the product — `BACKLOG.md` item #9 flags this explicitly ("Still needed: 'Did you get the job?' prompt... Target: Start tracking after 50 paying users"). At a tens-to-low-hundreds cohort, this doesn't need a built in-app prompt; a manually sent email per user two weeks after their session, driving them to the existing endpoint or just to a reply, is proportionate and requires no engineering.

### Sean Ellis PMF survey — concrete plan, not just "consider it"

No survey infrastructure exists in this codebase at all (checked: no `survey`/`NPS` mechanism beyond copy references to "feedback" in unrelated UI strings). For a cohort this size, don't build one — use a third-party form (Typeform/Google Form, whatever Anshuman already has an account for) and treat it as a manual, out-of-band step:

- **Who**: everyone who reached Activation (Definition 1) at least 3-5 days prior, so they've had time to reflect and (ideally) act on the debrief, not survey them the moment they close the tab.
- **The question** (Sean Ellis original wording, unmodified — don't reword this, the 40% benchmark is calibrated to this exact phrasing): *"How would you feel if you could no longer use PrepSignals?"* — Very disappointed / Somewhat disappointed / Not disappointed / N/A, no longer use it.
- **Two required follow-ups**, both standard to the methodology and both cheap:
  - "What type of person do you think would most benefit from PrepSignals?" — this is how you find your narrow ICP's actual shape, not the one you guessed.
  - "What is the main benefit you get from PrepSignals?" — validates whether the value people report matches the value the product is built around (evidence-first debrief, specific signal feedback) or something else entirely (e.g. "it made me practice at all," which would be a very different, much more commodity-risk finding).
- **Delivery**: email (Resend is already wired in for the debrief email — `lib/email.ts` — so the sending infrastructure and the user's email address are both already there; this plan does not require building an in-app survey trigger, just a manual send to the activated cohort, or a very small one-off addition to the existing debrief-email template if Anshuman wants it automatic. That template change is a real code change and out of scope for this plan/this seat to spec in detail — flagging it as a build candidate, not doing it.)
- **Sample size floor**: Sean Ellis's own guidance is ~40+ survey responses before treating the % as meaningful at all. At a "tens to low hundreds" cohort with realistic response rates (~20-30% for an unincentivized post-product email), that means the initial cohort target should be closer to 150-200 activated users, not 40-50, to have any chance of a stable read. Below that, treat any number as a trend to watch, not a verdict.

---

## 2. Audit — what's already trackable vs. what's missing

### 2a. What EXISTS today (verified by reading the actual call sites, not assumed)

All events go through two thin wrappers: `lib/analytics.ts` (`track()`, server-side, Node `mixpanel` package) and `lib/analytics-client.ts` (`trackClient()`, browser, `mixpanel-browser`). `distinct_id` is Clerk's `userId` server-side, linked to the browser's anonymous ID via `identify()` in `components/MixpanelProvider.tsx` (every page load, signed-in) and again explicitly in `SetupForm.tsx`'s post-auth resume effect.

| Event | Fired from | Properties | Status per `BACKLOG.md` |
|---|---|---|---|
| `landing_page_viewed` | `components/LandingPageView.tsx` (mount) | none | Code complete, **not confirmed live** |
| `cta_clicked` | `components/TrackedCta.tsx`, `components/InteractivePreview.tsx` | `cta_location` (`top_nav`\|`hero`\|`bottom`\|`preview_post_reveal`) | Code complete, **not confirmed live** |
| `basics_submit`, `personalisation_submit` | `components/SetupForm.tsx` `handleContinue()` | none | Code complete, **not confirmed live** |
| `jd_submit` | `SetupForm.tsx`, both signed-in submit and signed-out auth-redirect paths | `auth_state` (`signed_in`\|`signed_out`) | Code complete, **not confirmed live** |
| `sign_up_completed` / `sign_in_completed` | `SetupForm.tsx` post-auth resume effect | none | Code complete, **not confirmed live** — separated deliberately so a returning login isn't miscounted as a new signup |
| `session_started` | `app/api/sessions/route.ts`, `app/api/dev/quick-test/route.ts` | `role`, `company`, `round_type`, `company_stage`, `domain`, `session_number`, `is_test` (quick-test only), `$insert_id` | **Verified live** (real production event confirmed post-PR#26 per `BACKLOG.md`) |
| `session_completed` | `app/api/interview/debrief/route.ts` (success path only) | `round_type`, `recommendation` (lowercased/snake_cased), `interview_depth` (= total question count for the round), `session_duration_sec`, `is_test`, `$insert_id` | Not independently reconfirmed since the two new properties were added — same code path as the verified `session_started`, low risk |
| `debrief_generation_failed` | `debrief/route.ts` catch block | `reason` (`transcript_too_large`\|`rate_limited`\|`truncated`\|`unknown`), `$insert_id` | Code complete, added specifically because failures were previously invisible in the funnel (indistinguishable from a user closing the tab) |
| `drill_used` | `app/api/interview/drill/route.ts` | `parameter_id`, `original_rating`, `new_rating`, `$insert_id` (content-hashed) | Code complete; **zero historical data by design** — the drill loop is intentionally ephemeral (no DB write), so this event is the *only* record of drill usage that will ever exist, past or future |

`session_number` is already computed server-side at session creation (`COUNT(*) FROM sessions WHERE user_email = ...` + 1) and attached to `session_started` — this means "did they come back at all" (Definition 2's weaker cousin) is queryable directly from Mixpanel with zero new instrumentation, via `session_number >= 2` on that one event. Retroactively, `scripts/analytics-baseline.mjs`'s `returning_users` query does the same thing off the DB.

### 2b. Concrete gaps against the measurement plan above

1. **No way to distinguish "returned because a real interview is coming up" from "returned for any reason."** This is the single most important gap relative to Definition 2 above, and closing it does *not* require behavioral inference — it requires asking the user directly, once, and storing the answer. Nothing in `SetupForm.tsx`'s fields (`role`, `company`, `yoe`, `round_type`, `company_stage`, `domain`, `background`, JD) captures "when is your actual interview" or "is this practice for a specific upcoming interview or general prep." Without this, `session_number >= 2` conflates a genuine "prep pipeline worked" signal with idle re-engagement, and there is no way to tell them apart after the fact.

2. **`actual_outcome` / the outcome-tracking API is completely invisible to Mixpanel.** `app/api/sessions/[sessionId]/outcome/route.ts` writes straight to Postgres (`debriefs.actual_outcome`, `calibration_loops.actual_outcome`/`discrepancy_score`) with no `track()` call at all — confirmed by reading the full route, it has no import of `lib/analytics`. That means Definition 5 (outcome signal) can never be joined against the Mixpanel funnel (e.g. "of users who saw a Borderline verdict, what fraction actually got the offer") without a manual DB export. This route also currently has **zero UI callers anywhere in the app** — it's reachable only by direct API call — so today, nobody actually produces this data regardless of tooling.

3. **No survey-response event.** Whatever the Sean Ellis survey delivery mechanism ends up being (Section 1), there is no Mixpanel event or DB column to record a response against a specific user, which means the 40% number can't be cross-tabbed against behavioral data (e.g. "did the 'very disappointed' cohort actually complete more sessions than the 'not disappointed' cohort") without manually joining a spreadsheet export to the DB by email. For a cohort this small that manual join is genuinely fine — flagging it as a known manual step, not something worth building infra for yet.

4. **No acquisition-source property anywhere in the funnel.** `landing_page_viewed` fires with zero properties — no UTM capture, no referrer. For a "small, narrow cohort" test, knowing *where* your PMF-positive users came from (a specific subreddit, a specific college WhatsApp group, a specific LinkedIn post) is close to the whole point — a 40%+ Sean Ellis score from a cohort you can't attribute to a channel isn't actionable, because you don't know what to do more of. This is a one-line addition to the landing page load site whenever instrumentation work resumes; flagging as a real gap, not fixing.

5. **No cohort/segment property on any event.** Since the ask is explicitly to test PMF on a *narrow* slice rather than the broad ICP, whatever narrow slice gets chosen (e.g., one specific college, one specific round type like `technical_screen`, one specific company tier) needs to be tagged on events to be queryable as its own funnel in Mixpanel, rather than reconstructed after the fact from `role`/`company`/`round_type` combinations. `round_type` itself is present already, but see Gap 6 below before trusting it for a cohort cut.

6. **`round_type` normalization is inconsistent between the question route and the debrief route** (flagged already in `BACKLOG.md`'s "End-to-End Acquisition Funnel" entry, not a new finding — restating because it directly affects the reliability of any funnel segmented by round type): the debrief route treats legacy `"screening"`/`"technical"` values as their own round types (5/8 questions), while the question route folds both into `technical_screen` (5 questions). Any cohort analysis that filters or groups by `round_type` should sanity-check the actual distinct values present in the data before trusting the split, especially if the cohort includes any sessions from before this was noticed.

7. **`quick_test` contamination is handled inconsistently across surfaces.** DB-side reads (`GET /api/sessions`, `GET /api/sessions/analytics`, cross-session `history`) explicitly filter `round_type != 'quick_test'`. Mixpanel-side, `is_test: true` is attached as a property instead — which is the right call (still visible/debuggable in Live View) but means any Mixpanel-native funnel or cohort built for this PMF plan **must** explicitly filter `is_test` itself; it will not be excluded by default the way it is in the DB-derived baseline script and the DB-derived `/progress` page.
   - Also worth noting for hygiene: `is_test` is only ever attached to `session_started`/`session_completed`. If a `quick_test` session hits `debrief_generation_failed` instead, that event carries no `is_test` marker at all (confirmed by reading the route — the failure-path `track()` call doesn't include it), so a failure-rate analysis built on this data must exclude `quick_test` sessions by some other means (e.g. checking `role`/`company` against known test values) or accept minor contamination.

8. **No plan/tier property**, which is fine today (monetization tiers are speced, not launched — `CLAUDE.md`'s Week 3+ table, all still "not started") but will be a gap the moment pricing ships, since "would a user pay" is usually folded into a PMF read and none of the current events have anywhere to carry that.

9. **Drill usage has no denominator.** `drill_used` fires per attempt, but nothing records "how many debriefs had at least one signal ≤3 eligible for a drill" (the trigger condition), so "% of eligible users who used the drill loop" — the real Definition-3 metric — can't be computed from Mixpanel alone; it needs a join against `priority_risks`/signal ratings in `debrief_data`, which lives only in Postgres.

10. **`session_completed`'s properties intentionally exclude `hire_probability`/signal scores** (correctly, per the non-negotiable rule) but this also means Mixpanel alone cannot answer "does verdict severity predict return likelihood" — a genuinely useful PMF-adjacent question (do people who get a rough verdict come back to improve, or churn?). That join is possible today but only via the DB (`debriefs.debrief_data->>'hire_recommendation'`, already read this way in `app/api/sessions/analytics/route.ts`), joined against Mixpanel's return-usage data by user id/email out of band. Not a code gap — a "this analysis has to be done by hand for now" fact worth stating plainly.

### 2c. One process gap, not a data gap

Every event above except `session_started` carries a `BACKLOG.md`-documented "not yet verified live" status — meaning the honest current state is closer to "instrumentation is coded and plausible" than "instrumentation is confirmed working." Before trusting any funnel number for a real PMF decision, the actual first step is a manual click-through against a live deployed build (visit → CTA → 3-step wizard → sign-up → finish an interview → use drill) confirming every event listed in 2a actually lands in Mixpanel Live View, exactly as `BACKLOG.md` already calls out as the next step. I did not attempt to verify this myself — no Mixpanel MCP connection is available in this session, and no `DATABASE_URL`/live credentials exist in this sandbox to run `scripts/analytics-baseline.mjs` either. Both should be the literal first action taken on this plan, before recruiting any cohort.

---

## 3. What counts as "we found it" vs. a false positive

Given the cohort is deliberately narrow and small, treat any single metric in isolation as close to worthless — the plan only means something as a small bundle read together.

### Genuine signal (all of these together, not any one alone)
- Sean Ellis score ≥40% **on a sample of 40+ responses minimum** (Section 1) — below that sample size, don't trust the percentage even if it clears 40%.
- A meaningful fraction of Activated users show `session_number >= 2` **and**, once Gap 1 is closed, self-report that the return was tied to an actual upcoming interview — not just idle re-engagement.
- Non-trivial drill-loop usage among users whose debrief had at least one signal ≤3 (Gap 9 — needs the manual DB join described above until it's instrumented directly).
- Unprompted qualitative pull: people asking to bring a friend, asking when the paid tier ships, or referencing a specific piece of debrief feedback back to Anshuman unprompted. For a cohort this size, these anecdotes are not "soft" data — they're a large fraction of the total signal available, and should be logged somewhere (this plan doesn't specify where; a simple running note is enough at this scale).
- Some `actual_outcome` responses (even a handful) showing the debrief's verdict was directionally right and *the user attributes some credit to the practice* — not just that they got the offer, since plenty of people get offers with no prep tool at all.

### False positives to explicitly guard against
- **High signup, near-zero completed-debrief rate.** Vanity top-of-funnel (landing views, CTA clicks, even signups) with a weak `debriefed_sessions / total_sessions` ratio (Definition 1) means nothing else in this plan is even measuring real usage. This is exactly the failure mode Anshuman named as the risk to watch for, and it's the first gate to check, before anything else.
- **Returning users with no relationship to a real interview.** Once Gap 1 is closed, watch specifically for `session_number >= 2` being high while "returned because of an upcoming real interview" is low — that's re-engagement without evidence the tool matters at the moment that counts.
- **A high Sean Ellis % from a self-selected, over-friendly cohort.** If the initial "tens of users" are mostly personal network / people who feel obligated to be positive to a friend's founder, 40%+ is close to meaningless. The plan in Section 1 should recruit outside Anshuman's direct personal network as much as the "narrow cohort" constraint allows, or at minimum flag responses from known personal contacts separately so they can be excluded from the headline number.
- **Drill usage without independent evidence it changed the outcome.** `drill_used`'s `new_rating` going up is graded by the same LLM pipeline that produced the original score, on an ephemeral rewrite — it's evidence of engagement, not proof of real skill improvement. Useful as a depth-of-use signal (Definition 3), not as outcome evidence.
- **Strong quantitative funnel numbers with zero qualitative signal.** If nobody in the cohort volunteers a single unprompted "this actually helped" comment or asks a friend to try it, that absence is itself informative for a cohort this small — genuine PMF at this stage is usually loud, not just statistically present in a funnel.

---

## 4. Recommended immediate next steps (roughly in order, none require code changes except where noted)

1. Get real credentials into a runnable environment and execute `npm run analytics:baseline` for an actual current-state number — this plan's Section 2 audit is based on reading code, not on any real production numbers, because neither DB nor Mixpanel access exists in this sandbox.
2. Do the live click-through verification pass named in 2c — confirm every coded event actually lands in Mixpanel before designing any dashboard or funnel on top of it.
3. Decide the actual narrow cohort (a specific college, a specific round type, a specific company tier — Anshuman's call, not this seat's) and recruit toward the ~150-200 activated-user target from Section 1, not the raw signup count.
4. Stand up the Sean Ellis survey as a manual/external form now — it needs no engineering and can start collecting responses in parallel with everything else.
5. Flag Gaps 1, 2, and 4 (Section 2b: upcoming-interview date/intent capture, outcome-tracking Mixpanel visibility, acquisition-source capture) as the highest-leverage instrumentation additions if/when engineering time opens up on this — everything else in the gap list is either a nice-to-have or a manual-join workaround that's tolerable at this scale.

---

## Files referenced (all read, not modified)
- `lib/analytics.ts`, `lib/analytics-client.ts`, `components/MixpanelProvider.tsx`
- `app/api/sessions/route.ts`, `app/api/dev/quick-test/route.ts`
- `app/api/interview/debrief/route.ts`, `app/api/interview/drill/route.ts`
- `app/api/sessions/[sessionId]/outcome/route.ts`, `app/api/sessions/analytics/route.ts`
- `components/SetupForm.tsx`, `components/TrackedCta.tsx`, `components/LandingPageView.tsx`, `components/InteractivePreview.tsx`
- `scripts/analytics-baseline.mjs`, `db/schema.sql`, `BACKLOG.md`, `CLAUDE.md`
