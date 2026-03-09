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

const MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

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

  const questionInstruction = isFirstQuestion
    ? `This is question 1 of ${totalTarget}. Ask an open-ended opener to understand who the candidate is — their current role, key experience, and what they're looking to do next. Make it feel natural and conversational, not a checklist. Do NOT ask a technical question yet.`
    : `Target ${totalTarget} questions total. You have asked ${answeredCount} so far.`;

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
Output ONLY the next interview question. No preamble, no labels, no explanation.`;

  const completion = await getClient().chat.completions.create({
    model: MODEL,
    max_tokens: 300,
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
 * Called only when: seed === null AND session.domain is set.
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

  const fewShotExamples = `
[FEW-SHOT EXAMPLES — domain-specific depth]

Example 1 (Embedded/BMS, Technical):
Q: "Walk me through how you'd design a State of Charge estimation algorithm for a lithium-ion battery pack. What are the tradeoffs between Coulomb counting and Extended Kalman Filter approaches, and when would you choose each?"

Example 2 (ML Infra, Technical):
Q: "Your distributed training job is experiencing gradient staleness with async SGD across 64 GPUs. How do you diagnose whether this is a network bottleneck vs compute imbalance, and what architectural changes would you make?"
`;

  const completion = await getClient().chat.completions.create({
    model: MODEL,
    max_tokens: 300,
    messages: [
      {
        role: "system",
        content: `You are a senior ${domain} technical interviewer conducting a ${session.round_type} interview at ${session.company}.

${fewShotExamples}
${companyContextBlock}
RULES:
- Ask one question only. No preamble.
- Questions must require deep ${domain} expertise — a generic backend interviewer should not know to ask this.
- Adapt depth to YOE: ${session.yoe} years of experience.
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
  };
  skill_analysis: SkillAnalysis[]; // exactly 8 items
  behavioral_insights: {
    star_adherence_score: number;   // 0-100
    confidence_level: "High" | "Medium" | "Low";
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
    "overall_impression": "The candidate demonstrated SME-level depth across distributed systems and proactively surfaced trade-offs without prompting. Every claim was backed by specific, quantifiable outcomes."
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
  "behavioral_insights": {
    "star_adherence_score": 92,
    "confidence_level": "High",
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
    "overall_impression": "The candidate relied on vague, high-level descriptions without demonstrating how decisions were made or what results followed. Answers lacked specificity and were padded with filler."
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
  "behavioral_insights": {
    "star_adherence_score": 28,
    "confidence_level": "Low",
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
    "overall_impression": "The candidate communicated clearly and concisely but lacked the technical depth expected for this role. Strong on soft skills; weak on systems knowledge."
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
  "behavioral_insights": {
    "star_adherence_score": 65,
    "confidence_level": "Medium",
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
3. For metrics, estimate talk_to_listen_ratio based on relative answer lengths, signal_to_noise_ratio based on how much actionable content vs. filler was present, and set avg_response_latency_sec to 2.0 and interruption_count to 0 (defaults — not measurable from text).
4. Return raw JSON only — no markdown, no code blocks.

Return this exact structure:
{
  "summary": {
    "recommendation": "Strong Hire" | "Hire" | "Borderline" | "No Hire",
    "hire_probability": 0,
    "overall_impression": "2-3 honest sentences about the candidate's overall performance."
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
      "reasoning": "Why you gave this score.",
      "evidence_quotes": ["verbatim quote 1", "verbatim quote 2"]
    }
  ],
  "behavioral_insights": {
    "star_adherence_score": 0-100,
    "confidence_level": "High" | "Medium" | "Low",
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
    max_tokens: 3000,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Generate the structured debrief report." },
    ],
  });

  const raw = completion.choices[0].message.content?.trim() ?? "";
  // Strip markdown code block if present
  const jsonStr = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const report = JSON.parse(jsonStr) as DebriefReport;

  const usage = {
    input_tokens: completion.usage?.prompt_tokens ?? 0,
    output_tokens: completion.usage?.completion_tokens ?? 0,
    model: MODEL,
  };

  return { report, usage };
}
