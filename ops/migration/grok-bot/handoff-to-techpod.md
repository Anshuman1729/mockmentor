# Handoff Template — Grok Bot → Claude Code Techpod

There is no live bridge between Grok Bot and Claude Code. Every piece of work that a Grok Bot
seat identifies as needing a code change reaches Techpod as one of these two things, never as a
live session join or an assumption that Techpod "already knows":

1. A **GitHub issue** on `Anshuman1729/mockmentor`, or
2. A **written brief file** under `ops/` that Anshuman/Geet hands to a Claude Code session
   (e.g. by pasting it as the opening prompt, the same way this migration pack itself is meant
   to be read by whoever picks it up next).

Either way, use this shape — it's what a Claude Code `planner`/`pm` seat actually needs to turn
a request into a real spec without a back-and-forth.

## Template

```markdown
## What
[One or two sentences: what should change, in plain terms — not code, not file paths unless
you (the Grok Bot seat) already know them from a prior Techpod handoff.]

## Why
[The actual problem or opportunity this addresses. Cite the source — a real user report, a
Salty/Mendi finding, an Anshuman ask relayed through Chief of Staff. Vague "would be nice"
requests without a why get deprioritized; say so if that's genuinely all this is.]

## Who asked / where this came from
[Grok Bot seat name + date, or "Anshuman via Chief of Staff, [date]". Techpod should be able to
trace this back to a real conversation if it needs more context later — since there's no live
bridge, missing provenance here is a dead end, not something Techpod can just go ask Grok Bot.]

## What "done" looks like
[Concrete and checkable. "Users can see X" or "Y no longer happens" — not "improve Z".]

## What this explicitly does NOT include
[Scope boundary — the same discipline PM's own spec template already uses. Prevents Techpod
from either under- or over-building relative to what was actually asked.]

## Urgency / gating
[Is this Article II-gated in any way (touches pricing, legal copy, hire_probability exposure,
prod DB)? If yes, say so explicitly — Techpod's Reviewer will refuse to merge without Anshuman's
direct sign-off regardless, but flagging it up front saves a review round.]
```

## Notes

- Grok Bot seats should never estimate engineering effort or propose an implementation approach
  — that's Planner's job once the handoff lands in Claude Code, not something decided upstream
  without seeing the actual codebase.
- If a Grok Bot seat is unsure whether something is small enough for a direct fix or needs a
  real spec, default to writing the fuller template above — Techpod's `pm` seat can always scope
  it down; it can't scope up from a one-line ask with no context.
- Nothing about this template changes Techpod's own internal process
  (Planner → Coder → Tester → Debugger → Reviewer, feature branch + PR, Reviewer sign-off before
  merge) — this is purely the intake shape from outside the repo.
