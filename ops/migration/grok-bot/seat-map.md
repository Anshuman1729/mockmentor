# Seat Map — Claude Code → Grok Bot

Every seat that exists today as a `.claude/agents/*.md` file, or already exists on Grok Bot, and
where it lives after this migration. "Recreate (phased)" means: not done now, only build it on
Grok Bot if/when Anshuman decides Staff actually needs that head live — this pack does not
execute anything beyond the Chief of Staff brief (`cos-grok-bot-brief.md`).

## Techpod — stays on Claude Code, never duplicated on Grok Bot

| Seat | File | Why it never moves |
|---|---|---|
| Planner | `.claude/agents/planner.md` | Owns the technical plan/architecture — needs live repo read access |
| Coder | `.claude/agents/coder.md` | Writes and commits code — needs a real git checkout |
| Tester | `.claude/agents/tester.md` | Runs the actual test suite (`npm run test`, `tsc`, `eslint`) |
| Debugger | `.claude/agents/debugger.md` | Fixes failing tests Tester flags — same repo-access requirement |
| Reviewer | `.claude/agents/reviewer.md` | Final gate before merge — Article II requires Reviewer sign-off for any merge to `main`, which only exists as a Claude Code/GitHub mechanism |

## Leadership — recreate on Grok Bot (phased)

| Seat | File | Status | Notes |
|---|---|---|---|
| Chief of Staff | `.claude/agents/chief-of-staff.md` | **Recreate on Grok Bot — NOW** | See `cos-grok-bot-brief.md`. Claude Code's version becomes historical (header marked, not deleted). |
| VP Product | `.claude/agents/vp-product.md` | Recreate (phased) | Only if Staff needs live cross-feature coherence reads; SPM/PM/APM chain underneath it is a separate, larger question — not addressed by this pack |
| Director of Analytics | `.claude/agents/director-of-analytics.md` | Recreate (phased) | Only if Staff needs live funnel/root-cause reads |
| Director of Compliance | `.claude/agents/director-of-compliance.md` | Recreate (phased) | Only if Staff needs live compliance-risk reads |
| Sales Head | `.claude/agents/sales-head.md` | Recreate (phased) | Phase 3 seat originally (gated on Monetisation shipping) — that gating still applies regardless of platform |
| VP of Monetization | `.claude/agents/vp-of-monetization.md` | Recreate (phased) | Phase 4 seat originally — same gating logic |

## Already on Grok Bot — do not recreate

| Grok Bot teammate | Role | Notes |
|---|---|---|
| Salty | Product research | Closest existing overlap: `.claude/agents/vp-product.md`'s research-adjacent scope, but not a 1:1 — treat as its own Grok Bot-native seat |
| Mendi | Head of Marketing | Overlaps `.claude/agents/marketing-director.md`'s mandate — Grok Bot version is now the live one |
| Tamy | Content | New department-of-one under Marketing; no Claude Code equivalent existed |
| Saad | Outreach | New; no Claude Code equivalent existed |
| Aliya | Growth Ops | New; no Claude Code equivalent existed |
| Geet | Docs (reports to Anshuman, not under Marketing) | New; no Claude Code equivalent existed — also now the org map/Drive-checklist owner for the leadership side of this migration |

## Not recreated anywhere, for now

| Seat | File | Why |
|---|---|---|
| Compliance Associate, Senior Compliance Counsel, Specialist Counsel | `.claude/agents/compliance-associate.md`, `senior-compliance-counsel.md`, `specialist-counsel.md` | Reports of Director of Compliance, which itself is only phased-recreate — no reason to build the reports before the head |
| Junior Analyst, Senior Analyst, Data Engineer | `.claude/agents/junior-analyst.md`, `senior-analyst.md`, `data-engineer.md` | Reports of Director of Analytics, same logic |
| SPM, PM, APM | `.claude/agents/spm.md`, `pm.md`, `apm.md` | Reports of VP Product. Note: PM in particular sits close to Techpod (it coordinates Planner/Coder/Tester/Debugger/Reviewer directly per its own mandate) — if VP Product is ever recreated on Grok Bot, PM specifically may be better kept as a Claude Code seat that Grok Bot's VP Product hands written specs to, rather than moved. Flagging now, not deciding. |

## Reporting shape carries over unchanged

Recreating a head on Grok Bot does not change who reports to whom — `docs/autonomy-charter.md`'s
org map (Legal and Analytics non-flat, Product's SPM/PM/APM chain) is the source of truth
regardless of which platform a seat eventually runs on. This pack does not revise that map.
