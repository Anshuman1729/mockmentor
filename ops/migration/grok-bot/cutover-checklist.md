# Cutover Checklist — Leadership → Grok Bot

Ordered steps for Anshuman/Geet. Nothing in this checklist can be executed by a Claude Code
session — every step is a human action in Grok Bot's UI, GitHub, or this repo's docs.

- [ ] **1. Create Chief of Staff on Grok Bot.** Paste the block from `cos-grok-bot-brief.md`
      into Grok Bot's agent-creation flow. Seat it in the Staff room alongside Salty, Mendi, and
      Geet.
- [ ] **2. Seat Chief of Staff in Staff room** so Mendi, Salty, and Geet report to it there —
      confirm Grok Bot's room/permission model actually reflects "these three report to CoS,
      CoS reports to Anshuman" the way `docs/autonomy-charter.md` describes for the Claude Code
      original. If Grok Bot's room model doesn't support a reporting hierarchy directly, at
      minimum document in Geet's org map who's expected to loop CoS in on what.
- [ ] **3. Run the Phase-0 stand-up.** Chief of Staff's first output is not a synthesis brief —
      it's the "which head next" recommendation described in `cos-grok-bot-brief.md`'s Phase-0
      note. Confirm this actually happened before treating Grok Bot CoS as live.
- [ ] **4. Take the first real briefs.** Salty (positioning + competitive) and Mendi (week-1
      ownership + distribution) hand Chief of Staff their briefs; Chief of Staff reconciles them
      into one ranked list for Anshuman. This is the first genuine test that synthesis+routing
      works on this platform.
- [ ] **5. Geet marks Claude Code's Chief of Staff retired.** Once steps 1-4 are confirmed
      working, Geet updates the org map/Drive checklist to show Grok Bot CoS as the live system
      of record for leadership. Claude Code's `chief-of-staff.md` file is not deleted (see
      `docs/org-runtime.md`) but is no longer where routing decisions happen.
- [ ] **6. (Only if/when needed) Recreate a phased department head.** Per `seat-map.md`'s
      "Recreate (phased)" list — VP Product, Director of Analytics, Director of Compliance,
      Sales Head, VP of Monetization — only when Staff actually needs that head live, not
      preemptively. Each one gets its own paste-ready brief the same way CoS did, distilled the
      same way from its `.claude/agents/*.md` file, with that seat's own Article II-relevant
      constraints preserved.
- [ ] **7. Never recreate Techpod.** Planner, Coder, Tester, Debugger, Reviewer stay Claude-Code
      only, permanently. If a future Grok Bot seat's brief ever proposes a Grok Bot "Coder" or
      similar, that's a design error — catch it before pasting, not after.

## What "done" looks like for this cutover

Grok Bot Chief of Staff is producing real weekly synthesis from live Grok Bot pods, Anshuman is
getting his ranked decisions from Grok Bot instead of a Claude Code session, and any code-shaped
finding from a Grok Bot pod is reaching Techpod as a written handoff (`handoff-to-techpod.md`) —
not being attempted inside Grok Bot, and not sitting unrouted.

## Rollback note

If Grok Bot's Chief of Staff turns out not to work as expected (synthesis is weak, routing
misses things, the Staff room reporting model doesn't hold), nothing here is destructive — the
Claude Code `chief-of-staff.md` file and this persistent session's own history are untouched and
can resume as the system of record. Reverting step 5 is just: Geet updates the org map back, and
this session's own historical context (`ops/chief-of-staff/`, `BACKLOG.md`, this repo's git log)
is still exactly where it was.
