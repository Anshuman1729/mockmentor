# Product — Phase 2 Hiring Spec

**Author:** VP Product · **Date:** 2026-08-28 · **Branch:** `feat/agent-org-phase-2-product`

Per `docs/autonomy-charter.md`'s org map, Product's Phase 2 seats are **SPM, PM, APM**, all
ultimately answering to VP Product, who continues reporting to Chief of Staff.

**This entire document is a proposal.** Nothing here builds `.claude/agents/*.md` files for these
three seats — that step is gated on Anshuman's review, the same as Legal and Analytics's Phase 1
specs. This seat has no authority to bring reports online on its own.

---

## Reporting shape — decided, with reasoning

I checked how Legal and Analytics structured their just-completed Phase 1 specs (both flat: all
three reportees report directly to the department head). I was also given a specific instruction not
to treat "a junior seat should route through a mid-level seat" as an established precedent — it isn't
one; both Phase 1 departments went flat.

I'm **not** matching that flat precedent for Product. Here's why, on the merits of this department's
own seats rather than by pattern-matching titles:

**The naming-ladder argument is real but not sufficient on its own.** SPM/PM/APM does read as a
seniority ladder in a way "Junior Analyst / Senior Analyst / Data Engineer" doesn't — those three are
peers doing different jobs (analysis, analysis, infrastructure), not a chain of the same job at
different levels. But naming alone isn't a strong enough reason by itself: "Compliance Associate /
Senior Compliance Counsel / Specialist Counsel" also carries seniority-sounding names, and Legal still
went flat. If seniority-sounding names were sufficient justification for a chain, Legal's spec would
have looked different than it did.

**The actual, Product-specific reason is in this seat's own mandate, not the job titles.** My mandate,
verbatim from `.claude/agents/vp-product.md`, is to own roadmap *coherence* — "not any single feature."
That's an explicit, deliberate exclusion: VP Product is supposed to operate above individual feature
ownership. Neither Director of Compliance's mandate ("review a specific surface... for compliance
risk") nor Director of Analytics's mandate ("answer funnel questions with evidence") disclaims
feature-level ownership the way mine does — they're scoped to reviews and evidence, not to shipping
individual pieces of the product. That leaves a real gap for Product specifically: if VP Product
explicitly isn't the feature owner, *someone* has to be, and under a flat structure nothing forces that
someone's work through a coherence check before it reaches me. A chain closes that gap directly; flat
reporting would leave it open by construction.

**Decided shape:**

```
VP Product
 ├── SPM  (direct report)
 └── PM   (direct report)
       └── APM  (reports to PM, not to VP Product)
```

- **PM** owns single-feature ownership — the thing my own mandate explicitly excludes itself from.
- **APM** supports PM with raw research/analysis/triage. Its output is *input to a PM-owned spec*, not
  a coherence-level artifact ready for my read — so it makes sense for APM to hand off to PM, the same
  way a raw finding needs a feature-owner's edit pass before it's a spec I should be reconciling against
  the rest of the roadmap.
- **SPM** does not sit between PM and me in a strict ladder — it's a second, senior direct report that
  does a first coherence pass across *multiple* PMs' feature specs (there's currently only one PM seat,
  but the role is defined for when that's not true) before I do my own roadmap-level read. Functionally,
  SPM is closer to "my deputy for coherence" than "PM's manager."

This is a real deviation from the Phase 1 precedent, made explicitly rather than defaulted into, and
justified by something specific to this department's own mandate — not by the job titles alone.

---

## Access tiers — none Full-Auto, matching the conservative posture of both Phase 1 specs

All three seats below are capped at **Write**, several at **Read-Only**. No seat in this spec gets
Full-Auto, regardless of what a "routine, reversible, internal loop" might technically qualify under —
Product work (feature specs, roadmap calls) isn't the kind of repetitive, low-judgment loop Full-Auto
is meant for, and this org's Phase 1 departments made the same call for materially similar reasons
(nothing either of them proposed ships without a human check either). The Article II gate list applies
to all three regardless of tier, same as every other seat in this org.

---

## Seat 1: SPM (Senior Product Manager)

### Mandate
Deputy for roadmap coherence. Where VP Product's mandate is "does everything being built add up to a
consistent direction," SPM's job is the same question asked one level down and more often: read every
PM-owned feature spec, every BACKLOG.md entry, every ops/ digest from Analytics and Legal, and flag
where two things in flight contradict each other *before* it becomes VP Product's problem to notice at
roadmap-note time. SPM is the seat that would have caught, e.g., "docs/debrief-schema-migration.md
still describes a three-generations-stale schema" or "the round-type maps in two files disagree" as a
matter of routine cross-reading, not as a special one-off audit.

Also: second-line reviewer on PM's feature specs before they reach VP Product — not a rubber stamp,
a genuine coherence check (does this spec conflict with something another PM or Analytics/Legal
already flagged; does it contradict a stated non-negotiable rule; does it duplicate something already
built).

### Access tier: Write
**Justification:** SPM needs to actually draft coherence memos, cross-reference notes, and edits/
comments on PM's specs — a Read-Only seat that can only say "here's a problem" without being able to
draft the reconciling language would just create more hand-off overhead for VP Product to redo the
drafting work anyway. But nothing SPM drafts ships, merges, or becomes policy without VP Product (and
ultimately Anshuman) signing off — same boundary every Write-tier seat in this org already has.

### Tools and skills
- `Read, Grep, Glob` — same research/cross-reading toolkit as every other seat in this org; SPM's job
  is fundamentally about reading widely across `ops/`, `docs/`, `BACKLOG.md`, and PM's specs.
- `Write` — scoped to `ops/product/` (coherence memos, spec review notes) — not to `app/`, `lib/`,
  `components/`, or `scripts/`. Same boundary as VP Product's own Phase 2 restriction.
- `Skill` — `product-design-principles` is directly relevant whenever a PM-owned spec touches UI/UX,
  onboarding, or conversion; SPM should invoke it on the same trigger conditions VP Product does, since
  a coherence review of a UI-touching spec needs the same reference-driven/design-system-first lens.
  Once the marketplace `operations` plugin is installed, its process/roadmap-tracking skills (referenced
  generically in the autonomy charter, not yet named specifically since the plugin isn't installed) are
  likely a closer fit for the cross-referencing/tracking half of this job than anything currently
  available — flagging for install consideration the same way Legal flagged `legal:*` skills and
  Analytics flagged `data:*` skills.

---

## Seat 2: PM (Product Manager)

### Mandate
Owns individual features end-to-end, from spec to shipped-and-verified — the exact scope VP Product's
own mandate explicitly excludes itself from. Concretely: turn a BACKLOG.md item or a Chief-of-Staff/
Anshuman ask into a written spec (what it does, why, what "done" means, what it does *not* do),
coordinate with the Tech pod (Planner/Coder/Tester/Debugger/Reviewer) on execution, and verify the
result actually matches the spec before calling it done — including chasing down exactly the kind of
"marked ✅ Done but never verified live" gap this review's roadmap notes found repeatedly (the preview-
analysis Groq call, the SetupForm signed-out CTA, mobile responsiveness). PM is the seat whose job it
literally is to close "code complete" → "verified working for a real user," not leave that gap
unowned the way it currently is.

### Access tier: Write
**Justification:** PM needs to produce real specs that Planner/Coder can act on — a Read-Only PM would
be a contradiction in terms, since "PM" here specifically means feature ownership through to a written
artifact. Still capped below Full-Auto: PM does not merge code, does not push to `main`, and does not
independently decide a feature is "done" without Reviewer's sign-off and (per this org's existing
rules) without the outcome actually being checked against a live environment, not just a passing
typecheck.

### Tools and skills
- `Read, Grep, Glob` — understand the existing codebase/spec/backlog before writing a new spec; PM
  should be reading `lib/groq.ts`, `CLAUDE.md`, and `BACKLOG.md` as closely as this review did before
  handing anything to Planner.
- `Write` — scoped to spec/PRD documents (recommend a new `ops/product/specs/` subfolder, mirroring the
  `ops/<department>/<subfolder>/` convention already established) — not to `app/`, `lib/`,
  `components/`, or `scripts/` directly. PM directs Tech's work by spec, it doesn't write the code
  itself; that boundary keeps PM's Write tier from overlapping Coder's.
- `Skill` — `product-design-principles` is core to this seat, arguably more than any other Product
  seat: PM is the one actually writing the spec for a new screen/flow/onboarding change, which is
  exactly this skill's trigger condition (UI/UX, onboarding, conversion). PM should treat this skill as
  mandatory reading before any feature spec that touches a user-facing surface, not optional. Once
  installed, the marketplace `operations` plugin (referenced but not yet installed per the autonomy
  charter) likely has closer-fit project/roadmap-management skills than a generically-described
  reference; worth reassessing once it's actually available.

---

## Seat 3: APM (Associate Product Manager)

### Mandate
Junior research and analysis support, reporting to PM (see reporting-shape reasoning above), not
directly to VP Product. Concretely: competitive research (the kind of "look at Pramp/Final Round AI/
Huru" grounding work the ICP-first redesign already did once), first-pass reads of Analytics digests
and user-feedback entries flagged in `CLAUDE.md`'s "Key User Feedback" log, drafting raw findings that
PM turns into an actual spec, and the kind of mechanical cross-checking this review did by hand
(confirming a claimed fix is actually reflected in code, checking whether a PRD status label matches
reality) — genuinely useful, genuinely junior-appropriate work that doesn't require feature-ownership
judgment yet.

### Access tier: Read-Only
**Justification:** this is the most junior, least-tenured seat in the department, doing input/analysis
work whose entire purpose is to become someone else's (PM's) spec — it shouldn't be independently
producing artifacts that anyone downstream treats as a real deliverable. Read-Only also matches this
org's existing pattern (both Phase 1 departments capped their most junior seat — Compliance Associate,
Junior Analyst — this way) for exactly this reason: a junior research seat's value is in its findings
being read and incorporated by a more senior seat, not in it publishing directly.

### Tools and skills
- `Read, Grep, Glob` — sufficient for the mandate above; no `Write` tool, so findings get handed to PM
  as part of the interaction/output rather than written directly to a file APM owns. (If in practice
  APM's findings need a durable file trail rather than living only in a conversation transcript, that's
  worth revisiting before this seat is actually built — flagging now rather than silently deciding it.)
- `Skill` — `product-design-principles` for the same reason as the other two seats, whenever APM's
  research touches a UI/UX or competitive-positioning question. Once installed, the marketplace `data`
  plugin (`data:sql-queries`, `data:statistical-analysis` — already referenced in Director of
  Analytics's own spec for the same category of work) is probably the closest-fit skill for APM's
  digest-reading/cross-checking half of the job, more than anything Product-specific currently exists
  on the marketplace.

---

## Sequencing recommendation

Build **PM first**, not SPM. My own mandate already covers the coherence layer SPM would eventually
take over — I can do that job myself for a while longer, the same way I did for this first roadmap
pass. What I can't do myself, by my own mandate's explicit design, is own individual features through
to verified completion — that's the actual gap this review surfaced repeatedly (multiple "✅ Done"
items that turned out to be unverified-in-a-live-environment, one active bug marked resolved that
isn't). PM closes that gap immediately. APM should follow PM (not precede it, and not attach to VP
Product), since APM's entire value proposition is producing input for PM's specs — building APM before
PM exists means its output has nowhere real to go. SPM last: bring it on once there's enough live PM
output (more than one feature spec in flight, ideally more than one PM-track item at once) that a
dedicated second-line coherence reviewer is actually load-bearing rather than reviewing a single
stream I could just as easily read myself.

**Recommended order: PM → APM → SPM.**
