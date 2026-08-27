# Institutional Pilot as PMF-Testing Vehicle — Strategic Assessment

**Author:** Sales Head
**Date:** 2026-08-27
**Status:** Planning only. No institution contacted, no outreach drafted. Recommendation for Chief of Staff / Anshuman to decide on.
**Scope note:** This sits ahead of this seat's formal Phase 3 (gated on Monetisation shipping, per `docs/autonomy-charter.md`). Framed here as planning work only, consistent with the Phase 0 allowance to produce a thesis — not a decision to start institutional sales activity early. See "Sequencing" at the end.

---

## 1. The core question

Anshuman wants PMF evidence from a small, narrow audience before broad self-serve acquisition. The candidate narrow-first vehicles are:

- **A.** One individual-user segment, self-serve (e.g., final-year CS students at one archetype of college, recruited organically/directly)
- **B.** One institutional partnership (one placement cell, one bootcamp, one training institute) that provides access to a cohort

This memo assesses B, specifically against A — not against "do nothing."

## 2. What an institutional pilot would prove — and what it wouldn't

**What it's genuinely good for:**

- **Solves cold start fast.** PrepSignals needs real interview sessions to generate debrief data, populate `calibration_loops`, and test whether `hire_probability`/BARS actually correlates with real outcomes. One institution can hand you 30-100 in-ICP users inside a 3-4 week window at zero CAC. Reaching that density organically as a solo founder would take far longer.
- **Outcome data quality.** Placement cells and bootcamp career teams track actual placement outcomes for their cohort. That's exactly the `actual_outcome` field `calibration_loops` needs and which self-serve users — who have no reason to report back after landing or losing an offer — mostly won't supply.
- **Distribution efficiency.** One relationship, one round of coordination, reaches a whole cohort simultaneously. This is a real advantage over one-by-one self-serve acquisition for hitting density quickly.
- **Sidesteps pricing entirely.** Monetisation tiers exist on paper only. A pilot offered free needs no pricing decision and doesn't touch the Article II pricing gate.
- **Timing alignment.** India campus placement season runs roughly August–December — i.e., now. A placement-anxiety product pitched to a TPO during the actual crunch has a real, dated reason to say yes, not an abstract one.

**What it does NOT prove, and the trap to avoid:**

- **The buyer isn't the user.** A TPO or bootcamp career-team lead saying yes to a pilot is a B2B2C sale to an administrator. That validates "this pitch works on an institutional gatekeeper," not "an individual candidate finds enough value to choose this again unprompted." Those are different signals, and conflating them is the single biggest risk of using this as the *primary* PMF read.
- **Mandated/encouraged usage biases the data.** If a TPO tells a cohort "do this," some fraction will complete a session perfunctorily just to comply, not because they wanted to. Completion counts go up; genuine want-more signal gets diluted. An institution reporting "the pilot went well" (high attendance, no complaints) is not the same as individuals actually getting placement-relevant value — a false-positive PMF signal is a real risk here.
- **Institutional sales cycles are slow, even for a free pilot.** Getting in front of the actual decision-maker, building enough trust for them to hand over a cohort, then fitting into their calendar (not yours) — even without payment or contracts involved, this easily costs weeks. Every week spent chasing an institutional yes is a week not spent watching real usage data, which is a real cost for a pre-PMF solo-founder company where speed of learning is the scarce resource.
- **Asymmetric reputational risk.** An individual self-serve user churning quietly costs nothing. A bad first experience with a TPO's cohort — especially given real unresolved reliability gaps flagged in `CLAUDE.md` (debrief generation untested against a live `GROQ_API_KEY`, the drill/retry loop untested live, cross-session trends untested with real multi-session data, mobile responsiveness only statically verified, not visually confirmed in a live session) — could burn that specific institutional channel permanently, and institutional networks talk to each other (TPOs know other TPOs).

## 3. Recommendation

**Pursue it, but only if the definition of pilot "success" is restructured.**

Do not let institutional satisfaction (TPO reports it went smoothly, wants to repeat) count as the PMF signal. Treat the institution purely as a **distribution channel** — a zero-CAC way to reach a narrow, exactly-in-ICP cohort fast — and apply the *same individual-level PMF bar* you'd apply to an organic self-serve narrow segment: do individual students engage, return, and report real value, when engagement is not compulsory.

Concretely, this means:
- Usage inside the pilot should be *opt-in*, even if the TPO promotes/endorses it to the whole cohort. If the TPO insists on assigning it, track assigned-vs-opted-in separately and weight the opted-in subset as the real signal.
- The pilot's win condition for PrepSignals is individual pull (return usage, completion of more than one mock unprompted, direct student feedback) — not institutional renewal interest, which is a secondary, softer signal.

This gets the speed/density benefit of an institutional channel without letting an administrator's yes stand in for a user's yes.

## 4. Structural sketch of the pilot

**Target profile:** A single campus placement cell (TPO office) at a tier-2/3 engineering college, or a single coding bootcamp's career/placement team. Bootcamps are arguably the stronger first target — smaller, more homogeneous cohorts, and the placement/career team's own reputation is directly tied to graduate outcomes, so their incentive to try something that might move that number is sharper than a large college TPO office juggling many priorities.

**Timing:** Align to the current placement season (Aug–Dec) rather than running it as an off-season trial — the urgency is real and dated right now, not hypothetical.

**What to ask the institution for:**
- Access to one cohort (e.g., 30-50 final-year students, or one bootcamp batch)
- A 3-4 week window
- Permission to promote/announce the pilot to the cohort — explicitly *not* asking for it to be made mandatory
- One point of contact for coordination (TPO or career-team lead)
- No payment, no contract requested at pilot stage — this is Article-II-relevant (any real contract is gated to Anshuman directly regardless of pilot stage; "no payment, no contract" is also simply the right structure to actually get a yes at this stage)

**What to offer the institution:**
- Free access (full-feature, Sprint-tier-equivalent) for the pilot cohort — trivial to offer since Monetisation hasn't shipped, no pricing decision implicated
- An aggregated, anonymized cohort-level readiness summary at the end (e.g., "X% of the cohort showed a specific behavioral-round weakness pattern") — something the TPO/career team can actually use internally
- **Hard constraint, non-negotiable:** never share individual scores, `hire_probability`, or any BARS/rubric internals with the institution — this is the existing non-negotiable rule (never shown even to the user themselves) and applies with even more force to a third party. Aggregate-only, and this data-sharing design needs a look from the Director of Compliance before any institution is actually approached — sharing any student data with a third-party institution is DPDP-relevant territory even in aggregate form.

**Success criteria — institution's side:** Reasonable completion/engagement without complaints; TPO/career team would refer PrepSignals to a peer institution or want to run it again next season. Useful as a secondary signal and a distribution-growth signal, not treated as PMF proof.

**Success criteria — PrepSignals' side (the actual PMF bar):**
- Meaningful share of the cohort completes more than one mock without being told to
- Return usage / session-2 rate among opted-in students, measured the same way it would be for an organic self-serve segment
- Direct qualitative feedback from students (not filtered through the TPO) on whether the debrief actually changed how they'd prepare
- Enough real outcome data flowing into `calibration_loops.actual_outcome` to say something concrete about whether `hire_probability` tracks reality

## 5. Pre-conditions before any real institution is approached

This memo is strategy only. Before this moves from plan to outreach (which is gated to Anshuman directly under Article II — any message reaching a real external person), the following should be resolved, none of which are in this seat's control:

1. **Product reliability gates**, per `CLAUDE.md`'s own status table: debrief generation has never been verified against a live `GROQ_API_KEY` in this environment; the drill/retry loop is untested live; cross-session trend tracking is untested against real multi-session data; mobile responsiveness has only been statically checked, not visually confirmed in a live session. Running a real cohort through an unverified pipeline during their actual placement-prep window is a meaningfully worse failure mode than a self-serve user hitting the same bug alone — this should be closed or explicitly accepted as a risk by Anshuman before any institution is contacted.
2. **Compliance review** of the aggregate-reporting data-sharing design (Director of Compliance) before offering any cohort-level report to an institution.
3. **Sequencing decision by Anshuman/Chief of Staff:** the org chart ties Sales-Institutional's active phase to Monetisation shipping, reasoned as "needs a validated, sellable core product." A free, no-pricing pilot doesn't strictly require Monetisation to exist, so there's a real question of whether to greenlight this ahead of the formal Phase 3 gate specifically as a PMF-testing move (distinct from the eventual paid institutional-sales motion this seat is otherwise built for). This memo surfaces that as an open decision, not one it resolves.

## 6. Bottom line

An institutional pilot is a legitimate and probably faster narrow-first PMF vehicle than trying to organically assemble an equivalent individual cohort — the density and outcome-data advantages are real. The risk isn't in choosing this vehicle; it's in mistaking the institution's yes for the product's PMF signal. Structure the pilot so the institution is the access channel and the individual student's un-coerced return usage is still the thing being measured, and this is a good bet. If it instead gets measured by TPO satisfaction, it will look like a win and prove nothing.
