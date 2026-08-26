import Groq from "groq-sdk";

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

const FEW_SHOT_EXAMPLES = `
[FEW-SHOT EXAMPLES — follow this exact JSON structure and evidence style]

--- Example 1: Strong Hire (TECHNICAL_DEPTH 5, RESULT_ORIENTATION 5) ---
{
  "summary": {
    "recommendation": "Strong Hire",
    "hire_probability": 0,
    "overall_impression": "Easy yes — SME-level depth on distributed systems, trade-offs surfaced before I had to ask, and every claim backed by a real number. I'd fast-track this one."
  },
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
    },
    {
      "parameter_id": "RESULT_ORIENTATION",
      "rating": 5,
      "reasoning": "Every answer closed with a specific metric — p99 latency, revenue impact, or error rate reduction.",
      "evidence_quotes": [
        "That migration cut our p99 from 340ms to 90ms and dropped infrastructure cost by 23 percent quarter-over-quarter",
        "The feature launched to 100 percent of users within two weeks and drove a 7 percent lift in checkout conversion"
      ]
    }
  ],
  "question_walkthrough": [
    {
      "question_number": 1,
      "key_takeaway": "Opened with a specific rebalancing latency fix (8s to 400ms) instead of a generic self-intro — immediately signaled hands-on ownership of production systems, the kind of concrete detail that earns trust in the first 60 seconds of a screen.",
      "signal_ids": ["TECHNICAL_DEPTH", "RESULT_ORIENTATION"]
    },
    {
      "question_number": 2,
      "key_takeaway": "Named the exactly-once vs at-least-once trade-off unprompted, which is the difference an interviewer uses to separate 'has used Kafka' from 'understands Kafka' — this is the single strongest technical moment in the transcript.",
      "signal_ids": ["TECHNICAL_DEPTH", "PROBLEM_SOLVING"]
    },
    {
      "question_number": 3,
      "key_takeaway": "Closed the migration story with a paired metric (p99 340ms→90ms, cost -23%) rather than stopping at 'it went well' — this is exactly the Impact step most candidates skip, and its presence here is why Result Orientation scored a 5.",
      "signal_ids": ["RESULT_ORIENTATION", "STAR_ALIGNMENT"]
    }
  ],
  "priority_risks": [],
  "model_answers": [],
  "path_to_next_tier": "Already at the top tier for this rubric — the only stretch is a stronger cross-functional stakeholder narrative in behavioral answers.",
  "behavioral_insights": {
    "star_adherence_score": 92,
    "confidence_level": "High",
    "confidence_rationale": "Based on 5 substantive, technically detailed answers with consistent quantified outcomes across every question.",
    "red_flags": []
  },
  "actionable_feedback": {
    "strengths": ["Proactively surfaces trade-offs before being asked", "Quantifies impact with specific numbers"],
    "growth_areas": ["Could strengthen cross-functional stakeholder narrative"],
    "top_priority_fix": "Add explicit stakeholder alignment steps to behavioral answers."
  }
}

--- Example 2: No Hire (TECHNICAL_DEPTH 2, COMMUNICATION_SNR 2) ---
{
  "summary": {
    "recommendation": "No Hire",
    "hire_probability": 0,
    "overall_impression": "I never got past surface-level descriptions — every time I pushed for how or why, I got restated context instead of a decision. I can't verify real understanding from this transcript, and that's a no."
  },
  "metrics": {
    "talk_to_listen_ratio": "81/19",
    "avg_response_latency_sec": 2.0,
    "signal_to_noise_ratio": 0.06,
    "interruption_count": 0
  },
  "skill_analysis": [
    {
      "parameter_id": "TECHNICAL_DEPTH",
      "rating": 2,
      "reasoning": "Candidate named technologies but could not explain how they worked or why they were chosen over alternatives.",
      "evidence_quotes": [
        "We used Kubernetes because it's the industry standard and everyone uses it these days",
        "I worked with microservices — it's basically just breaking things into smaller services, which is good for scalability"
      ]
    },
    {
      "parameter_id": "COMMUNICATION_SNR",
      "rating": 2,
      "reasoning": "Answers were long and circular with no clear structure. Core point was buried in repetitive restating.",
      "evidence_quotes": [
        "So basically what happened was, we had this issue, and the issue was kind of like a problem with the system, and we needed to fix it, so we fixed it",
        "I think, you know, generally speaking, communication is important and I always try to communicate well with my team"
      ]
    }
  ],
  "question_walkthrough": [
    {
      "question_number": 1,
      "key_takeaway": "Named Kubernetes and microservices but justified the choice with 'industry standard' rather than a reason tied to the system's actual constraints — an interviewer hears this as pattern-matching on buzzwords, not engineering judgment, which is why this sets a low ceiling before the interview has really started.",
      "signal_ids": ["TECHNICAL_DEPTH"]
    },
    {
      "question_number": 2,
      "key_takeaway": "The explanation looped back on itself twice before reaching a conclusion — a real interviewer would have to work to extract the actual point, which reads as unprepared even if the underlying work was fine.",
      "signal_ids": ["COMMUNICATION_SNR"]
    }
  ],
  "priority_risks": [
    {
      "title": "Evidence gap",
      "description": "Makes claims about tools and decisions without the reasoning or specifics that would let an interviewer verify real understanding.",
      "related_signal_ids": ["TECHNICAL_DEPTH", "PROBLEM_SOLVING"]
    },
    {
      "title": "Answer architecture",
      "description": "Talks around the point before eventually reaching it, forcing the interviewer to extract the actual answer instead of receiving it directly.",
      "related_signal_ids": ["COMMUNICATION_SNR", "STAR_ALIGNMENT", "RESULT_ORIENTATION"]
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
    },
    {
      "question_number": 2,
      "parameter_id": "COMMUNICATION_SNR",
      "your_quote": "So basically what happened was, we had this issue, and the issue was kind of like a problem with the system, and we needed to fix it, so we fixed it",
      "why_it_hurt": "The interviewer has to wait through three restatements before learning what the actual problem or fix was — that reads as unprepared even if the underlying work was solid.",
      "framework": "Answer → Evidence → Impact",
      "model_excerpt": "Short answer: a bad cache invalidation was serving stale prices for up to 10 minutes. We fixed it by moving from TTL-based expiry to event-driven invalidation tied to the price-update queue, which cut staleness to under 5 seconds."
    }
  ],
  "path_to_next_tier": "One technically detailed answer — naming a real constraint and a trade-off, the way the model answer above does — would be enough to move Technical Depth off the floor and shift this from No Hire toward Borderline.",
  "behavioral_insights": {
    "star_adherence_score": 28,
    "confidence_level": "Low",
    "confidence_rationale": "Based on 5 answers, but 4 of them lacked enough specificity to confidently separate genuine gaps from nervousness or unfamiliarity with interview format.",
    "red_flags": ["Circular answers with no resolution", "No quantifiable outcomes in any response"]
  },
  "actionable_feedback": {
    "strengths": ["Willing to take ownership of past work"],
    "growth_areas": ["Must learn to quantify results", "Needs to explain technical decisions with reasoning"],
    "top_priority_fix": "Practice the STAR format — especially the Result step — with at least one specific metric per story."
  }
}

--- Example 3: Borderline (COMMUNICATION_SNR 4, TECHNICAL_DEPTH 2) ---
{
  "summary": {
    "recommendation": "Borderline",
    "hire_probability": 0,
    "overall_impression": "I'd want a second, more technical opinion before deciding — communication and reasoning are genuinely strong, but I don't yet have enough evidence this candidate can operate at the systems depth the role needs."
  },
  "metrics": {
    "talk_to_listen_ratio": "62/38",
    "avg_response_latency_sec": 2.0,
    "signal_to_noise_ratio": 0.22,
    "interruption_count": 0
  },
  "skill_analysis": [
    {
      "parameter_id": "COMMUNICATION_SNR",
      "rating": 4,
      "reasoning": "Answers were answer-first with minimal filler. Candidate paused to structure thoughts before responding.",
      "evidence_quotes": [
        "Short answer: we chose Postgres over DynamoDB because our access patterns were relational and we needed joins",
        "The trade-off was write throughput — we accepted that and scaled reads with read replicas"
      ]
    },
    {
      "parameter_id": "TECHNICAL_DEPTH",
      "rating": 2,
      "reasoning": "Surface-level responses on system internals. Could not explain indexing strategy or query planner behavior when probed.",
      "evidence_quotes": [
        "I just added an index on the column and it got faster — I didn't look too deeply into why",
        "I've heard of B-tree indexes but I'm not sure exactly how they work under the hood"
      ]
    }
  ],
  "question_walkthrough": [
    {
      "question_number": 4,
      "key_takeaway": "Gave a clean answer-first justification for Postgres over DynamoDB with the actual access-pattern reasoning — this is the strongest moment in the transcript and shows the communication skill is real, not just polish.",
      "signal_ids": ["COMMUNICATION_SNR", "PROBLEM_SOLVING"]
    },
    {
      "question_number": 6,
      "key_takeaway": "Admitted not knowing how B-tree indexes work under the hood when probed — the honesty is a plus for trust, but for a senior-level bar this is exactly the depth gap that would surface again in a real system design round.",
      "signal_ids": ["TECHNICAL_DEPTH"]
    }
  ],
  "priority_risks": [
    {
      "title": "Depth ceiling",
      "description": "Can name and use the right tool but hasn't gone one layer deeper into how or why it works — fine for a mid-level bar, a real gap at the senior bar this role needs.",
      "related_signal_ids": ["TECHNICAL_DEPTH"]
    }
  ],
  "model_answers": [
    {
      "question_number": 6,
      "parameter_id": "TECHNICAL_DEPTH",
      "your_quote": "I've heard of B-tree indexes but I'm not sure exactly how they work under the hood",
      "why_it_hurt": "Honesty about a gap builds trust, but for a senior-level bar this is exactly the depth an interviewer needs to see, and its absence caps the score regardless of how well the rest of the answer was delivered.",
      "framework": "Answer → Reasoning → Trade-off",
      "model_excerpt": "I added a B-tree index on the lookup column — it works by keeping sorted keys in a balanced tree so the query planner can do O(log n) lookups instead of a full scan. I chose it over a hash index because we also needed range queries, which hash indexes can't serve. The trade-off is slightly slower writes since every insert has to maintain the tree balance."
    }
  ],
  "path_to_next_tier": "One answer at the depth of the model answer above — explaining a system's internals, not just its interface — would likely be enough evidence to move this from Borderline to Hire.",
  "behavioral_insights": {
    "star_adherence_score": 65,
    "confidence_level": "Medium",
    "confidence_rationale": "Based on 7 answers with consistent communication quality, but only 2 questions probed technical internals directly, which limits how confidently the depth gap can be generalized.",
    "red_flags": ["Technical depth insufficient for senior-level role"]
  },
  "actionable_feedback": {
    "strengths": ["Concise, answer-first communication style", "Good self-awareness about limitations"],
    "growth_areas": ["Deepen systems internals knowledge", "Practice explaining database internals and distributed systems concepts"],
    "top_priority_fix": "Study the internals of at least 2 core systems you use daily — indexing, caching, or message queues."
  }
}

[END FEW-SHOT EXAMPLES]
`.trim();

export interface DebriefResult {
  report: DebriefReport;
  usage: { input_tokens: number; output_tokens: number; model: string };
}

export async function generateDebrief(
  session: SessionContext,
  qas: QAPair[]
): Promise<DebriefResult> {
  const qaText = qas
    .map(
      (qa) =>
        `Q${qa.question_number}: ${qa.question}\nAnswer: ${qa.answer ?? "(no answer provided)"}`
    )
    .join("\n\n");

  const backgroundLine = session.background
    ? `- Background: ${session.background}\n`
    : "";

  const companyContextBlock = session.company_stage
    ? `\n[COMPANY CONTEXT]\n- Company stage: ${session.company_stage}\n- Calibrate your scoring accordingly: Seed/Series A companies prize ownership and breadth; Series B/Public companies prize depth, process, and scalability.\n`
    : "";

  const systemPrompt = `You are a senior hiring panel evaluating a completed mock interview. Your job is to produce an evidence-first structured assessment using BARS (Behaviorally Anchored Rating Scales).

Session details:
- Role: ${session.role}
- Company: ${session.company}
- Round type: ${session.round_type}
- Years of experience: ${session.yoe}
${backgroundLine}${companyContextBlock}
Job Description (excerpt):
${session.jd_content.slice(0, 3000)}

Interview Q&As (the complete transcript):
${qaText}

${FEW_SHOT_EXAMPLES}

--- SCORING RUBRIC ---
Score each signal 1-5 using these anchors:
${SIGNAL_ANCHORS}

--- INSTRUCTIONS ---
1. For EVERY signal in skill_analysis, provide at least 2 verbatim quotes from the candidate's answers as evidence_quotes. Copy word-for-word from the transcript above — do not paraphrase.
2. Set hire_probability to 0 (this will be computed deterministically by the system).
3. For metrics, estimate talk_to_listen_ratio based on relative answer lengths, signal_to_noise_ratio based on how much actionable content vs. filler was present, and set avg_response_latency_sec to 2.0 and interruption_count to 0 (defaults — not measurable from text). signal_to_noise_ratio measures DENSITY of substance in the words used — a different thing from whether those words were well-organized (that's COMMUNICATION_SNR / STAR_ALIGNMENT below). A candidate can have dense, substantive content that is nonetheless poorly structured. If your signal_to_noise_ratio is high but COMMUNICATION_SNR or STAR_ALIGNMENT is rated <=3 (or vice versa), you MUST reconcile that explicitly in the relevant reasoning text (e.g. "dense with real content, but that content wasn't organized — buried the point three sentences in") — never let the metric and the rating silently contradict each other.
4. overall_impression must be written in first person, in the interviewer's own voice, as the verdict they'd actually report back to a hiring committee — a conclusion ("I'd fast-track this one" / "that's a no" / "I'd want a second opinion"), not a third-person summary of topics covered. This is the one thing a busy interviewer would say out loud if asked "so, how'd it go?" — see the few-shot examples above for the exact register.
5. Every skill_analysis[].reasoning must do two things, not one: describe what the candidate actually did (the behavior), AND state what that signals to a real interviewer and how it would affect the hire decision. "Explained the caching layer clearly" is not enough — say what that clarity implies (e.g. "which is the kind of clarity that shortens a technical debrief and builds confidence fast"). A reasoning string that only describes behavior without stating its interview consequence is incomplete.
6. Populate question_walkthrough with one entry per answered question, in question_number order. Each key_takeaway must name what happened in that specific answer AND its hire-decision implication (same two-part requirement as #5) in 1-2 sentences — this is a walkthrough of the interview, not a restatement of skill_analysis. Reference 1-3 signal_ids per entry (from the 8 parameter_ids) that this question's answer produced the clearest evidence for.
7. Populate priority_risks with 2-3 entries — root causes, not a re-listing of every weak signal. Look across all 8 skill_analysis ratings for the pattern underneath them: e.g. "makes claims without evidence" might explain low TECHNICAL_DEPTH, PROBLEM_SOLVING, and RESULT_ORIENTATION all at once. Every signal rated <=3 must be explained by at least one priority_risk's related_signal_ids — if you can't fit a weak signal under one of your 2-3 risks, your risks are too narrow; broaden or merge them. If every signal rated 4+, priority_risks may be empty or name what's still worth sharpening.
8. Populate model_answers with up to 3 entries — ideally one per priority_risk, for the specific question where that risk showed clearest. Each entry needs: your_quote (verbatim, MUST be copied word-for-word from one of that signal's evidence_quotes — not paraphrased, not summarized), why_it_hurt (one sentence: what the interviewer likely concluded from THAT SPECIFIC quote, not generic advice), framework (must be exactly one of these three names: "Answer → Evidence → Impact", "Situation → Action → Result", or "Answer → Reasoning → Trade-off" — pick whichever fits the question type), and model_excerpt (a concrete, plausible 2-4 sentence answer to THAT SPECIFIC question using that framework, grounded in the candidate's own domain/role, not a generic template). If every signal rated 4+, return an empty array — do not invent a weakness.
9. Set path_to_next_tier to one sentence: the SPECIFIC evidence that, if it had appeared in the transcript, would most likely move the recommendation up one tier (e.g. Borderline -> Hire). Ground it in what's actually missing from THIS transcript — "prepare more examples" is not acceptable, name the specific kind of evidence (e.g. "one technically detailed answer with a quantified outcome, on par with the acquisition story in Q3").
10. Set behavioral_insights.confidence_rationale to one sentence explaining WHY confidence is at that level, tied to something concrete about the session — answer count, topic coverage, or consistency (e.g. "based on 7 substantive answers; technical-depth confidence is lower because few platform-specific questions came up").
11. Return raw JSON only — no markdown, no code blocks.

Return this exact structure:
{
  "summary": {
    "recommendation": "Strong Hire" | "Hire" | "Borderline" | "No Hire",
    "hire_probability": 0,
    "overall_impression": "1-2 sentences, first person, in the interviewer's voice — the verdict, not a topic summary."
  },
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
  ],
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
      "your_quote": "Verbatim quote copied word-for-word from evidence_quotes.",
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
}

Include all 8 signals in skill_analysis in this order: TECHNICAL_DEPTH, PROBLEM_SOLVING, STAR_ALIGNMENT, COMMUNICATION_SNR, RESULT_ORIENTATION, OWNERSHIP_ETHICS, ADAPTABILITY_GROWTH, EDGE_CASE_MASTERY.`;

  const completion = await getClient().chat.completions.create({
    model: MODEL,
    max_tokens: 6000,
    // See generateNextQuestion — gpt-oss-120b's default 'medium' reasoning
    // effort burns hidden reasoning tokens out of the same max_tokens budget.
    // The debrief output is long and structured; keep the budget for visible
    // JSON, not hidden reasoning.
    reasoning_effort: "low",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Generate the structured debrief report." },
    ],
  });

  const raw = completion.choices[0].message.content?.trim() ?? "";
  // Strip markdown code block if present
  const jsonStr = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const report = JSON.parse(jsonStr) as DebriefReport;
  // Defensive defaults — the LLM occasionally omits a field despite instructions;
  // downstream rendering should degrade gracefully, not crash.
  report.question_walkthrough = report.question_walkthrough ?? [];
  report.model_answers = report.model_answers ?? [];
  report.priority_risks = report.priority_risks ?? [];
  report.path_to_next_tier = report.path_to_next_tier ?? "";
  if (report.behavioral_insights) {
    report.behavioral_insights.confidence_rationale = report.behavioral_insights.confidence_rationale ?? "";
  }

  const usage = {
    input_tokens: completion.usage?.prompt_tokens ?? 0,
    output_tokens: completion.usage?.completion_tokens ?? 0,
    model: MODEL,
  };

  return { report, usage };
}
