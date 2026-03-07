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
}

export async function generateNextQuestion(
  session: SessionContext,
  previousQAs: QAPair[]
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
    : `Target ${totalTarget} questions total. You have asked ${answeredCount} so far.
${answeredCount % 2 === 0 ? "Ask a behavioral/soft-skill question this time." : "Ask a technical question this time."}`;

  const systemPrompt = `You are a senior interviewer at ${session.company}. You are conducting a ${session.round_type} interview for a ${session.role} position. The candidate has ${session.yoe} year(s) of experience.
${backgroundSection}
Job Description:
${session.jd_content.slice(0, 4000)}

You ask ONE focused question per turn. Alternate between:
- Technical questions: tools, systems, architecture, problem-solving directly relevant to the JD
- Soft skill / behavioral questions: conflict resolution, leadership, communication style, how they handle pressure, confidence indicators

${questionInstruction}

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
