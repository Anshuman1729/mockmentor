# Grok Bot Migration — Hybrid Runtime Map

**Decided by Anshuman, 2026-09-06:** Grok Bot runs every non-tech-build seat (leadership,
department heads, and Marketing's existing pods) as live, interacting teammates. Claude Code
keeps the Tech pod, permanently, for anything that touches this repository. This is a **hybrid**,
not a full-lift — nothing here moves Tech, and nothing here recreates Tech on Grok Bot.

This pack exists to make that split concrete and to give Anshuman/Geet paste-ready material for
the Grok Bot side. It does not and cannot create anything on Grok Bot itself — no session running
in this repo has access to that platform's UI or API.

## Why this split

The agent org built in this repo (`docs/autonomy-charter.md`) deliberately used file-based
`ops/<department>/` handoffs "rather than live agent-to-agent chat" — reasonable when nothing
existed yet, but it means department heads can't actually talk to each other or to Anshuman in
real time. Grok Bot's staff-room model (bots as live, interacting teammates) solves that gap
directly for leadership and non-code departments. It does **not** need to solve it for Tech,
which has a different, harder requirement: it has to actually read and write this git repository,
run `tsc`/`eslint`/tests, and open PRs — work Grok Bot cannot do from outside the repo.

## Platform map

| Layer | Runtime | Why |
|---|---|---|
| **Leadership** — Chief of Staff, and any department head recreated later (VP Product, Director of Analytics, Director of Compliance, Sales Head, VP of Monetization) | **Grok Bot** | Live staff-room interaction; synthesis/routing doesn't need repo access |
| **Marketing pod** — already-built Grok Bot teammates: Mendi (Head of Marketing), Tamy (Content), Saad (Outreach), Aliya (Growth Ops) | **Grok Bot** (already exists — not recreated here) | Already live; nothing to migrate |
| **Docs** — Geet | **Grok Bot** (already exists, reports to Anshuman directly, not under Marketing) | Already live; org map/Drive checklist owner |
| **Product research** — Salty | **Grok Bot** (already exists) | Already live |
| **Tech pod** — Planner, Coder, Tester, Debugger, Reviewer, and any future code-session seat under `.claude/agents/` | **Claude Code, permanently** | Only Claude Code sessions in this repo can read/write files, run the test suite, and open PRs against `main` |
| **Cloud/ad-hoc repo work** | **Cursor cloud agents** (where used) or Claude Code sessions | Never a Grok Bot "Coder" duplicate — repo implementation only ever happens in a tool that actually has the repo checked out |

## What does NOT happen

- Grok Bot does not get a Coder/Tester/Debugger/Reviewer/Planner analog. Ever. If a Grok Bot
  seat identifies a bug or a feature need, it produces a **written brief**, not code — see
  `handoff-to-techpod.md`.
- Claude Code (this repo) does not get a live chat layer between department heads. That
  capability now lives on Grok Bot. `ops/<department>/` folders stay as historical record and as
  the place Tech-relevant briefs land, not as the live collaboration surface.
- No sync, webhook, or bridge exists or is planned between Grok Bot and Claude Code. There is no
  technical mechanism for a Grok Bot bot to see this repo's state, or for a Claude Code session to
  post into a Grok Bot room. Every cross-platform handoff is a human (Anshuman or Geet) copying a
  written artifact from one place to the other, or a Grok Bot seat's output becoming a GitHub
  issue Tech then picks up.

## Cross-platform handoff, in one sentence

**Grok Bot decides and specs; Claude Code Techpod builds; the handoff between them is always a
written artifact (a GitHub issue or a file under `ops/`), never a live session join.**

See `handoff-to-techpod.md` for the template, `cutover-checklist.md` for the sequencing, and
`cos-grok-bot-brief.md` for the first thing to actually paste into Grok Bot.
