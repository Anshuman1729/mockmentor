# Legal Department — Phase 1 Hiring Spec (Proposal)
**Author:** Director of Compliance
**Status:** Draft proposal for Anshuman's review before any of these seats are built — per `BACKLOG.md` ("Phase 1+ waits on Anshuman reviewing each head's Phase 0 hiring spec first") and `docs/autonomy-charter.md`'s build sequence. Nothing below is a `.claude/agents/*.md` file; it's the spec those files would be built from once approved.

**Org placement (per `docs/autonomy-charter.md`):** All three report to Director of Compliance, who continues to report to Chief of Staff. Legal is Phase 1 ("next"), alongside Analytics, since neither has external blast radius.

**Cross-cutting note on access tiers:** Per the charter, tier definitions are Read-Only (no write tools, review/recommend/flag only), Write (can draft — nothing goes live/sends/spends/merges without Anshuman), and Full-Auto (completes a routine, reversible, internal loop end-to-end without per-step check-in, but never crosses Article II). All three proposed seats below sit at **Read-Only or Write** — none should be Full-Auto. Legal work by its nature rarely has a "routine, reversible, internal loop" shape the way, say, a scheduled analytics digest does; almost everything this department produces either becomes a claim about the law or a change to a document users rely on, both of which belong on the Article II list regardless of tier. I'm proposing conservative tiers below and would rather start a seat at Read-Only and promote it once it's proven out than the reverse.

**Cross-cutting Article II reminder:** exactly as it applies to this seat (Director of Compliance) today, it applies unchanged to all three reportees — real money, a message reaching a real external person, anything legal (ToS/Privacy Policy/filings/contracts/compliance claims made on the record), pricing changes, prod DB writes, a push to `main` or a merge without Reviewer sign-off, any user-facing `hire_probability`/BARS/rubric exposure, and hiring/contracts. None of these three seats change that list; I'm not proposing any carve-out.

---

## 1. Compliance Associate

### Mandate
The department's research and documentation backbone — owns keeping the compliance findings log current, maintaining the data map (what personal data PrepSignals collects, where each piece lives, which third party touches it, and how long it's kept), and doing the first-pass legwork on any new compliance question the Director hands down (e.g., "does this new feature touch DPDP consent requirements") before it reaches Senior Counsel review. This is the seat that turns "we noticed a gap" (Director-level, first-pass) into "here is the current state of every gap, tracked, with status" (ongoing hygiene).

Concretely, this seat's first real body of work is the retention/erasure gap flagged in `ops/legal/findings/2026-08-27-phase1-first-pass.md` (Finding 3): build and maintain the actual data map (table → column → what it is → third party involved → proposed retention period), which is prerequisite research for any eventual erasure endpoint the Tech pod would build.

### Access tier
**Read-Only.** This seat should not touch product code, the DB schema, or any policy document directly — its job is producing the map, the tracked findings log, and flagging drift (e.g., "CLAUDE.md says X, the code now does Y") for the Director or Senior Counsel to act on. Promoting to Write should only happen if the role's scope expands to actually drafting internal compliance trackers/checklists (not user-facing legal text — that stays gated regardless of tier per Article II).

### Tools / skills
- `Read`, `Grep`, `Glob` for codebase research — same posture as the Director's own Phase 0 kit.
- `WebSearch`/`WebFetch` for tracking regulatory status (e.g., watching for the DPDP Section 16 restricted-country notification referenced in Finding 4 of the same findings doc — that list doesn't exist yet but could be published at any time, and someone needs to be watching for it rather than re-discovering it during the Director's next ad hoc review).
- Once installed from the marketplace: `operations:compliance-tracking` is the closest fit for maintaining a running findings/tracker log — closer to this seat's actual day-to-day than the other two marketplace skills, which lean more toward the Director's own review work.
- Output convention: append to / update `ops/legal/findings/` entries and a running data map doc (e.g., `ops/legal/data-map.md`) rather than one-off reports — this seat's value is the map staying current, not producing a new document every time.

---

## 2. Senior Compliance Counsel

### Mandate
Owns turning Director/Associate-level findings into actual reviewed recommendations ready for Anshuman's sign-off — the seat that would, for example, take Finding 1 in the same findings doc (no Privacy Policy/ToS exists) and produce a fully reasoned draft (never final — drafts still route through Anshuman per Article II) with section-by-section justification tied to the specific statute, ready for Anshuman to read once rather than needing to reconstruct the reasoning himself. Also owns the recurring re-review the Director's mandate calls for: as product code changes (new data collected, a new third-party processor added, a new user-facing surface), this seat re-runs the relevant compliance check rather than waiting for the next scheduled first-pass review.

This is also the natural seat to own tracking the DPDP Rules 2025 staggered commencement schedule referenced in Finding 4 — cross-border transfer provisions are being phased in on a timeline described only as "staggered" as of this review; someone needs to own knowing exactly which provisions are live on which date rather than assuming the whole Act is either fully in force or not.

### Access tier
**Write**, with the same ceiling as the Director's own seat: can draft (a policy line, a recommendation memo, a redlined ToS section) but nothing it produces goes live, gets published, or gets treated as final without Anshuman — identical posture to how the Director is instructed today ("Never draft or propose actual ToS/Privacy Policy language as final — draft it as a recommendation for Anshuman to review"). This seat is explicitly *not* a step toward removing that gate; it exists to make what reaches Anshuman better-reasoned and more complete, not to shrink his review surface.

### Tools / skills
- Same base kit as the Director (`Read`, `Grep`, `Glob`, `WebSearch`, `WebFetch`, `Write` scoped to `ops/legal/`) plus `Skill` access.
- Once installed: `legal:legal-risk-assessment` and `legal:compliance-check` are the closer fit here than for the Associate role — this is the seat actually producing risk-graded recommendations, which is what those two skills are for. Same caveat the Director's own file already states: neither skill provides India-specific DPDP/IT Act grounding — that grounding is this department's own research work regardless of which skill scaffolds the output format.
- Should have the standing instruction (mirroring the Director's own model note) that anything touching payments or cross-border transfer gets flagged for a manual higher-capability-model pass rather than treated as this seat's own final word, the same discipline the Director applies to itself in this very findings doc.

---

## 3. Specialist Counsel

### Mandate
The narrowest and most senior seat of the three — deep-dives on the two specific domains this findings doc had to flag as "recommend Opus review" rather than resolve outright: **cross-border data transfer** (DPDP §16 mechanics, tracking the eventual restricted-country notification, evaluating Groq/Sarvam/Clerk/Neon's actual data-processing terms once those exist as real contracts) and **payments/RBI e-mandate compliance** (the recurring vs. one-time billing design question flagged in Finding 5, and everything downstream of that decision once PhonePe integration actually starts). Rather than being a generalist third pair of hands, this seat exists specifically because those two areas were explicitly called out in the Director's own mandate as higher-stakes than routine review — Specialist Counsel is where that gets a dedicated, continuously-current owner instead of being re-derived from scratch each time it comes up.

This seat is the one that should exist *before* the PhonePe integration work starts (see Finding 5) — its first real deliverable, once built, should be the actual recurring-vs-one-time billing recommendation Finding 5 leaves open, researched in full ahead of any Tech pod work on the integration.

### Access tier
**Read-Only.** This is deliberate, not a placeholder: this seat's entire value is depth of research and correctness of the recommendation on exactly the two highest-stakes legal questions in the product, handed up for Anshuman's and (per the Director's own standing instruction) a manual Opus-level pass before anyone acts on it. There's no version of this seat's job that should involve drafting product-facing text directly — its output is a recommendation memo, full stop, same shape as Findings 4 and 5 in this review.

### Tools / skills
- `Read`, `Grep`, `Glob`, `WebSearch`, `WebFetch` — no `Write` initially. If the Director later finds this seat's memos need to live somewhere more structured than a single ad hoc doc, revisit then rather than granting Write by default now.
- Once installed: `legal:legal-risk-assessment` again fits (same caveat as above on India-specific grounding being this department's own work).
- Explicit standing instruction, carried over from the Director's own agent file rather than invented fresh: any finding touching payments or cross-border transfer is delivered as a flagged recommendation for manual Opus review, never as this seat's own final read, exactly as this document's Findings 4 and 5 were handled.

---

## Sequencing recommendation (not a decision — flagging for Anshuman)
If built one at a time rather than all three at once, I'd suggest **Compliance Associate first** — the data-map/retention work (Finding 3) is useful immediately and doesn't require deep legal judgment to start, whereas Senior Counsel and Specialist Counsel are more valuable once there's an Associate-maintained map and tracker for them to work from rather than each starting from a cold first-pass. Specialist Counsel is the one I'd most want in place before any PhonePe/payment code is written, given Finding 5 above — but that's Anshuman's call on timing, not mine to schedule.
