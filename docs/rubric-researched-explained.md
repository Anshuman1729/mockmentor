# PrepSignals Scoring Engine — Complete Technical & Business Explainer

**File**: `lib/rubric-researched.ts`
**Audience**: Founder (self) + potential co-founder onboarding
**Purpose**: Understand every line, every decision, and the business reason behind it

---

## Table of Contents

1. [Why This File Exists — The Core Problem It Solves](#1-why-this-file-exists)
2. [TypeScript Types — The Building Blocks](#2-typescript-types)
3. [CONV_INTEL_CONFIG — Conversation Intelligence Thresholds](#3-conv_intel_config)
4. [INTERVIEW_RUBRIC — The 8 Scoring Signals](#4-interview_rubric)
5. [calculateNormalizedScore() — The Math Engine](#5-calculatenormalizedscore)
6. [How All Three Parts Connect](#6-how-all-three-parts-connect)
7. [Why This Architecture Is Defensible IP](#7-why-this-is-defensible-ip)
8. [What A Co-Founder Needs To Understand](#8-co-founder-summary)

---

## 1. Why This File Exists

### The Problem With AI-Only Scoring

Imagine you ask an LLM (like GPT or Llama): "Was this interview candidate good?" The LLM might say "yes, they seemed confident and articulate." But:

- What does "confident" mean numerically?
- Would a different LLM say something different?
- Could a candidate game it by just sounding enthusiastic?

This is called **vibe-based scoring** — subjective, inconsistent, un-auditable.

### PrepSignals's Solution: Evidence-First, Deterministic Scoring

This file is the antidote. It separates two concerns:

| Concern | Who handles it | Why |
|---|---|---|
| "What did the candidate actually say?" | LLM (Groq / Llama 3.3) | LLMs are great at reading text |
| "How good was it, numerically?" | This TypeScript file | Code is deterministic, auditable, consistent |

The LLM extracts **evidence** (verbatim quotes, signal ratings on a 1–5 scale).
This file takes those raw numbers and **calculates the final score**.
This means two candidates with identical interview transcripts will always get identical scores — no hallucination, no vibe drift.

### The Research Basis

The rubric is synthesized from:
- **BarRaiser** — interview intelligence platform used by top-tier tech companies
- **FloCareer** — structured interview platform with BARS methodology
- **Noota** — AI interview analysis tool
- **Cockroach Labs** — known for rigorous, structured hiring
- **Google/Amazon** — published structured interview guidelines

This means PrepSignals's scoring methodology is not invented — it's grounded in published, industry-validated frameworks.

---

## 2. TypeScript Types

TypeScript "types" are blueprints. They define the shape of data. Think of them like column headers in a spreadsheet — they tell you what every row must contain.

### `SignalLevel`

```typescript
export type SignalLevel = 1 | 2 | 3 | 4 | 5;
```

**Plain English**: A signal level can only be 1, 2, 3, 4, or 5 — nothing else. Not 0. Not 6. Not "good".

**Why**: Interview ratings on a 5-point scale are industry standard (BARS methodology). Even numbers (1, 2, 4) are intentionally excluded from anchor definitions — this forces raters (here, the LLM) to make a directional judgment rather than picking the middle.

**Business reason**: Prevents score inflation. If you allow 0–10, people gravitate toward 7. A 1–5 scale forces clearer signal.

---

### `BehavioralAnchor`

```typescript
export interface BehavioralAnchor {
  score: SignalLevel;    // The number (1, 3, or 5)
  label: string;         // A short human-readable name ("Proficient")
  criteria: string;      // The actual behavioral description
}
```

**Plain English**: A behavioral anchor is one row in a scoring rubric. It says: "If a candidate does THIS, give them THIS score."

**Example from the code**:
```
score: 3, label: "Proficient", criteria: "Uses correct jargon; explains 'how' things work but misses 'why'."
```

**Why anchors matter**: Without anchors, "3/5" means nothing. With anchors, "3/5 on Technical Depth" means "they know the terms but can't explain design decisions." This is called **BARS — Behaviorally Anchored Rating Scales** — a 1960s psychology methodology proven to reduce inter-rater bias.

**Business reason**: If you hire human interviewers later, or if you show scores to candidates, anchors make the score legible and defensible.

---

### `SignalParameter`

```typescript
export interface SignalParameter {
  id: string;       // Machine identifier ("TECHNICAL_DEPTH")
  name: string;     // Human-readable name ("Technical Depth & Density")
  weight: number;   // How much this signal contributes to the final score (0.0–1.0)
  anchors: BehavioralAnchor[];  // The 3 behavioral descriptions for this signal
}
```

**Plain English**: A signal parameter is one complete scoring dimension. It has a name, a weight (importance), and behavioral anchors that define what 1, 3, and 5 look like.

**Why only 3 anchors (1, 3, 5) instead of all 5?**: Defining anchors for 2 and 4 too is often counterproductive — it creates false precision. The LLM interpolates 2 (below proficient) and 4 (above proficient) based on context. This is standard BARS practice.

---

## 3. CONV_INTEL_CONFIG

```typescript
export const CONV_INTEL_CONFIG = { ... }
```

**What it is**: A configuration object holding numerical thresholds for 4 "conversational intelligence" metrics. These are computed from transcript metadata (timing, word counts) — not from LLM interpretation.

**Why it's separate from the rubric**: These metrics are objective. You don't need an LLM to tell you that a candidate spoke for 90% of the interview — you can calculate that from timestamps. By keeping these separate, they serve as an independent check on the LLM's content-based scores.

---

### SNR (Signal-to-Noise Ratio)

```typescript
SNR_THRESHOLD: {
  CONCISE: 0.15,   // >15% = Strong Hire (Executive Presence)
  RAMBLING: 0.05   // <5% = Verbosity Red Flag
}
```

**What SNR means in interviews**:

SNR = (Technical keywords + Action verbs + Quantified results) / Total words

A candidate who says: *"I led the migration of our Postgres cluster, cutting p99 latency by 40%"* — high SNR.
A candidate who says: *"So basically, you know, what we did was kind of like, we were working on this thing with databases"* — low SNR.

**The thresholds**:
- `>15%` of words are high-signal = "Executive Presence" — they communicate like a senior
- `<5%` of words are high-signal = Verbosity red flag — they talk a lot but say little

**Business reason**: SNR is one of the clearest proxies for communication quality that doesn't require subjective judgment. It's calculable from any transcript.

---

### Talk-to-Listen Ratio

```typescript
TALK_RATIO: {
  MIN: 0.60,    // Below 60% = Passive / Submissive
  IDEAL: 0.72,  // 72% is the sweet spot
  MAX: 0.85     // Above 85% = Monologuing risk
}
```

**What it measures**: In a mock interview, what percentage of speaking time belongs to the candidate?

**Why 60–75% is ideal**: Research from BarRaiser and sales call analysis (Gong.io) consistently shows that in high-stakes conversations, the person being evaluated should speak ~65–72% of the time. Less means they're not driving the conversation. More means they're not listening.

**The floor rule**: If a candidate speaks less than 60% of the time, the system flags a "Passive" risk — this can also trigger a biased No Hire recommendation because the data is insufficient to score them fairly.

**The ceiling rule (in CLAUDE.md)**: If talk ratio exceeds 78% in practice (the UI benchmark), it's flagged as "Monologuing." Note: the config says 0.85 but the UI uses 78% — the config is the raw metric boundary, the UI applies a tighter display threshold.

---

### Response Latency

```typescript
LATENCY_SEC: {
  THOUGHTFUL: [1, 3],  // 1–3 seconds = ideal
  HESITANT: 5          // >5 seconds = "Prep Gap" flag
}
```

**What it measures**: The time between the interviewer finishing a question and the candidate beginning their answer.

**Why 1–3 seconds**: Immediate responses (<1s) suggest the candidate isn't processing — they're pattern-matching to a pre-memorized answer. Responses after 3–5 seconds suggest uncertainty. 1–3 seconds is the "thoughtful pause" window.

**>5 seconds**: Flagged as "Prep Gap" — likely they haven't thought about this topic before.

**Implementation note**: The app currently measures this via audio timestamps in `useAudioRecorder.ts`. Latency data flows into the debrief but is not yet fully instrumented for every Q&A pair.

---

### Interruptions

```typescript
MAX_INTERRUPTIONS: 2
```

**What it measures**: How many times the candidate interrupts the interviewer.

**Why 2 is the threshold**: One interruption can be enthusiasm. Two might be a pattern. Three+ is a clear dominance/listening signal.

**The combined rule**: If interruptions = 0 AND talk ratio is low, that's the "Submissive" pattern — the candidate may be too passive, waiting to be led.

---

## 4. INTERVIEW_RUBRIC

```typescript
export const INTERVIEW_RUBRIC: Record<string, SignalParameter> = { ... }
```

**What it is**: A dictionary (key-value map) of all 8 scoring signals. The key is the machine ID (e.g., `"TECHNICAL_DEPTH"`), the value is the full `SignalParameter` object.

**`Record<string, SignalParameter>`** means: "An object where every key is a string and every value is a SignalParameter."

**Total weights must sum to 1.0** (verified manually):
`0.20 + 0.15 + 0.15 + 0.12 + 0.13 + 0.10 + 0.08 + 0.07 = 1.00` ✓

---

### Signal 1: TECHNICAL_DEPTH (weight: 0.20 — highest)

```
Score 1: "No technical depth; uses vague or incorrect terminology."
Score 3: "Uses correct jargon; explains 'how' things work but misses 'why'."
Score 5: "SME Status; high technical density; proactive mention of trade-offs."
```

**Why it's weighted highest (20%)**: For most roles PrepSignals targets (software engineering, product, data), technical credibility is the first filter. A candidate who can't demonstrate domain knowledge won't pass even the most lenient bar.

**"SME Status"**: Subject Matter Expert. A score of 5 means the candidate sounds like someone who could teach the topic — not just use it.

**"Proactive mention of trade-offs"**: This is the critical differentiator between a 3 and a 5. Anyone can say "I used Redis for caching." An expert says "I used Redis for caching, but the trade-off was cache invalidation complexity, which we mitigated by..."

---

### Signal 2: PROBLEM_SOLVING (weight: 0.15)

```
Score 1: "Struggles with ambiguity; fails to adjust to curveballs."
Score 3: "Reaches functional solutions; handles hints well."
Score 5: "Proactively identifies edge cases; optimizes independently."
```

**What this really tests**: How does the candidate behave when the interviewer introduces a new constraint or complication mid-question?

**"Curveballs"**: A deliberate interviewer technique — "What if you had to do this with 10x the data?" or "What if the API was unreliable?" A rigid candidate says "I hadn't thought about that." An adaptive one says "In that case, I'd shift from X to Y because..."

**"Handles hints well" (score 3)**: The interviewer gives a nudge. The candidate picks it up. This is passable but not impressive — it means they needed help.

---

### Signal 3: STAR_ALIGNMENT (weight: 0.15)

```
Score 1: "Rambles; no clear beginning or end to stories."
Score 3: "Clear Situation/Task/Action, but Result is weak."
Score 5: "Clear STAR flow; Result is quantifiable and directly linked to Action."
```

**What STAR is**: A structured storytelling framework for behavioral questions ("Tell me about a time when..."):
- **S**ituation: The context
- **T**ask: What you were responsible for
- **A**ction: Specifically what YOU did
- **R**esult: The measurable outcome

**Why "Result is weak" (score 3) is such a common failure**: Most candidates narrate the Situation and Action fluently but trail off on Result. They say "and it went well" or "the team was happy." A score 5 says "and it reduced churn by 12% over 3 months."

**Business reason for tracking this**: STAR alignment is highly correlated with interview pass rates in behavioral rounds. It's one of the most trainable skills — making it a valuable coaching metric for users.

---

### Signal 4: COMMUNICATION_SNR (weight: 0.12)

```
Score 1: "Low SNR; takes 5 minutes to say what takes 1."
Score 3: "Answers the question first; moderate filler usage."
Score 5: "Executive Presence; high signal; zero filler; Answer-First approach."
```

**Relationship to CONV_INTEL_CONFIG**: The `CONV_INTEL_CONFIG.SNR_THRESHOLD` is the objective threshold. This signal is the LLM's subjective rating of the same quality. They cross-validate each other.

**"Answer-First" (Pyramid Principle)**: A communication technique where you give the conclusion before the reasoning. "Yes, I'd use a message queue here, because..." vs. "Well, there are many approaches, and we need to consider the volume, and also the latency requirements, and then..." The second candidate buries the answer.

**"Executive Presence"**: A buzzword in hiring that roughly means: sounds like someone who's presented to leadership before. High signal, no filler, direct.

---

### Signal 5: RESULT_ORIENTATION (weight: 0.13)

```
Score 1: "Talks only about tasks/efforts, not outcomes."
Score 3: "Mentions completions/delivery but lacks %, $, or time saved."
Score 5: "Quantifies impact across multiple answers with specific results."
```

**Why this is separate from STAR_ALIGNMENT**: STAR is about story structure. Result Orientation is about whether the candidate thinks in terms of impact at all — even in non-behavioral answers. A technical candidate who says "I optimized the query" (task) vs. "I optimized the query, dropping P95 from 800ms to 120ms" (result) — the second candidate is more valuable to a hiring manager.

**"Across multiple answers"**: A score of 5 isn't just one quantified result — it's a pattern across the whole interview. This candidate instinctively attaches numbers to outcomes.

---

### Signal 6: OWNERSHIP_ETHICS (weight: 0.10)

```
Score 1: "Does only what is assigned; avoids responsibility for failure."
Score 3: "Completes tasks; owns mistakes."
Score 5: "Demonstrates 'Ownership' by solving problems outside direct scope."
```

**What this really tests**: Amazon's "Ownership" leadership principle — the most copied hiring signal in tech. Does this person act like an owner of the problem, or a contractor who scopes strictly?

**"Outside direct scope"**: The hallmark question is "Tell me about a time you fixed something that wasn't your job." A score 1 candidate says they've never done that. A score 5 candidate has several examples.

**"Avoids responsibility for failure" (score 1)**: The danger signal. When asked about a failure, do they blame the team, the timeline, the tools? Or do they say "I should have caught that earlier"?

---

### Signal 7: ADAPTABILITY_GROWTH (weight: 0.08)

```
Score 1: "Defensive about feedback; ignores interviewer hints."
Score 3: "Incorporates feedback when prompted; shows learning path."
Score 5: "Seeks feedback; treats constraints as opportunities; learns fast."
```

**Why the weight is lower (0.08)**: Adaptability is important but harder to assess in a single 30-minute interview. It's weighted lower because there's less signal available, not because it matters less in a real job.

**"Treats constraints as opportunities"**: The classic growth mindset signal. "We had a tight deadline" → a fixed mindset candidate sees a problem. A growth mindset candidate says "so I prioritized ruthlessly and that actually taught me how to scope better."

**"Ignores interviewer hints" (score 1)**: Direct connection to Problem Solving signal 2. Refusal to incorporate hints in technical problems is a red flag across both signals.

---

### Signal 8: EDGE_CASE_MASTERY (weight: 0.07 — lowest)

```
Score 1: "Misses failure modes; assumes 'Happy Path' only."
Score 3: "Identifies basic edge cases (null checks, errors) when asked."
Score 5: "Proactively identifies race conditions, scale bottlenecks, and risks."
```

**What "Happy Path" means**: The scenario where everything works correctly. A candidate who only thinks about the happy path hasn't considered what happens when the database is down, the user input is malformed, or traffic spikes.

**"Race conditions, scale bottlenecks"**: These are advanced failure modes that require deep systems thinking. A junior engineer might not consider concurrency issues. A senior engineer who misses them is a bigger red flag.

**Why lowest weight (0.07)**: Edge case mastery is highly role-dependent. A junior frontend engineer may never need to think about race conditions. A backend infrastructure engineer absolutely does. The weight is kept low here because it's a universal rubric — role-specific weights could be added later.

---

## 5. calculateNormalizedScore()

```typescript
export function calculateNormalizedScore(
  rawScores: Record<string, number>,
  seniority: 'Junior' | 'Mid' | 'Senior'
): number
```

**Input**:
- `rawScores`: A dictionary like `{ TECHNICAL_DEPTH: 4, PROBLEM_SOLVING: 3, ... }` — one number per signal
- `seniority`: The candidate's self-reported experience level

**Output**: A single number from 0–100 representing hire probability

---

### Step 1: Define Seniority Modifiers

```typescript
const modifiers: Record<string, Record<string, number>> = {
  Junior: { TECHNICAL_DEPTH: 1.2, STAR_ALIGNMENT: 1.0 },
  Senior: { TECHNICAL_DEPTH: 0.8, EDGE_CASE_MASTERY: 1.5, RESULT_ORIENTATION: 1.3 }
};
```

**What modifiers do**: They multiply the weight of specific signals up or down depending on seniority. A modifier of `1.2` means "this signal counts 20% more." A modifier of `0.8` means "this signal counts 20% less."

**Why Junior gets a TECHNICAL_DEPTH boost (1.2)**:
Juniors are expected to be weaker everywhere — but if a junior has strong technical depth, that's more impressive proportionally than a senior having it. The boost rewards relative standouts.

**Why Senior gets TECHNICAL_DEPTH reduced (0.8)**:
A senior engineer is expected to have technical depth — it's table stakes, not a differentiator. The modifier downgrades it as a deciding factor.

**Why Senior gets EDGE_CASE_MASTERY boosted (1.5 — highest modifier)**:
A senior who misses failure modes is a serious risk. This is the "senior tax" — higher expectations at higher levels. The 1.5x multiplier makes this signal 50% more impactful for senior candidates.

**Why Senior gets RESULT_ORIENTATION boosted (1.3)**:
Senior candidates are hired for impact, not activity. If they can't articulate results, that's a much bigger concern than for a junior.

**Note**: `Mid` seniority has no modifiers defined — it uses `1.0` (no adjustment) for all signals. This makes Mid the baseline.

---

### Step 2: The Weighted Sum Loop

```typescript
for (const key in INTERVIEW_RUBRIC) {
  const param = INTERVIEW_RUBRIC[key];
  const score = rawScores[key] || 0;
  const modifier = modifiers[seniority]?.[key] || 1.0;

  totalWeightedScore += (score * param.weight * modifier);
  totalPossibleWeight += (5 * param.weight * modifier);
}
```

**Line by line**:

- `for (const key in INTERVIEW_RUBRIC)`: Loop through all 8 signals
- `const score = rawScores[key] || 0`: Get the LLM's score for this signal. If the LLM didn't score it (undefined), default to 0.
- `const modifier = modifiers[seniority]?.[key] || 1.0`: Get the seniority modifier for this signal. The `?.` is "optional chaining" — if `modifiers[seniority]` doesn't exist (e.g., for "Mid"), don't crash, return undefined. The `|| 1.0` then kicks in as the default.
- `totalWeightedScore += (score * param.weight * modifier)`: Add this signal's contribution to the running total. A score of 4 on TECHNICAL_DEPTH (weight 0.20, no modifier) contributes `4 × 0.20 × 1.0 = 0.80`.
- `totalPossibleWeight += (5 * param.weight * modifier)`: Track what the maximum possible score would be, accounting for the same modifier. This is how normalization works — you need to know the ceiling.

---

### Step 3: Normalization

```typescript
return Math.round((totalWeightedScore / totalPossibleWeight) * 100);
```

**The formula**: (Actual weighted score / Maximum possible weighted score) × 100

**Why divide by totalPossibleWeight instead of a fixed number**: Because seniority modifiers change the effective weight of signals. If a Senior has EDGE_CASE_MASTERY boosted 1.5x, the maximum possible score for that signal is also 1.5x higher. Dividing by `totalPossibleWeight` ensures the output is always a fair 0–100 regardless of which modifiers were applied.

**`Math.round()`**: Rounds to the nearest whole number. So 73.4% becomes 73, not 73.4.

---

### Concrete Example

Say a Mid-level candidate scores:

| Signal | Weight | LLM Score | Contribution |
|---|---|---|---|
| TECHNICAL_DEPTH | 0.20 | 4 | 0.80 |
| PROBLEM_SOLVING | 0.15 | 3 | 0.45 |
| STAR_ALIGNMENT | 0.15 | 2 | 0.30 |
| COMMUNICATION_SNR | 0.12 | 4 | 0.48 |
| RESULT_ORIENTATION | 0.13 | 3 | 0.39 |
| OWNERSHIP_ETHICS | 0.10 | 4 | 0.40 |
| ADAPTABILITY_GROWTH | 0.08 | 3 | 0.24 |
| EDGE_CASE_MASTERY | 0.07 | 2 | 0.14 |
| **Total** | **1.00** | — | **3.20** |

Max possible (all 5s, Mid = no modifiers): `5 × 1.00 = 5.00`

Hire probability: `(3.20 / 5.00) × 100 = 64%`

This maps to the "Hire" bucket (not Strong Hire, not Borderline). The UI shows "Hire" — not 64%.

---

## 6. How All Three Parts Connect

```
Interview Transcript
       |
       v
   LLM (Groq / Llama 3.3)
   - Reads the transcript
   - Assigns 1-5 scores per signal
   - Provides verbatim evidence quotes
       |
       v
  rawScores = { TECHNICAL_DEPTH: 4, ... }
       |
       v
  calculateNormalizedScore(rawScores, seniority)
  - Applies weights from INTERVIEW_RUBRIC
  - Applies seniority modifiers
  - Returns hire_probability (0-100)
       |
       v
  hire_probability → stored in DB (never shown to user)
  recommendation   → "Strong Hire / Hire / Borderline / No Hire" (shown in UI)
       |
  CONV_INTEL_CONFIG thresholds applied separately to:
  - Talk ratio
  - Latency
  - SNR
  - Interruptions
  These produce red flags and benchmark labels shown in the Metrics section
```

---

## 7. Why This Is Defensible IP

### Problem With Competitors

Most AI interview tools do one of two things:
1. Ask the LLM "how did this candidate do?" and display the answer (vibe-based, inconsistent)
2. Use a static rubric with no evidence grounding (arbitrary, gameable)

### What PrepSignals Does Differently

| Feature | Competitor Norm | PrepSignals |
|---|---|---|
| Scoring | LLM decides the score | LLM provides evidence, TS calculates score |
| Consistency | Different LLM calls = different scores | Same transcript always = same score |
| Auditability | "The AI said so" | Traceable to specific weights + evidence quotes |
| Seniority | One-size-fits-all | Dynamically weighted by experience level |
| Metrics | Qualitative summary | Quantitative, research-benchmarked |

### The Liability Argument

If a candidate disputes their score: "Why did I get 'Borderline' instead of 'Hire'?" — PrepSignals can show exactly which signals were weak and why (evidence quotes). No other consumer-facing mock interview tool can do this.

This matters for:
- Legal defensibility
- Enterprise sales (companies won't buy an opaque black box)
- Trust-building with users who paid for the assessment

---

## 8. Co-Founder Summary

If you're presenting this to a potential co-founder, here's the 5-sentence version:

> PrepSignals's scoring engine is the core technical moat. Instead of asking an AI "was this candidate good?" — which produces inconsistent, gameable results — we use the AI only to extract evidence from the transcript. The actual hire probability is calculated deterministically by a weighted rubric derived from BarRaiser, FloCareer, and Big Tech hiring frameworks. Scores are adjusted for seniority (juniors and seniors are evaluated differently), and conversational metrics like talk ratio and response latency are computed from audio metadata, not LLM opinion. The result is a scoring system that is auditable, consistent, research-backed, and explainable — something no consumer mock interview product currently offers.

---

## Appendix: Quick Reference

### Signal Weights
| Signal | ID | Weight | Primary Audience |
|---|---|---|---|
| Technical Depth | TECHNICAL_DEPTH | 20% | All technical roles |
| Problem Solving | PROBLEM_SOLVING | 15% | All roles |
| STAR Method | STAR_ALIGNMENT | 15% | Behavioral rounds |
| Communication | COMMUNICATION_SNR | 12% | All roles |
| Result Orientation | RESULT_ORIENTATION | 13% | Mid/Senior |
| Ownership | OWNERSHIP_ETHICS | 10% | All roles |
| Adaptability | ADAPTABILITY_GROWTH | 8% | All roles |
| Edge Cases | EDGE_CASE_MASTERY | 7% | Technical/Senior |

### Seniority Modifier Summary
| Signal | Junior | Mid | Senior |
|---|---|---|---|
| TECHNICAL_DEPTH | 1.2x (boosted) | 1.0x | 0.8x (reduced) |
| STAR_ALIGNMENT | 1.0x | 1.0x | 1.0x |
| EDGE_CASE_MASTERY | 1.0x | 1.0x | 1.5x (boosted) |
| RESULT_ORIENTATION | 1.0x | 1.0x | 1.3x (boosted) |
| All others | 1.0x | 1.0x | 1.0x |

### Recommendation Buckets (approximate)
| Score | Recommendation |
|---|---|
| 80–100 | Strong Hire |
| 65–79 | Hire |
| 50–64 | Borderline |
| 0–49 | No Hire |

*Note: Exact thresholds are applied in the debrief route, not in this file.*

### Conversational Metric Quick Reference
| Metric | Target | Red Flag (High) | Red Flag (Low) |
|---|---|---|---|
| Talk Ratio | 60–75% | >78% Monologuing | <55% Passive |
| Latency | 1–3s | >5s Hesitant | <0.5s Interruptive |
| SNR | >15% | — | <5% Verbose |
| Interruptions | 0–1 | >2 Dominating | 0 + low talk = Submissive |

---

## 9. Candidate Archetypes — Signal Pattern Taxonomy

> **Purpose**: First-principles decomposition of each scoring signal into wireable evidence atoms, plus a named taxonomy of 24 candidate archetypes derived from signal patterns. This section is internal — intended for founder calibration, future LLM prompt engineering, and eventual user-facing persona labeling.

---

### 9.1 Signal Sub-component Trees

Each signal is decomposed into 4–6 sub-components. These are the atomic units of evidence that an LLM can independently extract from a transcript. Each sub-component is scored:

- **0** — Absent: no evidence in transcript
- **1** — Weak evidence: present but vague, incomplete, or prompted
- **2** — Strong evidence: clear, specific, verifiable, unprompted

**Aggregation formula (per signal):**
```
sub_score       = Σ(component_score × component_weight)   [range: 0.0 – 2.0]
signal_score    = 1 + (sub_score / 2.0) × 4               [range: 1.0 – 5.0]
```

This maps cleanly:
- sub_score `0.0` → signal score `1` (Unsatisfactory)
- sub_score `1.0` → signal score `3` (Proficient)
- sub_score `2.0` → signal score `5` (Exceptional)

The resulting signal score (1–5) feeds into `calculateNormalizedScore()` exactly as it does today — no change to the math engine, only the upstream evidence extraction becomes more granular.

---

#### Signal 1: TECHNICAL_DEPTH (signal weight: 20%)

```
TECHNICAL_DEPTH (20%)
│
├── Jargon Accuracy (10%)
│     What: Uses domain-specific terms correctly, not decoratively.
│     LLM looks for: Precise vocabulary matched to the role's domain without
│                    misuse or overuse of buzzwords.
│     Absent signal: "We used microservices and cloud and API stuff."
│     Strong signal: "We used an event-driven architecture with Kafka as the
│                    message broker to decouple the order service from inventory."
│
├── Mechanism Explanation — HOW (20%)
│     What: Explains how something works, not just that it exists.
│     LLM looks for: Candidate moves beyond naming a tool/pattern to describing
│                    its internal logic or operational behavior.
│     Absent signal: "I used Redis for caching."
│     Strong signal: "Redis sits in front of Postgres. On cache miss, we write
│                    through to Redis with a 5-minute TTL. This cut DB read load
│                    by ~60%."
│
├── Design Rationale — WHY (25%)
│     What: Explains why a technical choice was made over alternatives.
│     LLM looks for: Explicit comparison ("I chose X over Y because..."),
│                    trade-off framing, constraint-driven decisions.
│     Absent signal: Describes what was built with no justification.
│     Strong signal: "We chose Postgres over MongoDB because our relationships
│                    were heavily normalized and ACID compliance was non-negotiable
│                    for financial transactions."
│
├── Trade-off Articulation (30%)  ← primary SME differentiator
│     What: Proactively names the downside of their own chosen approach.
│     LLM looks for: Candidate volunteers a limitation, risk, or cost of their
│                    decision — without being asked.
│     Absent signal: "We went with Redis and it worked great."
│     Strong signal: "The trade-off was cache invalidation complexity. When
│                    inventory updated, we had to invalidate across three services,
│                    which added latency we mitigated with a short TTL."
│
└── System-level Thinking (15%)
      What: Connects components; understands dependencies and failure propagation.
      LLM looks for: Candidate references how their piece fits into the broader
                     system — upstream dependencies, downstream consumers, failure
                     modes at the system boundary.
      Absent signal: Describes their component in isolation.
      Strong signal: "If the Kafka consumer fell behind, it would back-pressure
                     into order creation. We added a dead-letter queue and alerting
                     on consumer lag > 10k messages."
```

**Math example — "The Architect" profile:**
```
Jargon(2) × 0.10 + HOW(2) × 0.20 + WHY(2) × 0.25 + Trade-off(2) × 0.30 + System(1) × 0.15
= 0.20 + 0.40 + 0.50 + 0.60 + 0.15 = 1.85
signal_score = 1 + (1.85 / 2.0) × 4 = 4.7 → rounds to 5
```

**Math example — "The Happy Pather" profile:**
```
Jargon(2) × 0.10 + HOW(2) × 0.20 + WHY(1) × 0.25 + Trade-off(0) × 0.30 + System(0) × 0.15
= 0.20 + 0.40 + 0.25 + 0.00 + 0.00 = 0.85
signal_score = 1 + (0.85 / 2.0) × 4 = 2.7 → rounds to 3
```

---

#### Signal 2: PROBLEM_SOLVING (signal weight: 15%)

```
PROBLEM_SOLVING (15%)
│
├── Ambiguity Navigation (20%)
│     What: Asks clarifying questions before diving into a solution.
│     LLM looks for: Candidate identifies underspecified requirements and
│                    explicitly requests constraints before answering.
│     Absent signal: Jumps straight into a solution with unstated assumptions.
│     Strong signal: "Before I answer — are we optimizing for read latency or
│                    write throughput? And what's the expected scale?"
│
├── Structured Decomposition (20%)
│     What: Breaks a complex problem into named sub-problems before solving.
│     LLM looks for: Explicit problem partitioning ("There are three parts to
│                    this..."), layered thinking, ordered approach.
│     Absent signal: One continuous stream of thought with no structure.
│     Strong signal: "I'd break this into: (1) data ingestion, (2) processing
│                    pipeline, (3) serving layer. Let me address each."
│
├── Curveball Adaptation (25%)  ← primary interview differentiator
│     What: Adjusts approach when the interviewer introduces a new constraint
│           or complication mid-question.
│     LLM looks for: Pivot language ("In that case...", "Given that constraint,
│                    I'd shift from X to Y because..."), not defensive refusal.
│     Absent signal: "I hadn't thought about that" / restates original answer.
│     Strong signal: "If we need to support 10x the write volume, the
│                    synchronous approach breaks down — I'd move to an async
│                    queue with backpressure handling."
│
├── Independent Optimization (25%)  ← differentiates score 3 from score 5
│     What: Improves or extends the solution without being asked.
│     LLM looks for: Candidate proactively says "I could also..." or "One
│                    thing I'd add is..." without prompting.
│     Absent signal: Stops at a functional solution and waits.
│     Strong signal: "That covers the core case. I'd also add idempotency keys
│                    to the API to handle retries safely — easy to add now,
│                    very hard to retrofit."
│
└── Hint Uptake (10%)  ← inverse scoring: fewer hints needed = higher score
      What: How readily does the candidate incorporate interviewer nudges?
      LLM looks for: Candidate picks up subtle redirects quickly and integrates
                     them without needing the hint repeated.
      Score 2: Needs zero hints, or picks up indirect hints immediately.
      Score 0: Requires multiple direct hints or ignores them entirely.
      Note: This sub-component is inverse — score 0 on this means they needed
            lots of help; score 2 means they needed none.
```

**Math example — "The Deep Diver" profile:**
```
Ambiguity(2) × 0.20 + Decomp(2) × 0.20 + Curveball(2) × 0.25 + Optim(2) × 0.25 + Hints(2) × 0.10
= 0.40 + 0.40 + 0.50 + 0.50 + 0.20 = 2.00
signal_score = 1 + (2.00 / 2.0) × 4 = 5.0
```

**Math example — "The Reactive" profile:**
```
Ambiguity(1) × 0.20 + Decomp(1) × 0.20 + Curveball(0) × 0.25 + Optim(0) × 0.25 + Hints(0) × 0.10
= 0.20 + 0.20 + 0.00 + 0.00 + 0.00 = 0.40
signal_score = 1 + (0.40 / 2.0) × 4 = 1.8 → rounds to 2
```

---

#### Signal 3: STAR_ALIGNMENT (signal weight: 15%)

```
STAR_ALIGNMENT (15%)
│
├── Situation Framing (10%)
│     What: Sets concise, relevant context for the story.
│     LLM looks for: A clear "here's the setup" that is brief and necessary —
│                    not a 3-minute preamble.
│     Absent signal: Launches into action with no context, or spends 80%
│                    of the answer on context.
│     Strong signal: "This was at a fintech startup, 18 months ago, during
│                    a PCI audit crunch."
│
├── Task Specificity (15%)
│     What: Defines their personal responsibility, not the team's.
│     LLM looks for: "I was responsible for..." language, a named scope
│                    that is theirs alone.
│     Absent signal: "The team needed to..." — role is undefined.
│     Strong signal: "I owned the backend migration plan and was the single
│                    point of contact with the auditors."
│
├── Action Specificity (20%)
│     What: Names concrete steps they personally took.
│     LLM looks for: "I" language, specific verbs (built, escalated, designed,
│                    negotiated), named artifacts or decisions.
│     Absent signal: "We worked on the problem together."
│     Strong signal: "I rewrote the auth module, added field-level encryption,
│                    and ran three rounds of penetration testing with an
│                    external vendor."
│
├── Result Presence (15%)
│     What: Mentions any outcome at all.
│     LLM looks for: Any closing statement that references what happened after
│                    the action — even if unquantified.
│     Absent signal: Story ends mid-action ("...and that's what we did").
│     Strong signal: "We passed the audit." (Baseline — present but weak.)
│
├── Result Quantification (25%)  ← biggest STAR differentiator
│     What: Attaches a number, percentage, dollar amount, or time delta
│           to the result.
│     LLM looks for: Specific numeric outcome tied to the action.
│     Absent signal: "It went really well."
│     Strong signal: "We passed the audit with zero findings and renewed the
│                    contract, which was worth $1.2M ARR."
│
└── Result-Action Linkage (15%)
      What: Explicitly connects the outcome to the candidate's specific action.
      LLM looks for: Causal language ("Because I did X, we achieved Y"),
                     not just sequential ("I did X. Then Y happened.").
      Absent signal: Action and result are stated but unconnected.
      Strong signal: "Because I rewrote the auth module before the audit window,
                     we avoided a 6-week remediation delay that would have
                     pushed the renewal into Q2."
```

**Math example — "The Storyteller" profile:**
```
Situation(2) × 0.10 + Task(2) × 0.15 + Action(2) × 0.20 + Presence(2) × 0.15
+ Quantification(0) × 0.25 + Linkage(1) × 0.15
= 0.20 + 0.30 + 0.40 + 0.30 + 0.00 + 0.15 = 1.35
signal_score = 1 + (1.35 / 2.0) × 4 = 3.7 → rounds to 4
```

**Math example — "The Star Dropper" profile (across behavioral round):**
```
Situation(2) × 0.10 + Task(2) × 0.15 + Action(2) × 0.20 + Presence(1) × 0.15
+ Quantification(0) × 0.25 + Linkage(0) × 0.15
= 0.20 + 0.30 + 0.40 + 0.15 + 0.00 + 0.00 = 1.05
signal_score = 1 + (1.05 / 2.0) × 4 = 3.1 → rounds to 3
```

---

#### Signal 4: COMMUNICATION_SNR (signal weight: 12%)

```
COMMUNICATION_SNR (12%)
│
├── Answer-First Structure (30%)  ← highest weight; executive presence proxy
│     What: Leads with the conclusion, then supports it with reasoning.
│           (The Pyramid Principle / BLUF — Bottom Line Up Front.)
│     LLM looks for: First sentence of each answer is the direct response
│                    to the question, not a warm-up.
│     Absent signal: "So there are a few things to consider here, and the
│                    first is... [3 minutes later] ...so that's why I'd use X."
│     Strong signal: "I'd use a message queue here. The reason is latency
│                    decoupling — here's why that matters in this context."
│
├── Filler Frequency (15%)  ← inverse scoring
│     What: Frequency of non-substantive verbal fillers.
│     LLM looks for: "um", "uh", "basically", "you know", "kind of",
│                    "like" (non-comparative), "I mean", "so yeah".
│     Score 2: Zero or near-zero fillers across the interview.
│     Score 0: Fillers appear in nearly every sentence.
│     Note: Inverse — more fillers = lower score.
│
├── Question Adherence (25%)
│     What: Actually answers what was asked, not an adjacent topic.
│     LLM looks for: The candidate's answer maps to the specific question,
│                    not a rehearsed tangent that sounds related.
│     Absent signal: Asked about a failure; answers with a success story
│                    about a "challenge" they overcame.
│     Strong signal: Direct, literal response to the question asked.
│
├── Sentence Economy (15%)
│     What: No redundant phrases, repetition, or verbal throat-clearing.
│     LLM looks for: Each sentence adds new information. No re-stating
│                    the question, no summary of what they're about to say.
│     Absent signal: "So what I'm going to talk about is... [restates
│                    question]... and what I mean by that is..."
│     Strong signal: Every sentence is load-bearing.
│
└── Technical Density (15%)
      What: Ratio of high-signal words (technical terms, action verbs,
            quantified claims) to total words.
      LLM looks for: Substantive vocabulary, not padding.
      Absent signal: "We did a lot of work on the system and improved things
                     significantly over time."
      Strong signal: "We reduced P95 latency from 800ms to 120ms by adding
                     a read replica and query-level caching."
```

**Math example — "The Executive Communicator" profile:**
```
AnswerFirst(2) × 0.30 + Fillers(2) × 0.15 + Adherence(2) × 0.25
+ Economy(2) × 0.15 + Density(2) × 0.15
= 0.60 + 0.30 + 0.50 + 0.30 + 0.30 = 2.00
signal_score = 5.0
```

**Math example — "The Rambler" profile:**
```
AnswerFirst(0) × 0.30 + Fillers(0) × 0.15 + Adherence(1) × 0.25
+ Economy(0) × 0.15 + Density(1) × 0.15
= 0.00 + 0.00 + 0.25 + 0.00 + 0.15 = 0.40
signal_score = 1 + (0.40 / 2.0) × 4 = 1.8 → rounds to 2
```

---

#### Signal 5: RESULT_ORIENTATION (signal weight: 13%)

```
RESULT_ORIENTATION (13%)
│
├── Quantified Impact (30%)  ← highest weight; the core of this signal
│     What: Attaches a specific number to an outcome.
│     LLM looks for: %, $, time (days/weeks saved), user count, scale
│                    (requests/sec, data volume), error rate reduction.
│     Absent signal: "It had a big positive impact on the team."
│     Strong signal: "It reduced manual processing time by 4 hours/week
│                    per analyst, across a team of 12."
│
├── Business Framing (20%)
│     What: Frames outcomes in business terms, not just technical delivery.
│     LLM looks for: Revenue, retention, churn, NPS, cost savings, SLA
│                    compliance — not just "shipped the feature."
│     Absent signal: "We launched the feature on time."
│     Strong signal: "The feature increased trial-to-paid conversion by 8%,
│                    which at our volume was worth ~$200k ARR."
│
├── Result Consistency (25%)
│     What: Quantified results appear across multiple answers — it's a
│           pattern, not a one-off.
│     LLM looks for: Numbers and business outcomes in at least 3 of 5+
│                    behavioral answers.
│     Score 2: Results appear in the majority of answers, unprompted.
│     Score 0: One quantified result in the entire interview, or none.
│
├── Comparative Framing (15%)
│     What: States the before-and-after delta explicitly.
│     LLM looks for: "Before X, Y took N. After, it took M."
│                    Improvement is stated as a change, not just a state.
│     Absent signal: "Latency is now 120ms." (No baseline.)
│     Strong signal: "We brought P95 latency from 800ms down to 120ms."
│
└── Attribution Clarity (10%)
      What: Owns their specific contribution to the result, not the team's.
      LLM looks for: "My changes resulted in..." vs "The team achieved..."
                     when the context is a personal behavioral question.
      Absent signal: "The project reduced costs by 30%." (Whose work?)
      Strong signal: "The query optimizations I wrote reduced DB costs by
                     30% — the rest of the project cost delta was flat."
```

**Math example — "The Driver" profile:**
```
Quantified(2) × 0.30 + Business(2) × 0.20 + Consistency(2) × 0.25
+ Comparative(2) × 0.15 + Attribution(2) × 0.10
= 0.60 + 0.40 + 0.50 + 0.30 + 0.20 = 2.00
signal_score = 5.0
```

**Math example — "The Star Dropper" profile:**
```
Quantified(0) × 0.30 + Business(0) × 0.20 + Consistency(0) × 0.25
+ Comparative(0) × 0.15 + Attribution(1) × 0.10
= 0.00 + 0.00 + 0.00 + 0.00 + 0.10 = 0.10
signal_score = 1 + (0.10 / 2.0) × 4 = 1.2 → rounds to 1
```

---

#### Signal 6: OWNERSHIP_ETHICS (signal weight: 10%)

```
OWNERSHIP_ETHICS (10%)
│
├── Personal Attribution Language (15%)
│     What: Uses "I" language appropriately for individual contributions.
│     LLM looks for: "I decided", "I escalated", "I owned", "I built" in
│                    contexts where personal ownership is being assessed.
│     Absent signal: "We" used exclusively, even for personal projects.
│     Strong signal: Calibrated "I" and "we" — "I designed the approach;
│                    we executed it as a team."
│
├── Failure Ownership (30%)  ← highest weight; hardest to fake, most diagnostic
│     What: Takes personal accountability for a mistake or failure without
│           deflecting to external causes.
│     LLM looks for: "I should have...", "My mistake was...", "I didn't
│                    catch...", with a clear lesson.
│     Absent signal: "The requirements weren't clear." / "The timeline was
│                    unreasonable." / "The team didn't communicate well."
│     Strong signal: "I underestimated the migration complexity and didn't
│                    surface the risk early enough. By the time I did, we had
│                    2 weeks left and had to cut scope. I now build in a
│                    risk-review checkpoint on every migration."
│
├── Scope Extension (25%)
│     What: Example of solving a problem outside their direct job description.
│     LLM looks for: "Even though it wasn't my responsibility...",
│                    "I noticed X was broken and fixed it anyway..."
│     Absent signal: All examples are within assigned scope.
│     Strong signal: "The alerting system was owned by the SRE team but it
│                    kept paging us incorrectly. I spent a weekend diagnosing
│                    the threshold logic and sent them a PR."
│
├── Initiative Evidence (20%)
│     What: Started something without being asked.
│     LLM looks for: Projects, process improvements, or tools created
│                    proactively — not in response to a manager's request.
│     Absent signal: All work is in response to assigned tasks or tickets.
│     Strong signal: "I noticed we had no runbook for on-call. I wrote one
│                    and it's now the standard for the whole team."
│
└── Accountability Language (10%)
      What: Uses language that accepts responsibility rather than distributes it.
      LLM looks for: "I should have", "I missed", "I underestimated"
                     vs "it just happened", "no one told me", "that's not
                     really my area."
      Score 2: Accountability language appears in failure and ambiguous contexts.
      Score 0: No accountability language; everything is externally caused.
```

**Math example — "The Blame Externalizer" profile:**
```
Attribution(1) × 0.15 + Failure(0) × 0.30 + Scope(1) × 0.25
+ Initiative(1) × 0.20 + Accountability(0) × 0.10
= 0.15 + 0.00 + 0.25 + 0.20 + 0.00 = 0.60
signal_score = 1 + (0.60 / 2.0) × 4 = 2.2 → rounds to 2
```

**Math example — "The Driver" profile:**
```
Attribution(2) × 0.15 + Failure(2) × 0.30 + Scope(2) × 0.25
+ Initiative(2) × 0.20 + Accountability(2) × 0.10
= 0.30 + 0.60 + 0.50 + 0.40 + 0.20 = 2.00
signal_score = 5.0
```

---

#### Signal 7: ADAPTABILITY_GROWTH (signal weight: 8%)

```
ADAPTABILITY_GROWTH (8%)
│
├── Hint Incorporation (15%)
│     What: Picks up and uses interviewer nudges during problem-solving.
│     LLM looks for: Candidate integrates subtle redirects without needing
│                    them repeated or made explicit.
│     Absent signal: Interviewer hints twice; candidate continues original path.
│     Strong signal: Single indirect hint → immediate course correction with
│                    explanation of why the new direction is better.
│
├── Feedback Receptiveness (20%)
│     What: Responds constructively when the interviewer corrects or
│           challenges an answer mid-interview.
│     LLM looks for: "That's a good point, I hadn't considered...",
│                    or graceful update to a position.
│     Absent signal: Defensive, restates original answer, or dismisses
│                    the challenge.
│     Strong signal: "You're right — I was anchored on the read-heavy case.
│                    If writes are the bottleneck, the architecture shifts
│                    significantly. Let me rethink."
│
├── Learning Story (20%)
│     What: A specific narrative of learning something new quickly under
│           real conditions.
│     LLM looks for: Named technology, skill, or domain; a timeline;
│                    a concrete output.
│     Absent signal: "I'm always learning new things." (No specifics.)
│     Strong signal: "Six months into the role, the team pivoted to Kubernetes.
│                    I had zero k8s experience. I spent 3 weekends working
│                    through the CKAD curriculum and within 6 weeks I was
│                    reviewing the team's Helm charts."
│
├── Constraint-as-Opportunity (25%)  ← highest weight; clearest mindset marker
│     What: Frames a limitation as something that improved the outcome
│           or the candidate's own capability.
│     LLM looks for: "The constraint forced me to...", "Because we couldn't
│                    use X, I learned Y, which turned out to be better because..."
│     Absent signal: Constraint is described as a blocker or a complaint.
│     Strong signal: "We had a strict no-vendor-lock-in policy. It was
│                    painful at first but it forced us to build an abstraction
│                    layer that we later open-sourced."
│
└── Failure-to-Growth Arc (20%)
      What: A complete arc: failure → specific lesson → behavior change.
      LLM looks for: All three parts present. Not just "I learned from it"
                     — specifically what changed in their behavior afterward.
      Absent signal: Failure described, lesson is generic ("I learned
                     communication is important"), no behavior change mentioned.
      Strong signal: "I shipped a migration that caused a 20-minute outage.
                     I learned I was skipping the pre-prod dry-run step.
                     Since then, every migration I own has a mandatory dry-run
                     plus a rollback runbook — no exceptions."
```

**Math example — "The Pivot Artist" profile:**
```
Hints(2) × 0.15 + Receptive(2) × 0.20 + Learning(2) × 0.20
+ Constraint(2) × 0.25 + Arc(1) × 0.20
= 0.30 + 0.40 + 0.40 + 0.50 + 0.20 = 1.80
signal_score = 1 + (1.80 / 2.0) × 4 = 4.6 → rounds to 5
```

**Math example — "The Reactive" profile:**
```
Hints(0) × 0.15 + Receptive(0) × 0.20 + Learning(1) × 0.20
+ Constraint(0) × 0.25 + Arc(0) × 0.20
= 0.00 + 0.00 + 0.20 + 0.00 + 0.00 = 0.20
signal_score = 1 + (0.20 / 2.0) × 4 = 1.4 → rounds to 1
```

---

#### Signal 8: EDGE_CASE_MASTERY (signal weight: 7%)

```
EDGE_CASE_MASTERY (7%)
│
├── Basic Defensive Thinking (10%)
│     What: Considers null inputs, empty states, or invalid data.
│     LLM looks for: Mentions of validation, defaults, null checks,
│                    or empty-state handling.
│     Absent signal: Describes a solution that assumes all inputs are valid.
│     Strong signal: "I'd validate the input at the boundary before it
│                    hits the service — null IDs, malformed dates, and
│                    payloads over our size limit all need explicit handling."
│
├── Error/Failure Mode Identification (20%)
│     What: Names specific ways the system or solution can break.
│     LLM looks for: "What happens if X fails?", timeout handling,
│                    retry logic, circuit breakers, partial failure states.
│     Absent signal: Solution described with no failure scenario considered.
│     Strong signal: "If the payment service times out, we need to distinguish
│                    between 'definitely failed' and 'unknown' — the retry
│                    strategy is different for each."
│
├── Scale Consideration (25%)
│     What: Addresses how the solution behaves at 10x or 100x current load.
│     LLM looks for: Bottleneck identification, horizontal scaling path,
│                    connection pool limits, database read replica strategy.
│     Absent signal: Solution designed for current load only.
│     Strong signal: "This works at our current 1k req/sec but the single
│                    Postgres primary becomes the bottleneck around 10k. I'd
│                    plan the read replica strategy now before we need it."
│
├── Concurrency Awareness (30%)  ← highest weight; senior differentiator
│     What: Identifies race conditions, deadlocks, or parallel write conflicts.
│     LLM looks for: Mentions of locking strategy, optimistic vs pessimistic
│                    concurrency, idempotency, or distributed transaction risks.
│     Absent signal: Assumes single-threaded or single-instance execution.
│     Strong signal: "Two workers could process the same job concurrently
│                    if the queue visibility timeout expires. I'd add an
│                    idempotency key and use conditional writes on the DB to
│                    make the operation safe."
│
└── Proactive vs Prompted (15%)
      What: Did the candidate raise edge cases before being asked,
            or only after the interviewer probed?
      Score 2: Candidate surfaces edge cases unprompted.
      Score 1: Raises edge cases when the interviewer explicitly asks.
      Score 0: Only acknowledges edge cases when the interviewer names them.
      Note: This sub-component is a process marker, not a content marker.
            A score of 2 here multiplies the value of the other sub-components.
```

**Math example — "The Architect" profile:**
```
Defensive(2) × 0.10 + Failure(2) × 0.20 + Scale(2) × 0.25
+ Concurrency(2) × 0.30 + Proactive(2) × 0.15
= 0.20 + 0.40 + 0.50 + 0.60 + 0.30 = 2.00
signal_score = 5.0
```

**Math example — "The Happy Pather" profile:**
```
Defensive(1) × 0.10 + Failure(0) × 0.20 + Scale(0) × 0.25
+ Concurrency(0) × 0.30 + Proactive(0) × 0.15
= 0.10 + 0.00 + 0.00 + 0.00 + 0.00 = 0.10
signal_score = 1 + (0.10 / 2.0) × 4 = 1.2 → rounds to 1
```

---

### 9.2 The 24 Candidate Archetypes

> Each archetype is defined by its signal pattern (High / Mid / Low), its conversational metric fingerprint, and a narrative that describes who this person is, what they look like in transcript, and where the real risk or opportunity lies.

**Signal abbreviation key used throughout:**
`TD` = TECHNICAL_DEPTH · `PS` = PROBLEM_SOLVING · `SA` = STAR_ALIGNMENT · `CSNR` = COMMUNICATION_SNR · `RO` = RESULT_ORIENTATION · `OE` = OWNERSHIP_ETHICS · `AG` = ADAPTABILITY_GROWTH · `ECM` = EDGE_CASE_MASTERY

---

#### Cluster A — Technical Excellence

*Candidates where the technical signal cluster (TD, PS, ECM) dominates the profile.*

---

**A1. The Deep Diver**
`High: TD(5), PS(4-5), ECM(4-5)` · `Low: CSNR(2), RO(2)` · `Mid: SA(3), OE(3), AG(3)`
Conv. flags: Low SNR metric, functional talk ratio, near-zero quantified results.
**Hire bucket: Hire**

The classic senior IC. Extraordinarily deep in their domain — can walk through system internals, spot failure modes, and solve under ambiguity without hand-holding. But when asked "what was the impact?", they say "it worked well." Communication is functional but dense; stories are complete but not crisp. A hiring manager who values depth over polish will extend an offer; one who values presentation will hesitate.

The deep diver's trade-off articulation sub-component will score 2 consistently. Their result quantification sub-component will score 0 across the board. That's the gap.

*Coaching angle*: The only fix needed is result framing. Their work clearly had impact — they just never learned to state it in numbers.

---

**A2. The Architect**
`High: TD(5), ECM(5)` · `Low: SA(2), AG(2)` · `Mid: PS(3), CSNR(3), RO(3), OE(3)`
Conv. flags: Possibly fast latency (answers from a hardwired mental model), rigid under curveballs.
**Hire bucket: Hire**

A systems thinker who designs for failure from first principles. Scale, concurrency, edge cases — all covered unprompted. But introduce a new constraint mid-question and they resist; their mental model is set and they don't want to rebuild it. Behavioral questions reveal the same rigidity: stories are structured but deflect follow-up probing. The curveball adaptation and feedback receptiveness sub-components both score 0.

Best fit: well-defined system design roles with clear scope. Poor fit: ambiguous, fast-moving environments where the architecture is still being invented.

*Coaching angle*: The gap is mental flexibility, not technical knowledge. Needs practice with open-ended scenarios that have no right answer.

---

**A3. The Happy Pather**
`High: TD(3-4)` · `Low: ECM(1), PS(2)` · `Mid: SA(3), CSNR(3), RO(3), OE(3), AG(3)`
Conv. flags: High talk ratio (confident, fluent, never pauses to consider failure).
**Hire bucket: Borderline**

Knows the docs cold. Can explain the happy path of any system fluently and confidently. But ask "what happens if the database is down?" and you get a blank stare or a hand-wave. This candidate has learned by building features in controlled environments, not by debugging production fires. The basic defensive thinking and scale consideration sub-components both score 0.

Dangerous for senior roles. Acceptable for junior roles with strong mentorship and explicit edge-case review culture.

*Coaching angle*: Needs exposure to on-call, incident post-mortems, and production debugging. Not a knowledge gap — a perspective gap.

---

**A4. The Theorist**
`High: TD(4-5)` · `Low: RO(1), OE(2)` · `Mid: PS(3), SA(3), CSNR(3), AG(3), ECM(3)`
Conv. flags: High SNR metric (precise language, dense vocabulary) — but zero numbers anywhere.
**Hire bucket: Borderline**

The academic. Could write a textbook chapter on distributed consensus. Has deep conceptual knowledge but consistently fails to connect it to real-world outcomes. Stories are about interesting problems, not business results. Uses "we" exclusively, even for personal projects. The result quantification and business framing sub-components both score 0. The scope extension and initiative sub-components in OE score 0 as well.

Often found in research-adjacent roles or early-career engineers who studied extensively but haven't shipped in high-accountability environments.

*Coaching angle*: Needs to be asked "and what was the measurable result?" after every answer until it becomes instinct.

---

#### Cluster B — Communication

*Candidates where the communication signal cluster (CSNR, SA) dominates the profile.*

---

**B1. The Storyteller**
`High: SA(5), CSNR(4)` · `Low: RO(2)` · `Mid: TD(3), PS(3), OE(3), AG(3), ECM(3)`
Conv. flags: Ideal talk ratio, low fillers, good latency — metrics look clean.
**Hire bucket: Hire**

Exceptional at behavioral questions. Textbook STAR structure: clear Situation, well-defined personal Task, specific Action — and then "the team was really happy with how it turned out." The result is always there in spirit, never in numbers. The result quantification sub-component scores 0 consistently; the result-action linkage sub-component scores 1 at best.

Likely coached on STAR methodology but not on impact quantification. Strong for roles where communication and stakeholder management matter more than measurable output (early-stage startups, client-facing, PM-adjacent).

*Coaching angle*: One targeted habit change: end every story with a number. Even an estimate ("roughly 20% faster") is sufficient.

---

**B2. The Rambler**
`High: TD(4)` · `Low: CSNR(1-2), SA(1-2)` · `Mid: PS(3), RO(3), OE(3), AG(3), ECM(3)`
Conv. flags: High talk ratio, low SNR metric, high filler frequency — metrics are all red.
**Hire bucket: Borderline**

Knows their subject but cannot get out of their own way. Every answer starts at the beginning of time and arrives at the point eventually — if at all. The answer-first structure sub-component scores 0. Filler frequency scores 0 (inverse). Sentence economy scores 0. Interviewers who don't know the domain disengage early. Interviewers who do will excavate signal if patient — most won't be.

This is the archetype most likely to have their career growth blocked by communication, not by capability.

*Coaching angle*: The BLUF habit (Bottom Line Up Front). Every answer must open with the conclusion in one sentence, before any context.

---

**B3. The Executive Communicator**
`High: CSNR(5), RO(4-5)` · `Low: — (no critical lows)` · `Mid: TD(3-4), PS(3-4), SA(4), OE(3-4), AG(3-4), ECM(3)`
Conv. flags: Ideal talk ratio, near-zero fillers, answer-first on every question.
**Hire bucket: Strong Hire**

Communicates like a VP, thinks like a senior IC. Every answer starts with the conclusion; every story ends with a specific number. The answer-first structure and result quantification sub-components both score 2 consistently. Likely a high performer with cross-functional or customer-facing experience.

The one calibration: if TD is only 3, this profile is a strong generalist (PM, EM, senior IC-adjacent roles) but not deep enough for a principal technical role. The hire bucket stays Strong Hire for most role types.

*Coaching angle*: If technical depth is the gap, they already have the communication framework. Technical depth is the slower, harder build.

---

**B4. The Imposter**
`High: CSNR(4-5)` · `Low: TD(1-2), ECM(1)` · `Mid: SA(3), RO(3), OE(3), PS(2), AG(2)`
Conv. flags: Ideal metrics across the board — this is the trap.
**Hire bucket: No Hire**

The most dangerous archetype for untrained interviewers. Sounds polished, confident, and articulate. CONV_INTEL metrics are all green. But probe any technical answer and there is nothing behind the vocabulary. Jargon accuracy sub-component scores 2; mechanism explanation and trade-off articulation both score 0. Falls apart on follow-up questions.

This is precisely why the evidence-first scoring model exists. Vibe-based scoring passes this candidate. The LLM extracts verbatim quotes and finds the technical content hollow.

*Coaching angle*: Not a coaching candidate — this is a hiring risk.

---

#### Cluster C — Leadership & Ownership

*Candidates where the ownership/leadership signal cluster (OE, RO, AG) dominates the profile.*

---

**C1. The Driver**
`High: OE(5), RO(4-5), AG(4)` · `Low: — (no critical lows)` · `Mid: TD(3-4), PS(3-4), SA(4), CSNR(3-4), ECM(3)`
Conv. flags: Good talk ratio, moderate latency (thinks before speaking), failure stories are prominent.
**Hire bucket: Strong Hire**

This is what "leadership potential" looks like as a signal pattern. Owns everything — successes, failures, and things outside their scope. Quantifies impact consistently across the interview. Adapts to constraints and narrates what they learned from them. The failure ownership sub-component scores 2; initiative evidence scores 2; result consistency scores 2. Failure stories are detailed because they are not afraid of them.

Likely a senior IC who has managed informally, or a candidate on an EM track.

*Coaching angle*: If ECM is the only weak signal, worth noting — senior ownership without systems-level risk awareness is a gap at the principal level.

---

**C2. The Passenger**
`High: — (no strong signals)` · `Low: OE(1-2), RO(1-2)` · `Mid: TD(3), PS(3), SA(3), CSNR(3), AG(2), ECM(2)`
Conv. flags: Low talk ratio, passive answering pattern, interviewer ends up leading.
**Hire bucket: No Hire**

A competent executor who needs direction. Will complete tasks assigned to them, avoid failure narratives, and frame everything in "we" language. Not malicious — just not an ownership thinker. The personal attribution and scope extension sub-components both score 0. Failure stories end with external causes.

Fine in highly process-driven environments with strong management. Actively harmful in IC-heavy or startup environments where self-direction is expected from day one.

*Coaching angle*: Hard to coach in an interview context. This is usually a cultural fit miss, not a skill gap.

---

**C3. The Pivot Artist**
`High: AG(5)` · `Low: RO(2), SA(2)` · `Mid: TD(3), PS(3-4), CSNR(3), OE(3), ECM(2)`
Conv. flags: Possibly high latency (reflective, takes time to frame); vivid stories, weak endings.
**Hire bucket: Hire**

Learns fast and pivots well. Great in roles with high ambiguity — early startup, consultant, growth teams. The constraint-as-opportunity and failure-to-growth arc sub-components both score 2. But they cannot tell you what the business outcome was — either because they moved on before measuring it, or because they never thought in those terms.

The interview pattern: rich, specific stories about changing direction; endings that trail off into vague outcomes.

*Coaching angle*: Needs to develop the habit of measuring results before pivoting to the next challenge.

---

**C4. The Accountable IC**
`High: OE(4-5)` · `Low: RO(2), CSNR(2)` · `Mid: TD(3), PS(3), SA(3), AG(3), ECM(3)`
Conv. flags: Moderate fillers, functional but not crisp answers.
**Hire bucket: Borderline**

Genuinely owns their work and mistakes — refreshing and rare. But cannot articulate impact in numbers, and communication is workmanlike rather than executive. The failure ownership sub-component scores 2 consistently; the result quantification sub-component scores 0 consistently. Often mid-level ICs in execution-focused environments without exposure to business metrics.

High coachability. Of all the Borderline archetypes, this one has the best foundation for a Strong Hire outcome with focused development.

*Coaching angle*: One conversation about result framing could move this to Hire. The character signals are already there.

---

#### Cluster D — Balanced

*Candidates where no single signal cluster dominates — the overall pattern matters more than any individual signal.*

---

**D1. The Ideal Hire**
`High: All 8 signals (4-5)` · `Low: None` · `Mid: None`
Conv. flags: All green (60–75% talk ratio, near-zero fillers, ideal latency, low interruptions).
**Hire bucket: Strong Hire**

The rarest archetype. Every signal is present and strong. Technical depth with trade-off thinking, structured behavioral stories with quantified results, proactive edge case identification, genuine ownership language, and adaptive behavior under pressure. In practice, this candidate exists — but rarely walks into a generic mock interview. They are usually already employed at top-tier companies and interviewing with significant leverage.

*Note for calibration*: If PrepSignals surfaces an Ideal Hire, verify the CONV_INTEL metrics match. A candidate who scores 5 on all 8 signals but has >78% talk ratio or zero interruptions is possibly performing rather than authentically demonstrating.

---

**D2. The Safe Hire**
`High: None` · `Low: None` · `Mid: All 8 signals (3-4)`
Conv. flags: All metrics within benchmark ranges. No outliers.
**Hire bucket: Hire**

Solid, reliable, no red flags. Will do the job well. Won't transform the team. Mid-level across all signals — proficient at everything, exceptional at nothing. This is actually the most common "yes" in hiring: the candidate who clears every bar comfortably without convincingly clearing any of them.

Not a risk hire. Not an exciting hire. The correct hire for a mid-level IC role with a clear, defined scope and a strong onboarding process.

*Note for calibration*: The Safe Hire is often misidentified as a Strong Hire by untrained interviewers because there are no red flags to anchor on. The weighted rubric corrects for this.

---

**D3. The Near Miss**
`High: 6/8 signals at (4-5)` · `Low: 1 critical signal at (1-2)` · `Mid: 1 signal`
Conv. flags: Varies significantly based on which signal is the gap.
**Hire bucket: Hire or Borderline** (determined by which signal is low)

Defined by what is missing, not by what is present. The specific low signal determines everything:

| Low signal | Implication | Adjusted bucket |
|---|---|---|
| RESULT_ORIENTATION | Coachable gap; doesn't affect technical fit | Hire |
| STAR_ALIGNMENT | Coachable gap; behavioral prep needed | Hire |
| ADAPTABILITY_GROWTH | Moderate risk; hard to assess in single interview | Hire |
| TECHNICAL_DEPTH | Foundational gap for technical roles | Borderline |
| OWNERSHIP_ETHICS | Character signal; harder to develop | Borderline |
| COMMUNICATION_SNR | High-stakes for client-facing or leadership roles | Borderline |
| PROBLEM_SOLVING | Core reasoning gap; difficult to coach quickly | Borderline / No Hire |
| EDGE_CASE_MASTERY | Role-dependent; critical for backend/infra | Borderline (for senior) |

*Hardest archetype to debrief*: The candidate feels like a yes until the gap surfaces — often across 2-3 consecutive questions of the same type.

---

**D4. The Overqualified IC**
`High: TD(5), PS(4-5), ECM(4)` · `Low: SA(2), CSNR(2)` · `Mid: RO(3), OE(3), AG(3)`
Conv. flags: Low talk ratio on behavioral questions (uncomfortable), high latency when pivoting from technical to behavioral.
**Hire bucket: Hire**

A deep technical expert who is possibly interviewing for a role below their level, or who has never received behavioral interview coaching. Technical questions are handled with mastery; behavioral questions cause visible discomfort — answers are short, vague, and structurally weak. Not through inability — through unfamiliarity with the format.

Often a senior engineer (IC5 equivalent) interviewing for a mid-level role, or a specialist moving from a deeply technical culture into one that values storytelling.

*Coaching angle*: One session of behavioral prep — specifically STAR structure and result framing — would likely move this to Strong Hire.

---

#### Cluster E — Deficit & Anti-patterns

*Candidates with specific, diagnostic signal failures. These archetypes are particularly valuable for calibrating the scoring engine because they represent distinct failure modes, not just "low scores."*

---

**E1. The Star Dropper**
`High: Most signals at (3-4)` · `Low: RO(1) consistently` · `Mid: All others`
Conv. flags: Normal metrics — nothing stands out externally.
**Hire bucket: Borderline**

Everything looks reasonable on the surface. Communication is clear, ownership examples exist, technical depth is solid. But across every single behavioral answer, the result is absent or vague. Not one number, percentage, or business outcome across the full interview. The result quantification and result consistency sub-components both score 0 on every answer — not occasionally, systematically.

This is a trainable gap. But untrained, it creates a pattern hiring committees cannot justify: "Why should we believe they had impact if they can't describe it?"

*Coaching angle*: Force the habit of ending every story with a number. Even retrospective estimates ("probably saved us 2 days per sprint") are better than nothing.

---

**E2. The Vague Expert**
`High: TD(4-5) on jargon sub-component only` · `Low: CSNR(1-2)` · `Mid: All others (3)`
Conv. flags: High talk ratio, high filler frequency, low SNR metric.
**Hire bucket: Borderline**

Has genuine technical knowledge but cannot translate it into clear communication. Explanations are technically correct but so dense and meandering that signal is buried. The jargon accuracy sub-component scores 2; the mechanism explanation and design rationale sub-components score 1–2; the answer-first structure and sentence economy sub-components both score 0.

Often self-taught, or from environments where written async communication was more valued than verbal clarity. The gap: they need an interviewer willing to excavate. Most won't.

*Coaching angle*: BLUF habit plus the "explain it to a PM" exercise — forces answer-first structure.

---

**E3. The Underconfident**
`High: TD(3-4)` · `Low: CSNR(1-2)` · `Mid: PS(3), SA(3), RO(3), OE(3), AG(3), ECM(3)`
Conv. flags: Talk ratio below 55% (floor rule risk), long latency, heavy hedging language.
**Hire bucket: Borderline**

Knows the material but undersells every answer. Hedges constantly: "I think...", "I might be wrong but...", "This is probably not the right approach...". Low talk ratio means the interviewer ends up leading — and the floor rule can trigger a biased No Hire recommendation even when technical depth is present.

This is distinct from The Passenger: The Underconfident has the knowledge; The Passenger doesn't have the initiative. The gap here is confidence calibration and answer-first structure — not knowledge.

*Coaching angle*: The highest-leverage fix is simply banning hedge language for one mock session. It forces the candidate to claim their answers.

---

**E4. The Monologist**
`High: Nothing specific` · `Low: CSNR(1-2)` · `Mid: All others (variable)`
Conv. flags: Talk ratio above 78% (ceiling rule), high filler, low SNR metric — all three red simultaneously.
**Hire bucket: Borderline**

Talks a lot, says little. The ceiling rule on talk ratio fires consistently. Takes every question as a prompt for a stream-of-consciousness narrative that may eventually connect to the question. Interviewers feel steamrolled. The SNR metric will be the lowest of any archetype — often below 5%, triggering the verbosity red flag.

Distinct from The Rambler (who has genuine technical depth behind the words): The Monologist often lacks the depth to meaningfully fill the time, so filler, repetition, and tangents dominate.

*Coaching angle*: Hard 90-second answer cap in practice sessions. Forces ruthless prioritization of what to say.

---

**E5. The Reactive**
`High: Nothing specific` · `Low: OE(1), AG(1)` · `Mid: TD(3), PS(2), SA(3), CSNR(3), RO(2), ECM(2)`
Conv. flags: Passive answering pattern, waits to be led, possibly curveball refusal.
**Hire bucket: No Hire**

Does what is assigned, nothing more. When curveballs arrive mid-interview, they freeze or push back on the premise. No scope-extension examples. No growth stories. Failure stories always end with an external cause. Both the failure ownership and the constraint-as-opportunity sub-components score 0.

The combination of low OE and low AG is the clearest No Hire pattern in the rubric — it signals a candidate who neither owns their environment nor adapts to it.

*Coaching angle*: This is a cultural fit miss, not a skill gap. Coaching may surface better examples, but the underlying disposition is harder to change.

---

**E6. The Blame Externalizer**
`High: TD(3-4), CSNR(3)` · `Low: OE(1) — specifically failure ownership sub-component` · `Mid: All others`
Conv. flags: Possibly high talk ratio when narrating failure stories (verbose defensiveness).
**Hire bucket: No Hire**

Distinct from The Reactive because this candidate may be technically competent and communicatively clear. The red flag is surgical: the failure ownership sub-component is a hard zero across every failure question. When asked about a mistake, the answer always ends with an external cause: "The PM changed requirements." "The architecture was already broken when I joined." "The deadline was set without talking to engineering."

This is a team culture risk, not a skill gap. One of the clearest No Hire signals in behavioral assessment — and one of the easiest to miss if the interviewer doesn't probe failure questions specifically.

*Key diagnostic question*: "What specifically could you have done differently?" If the answer re-externalizes, the score is confirmed.

---

**E7. The Answer-First Faker**
`High: CSNR(4-5)` · `Low: TD(1-2), ECM(1)` · `Mid: SA(3), RO(3), OE(2), PS(2), AG(2)`
Conv. flags: Ideal metrics — the trap. Everything looks green externally.
**Hire bucket: No Hire**

The polished surface with no foundation. Has specifically trained answer-first structure and communication delivery, but the technical substance behind it is shallow. Opens every answer with a crisp conclusion, uses the right vocabulary, sounds confident — then falls apart on any follow-up requiring actual depth. The jargon sub-component scores 2; the mechanism explanation, design rationale, and trade-off articulation sub-components all score 0.

Distinct from The Imposter (same base pattern, more deliberate coaching artifact): The Answer-First Faker has optimized specifically for communication signals while letting content atrophy.

The evidence-first model is the only reliable catch for this archetype. Verbatim evidence quotes reveal that the "conclusions" have no supporting structure behind them.

---

**E8. The One-Hit Wonder**
`High: One signal at (5)` · `Low: All other 7 signals at (1-2)` · `Mid: None`
Conv. flags: Varies based on which signal is the dominant one.
**Hire bucket: No Hire**

One genuine area of excellence; everything else is a floor. Often a deep specialist who has never been asked to demonstrate anything outside their narrow domain — or a candidate who practiced one question type extensively (system design, behavioral, or coding) while ignoring the rest.

The weighted rubric handles this correctly by design. A perfect score on TECHNICAL_DEPTH (weight 0.20) contributes at most `5 × 0.20 = 1.00` to the weighted sum, against a maximum possible of `5 × 1.00 = 5.00`. Seven signals scoring 1 caps the total at roughly `(1.00 + 7 × 0.07) / 5.00 ≈ 30%` hire probability — a clear No Hire regardless of the dominant signal.

*Note for calibration*: The One-Hit Wonder is also the clearest indicator of coaching artifacts (candidate practiced one question type only). PrepSignals's round-dynamic question distribution — which forces breadth across all signal types — is specifically designed to surface this archetype.

---

### 9.3 Flat Lookup Table

All 24 archetypes in a single scannable reference. Signal levels: **H** = High (4–5) · **M** = Mid (3) · **L** = Low (1–2)

| # | Archetype | Cluster | High signals | Low signals | Conv. flags | Bucket | One-line |
|---|---|---|---|---|---|---|---|
| A1 | The Deep Diver | Technical | TD, PS, ECM | CSNR, RO | Low SNR metric | Hire | Domain expert who cannot articulate impact |
| A2 | The Architect | Technical | TD, ECM | SA, AG | Fast latency, rigid on curveballs | Hire | Systems thinker, breaks under ambiguity |
| A3 | The Happy Pather | Technical | TD | ECM, PS | High talk ratio | Borderline | Fluent on docs, blind to failure modes |
| A4 | The Theorist | Technical | TD | RO, OE | High SNR vocab, zero numbers | Borderline | Academic depth, no business grounding |
| B1 | The Storyteller | Communication | SA, CSNR | RO | All metrics green | Hire | Great narrative, no numbers anywhere |
| B2 | The Rambler | Communication | TD | CSNR, SA | High talk, low SNR metric | Borderline | Knows the answer, cannot say it clearly |
| B3 | The Executive Communicator | Communication | CSNR, RO | — | All metrics green | Strong Hire | Sounds and performs like a senior |
| B4 | The Imposter | Communication | CSNR | TD, ECM | All metrics green (trap) | No Hire | Polished surface, hollow interior |
| C1 | The Driver | Leadership | OE, RO, AG | — | Good; failure stories prominent | Strong Hire | Owns everything, quantifies everything |
| C2 | The Passenger | Leadership | — | OE, RO | Low talk ratio, passive | No Hire | Executes only when explicitly directed |
| C3 | The Pivot Artist | Leadership | AG | RO, SA | High latency, vivid stories weak endings | Hire | Learns fast, cannot measure outcomes |
| C4 | The Accountable IC | Leadership | OE | RO, CSNR | Moderate; functional not crisp | Borderline | Owns work, cannot quantify it |
| D1 | The Ideal Hire | Balanced | All 8 | None | All green | Strong Hire | Every signal strong; extremely rare |
| D2 | The Safe Hire | Balanced | None (all mid) | None | All in range | Hire | Solid, no spikes, no risks |
| D3 | The Near Miss | Balanced | 6 of 8 | 1 critical signal | Varies by gap | Hire / Borderline | One gap determines everything |
| D4 | The Overqualified IC | Balanced | TD, PS, ECM | SA, CSNR | Low talk on behavioral Qs | Hire | Technical peak, behavioral floor |
| E1 | The Star Dropper | Deficit | Most at 3–4 | RO (consistent zero) | Normal metrics | Borderline | Never says a number, in any answer |
| E2 | The Vague Expert | Deficit | TD (jargon only) | CSNR | High talk, low SNR | Borderline | Right knowledge, wrong words |
| E3 | The Underconfident | Deficit | TD | CSNR | <55% talk, long latency, heavy hedging | Borderline | Knows it, will not claim it |
| E4 | The Monologist | Deficit | — | CSNR | >78% talk, low SNR, high fillers | Borderline | Talks the most, says the least |
| E5 | The Reactive | Deficit | — | OE, AG | Passive; curveball refusal | No Hire | No initiative, no adaptation |
| E6 | The Blame Externalizer | Deficit | TD, CSNR (sometimes) | OE — failure sub-component only | Verbose on failure stories | No Hire | Everything went wrong; never their fault |
| E7 | The Answer-First Faker | Deficit | CSNR | TD, ECM | All metrics green (trap) | No Hire | Clean structure, empty content |
| E8 | The One-Hit Wonder | Deficit | 1 signal only | All other 7 | Varies by dominant signal | No Hire | Peak specialist, floor on everything else |

---

### 9.4 Hire Bucket Distribution of Archetypes

| Bucket | Count | Archetypes |
|---|---|---|
| Strong Hire | 3 | B3 Executive Communicator, C1 Driver, D1 Ideal Hire |
| Hire | 8 | A1 Deep Diver, A2 Architect, B1 Storyteller, C3 Pivot Artist, C4 Accountable IC (with coaching), D2 Safe Hire, D3 Near Miss (depends), D4 Overqualified IC |
| Borderline | 8 | A3 Happy Pather, A4 Theorist, B2 Rambler, C4 Accountable IC, D3 Near Miss (depends), E1 Star Dropper, E2 Vague Expert, E3 Underconfident, E4 Monologist |
| No Hire | 5 | B4 Imposter, C2 Passenger, E5 Reactive, E6 Blame Externalizer, E7 Answer-First Faker, E8 One-Hit Wonder |

*Note: D3 Near Miss and C4 Accountable IC appear in two buckets because their final bucket is contingent on a specific signal or coaching context.*
