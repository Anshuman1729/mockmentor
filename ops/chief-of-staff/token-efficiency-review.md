# Token Efficiency Review — 2026-08-28

Self-review of this persistent Chief of Staff session's own usage pattern today, per Anshuman's
request (individual Pro plan — parallel agent fan-outs burn tokens fast, wants this optimized).
Grounded in what actually happened today, not a generic efficiency essay.

## Finding 1 (highest leverage): every dispatched session re-reads CLAUDE.md + autonomy-charter.md cold

Today alone: Tech Pod Phase 1, the 4-way PMF fan-out (Product/Analytics/Marketing/Sales), org phase 1
(twice — spec-writing pass, then the build pass), and org phase 2 each independently read `CLAUDE.md`
in full and `docs/autonomy-charter.md` in full before doing anything else — that's 8+ full reads of
two large documents today, each one paid fresh because a new session/subagent has no memory of any
other session's read. `CLAUDE.md` alone carries the full PRD status history, metric benchmarks, and
years of accumulated decisions — most of which is irrelevant to, say, Compliance Associate writing a
data map.

**Recommendation:** create a trimmed `docs/agent-context.md` — the subset every dispatched seat
actually needs (Article II list, access tier definitions, the org map, the non-negotiable rules) —
and point dispatch prompts at that instead of "read CLAUDE.md and autonomy-charter.md in full."
Full-file reads stay available for anyone who genuinely needs the history. This is the single
biggest lever found today, because it's paid on every dispatch, not once.

## Finding 2: failed tool retries burned real tokens for zero value today

This session hit MCP connection churn (server IDs rotating mid-conversation) and retried the same
blocked call 3-4 times in a row on two separate occasions before stopping to report status instead.
Each failed call still costs a full request/response round-trip. The eventual correction (stop
retrying blind, report the blocker plainly, let the user redirect) was right — it just came a few
retries too late both times.

**Recommendation:** standing rule for this session — if the same tool call fails twice with the
same class of error (`No such tool available`, `requires approval`, `not reachable`), stop and
report rather than retry a third time. A third identical retry is never going to succeed where the
first two didn't; it's pure waste.

## Finding 3: parallel fan-out was justified once today, would be waste as a default

The 4-way PMF fan-out (Product, Analytics, Marketing, Sales running simultaneously, blind to each
other) is defensible specifically because the *independence itself* was the point — the finding that
three departments converged on the same audience without seeing each other's work is real evidence,
and running them sequentially or feeding one department's output to the next would have destroyed
that signal. That's a genuine case where 4x the base dispatch cost bought something a cheaper
approach couldn't.

But that's the exception, not the pattern to default to. Org phase 1 and phase 2 were each a single
well-scoped dispatch, not a fan-out — correctly, since nothing there needed independent blind reads.

**Recommendation:** reserve multi-agent parallel fan-out for cases where independence is itself
load-bearing (like the PMF convergence check). Default to a single well-scoped dispatch otherwise —
it was already the pattern for org phase 1/2 today, worth keeping deliberate rather than drifting
into "fan out by default because it's thorough."

## Finding 4: designed artifacts are real spend — worth it twice today, not a default

Building the PMF plan and the hiring-review pages as fully designed HTML artifacts (custom CSS,
typography, layout) costs meaningfully more than writing the same content as a markdown doc in
`ops/`. Both earned it today — Anshuman engaged directly with specific details in each (asked
follow-up questions naming the funnel table and the formulas section specifically), meaning the
polish bought real usability on a document he was actually going to reference and act on.

**Recommendation:** keep markdown-in-`ops/` as the default for internal handoffs and status docs
(this very file is one) — reserve a designed artifact for documents Anshuman is actually going to
reread, reference, or potentially share, not every deliverable by default.

## Finding 5 (confirmed working, no change needed): model choice

Checked every seat built or dispatched today — all Sonnet, none elevated to Opus, consistent with
`chief-of-staff.md`'s standing "no seat gets a more expensive model by default" rule. This one's
actually working as intended; noting it rather than assuming it silently.

## Not found: duplicated or overlapping subagent work

Each of today's dispatches had a distinct, non-overlapping scope — no case found today of two
subagents redoing the same investigation. Worth keeping an eye on as the org grows (more seats
means more chances for scope overlap), but nothing to fix today.

## Summary — two things worth doing, ranked

1. **Build the trimmed context doc (Finding 1).** Real, recurring, compounds with every future
   dispatch as the org grows — this is where the actual savings are.
2. **Adopt the two-strikes-then-report rule on tool failures (Finding 2).** Cheap to adopt, prevents
   exactly the kind of waste that happened twice today.

Findings 3-5 are judgment calls to keep making deliberately, not process changes to build.
