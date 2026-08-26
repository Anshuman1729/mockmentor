# Behavioral Psychology Principles for UX

Six principles, each with a mechanism and a concrete rule. Apply them to onboarding, signup, checkout, upgrade, and pricing flows specifically — they matter most wherever a flow is asking the user to make a decision or take an action.

## 1. Smart defaults (decision fatigue)

**Mechanism:** every empty field in a form is a decision the user has to make before anything happens. Stacking several decisions at once measurably increases the chance someone makes no decision at all and abandons the flow. In most products, the large majority of users never change a pre-filled value — that's not laziness, it's the user reading the default as a recommendation ("this is what most people pick").

**Rule:** pre-select the most common or most likely-correct value for every field you can reasonably predict. Shift the user's task from "fill this out from scratch" to "scan and adjust what doesn't fit" — a fundamentally easier task than a blank form.

**Applies to:** any form, filter set, or configuration screen where you can infer a sensible default from context, prior answers, or aggregate behavior.

## 2. The goal-gradient effect (never start at 0%)

**Mechanism:** motivation to finish something increases the closer people feel to the finish line — this is measurable even when the actual remaining work is identical. A progress indicator that starts at 0% communicates "you haven't started and there's a lot ahead," which is deflating regardless of how much work is actually left.

**Rule:** never show a user's progress starting at zero if you can honestly credit them for something already true — an account they created, a preference they set, a first small action they took. Frame that as step one of the journey rather than a separate prerequisite event. The framing costs nothing extra to build; it just changes where the starting line is drawn.

**Applies to:** onboarding flows, profile completion, any multi-step setup process, loyalty/progress mechanics.

## 3. Reciprocity (give value before asking for signup)

**Mechanism:** when someone receives something of real value first, they feel a pull to reciprocate. This is one of the most consistently documented drivers of behavior in persuasion research, and it's why free samples and free trials work as well as they do — receiving something creates an unconscious sense of obligation, even when the thing received is small.

**Rule:** don't gate all value behind account creation. Let the user get a real, if partial, result first (a partial report, a completed first step, a working preview) — then ask for signup to unlock the rest. A wall that appears before any value has been delivered reads as "give me something before I've given you anything," which is a much harder ask than it needs to be.

**Applies to:** any product where a free scan/analysis/preview/trial is possible before requiring an account — the ask should come after value, not before.

## 4. Investment before the ask (IKEA effect / endowment effect)

**Mechanism:** people value things more when they've put effort into creating them, even if the result is objectively no different from something premade. A weaker version of the same effect applies just to the feeling of ownership, without any real effort: merely feeling like something is "yours" increases how much you value it and how reluctant you are to lose it.

**Rule:** where possible, let users make a few real choices — a name, a style, a first customization, a first completed action — *before* the signup screen appears. By the time the account-creation step shows up, leaving doesn't feel like skipping an empty form; it feels like abandoning something they already made. A signup screen with nothing built up before it (just email + password) is the easiest possible screen to close.

**Applies to:** product setup/customization flows, any flow where the user can make meaningful choices before you need their identity.

## 5. Loss aversion and status-quo bias (frame around what's lost)

**Mechanism:** the psychological pain of losing something is measurably stronger than the pleasure of gaining an equivalent thing. A pitch that frames an action purely as a gain ("upgrade for more storage") carries less weight than a frame that makes concrete what the user stands to lose by not acting (specific files, at risk, on a visible timeline).

**Rule:** for actions where you genuinely need the user to act (a real deadline, a real consequence of inaction), frame the stakes around what's lost, not just what's gained — and make the "lost" state concrete and specific rather than abstract.

**Use this carefully and honestly.** This is about making a real cost visible and legible, not about inventing a fake one. If there's no real consequence to inaction, don't manufacture urgency — that crosses from persuasive design into a dark pattern, and users notice.

**Applies to:** genuine limited-time actions, real data-loss or access-loss scenarios, real deadlines — never invented ones.

## 6. The contrast effect (never show a cost in isolation)

**Mechanism:** people don't evaluate a price or cost in absolute terms — they evaluate it relative to whatever they saw immediately before it. The same number can register as expensive or negligible purely based on what preceded it in the flow.

**Rule:** control what the user sees immediately before a price or a consequential decision. A cost shown right after a much larger number (e.g., an add-on shown right after a large purchase, rather than on its own page) will be judged far more favorably, with no change to the offer itself.

**Applies to:** add-ons, protection plans, upsells, and any secondary pricing decision — sequence and context matter as much as the number itself.
