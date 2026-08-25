import { DebriefReportView, type NewDebrief } from "@/components/DebriefReport";

// Dev-only, DB-free preview of the new debrief report design — realistic
// mock data matching the current DebriefReport schema (lib/groq.ts), so the
// redesign can be visually checked without a live database or LLM call.
// See /dev/loading for the same pattern.

const MOCK_SESSION = {
  role: "Senior Backend Engineer",
  company: "Stripe",
  round_type: "Technical Deep Dive",
  yoe: 5,
  user_email: "test@prepsignals.dev",
};

const MOCK_DEBRIEF = {
  summary: {
    recommendation: "Borderline" as const,
    hire_probability: 58,
    overall_impression:
      "Strong communicator with real production ownership, but technical depth on distributed-systems trade-offs falls short of the senior bar for this round. The candidate is closer than the score suggests — the gaps are specific and fixable, not fundamental.",
  },
  metrics: {
    talk_to_listen_ratio: "81/19",
    avg_response_latency_sec: 2.6,
    signal_to_noise_ratio: 0.11,
    interruption_count: 1,
  },
  skill_analysis: [
    {
      parameter_id: "TECHNICAL_DEPTH",
      rating: 2,
      reasoning:
        "Named Kafka and Redis correctly but could not explain partition assignment or cache eviction policy when probed — this is the gap that would surface again in a real system design round, and it's the single biggest reason this session reads Borderline instead of Hire.",
      evidence_quotes: [
        "We used Kafka to decouple the services, it's pretty standard for this kind of thing",
        "I know we had a cache in front of it but I wasn't the one who configured the eviction policy",
      ],
    },
    {
      parameter_id: "PROBLEM_SOLVING",
      rating: 4,
      reasoning:
        "Handled the ambiguous on-call scenario well — asked two clarifying questions before proposing a diagnosis path, which is exactly the kind of composure that reads as senior under pressure.",
      evidence_quotes: [
        "Before I answer, can I ask — is this a gradual degradation or a sudden spike?",
        "If it's sudden, I'd check recent deploys first since that's the highest-probability cause",
      ],
    },
    {
      parameter_id: "STAR_ALIGNMENT",
      rating: 3,
      reasoning:
        "Stories had a clear situation and action but the result step was frequently left as 'it worked well' rather than a number — an interviewer walks away unsure how much it actually mattered.",
      evidence_quotes: [
        "So we shipped that and it went pretty well after that",
        "The team was happier with the new process",
      ],
    },
    {
      parameter_id: "COMMUNICATION_SNR",
      rating: 2,
      reasoning:
        "Talk ratio of 81% combined with a low signal-to-noise score means most of the airtime was spent restating the question or narrating thought process rather than delivering content — this is the metric most likely to frustrate a time-boxed interviewer.",
      evidence_quotes: [
        "So basically what happened was, let me think about this for a second, so the way it worked was",
        "Yeah so I guess the way I'd think about it is, it's kind of like, there's a few ways to approach it",
      ],
    },
    {
      parameter_id: "RESULT_ORIENTATION",
      rating: 3,
      reasoning:
        "One answer had a hard number (30% latency reduction); the other three stopped at describing what shipped without quantifying the outcome, which undercuts otherwise solid technical stories.",
      evidence_quotes: [
        "that cut our p99 latency by about 30 percent",
        "we rolled that out and didn't get any complaints after",
      ],
    },
    {
      parameter_id: "OWNERSHIP_ETHICS",
      rating: 5,
      reasoning:
        "Volunteered a story about catching their own production bug before it was reported and fixing it same-day without being asked — this is exactly the proactive-ownership signal senior interviewers look for and don't often get unprompted.",
      evidence_quotes: [
        "I actually caught it myself in the logs before anyone filed a ticket, so I just fixed it and wrote up what happened",
        "I didn't wait for someone to assign it to me",
      ],
    },
    {
      parameter_id: "ADAPTABILITY_GROWTH",
      rating: 4,
      reasoning:
        "Took the interviewer's hint about a race condition well, incorporated it immediately, and named the follow-up fix rather than getting defensive — a good adaptability signal.",
      evidence_quotes: [
        "Oh good catch, yeah that would race — I'd add a lock there",
        "That's a fair point, let me revise that",
      ],
    },
    {
      parameter_id: "EDGE_CASE_MASTERY",
      rating: 2,
      reasoning:
        "Described the happy path confidently across every answer but never proactively named a failure mode — every edge case discussed was raised by the interviewer, not the candidate.",
      evidence_quotes: [
        "In the normal case it just processes the queue in order",
        "Oh yeah I guess if that failed we'd need to handle it somehow",
      ],
    },
  ],
  question_walkthrough: [
    {
      question_number: 1,
      key_takeaway:
        "Opened with a confident summary of 5 years of backend ownership at two companies — solid, if generic, framing that didn't cost or gain much signal on its own.",
      signal_ids: ["COMMUNICATION_SNR"],
    },
    {
      question_number: 2,
      key_takeaway:
        "Named Kafka and Redis for the event pipeline but couldn't explain partition assignment when pushed — this is the moment the interview shifted from 'likely hire' to 'borderline', since depth-on-probe is exactly what separates using a tool from understanding it.",
      signal_ids: ["TECHNICAL_DEPTH"],
    },
    {
      question_number: 3,
      key_takeaway:
        "Asked two sharp clarifying questions before diagnosing the on-call scenario, which read as genuine operational maturity rather than rehearsed confidence.",
      signal_ids: ["PROBLEM_SOLVING", "ADAPTABILITY_GROWTH"],
    },
    {
      question_number: 4,
      key_takeaway:
        "Told the production-bug story with a specific, quantified outcome (30% p99 reduction) and volunteered that they caught and fixed it before anyone reported it — the strongest single moment in the transcript for both Result Orientation and Ownership.",
      signal_ids: ["RESULT_ORIENTATION", "OWNERSHIP_ETHICS"],
    },
    {
      question_number: 5,
      key_takeaway:
        "Talked through the happy path of the queue processor fluently but never raised what happens on failure until directly asked — a pattern that, if it repeats in the next round, will read as reactive rather than senior.",
      signal_ids: ["EDGE_CASE_MASTERY"],
    },
  ],
  model_answers: [
    {
      question_number: 2,
      parameter_id: "TECHNICAL_DEPTH",
      framework: "What → How → Why → Trade-off",
      model_excerpt:
        "We used Kafka with a keyed producer so all events for a given order land on the same partition, which keeps ordering guarantees per-order without needing a global lock. We chose a sticky partition assignor over round-robin because our consumer group rebalances were causing multi-second gaps in ordered processing during deploys. The trade-off is a small risk of hot-partitioning if one order key gets disproportionately busy — we monitor per-partition lag to catch that.",
    },
    {
      question_number: 1,
      parameter_id: "COMMUNICATION_SNR",
      framework: "Answer-first (BLUF)",
      model_excerpt:
        "Short version: five years building and owning backend systems, most recently leading the payments-reliability team at my current company. I can go deeper on any part of that — architecture decisions, the on-call process I built, or a specific incident — whichever is most useful to you.",
    },
  ],
  behavioral_insights: {
    star_adherence_score: 61,
    confidence_level: "Medium" as const,
    red_flags: ["Never proactively raised a failure mode across 5 questions — every edge case came from interviewer prompts"],
  },
  actionable_feedback: {
    strengths: [
      "Proactive ownership — caught and fixed a production bug before it was reported",
      "Composed under ambiguity — asks clarifying questions before diagnosing",
      "Takes feedback well and revises in real time without getting defensive",
    ],
    growth_areas: [
      "Technical depth breaks down under a second-level probe — comfortable naming tools, less comfortable explaining internals",
      "Talk ratio (81%) paired with low signal density means a lot of airtime isn't landing — practice answer-first delivery",
      "Never raises failure modes proactively — always reactive to the interviewer's prompt",
    ],
    top_priority_fix:
      "Before your next round, pick the two systems you use daily (your event queue, your cache) and go one level deeper than you currently can — partition strategy, eviction policy, failure behavior. That single gap is doing more damage to this score than anything else in the transcript.",
  },
};

// ---- Strong Hire scenario — every signal rated 4-5, so model_answers and
// the per-card framework callouts should both be empty. Checks that those
// sections degrade to "nothing rendered" instead of an empty box/heading.
const STRONG_HIRE_DEBRIEF = {
  ...MOCK_DEBRIEF,
  summary: {
    recommendation: "Strong Hire" as const,
    hire_probability: 91,
    overall_impression:
      "Consistently exceptional across every signal — SME-level technical depth, quantified results in nearly every answer, and proactive ownership without being asked. This is one of the strongest transcripts in the sample.",
  },
  skill_analysis: MOCK_DEBRIEF.skill_analysis.map((s) => ({
    ...s,
    rating: 5,
    reasoning: s.reasoning.replace(/\.$/, "") + " — consistently the strongest possible version of this signal throughout the session.",
  })),
  question_walkthrough: MOCK_DEBRIEF.question_walkthrough.map((q) => ({
    ...q,
    key_takeaway: q.key_takeaway,
  })),
  model_answers: [],
  behavioral_insights: {
    star_adherence_score: 96,
    confidence_level: "High" as const,
    red_flags: [],
  },
};

// ---- No Hire scenario — most signals rated 1-2, to check that many
// stacked framework + model-answer callouts don't break card spacing.
const NO_HIRE_DEBRIEF = {
  ...MOCK_DEBRIEF,
  summary: {
    recommendation: "No Hire" as const,
    hire_probability: 22,
    overall_impression:
      "Struggled to go beyond surface-level answers across almost every question. Technical claims were frequently vague or unverifiable, and several answers had no clear outcome. This session would not clear a technical screen at most companies.",
  },
  skill_analysis: MOCK_DEBRIEF.skill_analysis.map((s, i) => ({
    ...s,
    rating: i % 3 === 0 ? 3 : 1,
  })),
  model_answers: [
    ...MOCK_DEBRIEF.model_answers,
    {
      question_number: 3,
      parameter_id: "STAR_ALIGNMENT",
      framework: "STAR",
      model_excerpt:
        "Situation: our checkout error rate spiked to 4% after a deploy. Task: I was on-call and owned triage. Action: I bisected the last three deploys, found the culprit in a payment-retry change, and rolled it back within 12 minutes. Result: error rate returned to baseline (0.2%) and we shipped a fixed version with a regression test the next day.",
    },
    {
      question_number: 5,
      parameter_id: "RESULT_ORIENTATION",
      framework: "Situation → Complication → Resolution → Impact",
      model_excerpt:
        "The queue was backing up during peak hours. I added backpressure and horizontal scaling triggers on queue depth, which cut peak processing lag from 40 minutes to under 3.",
    },
  ],
  behavioral_insights: {
    star_adherence_score: 24,
    confidence_level: "Low" as const,
    red_flags: [
      "No quantified outcome in 4 of 5 answers",
      "Could not explain a core technology choice when probed",
      "Never proactively raised a failure mode or edge case",
    ],
  },
};

const SCENARIOS: Record<string, NewDebrief> = {
  borderline: MOCK_DEBRIEF,
  strong: STRONG_HIRE_DEBRIEF,
  nohire: NO_HIRE_DEBRIEF,
};

export default async function DebriefPreview({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string }>;
}) {
  const { scenario } = await searchParams;
  const debrief = SCENARIOS[scenario ?? "borderline"] ?? MOCK_DEBRIEF;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs text-amber-700 font-medium">
        dev preview — /dev/debrief — mock data, no DB or LLM call — try ?scenario=strong or ?scenario=nohire
      </div>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <DebriefReportView session={MOCK_SESSION} debrief={debrief} />
      </div>
    </div>
  );
}
