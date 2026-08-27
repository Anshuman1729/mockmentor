import Groq from "groq-sdk";
import { getCachedScoring, setCachedScoring, clearCachedScoring } from "./debrief-cache";

// Lazy client — only instantiated on first use (avoids build-time env var errors)
let _client: Groq | null = null;
function getClient(): Groq {
  if (!_client) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY environment variable is not set");
    }
    _client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _client;
}

const MODEL = "openai/gpt-oss-120b";

export interface QAPair {
  question_number: number;
  question: string;
  answer: string | null;
}

export interface SessionContext {
  role: string;
  company: string;
  yoe: number;
  round_type: string;
  jd_content: string;
  background?: string | null;
  total_questions?: number;
  company_stage?: string | null;
  domain?: string | null;
}

export interface SeedQuestion {
  id: string;
  question_text: string;
  expected_signals: string[];
}

function buildRoundInstructions(roundType: string): string {
  switch (roundType.toLowerCase()) {
    case "technical_deep_dive":
      return `You are conducting a Technical Deep Dive. The purpose is to understand HOW the candidate thinks — not what they've memorised.

EVERY question must be scenario-based or reasoning-based. NEVER ask "What is X?" or "Explain Y."
Instead ask: "Given situation Z, how would you approach W? What signals would you look for? What would you try first? What corrective actions would you take?"

After the candidate answers, probe deeper based on their specific answer — don't move to a new topic until you've understood their reasoning.

Example reasoning question style:
- "Your API p99 latency spiked from 200ms to 2s immediately after a deploy. Walk me through your diagnosis — what do you check first, what signals would you look at, and what's your rollback decision criteria?"
- "Your team's feature flag rollout caused a 15% drop in checkout conversion. The deploy looks clean. How do you approach this?"

NEVER ask HR, stakeholder, or leadership questions.`;

    case "technical_screen":
    case "technical":
      return `You are conducting a Technical Screen.

Ask a mix of:
- Knowledge questions: tools, APIs, algorithms, system components relevant to the JD
- 1-2 scenario-based reasoning questions

After the candidate has answered 2+ questions and shown domain knowledge, pivot to at least one scenario-based reasoning question that tests their diagnostic/analytical thinking.

Reasoning question style: Give a real situation with specific numbers or symptoms, ask how they'd diagnose and fix it.
Example: "Your Redis cache hit rate dropped from 95% to 60% after a feature deploy. Walk me through your diagnosis."

NEVER ask HR, stakeholder management, or leadership questions.`;

    case "system_design":
      return `You are conducting a System Design interview.

Ask one focused architecture or design question per turn. Focus on: scalability, tradeoffs, failure modes, data modeling, API design, infrastructure choices.

After initial design, probe with: constraints ("now handle 10x traffic"), failure scenarios ("what happens when the DB goes down?"), or alternative approaches.

NEVER ask HR, behavioral, or knowledge-recall questions like "What is a load balancer?"`;

    case "behavioural":
      return `You are conducting a Behavioral interview. Use STAR-style prompts (Situation, Task, Action, Result).

Focus on: leadership, conflict resolution, collaboration, handling failure, communication, growth mindset.

After a STAR answer, follow up on the specific details they gave — probe the Action and Result.

NEVER ask technical questions about code, algorithms, or system design.`;

    case "final":
      return `You are conducting a Final Round interview. Mix technical depth with behavioral judgment.

Split roughly: 60% technical (1 scenario-based reasoning question required), 40% behavioral (STAR format).

Technical questions should test depth, not breadth. Behavioral questions should focus on leadership and decision-making.`;

    case "hr_screen":
      return `You are conducting an HR Screen. Focus on culture fit, motivation, career goals, and team preferences.

Ask about: why this role, what they're looking for, working style, values alignment.

NEVER ask technical, algorithmic, or system design questions.`;

    case "case_study":
      return `You are conducting a Case Study interview. Present a business or technical scenario and guide the candidate through a structured analysis.

Each question should build on their previous answer — probe their framework, assumptions, and recommendations.

Start with a high-level scenario, then go deeper based on their response.`;

    default:
      return `You are conducting a ${roundType} interview. Ask one focused question per turn relevant to the role and JD.`;
  }
}

function buildDifficultyInstruction(yoe: number): string {
  if (yoe <= 1) {
    return `Difficulty: Junior (0-1 YOE). Ask foundational questions. Test core concepts and basic problem-solving. Avoid advanced distributed systems, architecture tradeoffs, or large-scale design. The goal is to test practical competence, not intimidate.`;
  } else if (yoe <= 3) {
    return `Difficulty: Mid-level (2-3 YOE). Expect solid fundamentals and some hands-on project experience. Ask about real trade-offs they've encountered, not just theory. Avoid staff-level system design or team leadership questions.`;
  } else if (yoe <= 6) {
    return `Difficulty: Senior (4-6 YOE). Expect ownership of systems, cross-team coordination, and technical depth. Ask about design decisions, failure modes, and lessons learned. One reasoning scenario is appropriate.`;
  } else {
    return `Difficulty: Staff/Principal (7+ YOE). Expect org-level thinking, architectural decisions with long-term consequences, and leadership under ambiguity. Reasoning and scenario questions should involve systemic complexity.`;
  }
}

export async function generateNextQuestion(
  session: SessionContext,
  previousQAs: QAPair[],
  seedQuestion?: SeedQuestion
): Promise<string> {
  const answeredCount = previousQAs.filter((qa) => qa.answer !== null).length;
  const totalTarget = session.total_questions ?? 7;
  const isFirstQuestion = previousQAs.length === 0;

  const qaHistory =
    previousQAs
      .filter((qa) => qa.answer !== null)
      .map((qa) => `Q${qa.question_number}: ${qa.question}\nA: ${qa.answer}`)
      .join("\n\n") || "No previous questions yet.";

  const backgroundSection = session.background
    ? `\nCandidate Resume / Background:\n${session.background}\n`
    : "";

  const lastAnswer = previousQAs.filter((qa) => qa.answer !== null).slice(-1)[0];

  const questionInstruction = isFirstQuestion
    ? `This is question 1 of ${totalTarget}. Ask an open-ended opener to understand who the candidate is — their current role, key experience, and what they're looking to do next. Make it feel natural and conversational, not a checklist. Do NOT ask a technical question yet.`
    : `Target ${totalTarget} questions total. You have asked ${answeredCount} so far.

This is a live discussion, not a checklist being read out loud. Before writing your next question, decide: does the candidate's last answer deserve a follow-up — a specific claim worth probing, a detail worth digging into, an assumption worth testing — or have you learned enough on this topic to move on?
Default to following up at least once per topic. When you do follow up, reference something specific they actually said (quote or paraphrase it) — don't ask a generic pre-written question that ignores their answer.
${lastAnswer ? `\nTheir last answer was: "${lastAnswer.answer}"` : ""}`;

  const roundInstructions = buildRoundInstructions(session.round_type);
  const difficultyInstruction = buildDifficultyInstruction(session.yoe);

  const seedSection = seedQuestion
    ? `\n[SEED QUESTION — adapt this to fit the conversation flow and candidate background]
Base question: ${seedQuestion.question_text}
Target signals: ${seedQuestion.expected_signals.join(", ")}
Do NOT copy verbatim — rephrase naturally for this specific candidate and context.\n`
    : "";

  const systemPrompt = `You are a senior interviewer at ${session.company} conducting a ${session.round_type} interview for a ${session.role} position.
${backgroundSection}
Job Description:
${session.jd_content.slice(0, 4000)}

--- ROUND INSTRUCTIONS ---
${roundInstructions}

--- DIFFICULTY ---
${difficultyInstruction}

${questionInstruction}
${seedSection}
Ask exactly ONE question, and make it a single, self-contained ask — not several requirements stacked into one sentence via commas or "and" (e.g. don't ask for a design AND the implementation details AND the tradeoffs AND the failure handling all at once — that's four questions wearing one question mark). No bullet points, no numbered sub-parts. If there are several angles worth exploring, pick the single most important one now — you'll get another turn to follow up based on their answer.

Output ONLY the next interview question. No preamble, no labels, no explanation.`;

  const completion = await getClient().chat.completions.create({
    model: MODEL,
    max_tokens: 320,
    // openai/gpt-oss-120b defaults to 'medium' reasoning effort, which burns
    // hidden reasoning tokens out of the same max_tokens budget before ever
    // emitting the visible answer — a low-complexity task like "write one
    // interview question" doesn't need that, and at a tight token budget it
    // can consume the whole budget and return an empty completion.
    reasoning_effort: "low",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Previous Q&As:\n${qaHistory}\n\nProvide the next interview question.`,
      },
    ],
  });

  return completion.choices[0].message.content?.trim() ?? "";
}

/**
 * Generate a domain-specific question when no seed exists for the user's domain.
 * Called only when: seed === null AND session.domain is set AND the round is
 * a technical-style round (the caller gates this — see seedRoundType() in the
 * question route). This function has no HR/behavioral awareness of its own,
 * so it must never be reached for an HR screen or behavioral round.
 */
export async function generateDomainQuestion(
  session: SessionContext,
  previousQAs: QAPair[]
): Promise<string> {
  const domain = session.domain ?? "technical";

  const answeredQAs = previousQAs.filter((qa) => qa.answer !== null);
  const previousQABlock =
    answeredQAs.length > 0
      ? `\n[PREVIOUS Q&As]\n${answeredQAs
          .map((qa) => `Q${qa.question_number}: ${qa.question}\nA: ${qa.answer}`)
          .join("\n\n")}\n`
      : "";

  const companyContextBlock = session.company_stage
    ? `\n[COMPANY CONTEXT]\n- Company stage: ${session.company_stage}\n- Seed/Series A companies prize ownership + breadth; Series B/Public companies prize depth + scalability.\n`
    : "";

  const difficultyInstruction = buildDifficultyInstruction(session.yoe);

  const fewShotExamples = `
[FEW-SHOT EXAMPLES — for STYLE only: specific and scenario-grounded, not generic textbook trivia. NOT for required difficulty — these happen to be senior-level; scale actual complexity to the YOE guidance above, not to these examples.]

Example 1 (Embedded/BMS, senior-level):
Q: "Walk me through how you'd design a State of Charge estimation algorithm for a lithium-ion battery pack. What are the tradeoffs between Coulomb counting and Extended Kalman Filter approaches?"

Example 2 (ML Infra, senior-level):
Q: "Your distributed training job is experiencing gradient staleness with async SGD across 64 GPUs. How do you diagnose whether this is a network bottleneck vs compute imbalance?"

Example 3 (same ML Infra domain, junior-level — same specificity, far lower complexity):
Q: "You're training a small model and notice the loss isn't decreasing after a few epochs. What's the first thing you'd check?"
`;

  const completion = await getClient().chat.completions.create({
    model: MODEL,
    max_tokens: 320,
    // See generateNextQuestion — gpt-oss-120b's default 'medium' reasoning
    // effort can otherwise consume the whole token budget before emitting
    // any visible answer.
    reasoning_effort: "low",
    messages: [
      {
        role: "system",
        content: `You are a senior ${domain} technical interviewer conducting a ${session.round_type} interview at ${session.company}.

--- DIFFICULTY (this governs complexity, not the examples below) ---
${difficultyInstruction}

${fewShotExamples}
${companyContextBlock}
RULES:
- Ask exactly ONE question, and make it a single, self-contained ask — not several requirements stacked into one sentence via commas or "and" (e.g. don't ask for a design AND the data pipeline AND the statistical method AND the guardrails all at once). No preamble, no bullet points, no numbered sub-parts.
- Questions must require deep ${domain} expertise — a generic backend interviewer should not know to ask this — but expertise depth and question complexity are two different things: match complexity to the YOE guidance above.
- Do not repeat topics from previous Q&As.${session.jd_content ? `\n- Stay relevant to the JD: ${session.jd_content.slice(0, 800)}` : ""}${session.background ? `\n- Tailor to candidate background: ${session.background.slice(0, 500)}` : ""}`,
      },
      {
        role: "user",
        content: `${previousQABlock}
Ask the next ${domain} interview question. Return only the question text, nothing else.`,
      },
    ],
  });

  return (
    completion.choices[0].message.content?.trim() ??
    "Tell me about a challenging technical problem you solved in your domain."
  );
}

export interface SkillAnalysis {
  parameter_id: string; // matches INTERVIEW_RUBRIC keys
  rating: number;       // 1-5 BARS scale
  reasoning: string;
  evidence_quotes: string[];
}

export interface QuestionWalkthroughEntry {
  question_number: number;
  key_takeaway: string; // what happened in this answer AND what it signals for the hire decision
  signal_ids: string[]; // 1-3 of the 8 parameter_ids this question mainly produced evidence for
}

export interface ModelAnswer {
  question_number: number;  // the actual question this illustrates a stronger answer to
  parameter_id: string;     // the weak signal this addresses (should be a low-rated one)
  your_quote: string;       // verbatim — must be one of that signal's evidence_quotes, word-for-word
  why_it_hurt: string;      // one sentence, in the interviewer's likely read of that exact quote — not generic advice
  framework: string;        // short framework name — must be one of the 3 canonical frameworks (see SIGNAL_FRAMEWORKS)
  model_excerpt: string;    // 2-4 sentences: a concrete, plausible stronger answer to that specific question
}

export interface PriorityRisk {
  title: string;              // short, e.g. "Evidence gap" — a root cause, not a symptom
  description: string;        // one sentence: what the pattern actually is, in plain language
  related_signal_ids: string[]; // which of the 8 signals this root cause explains (usually 2-4)
}

export interface DebriefReport {
  summary: {
    recommendation: "Strong Hire" | "Hire" | "Borderline" | "No Hire";
    hire_probability: number; // 0-100 — injected by TS, not LLM
    overall_impression: string;
  };
  metrics: {
    talk_to_listen_ratio: string;   // e.g. "72/28"
    avg_response_latency_sec: number;
    signal_to_noise_ratio: number;  // 0.0-1.0
    interruption_count: number;
    // Both injected by TS from real instrumentation, not LLM-estimated —
    // unlike the four fields above, these come straight from
    // qa_pairs.answer_duration_sec and sessions.candidate_questions_asked
    // (Backlog #10/#11: data was already collected but never surfaced).
    // No research-backed benchmark exists for either yet, so the UI shows
    // them as plain stats rather than inventing ideal/watch/flag bands.
    longest_monologue_sec?: number;
    candidate_questions_asked?: number;
  };
  skill_analysis: SkillAnalysis[]; // exactly 8 items — supporting detail behind priority_risks, not the primary read
  question_walkthrough: QuestionWalkthroughEntry[]; // one entry per answered question, in order
  // The consolidated root-cause layer: 2-3 items, not 8 separate scores.
  // Every signal in skill_analysis rated <=3 must be explained by at least
  // one priority_risk's related_signal_ids — these are root causes, the 8
  // signals are the evidence for them, not a parallel list of problems.
  priority_risks: PriorityRisk[];
  model_answers: ModelAnswer[]; // up to 3 — one per priority_risk where the transcript supports it
  // One sentence: what single piece of evidence, if present in the
  // transcript, would most likely move the recommendation up one tier
  // (e.g. Borderline -> Hire). Grounded in what's actually missing, not
  // generic advice.
  path_to_next_tier: string;
  behavioral_insights: {
    star_adherence_score: number;   // 0-100
    confidence_level: "High" | "Medium" | "Low";
    confidence_rationale: string;   // why — tied to answer count/coverage, e.g. "few platform-specific questions were asked"
    red_flags: string[];
  };
  actionable_feedback: {
    strengths: string[];
    growth_areas: string[];
    top_priority_fix: string;
  };
}

const SIGNAL_ANCHORS = `
TECHNICAL_DEPTH (weight 20%): 1=Unsatisfactory (vague/incorrect terms) | 3=Proficient (correct jargon, explains how but not why) | 5=Exceptional (SME-level, proactive trade-offs)
PROBLEM_SOLVING (weight 15%): 1=Rigid (fails with ambiguity) | 3=Adaptive (functional solutions, handles hints) | 5=Strategic (identifies edge cases, optimizes independently)
STAR_ALIGNMENT (weight 15%): 1=Disorganized (rambles, no clear story) | 3=Structured (clear Situation/Task/Action, weak Result) | 5=Highly Structured (quantifiable Result linked to Action)
COMMUNICATION_SNR (weight 12%): 1=Vague/Wordy (low signal-to-noise) | 3=Direct (answers question first, moderate filler) | 5=Concise (executive presence, zero filler, answer-first)
RESULT_ORIENTATION (weight 13%): 1=Input-focused (talks tasks, not outcomes) | 3=Output-focused (mentions completions, no %) | 5=Impact-focused (quantifies impact with specific numbers)
OWNERSHIP_ETHICS (weight 10%): 1=Passive (does only what's assigned) | 3=Reliable (completes tasks, owns mistakes) | 5=Proactive (solves problems outside direct scope)
ADAPTABILITY_GROWTH (weight 8%): 1=Resistant (defensive, ignores hints) | 3=Receptive (incorporates feedback when prompted) | 5=Growth-focused (seeks feedback, treats constraints as opportunities)
EDGE_CASE_MASTERY (weight 7%): 1=Surface-level (misses failure modes, assumes happy path) | 3=Aware (identifies basic edge cases when asked) | 5=Preemptive (proactively flags race conditions, scale risks)
`.trim();

// ─── Debrief generation — split into two Groq calls ─────────────────────────
// Was one call with max_tokens:12000. Groq's TPM rate limiter counts the
// reserved max_tokens toward the budget, not just actual prompt size — so on
// an 8000 TPM account tier, max_tokens:12000 alone exceeded the entire
// budget before a single prompt token was counted, regardless of transcript
// length. Confirmed in production: a very short interview hit the identical
// 413 as a long one, because the fixed prompt overhead (few-shot examples,
// rubric, schema, instructions) dominated over the transcript either way.
//
// Split along the real dependency boundary: raw scoring (skill_analysis,
// metrics, question_walkthrough — evidence read directly off the transcript)
// produces the foundation; synthesis (priority_risks, model_answers,
// overall_impression, behavioral_insights, actionable_feedback) reasons
// ABOUT that scoring, not just against the transcript, so it runs second and
// receives Call 1's skill_analysis as grounding context. Synthesis still
// needs the transcript too — model_answers pulls fresh verbatim quotes that
// don't have to already be in evidence_quotes. Each call's own prompt+
// max_tokens is sized to stay comfortably under an 8000 TPM ceiling; see the
// token-budget comments on each max_tokens value below.

const CORE_SCORING_EXAMPLE = `
[EXAMPLE — follow this exact JSON structure and evidence style; one signal and one question shown, produce all 8 signals and one question_walkthrough entry per answered question]
{
  "metrics": {
    "talk_to_listen_ratio": "68/32",
    "avg_response_latency_sec": 2.0,
    "signal_to_noise_ratio": 0.31,
    "interruption_count": 0
  },
  "skill_analysis": [
    {
      "parameter_id": "TECHNICAL_DEPTH",
      "rating": 5,
      "reasoning": "Candidate explained Kafka consumer group rebalancing internals and chose exactly-once semantics with clear trade-off reasoning against at-least-once.",
      "evidence_quotes": [
        "We used sticky partition assignors to reduce rebalance latency from 8 seconds down to under 400ms in our consumer fleet",
        "I specifically chose transactional producers over idempotent-only because we needed cross-partition atomicity for our order state machine"
      ]
    }
  ],
  "question_walkthrough": [
    {
      "question_number": 1,
      "key_takeaway": "Opened with a specific rebalancing latency fix (8s to 400ms) instead of a generic self-intro — immediately signaled hands-on ownership of production systems, the kind of concrete detail that earns trust in the first 60 seconds of a screen.",
      "signal_ids": ["TECHNICAL_DEPTH", "RESULT_ORIENTATION"]
    }
  ]
}
`.trim();

// A4: trimmed from a full-report example to just what teaches register — the
// first-person interviewer voice and the Observed -> Problem -> Better
// structure are the entire point of the "Coaching Cockpit" rework (direct
// user feedback, see CLAUDE.md). The dropped fields (second priority_risks
// entry, path_to_next_tier, behavioral_insights, actionable_feedback) are
// mechanical and already fully specified by instructions #4/#5 and the
// "Return this exact structure" schema block below — this is the one Part A
// trim with real quality risk and it could not be verified against a real
// Groq response in this sandbox (api.groq.com is egress-blocked).
const SYNTHESIS_EXAMPLE = `
[EXAMPLE — No Hire case (TECHNICAL_DEPTH 2, COMMUNICATION_SNR 2 from Call 1's scoring); follow this exact JSON structure and register]
{
  "summary": {
    "overall_impression": "I never got past surface-level descriptions — every time I pushed for how or why, I got restated context instead of a decision. I can't verify real understanding from this transcript, and that's a no."
  },
  "priority_risks": [
    {
      "title": "Evidence gap",
      "description": "Makes claims about tools and decisions without the reasoning or specifics that would let an interviewer verify real understanding.",
      "related_signal_ids": ["TECHNICAL_DEPTH", "PROBLEM_SOLVING"]
    }
  ],
  "model_answers": [
    {
      "question_number": 1,
      "parameter_id": "TECHNICAL_DEPTH",
      "your_quote": "We used Kubernetes because it's the industry standard and everyone uses it these days",
      "why_it_hurt": "This reads as pattern-matching on a buzzword rather than a decision tied to an actual constraint, which is what an interviewer is listening for.",
      "framework": "Answer → Reasoning → Trade-off",
      "model_excerpt": "We moved to Kubernetes specifically because our deploy cadence was blocked on manual VM provisioning — it was taking us 40 minutes per release. K8s let us define declarative deployments and roll back in under a minute. The trade-off was operational complexity: we had to invest two weeks in on-call runbooks before it paid off."
    }
  ]
}
`.trim();

export interface DebriefResult {
  report: DebriefReport;
  usage: { input_tokens: number; output_tokens: number; model: string };
}

// ─── TPM rate-limit gating (see docs/plans/debrief-tpm-fix.md) ──────────────
// Groq's TPM budget is a rolling 60s window, org-level, input+output, with
// max_tokens counted up front as reserved capacity. Call 1 (scoring) and
// call 2 (synthesis) fire back-to-back, so call 2 can land against an
// already-exhausted window even though call 1 itself succeeded. These
// helpers let generateDebrief make an informed go/wait/defer decision using
// call 1's own rate-limit response headers instead of guessing.

// Reserve this many tokens beyond estimateTokens' raw estimate before
// deciding call 2 fits in the remaining TPM budget. estimateTokens is a
// character-count approximation (±15%), not a real tokenizer count, and this
// absorbs that error so a false "proceed" doesn't immediately 429.
export const SYNTHESIS_TOKEN_SAFETY_MARGIN = 500;

// How long we're willing to block a single request inline waiting for the
// TPM window to reset before giving up and asking the client to retry.
// Paired with `maxDuration` on the debrief route (see route.ts) — must stay
// comfortably under that ceiling once the two Groq calls and the post-call
// DB writes/email are accounted for.
export const MAX_INLINE_WAIT_MS = 20_000;

// Fallback wait hint returned to the client when we know call 2 won't fit
// but don't know how long until the TPM window resets (x-ratelimit-reset-
// tokens was absent or unparseable on an otherwise-informative response).
// This is a display hint only — the client's own bounded single auto-retry
// is what actually protects against a bad guess here, not this number.
const DEFAULT_DEFER_RETRY_MS = 5_000;

export class DebriefSynthesisDeferredError extends Error {
  retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super("Debrief synthesis deferred — TPM budget insufficient for call 2 within the inline wait window");
    this.name = "DebriefSynthesisDeferredError";
    this.retryAfterMs = retryAfterMs;
  }
}

// Character-count approximation of token count — NOT a real tokenizer.
// Deliberately not adding a tokenizer dependency for this: the estimate only
// needs to be right within a few hundred tokens to make a go/no-go call, and
// SYNTHESIS_TOKEN_SAFETY_MARGIN absorbs the rest.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

// Groq's `x-ratelimit-reset-tokens` header is a Go-style duration string
// ("7.66s", "120ms", "2m59.56s"), not a plain number — parseFloat() on that
// silently yields 2 for "2m59.56s" (a 180s wait misread as 2ms). Sums every
// (number, unit) pair found in the string; returns null if nothing matches
// so callers can fail open instead of trusting a garbage 0.
const DURATION_UNIT_MS: Record<string, number> = {
  ns: 1e-6,
  us: 1e-3,
  "µs": 1e-3,
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
};
const DURATION_TOKEN_RE = /(\d+(?:\.\d+)?)(ns|us|µs|ms|s|m|h)/g;

export function parseGroqResetDuration(v: string | null | undefined): number | null {
  if (!v || typeof v !== "string") return null;
  let totalMs = 0;
  let matchedAny = false;
  // Reset lastIndex explicitly — DURATION_TOKEN_RE is a module-level /g
  // regex, and reusing a stateful global regex across calls without
  // resetting lastIndex is a classic source of intermittent, input-order-
  // dependent bugs.
  DURATION_TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DURATION_TOKEN_RE.exec(v)) !== null) {
    matchedAny = true;
    const value = parseFloat(match[1]);
    const unitMs = DURATION_UNIT_MS[match[2]];
    totalMs += value * unitMs;
  }
  if (!matchedAny) return null;
  return Math.round(totalMs);
}

export type SynthesisGate =
  | { action: "proceed" }
  | { action: "wait"; ms: number }
  | { action: "defer"; retryAfterMs: number };

// The actual go/wait/defer decision for call 2, given call 1's rate-limit
// headers (already parsed to numbers/ms upstream). remainingTokens === null
// means the header was absent or unparseable — in that case we have no
// signal at all and MUST fail open to "proceed" (today's behavior), never
// block debrief generation over a missing header. Once we know we're short
// on budget, resetMs === null means we know we're short but don't know for
// how long — that's a "defer", not a silent proceed, since waiting an
// unknown amount of time inline is worse than a client-side retry.
export function decideSynthesisGate(input: {
  remainingTokens: number | null;
  resetMs: number | null;
  needTokens: number;
  maxInlineWaitMs: number;
}): SynthesisGate {
  const { remainingTokens, resetMs, needTokens, maxInlineWaitMs } = input;

  if (remainingTokens === null) {
    return { action: "proceed" };
  }
  if (remainingTokens >= needTokens) {
    return { action: "proceed" };
  }
  if (resetMs !== null && resetMs <= maxInlineWaitMs) {
    return { action: "wait", ms: resetMs + 250 };
  }
  return { action: "defer", retryAfterMs: resetMs ?? DEFAULT_DEFER_RETRY_MS };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseIntHeader(v: string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

// Shared call+error-handling wrapper for both debrief calls — the 413/rate-
// limit/bad-request mapping and finish_reason==='length' check apply
// identically to either. label distinguishes the two in logs.
type CallHeaders = { remainingTokens: number | null; resetMs: number | null };

async function runDebriefCompletion(
  systemPrompt: string,
  maxTokens: number,
  label: "scoring" | "synthesis"
): Promise<{ raw: string; usage: { input_tokens: number; output_tokens: number }; headers: CallHeaders }> {
  const { completion, headers } = await (async () => {
    try {
      const { data, response } = await getClient()
        .chat.completions.create(
          {
            model: MODEL,
            max_tokens: maxTokens,
            // See generateNextQuestion — gpt-oss-120b's default 'medium' reasoning
            // effort burns hidden reasoning tokens out of the same max_tokens budget.
            reasoning_effort: "low",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: "Generate the structured JSON." },
            ],
          },
          // The SDK's default maxRetries:2 with exponential backoff cannot
          // succeed against a 60s TPM rolling window (it only honours
          // retry-after when under 60s, otherwise falls back to a useless
          // 0.5s/1s backoff) — it just burns 3 requests for a guaranteed
          // eventual failure. Our own gating (decideSynthesisGate) replaces
          // this for call 2; call 1 fails fast on its own errors.
          { maxRetries: 0 }
        )
        .withResponse();
      return {
        completion: data,
        headers: {
          remainingTokens: parseIntHeader(response.headers.get("x-ratelimit-remaining-tokens")),
          resetMs: parseGroqResetDuration(response.headers.get("x-ratelimit-reset-tokens")),
        } as CallHeaders,
      };
    } catch (apiErr) {
      // Confirmed in production: Groq returns HTTP 413 (not the 429 that
      // Groq.RateLimitError maps to) when a single request's token need
      // exceeds the account's tokens-per-minute (TPM) budget outright. That's
      // a capacity ceiling on the account's current Groq tier, not a
      // transient throttle — waiting and retrying will fail identically, so
      // this must not get the generic "try again in a moment" message.
      if (apiErr instanceof Groq.APIError && apiErr.status === 413) {
        console.error(`[generateDebrief:${label}] Groq TPM capacity exceeded:`, apiErr.status, apiErr.error);
        throw new Error("This interview's transcript is too large for the AI service's current capacity — please contact support.");
      }
      if (apiErr instanceof Groq.RateLimitError) {
        // apiErr.headers is a plain Record<string, string|null|undefined>
        // (not a fetch Headers object — that's only true on the success
        // path's `response`), so bracket access, not .get(). Attached to the
        // thrown error for observability only; this doesn't change the
        // user-facing message or status — call 1 hitting 429 is a different,
        // pre-existing failure from the call-2-gating path this plan adds.
        const resetMs = parseGroqResetDuration(apiErr.headers?.["x-ratelimit-reset-tokens"] ?? null);
        console.error(`[generateDebrief:${label}] Groq rate limit:`, apiErr.status, apiErr.error, { resetMs });
        const err = new Error("The AI service is rate-limited right now — please wait a minute and try again.") as Error & {
          groqResetMs?: number | null;
        };
        err.groqResetMs = resetMs;
        throw err;
      }
      if (apiErr instanceof Groq.BadRequestError) {
        console.error(`[generateDebrief:${label}] Groq rejected the request:`, apiErr.status, apiErr.error);
        throw new Error("Your interview transcript was too long for the report to process — please contact support.");
      }
      if (apiErr instanceof Groq.APIError) {
        console.error(`[generateDebrief:${label}] Groq API error:`, apiErr.status, apiErr.error);
        throw new Error("The AI service returned an unexpected error — please try again in a moment.");
      }
      throw apiErr;
    }
  })();

  const choice = completion.choices[0];
  if (choice.finish_reason === "length") {
    console.error(
      `[generateDebrief:${label}] response truncated by max_tokens (${completion.usage?.completion_tokens} completion tokens used)`
    );
    throw new Error("The report generation ran out of room and was cut off — please try again.");
  }

  const raw = choice.message.content?.trim() ?? "";
  const usage = {
    input_tokens: completion.usage?.prompt_tokens ?? 0,
    output_tokens: completion.usage?.completion_tokens ?? 0,
  };
  // A6: per-call token usage logging. generateDebrief's returned `usage` is
  // combined across both calls (persisted as-is to debriefs.tokens_used, an
  // existing contract not changed here) — so today the per-call split is
  // otherwise unrecoverable, and every max_tokens reservation in this file
  // is an estimate nobody can check against reality. This is the instrument
  // that makes the next token-budget iteration data-driven.
  console.log(`[generateDebrief:${label}] token usage`, {
    label,
    prompt_tokens: usage.input_tokens,
    completion_tokens: usage.output_tokens,
  });

  return { raw, usage, headers };
}

function parseDebriefJson<T>(raw: string, label: string): T {
  const jsonStr = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  try {
    return JSON.parse(jsonStr) as T;
  } catch (parseErr) {
    console.error(`[generateDebrief:${label}] failed to parse LLM response as JSON:`, parseErr);
    console.error(`[generateDebrief:${label}] raw response (first 2000 chars):`, raw.slice(0, 2000));
    throw new Error("The report came back malformed — please try again.");
  }
}

export type CoreScoring = Pick<DebriefReport, "metrics" | "skill_analysis" | "question_walkthrough">;
type Synthesis = Pick<
  DebriefReport,
  "priority_risks" | "model_answers" | "path_to_next_tier" | "behavioral_insights" | "actionable_feedback"
> & { summary: { overall_impression: string } };

// A3: select a reduced transcript for the synthesis call rather than paying
// for the full transcript twice (~2,400 tokens duplicated on a typical
// 8-question round). Synthesis only needs the transcript at all for one
// reason — model_answers[].your_quote pulls a fresh verbatim quote that
// doesn't have to already be in a signal's evidence_quotes — and
// model_answers only ever targets weak (<=3) signals. Never fails closed:
// any missing input (empty question_walkthrough, empty weakSignals) falls
// back to the full transcript.
function buildSynthesisTranscript(qas: QAPair[], scoring: CoreScoring, maxAnswerChars: number): string {
  const fullTranscript = qas
    .map(
      (qa) =>
        `Q${qa.question_number}: ${qa.question}\nAnswer: ${
          qa.answer ? qa.answer.slice(0, maxAnswerChars) : "(no answer provided)"
        }`
    )
    .join("\n\n");

  const weakSignals = new Set(
    (scoring.skill_analysis ?? []).filter((s) => s.rating <= 3).map((s) => s.parameter_id)
  );
  const walkthrough = scoring.question_walkthrough ?? [];
  if (weakSignals.size === 0 || walkthrough.length === 0) {
    return fullTranscript;
  }

  const relevantQuestionNumbers = new Set(
    walkthrough
      .filter((entry) => (entry.signal_ids ?? []).some((id) => weakSignals.has(id)))
      .map((entry) => entry.question_number)
  );

  let selected = qas.filter((qa) => relevantQuestionNumbers.has(qa.question_number));
  // Floor at 3 — pad with whatever else is available, in original order, if
  // the weak-signal match came back thinner than that.
  if (selected.length < 3) {
    const selectedNumbers = new Set(selected.map((qa) => qa.question_number));
    for (const qa of qas) {
      if (selected.length >= 3) break;
      if (!selectedNumbers.has(qa.question_number)) selected.push(qa);
    }
  }
  // Cap at 5 — no priority_risks synthesis needs more source material than that.
  selected = selected
    .sort((a, b) => a.question_number - b.question_number)
    .slice(0, 5);

  if (selected.length === 0) return fullTranscript;

  return selected
    .map(
      (qa) =>
        `Q${qa.question_number}: ${qa.question}\nAnswer: ${
          qa.answer ? qa.answer.slice(0, maxAnswerChars) : "(no answer provided)"
        }`
    )
    .join("\n\n");
}

export async function generateDebrief(
  sessionId: string,
  session: SessionContext,
  qas: QAPair[]
): Promise<DebriefResult> {
  // Cap each answer the same way jd_content is already capped below — an
  // uncapped transcript (e.g. a long round with rambling answers) can push
  // either call's prompt past Groq's context/rate limits. 4000 chars is
  // generous for a single spoken answer (roughly 700-800 words) while
  // bounding the worst case.
  const MAX_ANSWER_CHARS = 4000;
  // A1: session.background is user-pasted resume text via the TMAY/setup
  // flow — 4,000-8,000 chars is entirely normal and, until now, uncapped
  // here despite being interpolated into BOTH calls' prompts (unlike
  // jd_content and each answer, which already had caps). The single largest
  // uncontrolled input in the whole debrief path — see plan §1 correction 4.
  const MAX_BACKGROUND_CHARS = 1200;
  // A2: the scoring task is "rate what the candidate said against BARS
  // anchors," not "audit JD fit" — the first ~1,200 chars of a JD reliably
  // carry role, seniority and core requirements; the rest is boilerplate.
  const MAX_JD_CHARS = 1200;

  const qaText = qas
    .map(
      (qa) =>
        `Q${qa.question_number}: ${qa.question}\nAnswer: ${
          qa.answer ? qa.answer.slice(0, MAX_ANSWER_CHARS) : "(no answer provided)"
        }`
    )
    .join("\n\n");

  const backgroundLine = session.background
    ? `- Background: ${session.background.slice(0, MAX_BACKGROUND_CHARS)}\n`
    : "";

  const companyContextBlock = session.company_stage
    ? `\n[COMPANY CONTEXT]\n- Company stage: ${session.company_stage}\n- Calibrate your scoring accordingly: Seed/Series A companies prize ownership and breadth; Series B/Public companies prize depth, process, and scalability.\n`
    : "";

  const sessionHeader = `Session details:
- Role: ${session.role}
- Company: ${session.company}
- Round type: ${session.round_type}
- Years of experience: ${session.yoe}
${backgroundLine}${companyContextBlock}
Job Description (excerpt):
${session.jd_content.slice(0, MAX_JD_CHARS)}

Interview Q&As (the complete transcript):
${qaText}`;

  // ── Call 1 (or a warm cache hit) — raw scoring read directly off the transcript ──
  const cachedScoring = getCachedScoring(sessionId);
  let scoring: CoreScoring;
  let scoringUsage = { input_tokens: 0, output_tokens: 0 };
  // A cache hit means this request never made call 1 itself, so there is no
  // fresh rate-limit signal to gate on — null/null correctly fails
  // decideSynthesisGate open to "proceed" below, which is the whole point:
  // a warm-cache retry should just make call 2 and finish.
  let callOneHeaders: CallHeaders = { remainingTokens: null, resetMs: null };

  if (cachedScoring) {
    scoring = cachedScoring;
  } else {
    // ── Call 1: raw scoring — evidence read directly off the transcript ──────
    const scoringPrompt = `You are a senior hiring panel evaluating a completed mock interview. Your job is to produce an evidence-first structured assessment using BARS (Behaviorally Anchored Rating Scales).

${sessionHeader}

${CORE_SCORING_EXAMPLE}

--- SCORING RUBRIC ---
Score each signal 1-5 using these anchors:
${SIGNAL_ANCHORS}

--- INSTRUCTIONS ---
1. For EVERY signal in skill_analysis, provide at least 2 verbatim quotes from the candidate's answers as evidence_quotes. Copy word-for-word from the transcript above — do not paraphrase.
2. For metrics, estimate talk_to_listen_ratio based on relative answer lengths, signal_to_noise_ratio based on how much actionable content vs. filler was present, and set avg_response_latency_sec to 2.0 and interruption_count to 0 (defaults — not measurable from text). signal_to_noise_ratio measures DENSITY of substance in the words used — a different thing from whether those words were well-organized (that's COMMUNICATION_SNR / STAR_ALIGNMENT below). A candidate can have dense, substantive content that is nonetheless poorly structured. If your signal_to_noise_ratio is high but COMMUNICATION_SNR or STAR_ALIGNMENT is rated <=3 (or vice versa), you MUST reconcile that explicitly in the relevant reasoning text (e.g. "dense with real content, but that content wasn't organized — buried the point three sentences in") — never let the metric and the rating silently contradict each other.
3. Every skill_analysis[].reasoning must do two things, not one: describe what the candidate actually did (the behavior), AND state what that signals to a real interviewer and how it would affect the hire decision. "Explained the caching layer clearly" is not enough — say what that clarity implies (e.g. "which is the kind of clarity that shortens a technical debrief and builds confidence fast"). A reasoning string that only describes behavior without stating its interview consequence is incomplete.
4. Populate question_walkthrough with one entry per answered question, in question_number order. Each key_takeaway must name what happened in that specific answer AND its hire-decision implication (same two-part requirement as #3) in 1-2 sentences. Reference 1-3 signal_ids per entry (from the 8 parameter_ids) that this question's answer produced the clearest evidence for.
5. Return raw JSON only — no markdown, no code blocks.

Return this exact structure:
{
  "metrics": {
    "talk_to_listen_ratio": "e.g. 72/28",
    "avg_response_latency_sec": 2.0,
    "signal_to_noise_ratio": 0.0,
    "interruption_count": 0
  },
  "skill_analysis": [
    {
      "parameter_id": "TECHNICAL_DEPTH",
      "rating": 1-5,
      "reasoning": "What they did, and what it signals for the hire decision.",
      "evidence_quotes": ["verbatim quote 1", "verbatim quote 2"]
    }
  ],
  "question_walkthrough": [
    {
      "question_number": 1,
      "key_takeaway": "What happened in this answer and its hire-decision implication, 1-2 sentences.",
      "signal_ids": ["TECHNICAL_DEPTH"]
    }
  ]
}

Include all 8 signals in skill_analysis in this order: TECHNICAL_DEPTH, PROBLEM_SOLVING, STAR_ALIGNMENT, COMMUNICATION_SNR, RESULT_ORIENTATION, OWNERSHIP_ETHICS, ADAPTABILITY_GROWTH, EDGE_CASE_MASTERY.`;

    const scoringResult = await runDebriefCompletion(
      scoringPrompt,
      // Measured against a realistic 8-signal + 8-question_walkthrough JSON
      // payload: ~1600 tokens actually needed. 2500 leaves a real margin
      // without repeating the old mistake of reserving far more than the
      // output will ever use — on an 8000 TPM tier, every reserved token not
      // actually used is TPM budget taken away from the (variable-length,
      // unavoidable) transcript.
      2500,
      "scoring"
    );
    const parsedScoring = parseDebriefJson<CoreScoring>(scoringResult.raw, "scoring");
    if (!Array.isArray(parsedScoring.skill_analysis) || parsedScoring.skill_analysis.length === 0) {
      console.error("[generateDebrief:scoring] response parsed but missing skill_analysis:", JSON.stringify(parsedScoring).slice(0, 2000));
      throw new Error("The report came back incomplete — please try again.");
    }
    parsedScoring.question_walkthrough = parsedScoring.question_walkthrough ?? [];

    scoring = parsedScoring;
    scoringUsage = scoringResult.usage;
    callOneHeaders = scoringResult.headers;
  }

  // A3: reduced, weak-signal-filtered transcript for synthesis — see
  // buildSynthesisTranscript's own comment for the selection algorithm.
  const synthesisTranscript = buildSynthesisTranscript(qas, scoring, MAX_ANSWER_CHARS);
  // Synthesis doesn't need the JD text again — role/company/round_type plus
  // the transcript (for fresh quotes) and Call 1's scoring already give it
  // enough domain grounding, and the JD excerpt is the single largest
  // reusable chunk of sessionHeader worth not paying for twice.
  const synthesisHeader = `Session details:
- Role: ${session.role}
- Company: ${session.company}
- Round type: ${session.round_type}
- Years of experience: ${session.yoe}
${backgroundLine}${companyContextBlock}
Interview Q&As (the complete transcript):
${synthesisTranscript}`;

  // ── Call 2: synthesis — reasons about Call 1's scoring, not just the transcript ──
  const synthesisPrompt = `You are the same senior hiring panel, now synthesizing your own scoring below into the parts of the report that reason about root causes and next steps — not re-scoring.

${synthesisHeader}

--- YOUR SCORING FROM STEP 1 (ground everything below in this) ---
${JSON.stringify({ skill_analysis: scoring.skill_analysis, question_walkthrough: scoring.question_walkthrough })}

${SYNTHESIS_EXAMPLE}

--- INSTRUCTIONS ---
1. summary.overall_impression must be written in first person, in the interviewer's own voice, as the verdict they'd actually report back to a hiring committee — a conclusion ("I'd fast-track this one" / "that's a no" / "I'd want a second opinion"), not a third-person summary of topics covered. This is the one thing a busy interviewer would say out loud if asked "so, how'd it go?" — see the example above for the exact register.
2. Populate priority_risks with 2-3 entries — root causes, not a re-listing of every weak signal above. Look across all 8 skill_analysis ratings for the pattern underneath them: e.g. "makes claims without evidence" might explain low TECHNICAL_DEPTH, PROBLEM_SOLVING, and RESULT_ORIENTATION all at once. Every signal rated <=3 must be explained by at least one priority_risk's related_signal_ids — if you can't fit a weak signal under one of your 2-3 risks, your risks are too narrow; broaden or merge them. If every signal rated 4+, priority_risks may be empty or name what's still worth sharpening.
3. Populate model_answers. If priority_risks is non-empty, model_answers MUST also be non-empty — at least 1 entry, ideally one per priority_risk, up to 3 total. Only return an empty array when priority_risks is ALSO empty (every signal rated 4+) — never skip this field just because filling it out is demanding; an empty array is a claim that nothing needs fixing, and if you've named a priority_risk that claim is false. Each entry needs: your_quote (a real quote from the candidate's answer to that specific question — take it directly from the transcript above, verbatim, no paraphrasing — it does not need to already appear in the scoring above, just genuinely be from the transcript), why_it_hurt (one sentence: what the interviewer likely concluded from THAT SPECIFIC quote, not generic advice), framework (must be exactly one of these three names: "Answer → Evidence → Impact", "Situation → Action → Result", or "Answer → Reasoning → Trade-off" — pick whichever fits the question type), and model_excerpt (a concrete, plausible 2-4 sentence answer to THAT SPECIFIC question using that framework, grounded in the candidate's own domain/role, not a generic template).
4. Set path_to_next_tier to one sentence: the SPECIFIC evidence that, if it had appeared in the transcript, would most likely move the recommendation up one tier (e.g. Borderline -> Hire). Ground it in what's actually missing from THIS transcript — "prepare more examples" is not acceptable, name the specific kind of evidence (e.g. "one technically detailed answer with a quantified outcome, on par with the acquisition story in Q3").
5. Set behavioral_insights.confidence_rationale to one sentence explaining WHY confidence is at that level, tied to something concrete about the session — answer count, topic coverage, or consistency (e.g. "based on 7 substantive answers; technical-depth confidence is lower because few platform-specific questions came up").
6. Return raw JSON only — no markdown, no code blocks.

Return this exact structure:
{
  "summary": {
    "overall_impression": "1-2 sentences, first person, in the interviewer's voice — the verdict, not a topic summary."
  },
  "priority_risks": [
    {
      "title": "Short root-cause name, 2-4 words",
      "description": "One sentence: what the underlying pattern actually is.",
      "related_signal_ids": ["TECHNICAL_DEPTH", "RESULT_ORIENTATION"]
    }
  ],
  "model_answers": [
    {
      "question_number": 1,
      "parameter_id": "TECHNICAL_DEPTH",
      "your_quote": "Verbatim quote from the transcript above.",
      "why_it_hurt": "One sentence: what the interviewer likely concluded from that exact quote.",
      "framework": "Answer → Evidence → Impact" | "Situation → Action → Result" | "Answer → Reasoning → Trade-off",
      "model_excerpt": "A concrete stronger answer to that exact question, 2-4 sentences."
    }
  ],
  "path_to_next_tier": "One sentence: the specific evidence that would most likely move the recommendation up a tier.",
  "behavioral_insights": {
    "star_adherence_score": 0-100,
    "confidence_level": "High" | "Medium" | "Low",
    "confidence_rationale": "One sentence: why, tied to answer count/coverage/consistency.",
    "red_flags": ["list any red flags, or empty array"]
  },
  "actionable_feedback": {
    "strengths": ["2-3 specific strengths"],
    "growth_areas": ["2-3 specific areas to improve"],
    "top_priority_fix": "The single most important thing to work on."
  }
}`;

  // Measured against a realistic 3-risk + 3-model_answer payload (the
  // heaviest realistic case — model_excerpt is the single biggest field):
  // ~850 tokens actually needed. 1800 leaves real margin without
  // over-reserving — same reasoning as the scoring call's max_tokens. (A7:
  // deliberately not tightened — wait for real per-call numbers from A6.)
  const SYNTHESIS_MAX_TOKENS = 1800;

  // B3: gate call 2 on call 1's own rate-limit headers (or fail open if this
  // was a warm-cache hit and there are none). needTokens is the synthesis
  // prompt's estimated size plus its reserved max_tokens plus a safety
  // margin — the whole point is to know call 2 will fit BEFORE spending it.
  const needTokens =
    estimateTokens(synthesisPrompt) + SYNTHESIS_MAX_TOKENS + SYNTHESIS_TOKEN_SAFETY_MARGIN;
  const gate = decideSynthesisGate({
    remainingTokens: callOneHeaders.remainingTokens,
    resetMs: callOneHeaders.resetMs,
    needTokens,
    maxInlineWaitMs: MAX_INLINE_WAIT_MS,
  });

  if (gate.action === "wait") {
    console.log(`[generateDebrief:synthesis] TPM budget short — waiting ${gate.ms}ms inline before call 2`);
    await sleep(gate.ms);
  } else if (gate.action === "defer") {
    // Stash call 1's scoring so a client retry (post-503) can skip call 1
    // entirely — see lib/debrief-cache.ts. This does not guarantee a
    // retry-only-call-2, but it makes it work most of the time with zero
    // schema change (plan §5).
    setCachedScoring(sessionId, scoring);
    console.warn(
      `[generateDebrief:synthesis] TPM budget insufficient within ${MAX_INLINE_WAIT_MS}ms inline wait — deferring, retryAfterMs=${gate.retryAfterMs}`
    );
    throw new DebriefSynthesisDeferredError(gate.retryAfterMs);
  }

  const synthesisResult = await runDebriefCompletion(synthesisPrompt, SYNTHESIS_MAX_TOKENS, "synthesis");
  // Call 2 succeeded — the cached scoring (if any) has done its job.
  clearCachedScoring(sessionId);
  const synthesis = parseDebriefJson<Synthesis>(synthesisResult.raw, "synthesis");
  if (!synthesis.summary || !synthesis.behavioral_insights) {
    console.error("[generateDebrief:synthesis] response parsed but missing required fields:", JSON.stringify(synthesis).slice(0, 2000));
    throw new Error("The report came back incomplete — please try again.");
  }

  // ── Merge into the shape the route/UI expect — unchanged from before ─────
  const report: DebriefReport = {
    summary: {
      // recommendation/hire_probability are always overwritten downstream by
      // calculateNormalizedScore() (deterministic, evidence-first) before
      // this ever reaches a client — this placeholder is never read.
      recommendation: "Borderline",
      hire_probability: 0,
      overall_impression: synthesis.summary.overall_impression,
    },
    metrics: scoring.metrics,
    skill_analysis: scoring.skill_analysis,
    question_walkthrough: scoring.question_walkthrough,
    priority_risks: synthesis.priority_risks,
    model_answers: synthesis.model_answers,
    path_to_next_tier: synthesis.path_to_next_tier,
    behavioral_insights: synthesis.behavioral_insights,
    actionable_feedback: synthesis.actionable_feedback,
  };

  // Defensive defaults — the LLM occasionally omits a field despite instructions;
  // downstream rendering should degrade gracefully, not crash.
  report.question_walkthrough = report.question_walkthrough ?? [];
  report.model_answers = report.model_answers ?? [];
  report.priority_risks = report.priority_risks ?? [];
  report.path_to_next_tier = report.path_to_next_tier ?? "";
  if (report.behavioral_insights) {
    report.behavioral_insights.confidence_rationale = report.behavioral_insights.confidence_rationale ?? "";
  }
  // Instruction #3 (synthesis) requires model_answers to be non-empty whenever
  // priority_risks is non-empty — if the model didn't follow that, it's a
  // real prompt-compliance gap worth knowing about rather than a silent
  // empty section. Logged, not enforced: better to show nothing than to
  // synthesize a fake rewrite server-side.
  if (report.priority_risks.length > 0 && report.model_answers.length === 0) {
    console.warn(
      `[generateDebrief] priority_risks non-empty (${report.priority_risks.length}) but model_answers came back empty — prompt-compliance gap, "Moments That Cost You Signal" will be hidden`
    );
  }

  const usage = {
    // scoringUsage is {0, 0} on a warm-cache hit (no call 1 this request) —
    // an intentional, honest undercount: debriefs.tokens_used is meant to
    // reflect what THIS request actually spent, and a cache hit spent zero
    // scoring tokens.
    input_tokens: scoringUsage.input_tokens + synthesisResult.usage.input_tokens,
    output_tokens: scoringUsage.output_tokens + synthesisResult.usage.output_tokens,
    model: MODEL,
  };

  return { report, usage };
}

// ─── Drill / Retry Loop ──────────────────────────────────────────────────────
// Direct product feedback: the report shouldn't stop at "here's a better
// answer" — it should let the candidate actually try the rewrite and see if
// it worked ("Interview -> Diagnosis -> Rewrite -> Drill -> Retry -> Trend").
// This is a deliberately tiny, single-signal rescore — NOT a full debrief —
// so a practice attempt gets fast, cheap, focused feedback instead of
// waiting on a multi-thousand-token structured report.

export interface DrillScoreResult {
  rating: number;    // 1-5, same BARS scale as skill_analysis
  reasoning: string;  // one sentence: what changed vs. the original attempt, and what (if anything) is still missing
}

export interface DrillAttemptInput {
  question: string;
  parameter_id: string;      // which of the 8 signals to score against
  original_rating: number;   // the rating this answer got in the real interview
  attempt_answer: string;    // the candidate's new, rewritten answer
  role: string;
  company: string;
}

export async function scoreDrillAttempt(
  input: DrillAttemptInput
): Promise<{ result: DrillScoreResult; usage: { input_tokens: number; output_tokens: number; model: string } }> {
  const systemPrompt = `You are scoring a SINGLE practice answer against ONE interview signal, using the same BARS rubric a full interview debrief uses. This is a practice drill — the candidate rewrote their answer and wants to know, honestly, whether it actually improved.

Role: ${input.role} at ${input.company}
Question: ${input.question}
Signal being scored: ${input.parameter_id}

--- SCORING RUBRIC (score only the signal above, using its anchor) ---
${SIGNAL_ANCHORS}

The candidate's ORIGINAL answer to this question scored ${input.original_rating}/5 on ${input.parameter_id}. Here is their NEW attempt:
"${input.attempt_answer}"

Score the new attempt 1-5 on ${input.parameter_id} using the anchors above. Be honest — if it didn't actually improve, or overcorrected into a new problem, say so. Do not inflate the score just because they made an effort.

Return raw JSON only, no markdown:
{ "rating": 1-5, "reasoning": "One sentence: what's different from the original attempt, and what (if anything) is still missing." }`;

  const completion = await getClient().chat.completions.create({
    model: MODEL,
    max_tokens: 400,
    reasoning_effort: "low",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Score this practice attempt." },
    ],
  });

  const raw = completion.choices[0].message.content?.trim() ?? "";
  const jsonStr = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const result = JSON.parse(jsonStr) as DrillScoreResult;

  const usage = {
    input_tokens: completion.usage?.prompt_tokens ?? 0,
    output_tokens: completion.usage?.completion_tokens ?? 0,
    model: MODEL,
  };

  return { result, usage };
}

// Fixed sample question for the unauthenticated landing-page preview
// (components/InteractivePreview.tsx). Kept fixed and server-side — the
// public route only ever scores an answer against this one question, never
// an arbitrary caller-supplied prompt.
export const PREVIEW_SAMPLE_QUESTION =
  "Tell me about a time you had to debug a critical issue under pressure.";

export interface PreviewAnalysisResult {
  score: number; // 1-5
  evidence_quote: string; // verbatim excerpt from the candidate's answer
  feedback: string; // one short paragraph
}

export async function scorePreviewAnswer(
  answer: string
): Promise<{ result: PreviewAnalysisResult; usage: { input_tokens: number; output_tokens: number; model: string } }> {
  const systemPrompt = `You are giving a short, honest sample read of ONE practice interview answer for a marketing preview — a visitor who hasn't signed up yet is trying the product. Score only "Technical Depth": does the answer show real, specific technical substance (concrete tools/approach, a clear before/after outcome) versus vague description.

Question: "${PREVIEW_SAMPLE_QUESTION}"
Candidate's answer: "${answer}"

Return raw JSON only, no markdown:
{
  "score": 1-5,
  "evidence_quote": "A short verbatim excerpt (<25 words) copied exactly from the candidate's answer above that best supports the score. If the answer has no usable content, use an empty string.",
  "feedback": "One short paragraph (2-3 sentences, plain language, no jargon): what's credible about the answer and the single biggest thing missing."
}`;

  const completion = await getClient().chat.completions.create({
    model: MODEL,
    max_tokens: 300,
    reasoning_effort: "low",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Give the sample read." },
    ],
  });

  const raw = completion.choices[0].message.content?.trim() ?? "";
  const jsonStr = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const result = JSON.parse(jsonStr) as PreviewAnalysisResult;

  const usage = {
    input_tokens: completion.usage?.prompt_tokens ?? 0,
    output_tokens: completion.usage?.completion_tokens ?? 0,
    model: MODEL,
  };

  return { result, usage };
}
