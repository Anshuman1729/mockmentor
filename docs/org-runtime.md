# Org Runtime — Where Each Part of the Org Actually Runs

Quick pointer doc. `docs/autonomy-charter.md` still owns the org *shape* (who reports to whom,
access tiers, Article II gate list) — this doc only says which platform each part runs on, since
that split is no longer "everything on Claude Code" as of 2026-09-06.

| Layer | Runtime | Detail |
|---|---|---|
| **Leadership** (Chief of Staff; any phased-recreate department head) | **Grok Bot** | See `ops/migration/grok-bot/` |
| **Marketing pod, Product research, Docs** (Mendi/Tamy/Saad/Aliya, Salty, Geet) | **Grok Bot** | Already live there; not migrated from Claude Code |
| **Tech pod** (Planner, Coder, Tester, Debugger, Reviewer) | **Claude Code** | Permanent — see `ops/migration/grok-bot/README.md`'s platform map for why |
| **Cloud/ad-hoc repo implementation work** | **Cursor cloud agents** (where used) or Claude Code sessions | Never Grok Bot |

Full migration rationale, seat-by-seat mapping, and the cutover sequence: `ops/migration/grok-bot/`.

Cross-platform handoff rule, in one line: **Grok Bot decides and specs; Claude Code Techpod
builds; the handoff is always a written artifact (GitHub issue or `ops/` file), never a live
session join** — there is no sync, webhook, or bridge between the two platforms.
