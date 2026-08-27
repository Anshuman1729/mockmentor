# PMF at Small Scale — Narrow Audience Pilot

**From:** VP Product · **To:** Chief of Staff (feeding a cross-department plan) · **Date:** 2026-08-27
**Ask this answers:** deliberately narrow the ICP before optimizing broad — define what PMF means at small
scale, propose 2-3 narrower slices to pilot, flag what's currently in the way of testing it well.

No live analytics exist yet to check this against (`ops/analytics/digests/` is empty — Director of
Analytics hasn't run yet). This is first-pass reasoning from the existing docs, competitor research, and
codebase state, per Phase 0 mandate. Should be revisited once Analytics has real numbers.

---

## 1. What PMF means here, concretely (not the generic definition)

PrepSignals is a **pre-event prep tool**, not a daily-habit app — people don't use it because they enjoy
using it, they use it because a real interview is coming. That changes what the standard PMF signals
should actually look like. Applying generic SaaS retention benchmarks (e.g., 30-day cohort retention) to
this product would produce a false negative — nobody should be opening a mock-interview app 30 days after
their interview is over. The four signals below are the ones worth measuring, each reframed for that
reality:

1. **Sean Ellis test, reframed around the event, not the calendar.** Not "how would you feel if you
   could no longer use this product" on a fixed 30/90-day clock — ask it as *"if you found out about
   PrepSignals but couldn't use it before your next real interview, how would you feel?"* Target: **≥40%
   "very disappointed"** among people who actually have a real interview scheduled or imminent — the
   standard Sean Ellis threshold, but the question has to be anchored to the interview, not a time window,
   or it measures the wrong thing.

2. **Repeat usage before one real interview — not 30-day return.** The right retention proxy for this
   product is: within a single candidate's live job-search window, do they come back for a 2nd/3rd mock
   before the actual interview, rather than doing exactly one free session and disappearing? Target:
   **≥50% of engaged users (finished at least 1 full debrief) complete 2+ sessions before their stated
   interview date/round.** This requires knowing when a user's real interview is (see Section 3 — this
   isn't currently captured).

3. **Unprompted referral within a real, dense social graph.** Because a narrow cohort (see Section 2) can
   be chosen to already share a social graph (same batch, same WhatsApp group), referral is observable
   directly, not just inferred from broad growth curves. Target: **at least 1 in 5 users in the pilot
   cohort brings in a second real user with no incentive attached** (not a referral-code/credit flow —
   that's the Rings/Referral feature already scoped and paused in BACKLOG.md, and incentivized referral
   would contaminate this specific read of organic pull).

4. **Willingness to pay, measured before the payment rail exists.** PhonePe integration isn't built
   (PRD Status table, Week 3 Monetisation) and pricing itself is Article-II-gated — this doc isn't
   proposing a price. But PMF at small scale still needs a WTP signal *before* a real checkout exists:
   an explicit ask ("would you pay ₹X for unlimited mocks this month" as a single yes/no + amount
   question, or a fake-door "Notify me" CTA on the still-disabled Sprint/Deep Dive tiers) with a
   **target of ≥15-20% of engaged users saying yes or clicking through**, is a legitimate lightweight
   proxy that doesn't require Anshuman to approve a real pricing/payment change first.

**Bottom line: PMF at this stage = a cohort where losing access would genuinely upset a meaningful chunk
of them, where "engaged" means multiple sessions before their actual interview (not a 30-day habit), and
where at least a fifth of them would pay or bring a friend without being asked to.** All four should be
measured on the *same* narrow cohort at the same time — a slice can look good on one signal and fail the
others, and that's a real "not yet" finding, not noise.

---

## 2. Candidate narrow slices (pick one to pilot first — not all three at once)

Each is deliberately narrower than "college students in India," combining a job-seeking moment with either
a round type or an institution tier, per the framing already used in the ICP-first redesign
(`CLAUDE.md`'s ICP-First Redesign entry; the self-identification tags already live on the homepage —
`app/page.tsx:135`, `["Campus placements", "First job hunt", "First technical interview", "Career switch"]`
— are copy, not a validated segmentation, but they're the right axes to cut on).

**A. Final-semester CS/IT students at tier-2/3 engineering colleges, prepping for the technical
screen/deep-dive round of an on-campus placement drive.**
Rationale: campus placement season is a hard calendar deadline — the strongest natural trigger for the
"repeat usage before one real interview" signal above, not an assumption. Tier-2/3 colleges (deliberately
*not* IIT/NIT) are the ones actually carrying the "knowledge/expectation gap vs. recruiters" that the
ICP-first redesign was built around — top-tier students already have TPO-cell drilling and seniors'
interview archives, which blunts their felt need for an external tool. This cohort is also a tight,
pre-existing social graph (batch/branch WhatsApp groups), making the referral signal directly observable
instead of inferred.

**B. That same final-semester cohort, but for the HR/behavioural round specifically, not technical.**
Rationale: `COMPETITIVE_ANALYSIS.md`'s own Gap 1 ("Behavioral Interview Prep is Fragmented... 40-60% of
interview process; most tools ignore it") is unclaimed territory, and first-time candidates have the least
internal calibration for a behavioral round specifically — there's no "correct answer" to fall back on the
way there is for DSA/technical prep, which is also freely available elsewhere (LeetCode, YouTube). That's
where the product's actual differentiation (evidence quotes, model answers grounded in the real question,
`priority_risks`) is hardest to substitute with a free alternative, and the current debrief-only pipeline
already covers behavioural rounds without new build work.

**C. Off-campus early-career switchers (0-2 YOE) interviewing outside a campus placement cycle** —
someone applying to a product-based company on their own, with no institutional placement support.
Rationale: this is the one slice with real income and no free institutional safety net running in
parallel (no TPO cell, no cohort of peers doing the identical interview at the identical time), making it
the cleanest place to read the willingness-to-pay signal specifically — testing WTP on students with
essentially no disposable income (Slices A/B) will read as a false negative on that one signal even if
everything else about the product is working for them.

**Recommendation:** pilot **A** first — it's the slice the product was already redesigned around (ICP-first
redesign), it's the easiest to recruit into in bulk (one college, one placement cell, one batch), and it's
the only one of the three where referral is trivially observable. Use **B** as the fast, cheap follow-up
test (same recruiting pool, zero new build) specifically to check whether behavioral-round differentiation
is real or theoretical. Treat **C** as the dedicated WTP probe once A/B produce a real "very disappointed"
number — don't try to read WTP off Slice A/B's data, it'll be misleadingly low.

---

## 3. What's currently missing or weak that would get in the way of testing this well

Ordered roughly by how much it would corrupt the read, not by build effort.

1. **Nothing captures *why* a user is here, so a narrow cohort can't be identified in the data at all.**
   The four self-identification tags on the homepage (`app/page.tsx:135`) are decorative copy — there's no
   corresponding field in `SetupForm.tsx`, the `sessions` table, or `lib/analytics.ts`'s tracked events.
   Without a structured "campus placement / off-campus / career switch" field captured at setup, you
   cannot slice `session_started`/`session_completed`/return-usage by the cohort this doc proposes — you'd
   be reasoning from whoever you manually recruited, not from what the product itself observed. This is
   the single highest-priority gap to close before running any pilot.

2. **No referral mechanism exists at all, not even an unincentivized one.** The "Rings / Referral /
   Help-Credit Loop" feature (`BACKLOG.md`) reached Discovery-stage design and was explicitly paused,
   blocked on the analytics prerequisite above. Right now, referral can only be measured by directly
   asking users ("did you tell anyone about this"), not by a trackable invite link or "how did you hear
   about us" field — a much noisier, self-report-only version of PMF signal 3.

3. **Return-usage is measured at the wrong granularity for this hypothesis.** The existing baseline
   tooling (`scripts/analytics-baseline.mjs`, referenced in `BACKLOG.md`'s engagement-loop section) is
   built around generic cohort-style return-usage, not "sessions completed within one candidate's live
   job-search window." Testing signal 2 above needs a definition that clusters a user's sessions by
   role/company/round proximity in time, which doesn't exist yet — without it, "did they come back" can't
   be distinguished from "did they come back within their actual prep window," which is the entire point.

4. **No lightweight WTP probe exists pre-payment-rail.** PhonePe isn't built and pricing is Article-II
   gated, so this isn't proposing to change anything — but there's also currently no "would you pay"
   question or fake-door CTA anywhere in the product to get signal 4 above before that gate matters. The
   Sprint/Deep Dive tiles on the pricing teaser are disabled buttons with no click-through capture (and
   per `BACKLOG.md`'s "Known Bugs — Landing Page," the Free tier's own CTA doesn't even redirect reliably)
   — right now there's no way to tell "nobody clicked because it's disabled" from "nobody clicked because
   nobody wants it."

5. **No survey/feedback trigger exists in-app.** Searched the codebase — there's no NPS/survey/prompt
   mechanism anywhere. The "Did you get the job?" outcome-tracking prompt (`BACKLOG.md` item #9) is API-only
   (`POST /api/sessions/[sessionId]/outcome`); the UI trigger was never built. The Sean Ellis-style question
   in signal 1 needs *some* deliberate trigger point (post-2nd-session, or N days after a stated interview
   date) — right now that would have to be a manual ask outside the product.

6. **Several pipeline paths a narrow pilot would actually exercise are still unverified against a live
   LLM/DB**, per `BACKLOG.md`'s own status marks: the drill/retry loop (🟡 built, untested live), cross-session
   trend tracking (🟡 built, untested with real multi-session data), and the debrief-generation TPM fix
   (verified only by simulation, "needs a real interview run through to confirm"). If a real pilot cohort
   hits one of these for real and gets a bad experience, it reads as "this audience doesn't want the
   product" when the actual cause is an unverified code path. **Recommend a live smoke-test pass (real
   `GROQ_API_KEY`, a handful of real interviews end-to-end) before pointing any real narrow cohort at this**
   — this is a Tech-pod ask, flagging it here because it directly threatens the validity of the PMF read,
   not because VP Product should run it.

7. **Mobile verification is still incomplete**, and Slice A/B (India campus students) skew mobile-heavy.
   PRD Status table: mobile responsiveness is "🟡 Addressed... still needs a real visual pass in a browser
   against a live session... before calling it verified." Worth closing before recruiting a mobile-first
   cohort, not after.

8. **Minor but relevant to a first-timer audience's trust bar:** the homepage founder-note photo is still
   a placeholder gradient block (ICP-First Redesign table, 🟡 item) — the "founder note / real face" trust
   signal this cohort was specifically designed to respond to isn't actually live yet.

---

## Recommended next step

Close gaps 1 and 2 above (cohort-identifying field + a bare-minimum unincentivized "how did you hear about
this" / invite capture) before recruiting Slice A — both are small, additive, don't touch pricing/legal/
external messaging, and without them the pilot produces an anecdote, not a measurable PMF read. Everything
else in Section 3 can run in parallel or slightly behind.
