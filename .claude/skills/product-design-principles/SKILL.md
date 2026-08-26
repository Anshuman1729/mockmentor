---
name: product-design-principles
description: Guides UI/UX and product design work so it feels intentional and polished instead of generic AI output. Covers a reference-driven, design-system-first workflow plus research-backed behavioral psychology and gamification patterns. Use this whenever building or reviewing a landing page, onboarding flow, signup/paywall, pricing page, dashboard, settings screen, or any new app UI — and especially when the user says a design "looks generic", "feels AI-generated", "needs more polish", "doesn't feel professional", or asks how to improve conversion, signups, retention, or engagement. Also use it whenever a feature involves points, streaks, badges, leaderboards, or other gamification mechanics, even if the user doesn't use the word "gamification" — e.g. "add a streak counter" or "how do we make practice sessions feel more rewarding".
---

# Product Design Principles

## Why this exists

The most common reason an AI-generated (or quickly-built) UI looks generic isn't a weak prompt — it's that it was designed from imagination instead of from precedent, and screen-by-screen instead of from a system. Fix the process, not just the prompt.

This skill has three parts. Use part 1 and 2 for *any* UI work. Use part 3 only when the feature actually involves engagement/gamification mechanics.

## 1. Design from real reference, not imagination

Before implementing a new screen, flow, or component, spend a step gathering real precedent rather than inventing from scratch. This applies especially to three situations:

- **Building something from zero** (a new screen, a new flow) — look at how successful, comparable products solve the same problem before writing your own version.
- **Stuck on a UX decision** you can't reason your way through in the abstract (how should this onboarding flow be structured? is this pricing page too aggressive?) — find real examples instead of debating it internally.
- **A UI that "isn't broken" but feels dated** — nothing is obviously wrong, but it lacks the polish of modern apps. Pull current patterns from category-leading apps and diff your screen against them explicitly (what to borrow, what to avoid).

How to gather reference, in priority order:
1. If a design-reference tool is available (an MCP server for browsing real app UI, screenshots the user provides, or a design-canvas/inspiration tool), use it to pull actual screens from comparable or competing products.
2. Otherwise, reason from well-documented, specific real-world patterns (name actual products and what they do), not from a vague "best practice" — specificity is what separates a grounded recommendation from a generic one.
3. State explicitly what to borrow and what to avoid — the "avoid" list is just as valuable as the "borrow" list, since it's usually where competitors have visibly struggled.

## 2. Build the design system before the screens

Don't iterate screen-by-screen — that's what produces inconsistent, generic-feeling output even when each individual screen looks fine in isolation. Instead:

1. Establish (or extract from a reference image/site) a design system: color palette, typography scale, spacing/radius scale, motion/elevation language, iconography style.
2. Apply that system consistently to every surface the product touches — marketing pages, in-app screens, emails, social/marketing assets — so they read as one product rather than independently-styled pieces.
3. When refining an existing UI, prefer "reapply the system to this screen" over "restyle this screen" — the goal is convergence toward one consistent language, not a one-off improvement.

If the project already has a design system or component library, extend and reuse it rather than introducing a parallel one.

## 3. Apply behavioral psychology to flows deliberately

Six specific, research-backed principles change how users experience a flow — each with a concrete rule, not just a concept. Read `references/psychology-principles.md` for the full detail (the mechanism behind each one, and a before/after pattern) before applying them to an onboarding flow, signup, checkout, or paywall design.

Use these ethically: they're about reducing friction and communicating real value, not about manufacturing false urgency or hiding information the user needs to make a real decision. If a technique would only work by deceiving the user (fake scarcity, hidden costs, disguised unsubscribe flows), don't apply it — that's a dark pattern, not persuasive design.

## 4. Gamification: only if the feature actually needs it

If a task involves points, badges, streaks, leaderboards, levels, or similar mechanics, read `references/gamification-patterns.md` first. The short version: the mechanics every product reaches for first (points/badges/leaderboards) are also the most commonly reverted in industry history, because they reward attention rather than the behavior the product actually needs. The patterns that hold up long-term look different — read the reference file for what to do instead and why.

## Quick self-check before calling a design "done"

- Did I look at real precedent, or did I just imagine what "good" looks like?
- Does this screen use the same system (color/type/spacing/motion) as the rest of the product, or did I restyle it in isolation?
- If this is a flow that asks something of the user (signup, upgrade, a big action), have I applied any of the relevant psychology principles, and would I be comfortable explaining the reasoning to the user?
- If this involves gamification, am I rewarding real competence/progress, or just engagement theater?
