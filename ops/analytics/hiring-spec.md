# Analytics — Hiring Spec (Phase 1 Proposal)

**Author**: Director of Analytics
**Status**: Proposal only — not a build. Per BACKLOG.md ("Still open: Phase 1+... waits on Anshuman reviewing each head's Phase 0 hiring spec first") and the Article II gate list (hiring, and anything that legally binds the company, is always gated to Anshuman directly), none of the three seats below get built, and no `.claude/agents/*.md` file gets created for them, until Anshuman reviews and approves this document. This file describes what each seat *would* look like if approved — it is written in the same descriptive style as `.claude/agents/director-of-analytics.md` and `.claude/agents/director-of-compliance.md` so it can be turned into a real agent file with minimal rewriting, but it is not itself one.

Per `docs/autonomy-charter.md`'s org map, Analytics' Phase 1 seats are: Junior Analyst, Senior Analyst, Data Engineer — all reporting to Director of Analytics, who continues to report to Chief of Staff.

---

## Junior Analyst

### Reports to
Director of Analytics.

### Mandate
Answer well-scoped, already-framed funnel/metric questions — "what's the landing→signup conversion rate this week," "how many `session_completed` events fired by `round_type` in the last 30 days" — by writing and running the SQL/Mixpanel queries and presenting the numbers. Does not decide what questions matter or interpret what a number means for the product; that's Senior Analyst's and Director of Analytics' job. This is the seat that turns a question already asked into an answered one, quickly and correctly, not the seat that asks the question.

### Access tier
**Read-Only.** No write tools of any kind — produces a query result and a short writeup, nothing else. This is the correct floor for a first hire in a seat that's new, unproven, and working with data that (per Article II) can never expose `hire_probability`/BARS internals — a Read-Only seat structurally cannot make that mistake in a way that reaches a user, since it has no path to touch user-facing anything.

### What tools/skills they'd need
- `Read`, `Grep`, `Glob` — read source to understand what an event/property actually means before querying it (this review found real gaps between what BACKLOG.md claimed and what the code did; a Junior Analyst needs the same habit of checking source, not just trusting docs).
- `Bash`, scoped to this repo's existing read-only scripts (`npm run analytics:baseline` and anything else already in `scripts/`) — same hard personal rule as Director of Analytics: never a write/migration/schema command, enforced by instruction not by the tool allowlist.
- Once installed: `data:sql-queries` (marketplace skill, not yet installed) is the closest fit for this seat's actual day-to-day — read-only query construction against a known schema.
- No `Write` — findings get reported back to Director of Analytics in-conversation or via whatever handoff mechanism Director of Analytics specifies per-task, not published as standalone digests. (If in practice this seat needs to leave a file trail, the smallest safe grant is `Write` scoped to a `ops/analytics/queries/` subfolder, not the digests folder Director of Analytics owns.)

---

## Senior Analyst

### Reports to
Director of Analytics.

### Mandate
Own root-cause analysis on funnel/retention questions that don't have an obvious answer yet — not "what's the number" but "why did the number move, and what does the event data actually support as an explanation." Reviews and can push back on Junior Analyst's query framing before a number gets reported up. Also owns a piece of Director of Analytics' standing mandate: flagging when the underlying data can't actually support the conclusion being asked for (the same "is this trustworthy" instinct this review applied to `is_test` filtering and live-vs-code-complete event status) — this is a delegated slice of that judgment, not just faster querying.

### Access tier
**Write**, for documentation only — same scope Director of Analytics itself operates under. Can draft an analysis writeup, a proposed digest section, a recommended taxonomy fix (e.g. the tense-inconsistency or `is_test`-gap findings in this session's digest) — but a draft is as far as it goes. Nothing this seat writes ships, merges, or changes product code, schema, or a live dashboard without Director of Analytics' and/or Chief of Staff's sign-off, per the same tier definition the charter gives every Write seat ("nothing it produces goes live, sends, spends, or merges without Anshuman" — read through this org's chain, that means without the tier above approving first, and Anshuman for anything Article II).

### What tools/skills they'd need
- Everything Junior Analyst has, plus `Write` scoped to `ops/analytics/` (drafts/analysis only, same restriction Director of Analytics operates under re: app/lib/components/scripts code).
- Once installed: `data:analyze` and `data:statistical-analysis` (marketplace skills, not yet installed) — this seat is where actual statistical rigor (significance, not just "the number went up") would matter most; Director of Analytics' own first-pass review today is descriptive, not statistical.
- `dataviz` skill, same as Director of Analytics — for any chart this seat produces as part of a root-cause writeup, so output stays visually consistent with the Director's digests rather than introducing a second visual language.

---

## Data Engineer

### Reports to
Director of Analytics.

### Mandate
Owns the plumbing the two analyst seats depend on: the correctness and reliability of the event pipeline itself (this review's entire subject — `lib/analytics.ts`, `lib/analytics-client.ts`, `MixpanelProvider`, every `track()` call site), plus schema/migration proposals for anything analytics needs from the product database (e.g. the `qa_pairs.seed_question_id`/`calibration_loops` pattern already in this codebase, which is exactly the kind of thing this seat would have driven). Distinct from Coder/Debugger on the Tech pod: this seat's proposals are analytics-schema-driven (what does a trustworthy funnel need to exist), not feature-driven, even though the actual DB tables are shared with the product.

### Access tier
**Write**, for documentation/proposals only, same as Senior Analyst above — explicitly **not** Full-Auto, and explicitly barred from ever executing a production database write, schema change, or destructive operation directly, per Article II ("Production database writes, schema changes, or any destructive data operation" is always gated to Anshuman, with no tier exception — this line applies to every seat regardless of who's asking, this one most of all given the role's name). In practice: this seat drafts a migration (as a file, a plan, a PR description) and hands it to the Tech pod (Coder/Reviewer) or Anshuman to actually run — it never runs `ALTER TABLE`, `INSERT`, `UPDATE`, or `DELETE` against a real database itself, mirroring the same hard personal rule Director of Analytics already operates under with `Bash`.

### What tools/skills they'd need
- `Read`, `Grep`, `Glob` — same as the analyst seats, for reading the existing schema/pipeline before proposing a change to it.
- `Write`, scoped to drafting migration files/schema-change proposals (not running them) and to `ops/analytics/` for proposal writeups.
- `Bash`, same read-only restriction as Director of Analytics — for running existing read-oriented scripts (`npm run analytics:baseline`, `npm run test:debrief`, etc.) to verify a pipeline claim empirically, never for a write/migration/schema command.
- Once installed: `data:sql-queries` for query drafting during investigation (same as Junior Analyst); no other marketplace skill maps cleanly to this seat's actual job (pipeline reliability + schema proposals) — this may be a real gap worth flagging back to whoever evaluates the marketplace next, not something to force-fit onto an existing skill.

---

## Notes for review

- All three seats sit **below** the Write tier's ceiling that Director of Analytics itself currently operates under during Phase 0's temporary elevation — none of them get Full-Auto, and none of them get the Article II exceptions Director of Analytics doesn't have either. Nothing here proposes loosening any gate.
- The clearest ROI ordering if these get approved one at a time rather than all three together: **Junior Analyst first** (lowest risk, immediate leverage on the backlog of "what's the number" questions this Phase 0 digest didn't have time to run against live data), **Data Engineer second** (the `is_test`/pipeline-correctness gaps this digest surfaced are exactly this seat's mandate, and they compound the longer they sit unfixed), **Senior Analyst third** (root-cause judgment is most valuable once there's a larger volume of Junior-Analyst-produced numbers to actually rootcause).
- This spec does not request any new MCP connector or external-system credential for any of the three seats — consistent with the charter's existing rule that no automated seat holds real external-system access.
