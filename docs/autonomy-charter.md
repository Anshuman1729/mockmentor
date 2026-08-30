# The Autonomy Charter

How work gets delegated across PrepSignals as a one-person company: what each seat can decide on its own, and what always comes back to Anshuman. This is the versioned source of truth; a designed presentation of the same content was published as an artifact during the session this was built in — this file is what future sessions in this repo should actually read.

## Reaching Chief of Staff

Two confirmed access surfaces:

- **Persistent Claude Code Remote session** — reachable from any device via claude.ai/code, no laptop or active terminal required. Full conversation memory within the session (re-derives dynamic state — git/`ops/`/PRs/`BACKLOG.md` — fresh every turn per its own file, per its durable-state principle; trusts static reference material only once, at session start).
- **Daily push-notified check-in (Routine)** — fires into a fresh session each day, reads the same state, surfaces anything pending as an explicit decision, pushes a notification. No persistent memory across days by design — the persistent session above is where continuity lives.

**Slack — investigated, not available.** Claude Tag (Claude in Slack) would have been the real mechanism for a live "@-mention Chief of Staff in Slack" experience — not a member account with its own email, which was the original (incorrect) mental model. It's Enterprise-plan only; PrepSignals runs on an Individual plan, so this is closed for now, not unresolved. Revisit only if the plan tier changes — don't re-investigate the mechanism from scratch, it's already known (Claude admin console install, `@Claude` mention in-channel; whether it supports a fixed custom persona or repo-scoping was never confirmed before the plan-tier blocker ended the investigation).

**A Telegram/Discord-style bot bridge — considered, declined on cost.** Technically real (a small self-hosted service calling the Anthropic API directly, bridged to a messaging platform's bot API), but it's infrastructure outside everything else here: its own hosting, its own separately-billed Anthropic API key, and its own GitHub credential if it needs live repo state — none of it covered by existing Claude usage. Declined specifically for that added standalone cost, not for a technical reason. If cost stops being the blocker, this is the option to revisit; the two surfaces above are what's actually active in the meantime.

## Access tiers

- **Read-Only** — no write tools. Produces a review, a recommendation, a risk flag — never touches anything itself.
- **Write** — can draft (code on a branch, a memo, an email, a policy line). Nothing it produces goes live, sends, spends, or merges without Anshuman.
- **Full-Auto** — completes a routine, reversible, internal loop end to end without a check-in at every step. Still cannot cross into the Article II list below. That boundary is not a per-role setting; it's fixed.

## Article II — always gated

Blocked for Anshuman directly, no matter which seat or tier is asking:

- Real money leaves the business (ad spend, tool subscriptions, any paid campaign)
- A message reaches a real external person (a cold email/DM actually sent, a social post published, a reply to a real user)
- Anything legal — ToS/Privacy Policy changes, filings, contracts, compliance claims made on the record
- Pricing changes
- Production database writes, schema changes, or any destructive data operation
- A push to `main`, or a merge without the Reviewer's sign-off
- Any user-facing copy referencing `hire_probability`, BARS scoring, or rubric internals — the existing non-negotiable rule from `CLAUDE.md`, not re-litigated per department
- Hiring, contracts with real people, anything that legally binds the company

Full-Auto never overrides this list.

## Org map

Chief of Staff sits between Anshuman and every department head — heads report to Chief of Staff, not directly to Anshuman.

| Department | Phase | Seats |
|---|---|---|
| Chief of Staff | 0 — now | Chief of Staff |
| Tech | 0 — now | Planner, Coder, Tester, Debugger, Reviewer |
| Legal | 1 — now | Director of Compliance, Compliance Associate, Senior Compliance Counsel, Specialist Counsel |
| Analytics | 1 — now | Director of Analytics, Junior Analyst, Senior Analyst, Data Engineer |
| Product | 2 — now | VP Product, SPM, PM, APM |
| Marketing | 3 (gated on Monetisation shipping) | Marketing Director, Analyst, Social Media Manager, Outreach Manager, Paid Ads Manager |
| Sales — Institutional | 3 (gated on Monetisation shipping) | Sales Head, Institutional BD Associate, Institutional Outreach Manager, Qualifier |
| Lifecycle | 4 (follows Phase 3) | VP of Monetization, Lifecycle Manager, Lifecycle Associate |

Business (Associate → Director) as originally proposed is folded into Product + Analytics rather than run as a ninth department — it duplicated both without adding a distinct read.

**Legal and Analytics are not flat.** Both hiring specs (`ops/legal/hiring-spec.md`, `ops/analytics/hiring-spec.md`) originally proposed all three reportees flat to their Director — Anshuman rejected that as an unfair review structure and overload on a single Director reviewing three reports directly. Approved instead:

```
Director of Compliance                    Director of Analytics
├── Senior Compliance Counsel              ├── Senior Analyst
│   └── Compliance Associate               │   └── Junior Analyst
└── Specialist Counsel                     └── Data Engineer
```

- **Legal:** Compliance Associate → Senior Compliance Counsel → Director of Compliance. Specialist Counsel → Director of Compliance directly.
- **Analytics:** Junior Analyst → Senior Analyst → Director of Analytics. Data Engineer → Director of Analytics directly.

Build order (the sequence these seats were actually built in, distinct from the reporting chain above): Legal — Compliance Associate → Specialist Counsel → Senior Compliance Counsel. Analytics — Junior Analyst → Data Engineer → Senior Analyst.

**Product is not flat either, for its own reason — approved as proposed, not overridden.** VP Product's hiring spec (`ops/product/hiring-spec.md`) proposed a partial chain rather than defaulting to the flat precedent, and Anshuman approved it exactly as written:

```
VP Product
├── SPM  (direct report)
└── PM   (direct report)
      └── APM  (reports to PM, not VP Product)
```

- **PM** owns single-feature ownership — the scope VP Product's own mandate explicitly excludes itself from ("coherence... not any single feature"). Under a flat structure nothing would force feature-level work through a coherence check before it reaches VP Product; a chain closes that gap.
- **APM** reports to PM, not VP Product: its output (competitive research, digest reads, mechanical cross-checking) is input to a PM-owned spec, not a coherence-level artifact ready for VP Product's read — the same way a raw finding needs a feature-owner's edit pass first.
- **SPM** is a direct report to VP Product, not a link in a PM→SPM→VP Product ladder — it's a second, senior report that does a first coherence pass across (eventually) multiple PMs' specs before VP Product's own roadmap-level read. Closer to "VP Product's deputy for coherence" than "PM's manager."

Access tiers, also approved as proposed: PM is Write (scoped to `ops/product/specs/`), APM is Read-Only, SPM is Write (scoped to `ops/product/`). None Full-Auto.

Build order (approved as proposed): **PM → APM → SPM** — see `ops/product/hiring-spec.md`'s sequencing section for the reasoning (PM closes the highest-priority gap immediately; APM's output has nowhere to go until PM exists; SPM is only load-bearing once there's more than one PM-track item in flight).

## Build sequence

**Phase 0 (built this session):** Chief of Staff + all 7 other department heads, temporarily elevated from Read-Only to Write since none has reports yet — each head's Phase 0 job is real first-pass work in its domain *plus* a hiring spec for its own team. Tech is the exception: Planner is Write by design (not elevated), and Reviewer ships alongside it as a fixed paired control rather than "a team lead who builds reports," since Planner's output needs a gate from day one.

**Phase 1+:** each head builds out its own reports, in this order — Tech's remaining seats first (done this session too, since the pipeline needs Coder/Tester/Debugger to be useful at all), then Legal + Analytics in parallel (no external blast radius, useful today), then Product, then Marketing + Institutional Sales (once Monetisation ships), then Lifecycle.

## Operating rule: persistent sessions don't self-refresh

A Claude Code Remote session's Agent-tool roster is fixed when that session's container
starts. If `.claude/agents/*.md` changes on `main` afterward — a new seat, an edited
mandate, a model swap — a persistent session created before that change will not pick it
up. Merging the PR is not enough; the session itself has to be recreated. This was found
the hard way: a persistent Chief of Staff session created before PR #30 merged still
couldn't invoke any of the 12 seats after the merge, because the session (not the repo)
was stale.

**Rule:** any time the agent-org files change on `main`, every persistent monitoring
session that already exists — Chief of Staff today, any future per-head session — gets
recreated, not just notified. Verify with a real invocation after recreating, not an
assumption that it now works.

## Seats, table by table

Full per-seat mandate, model, and skill assignment lives in `.claude/agents/*.md` — one file per built seat. This doc tracks the org shape and the gate; the agent files are the operational detail and are the ones that actually run.

## Skills

Two separate provisioning axes, deliberately kept apart: a **Skill** is a playbook/reference the agent can invoke (via the `Skill` tool); an **MCP connector** is live access to an external system (Gmail, Stripe, HubSpot, etc.). Marketplace plugins usually bundle both together — installing one for its skill does not mean wiring its MCP servers into any subagent's tool list. No automated seat gets real send-email, real ad-spend, or real payment access. Only the interactive session Anshuman is driving gets that, ever.

Currently referenced built-in skills: `internal-comms` (Chief of Staff), `code-review` + `security-review` (Reviewer), `product-design-principles` (all of Product — VP Product, SPM, PM, APM), `humanizer` (Marketing Director), `dataviz` (Director of Analytics).

Marketplace plugins identified but not installed (`legal`, `sales`, `marketing`, `operations`, `data`, `small-business` — all in the `knowledge-work-plugins` marketplace): referenced by name in the relevant agent files as closer-fit skills to adopt once installed. No India-specific DPDP/compliance skill exists on the marketplace as of this writing — Director of Compliance's India-law grounding is this repo's own work, not something bought off the shelf.
