import { DebriefReportView, type NewDebrief, type HistoryEntry } from "@/components/DebriefReport";
import { DevDrillMock } from "./DevDrillMock";

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

// Real question text for each question_number the mock debriefs reference —
// DrillPractice needs this to show "your turn, answer this again."
const MOCK_QAS = [
  { question_number: 1, question: "Tell me about yourself and your experience with backend systems." },
  { question_number: 2, question: "Walk me through the event-driven architecture you built — what did you use and why?" },
  { question_number: 3, question: "You get paged at 2am for a service returning intermittent 500s. Walk me through your diagnosis." },
  { question_number: 4, question: "Tell me about a time you found and fixed a bug that wasn't assigned to you." },
  { question_number: 5, question: "How does your queue processor handle failures?" },
];

// Cross-interview trend fixture (Backlog: "retry/drill loop + trend
// tracking") — two past sessions where Technical Depth stayed weak and
// Communication Clarity improved, so both the "N-session pattern" and
// "Improving" badges can be visually verified against the borderline
// scenario's today rating (TECHNICAL_DEPTH: 2, COMMUNICATION_SNR: 2).
const MOCK_HISTORY: HistoryEntry[] = [
  {
    session_id: "mock-session-a",
    date: "2026-08-10T10:00:00Z",
    role: "Senior Backend Engineer",
    company: "Datadog",
    round_type: "Technical Screen",
    skill_analysis: [
      { parameter_id: "TECHNICAL_DEPTH", rating: 2 },
      { parameter_id: "COMMUNICATION_SNR", rating: 1 },
      { parameter_id: "EDGE_CASE_MASTERY", rating: 2 },
    ],
  },
  {
    session_id: "mock-session-b",
    date: "2026-08-18T10:00:00Z",
    role: "Senior Backend Engineer",
    company: "Notion",
    round_type: "Technical Deep Dive",
    skill_analysis: [
      { parameter_id: "TECHNICAL_DEPTH", rating: 2 },
      { parameter_id: "COMMUNICATION_SNR", rating: 1 },
      { parameter_id: "EDGE_CASE_MASTERY", rating: 3 },
    ],
  },
];

const MOCK_DEBRIEF: NewDebrief = {
  summary: {
    recommendation: "Borderline",
    hire_probability: 58,
    overall_impression:
      "I'd want a second, more technical opinion before deciding — communication and ownership are genuinely strong, but I don't yet have enough evidence this candidate can operate at the systems depth the role needs.",
  },
  metrics: {
    talk_to_listen_ratio: "81/19",
    avg_response_latency_sec: 2.6,
    signal_to_noise_ratio: 0.11,
    interruption_count: 1,
    longest_monologue_sec: 143,
    candidate_questions_asked: 1,
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
  priority_risks: [
    {
      title: "Evidence gap",
      description: "Names the right tools but stops before the reasoning that would let an interviewer verify real understanding — 'we used Kafka' without why, or how it actually works.",
      related_signal_ids: ["TECHNICAL_DEPTH", "STAR_ALIGNMENT"],
    },
    {
      title: "Answer architecture",
      description: "Talks around the point before landing it, and closes stories without a number — the content is there, but it isn't organized to land fast.",
      related_signal_ids: ["COMMUNICATION_SNR", "RESULT_ORIENTATION"],
    },
    {
      title: "Reactive, not proactive",
      description: "Every edge case and failure mode in the session came from an interviewer prompt, never volunteered first.",
      related_signal_ids: ["EDGE_CASE_MASTERY"],
    },
  ],
  model_answers: [
    {
      question_number: 2,
      parameter_id: "TECHNICAL_DEPTH",
      your_quote: "We used Kafka to decouple the services, it's pretty standard for this kind of thing",
      why_it_hurt: "This names the tool but not the reasoning — an interviewer hears 'used a common pattern,' not 'understands why this pattern fit this problem.'",
      framework: "Answer → Reasoning → Trade-off",
      model_excerpt:
        "We used Kafka with a keyed producer so all events for a given order land on the same partition, which keeps ordering guarantees per-order without needing a global lock. We chose a sticky partition assignor over round-robin because our consumer group rebalances were causing multi-second gaps in ordered processing during deploys. The trade-off is a small risk of hot-partitioning if one order key gets disproportionately busy — we monitor per-partition lag to catch that.",
    },
    {
      question_number: 1,
      parameter_id: "COMMUNICATION_SNR",
      your_quote: "So basically what happened was, let me think about this for a second, so the way it worked was",
      why_it_hurt: "Three restatements before any content — the interviewer has to wait through the throat-clearing to get to the actual answer, which reads as unprepared even when the underlying work is solid.",
      framework: "Answer → Evidence → Impact",
      model_excerpt:
        "Short version: five years building and owning backend systems, most recently leading the payments-reliability team at my current company. I can go deeper on any part of that — architecture decisions, the on-call process I built, or a specific incident — whichever is most useful to you.",
    },
    {
      question_number: 5,
      parameter_id: "EDGE_CASE_MASTERY",
      your_quote: "In the normal case it just processes the queue in order",
      why_it_hurt: "Stopping at the happy path and waiting to be asked 'what if it fails' reads as reactive — the interviewer has to do the work of probing for risk awareness instead of seeing it volunteered.",
      framework: "Answer → Reasoning → Trade-off",
      model_excerpt:
        "In the normal case it processes the queue in order. Two things I'd want to handle proactively: a message that fails repeatedly shouldn't block the whole queue, so I'd move it to a dead-letter queue after N retries. And if the consumer crashes mid-processing, I'd want idempotent handlers so a retry doesn't double-process.",
    },
  ],
  path_to_next_tier: "One answer at the depth of the Kafka rewrite above — explaining the reasoning behind a technical choice, not just naming it — would likely be enough to move this from Borderline to Hire.",
  behavioral_insights: {
    star_adherence_score: 61,
    confidence_level: "Medium",
    confidence_rationale: "Based on 5 substantive answers with consistent communication style, but only 1 question probed technical internals directly, which limits how confidently the depth gap generalizes.",
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

// ---- Strong Hire scenario — every signal independently written for a 5/5
// performance (NOT derived from the borderline scenario's text — an earlier
// version of this fixture reused MOCK_DEBRIEF's reasoning/evidence verbatim
// and just overrode the rating number, which a persona review correctly
// called out as a real reasoning/score mismatch risk, even though it was
// purely a fixture bug and not a generateDebrief prompt issue). Every
// signal here is 4-5, so model_answers and the per-card framework callouts
// should both be empty — checks that those sections degrade to "nothing
// rendered" instead of an empty box/heading.
const STRONG_HIRE_DEBRIEF: NewDebrief = {
  summary: {
    recommendation: "Strong Hire",
    hire_probability: 91,
    overall_impression:
      "Easy yes — SME-level depth, results backed by real numbers, ownership before I had to ask. I'd fast-track this one.",
  },
  metrics: {
    talk_to_listen_ratio: "68/32",
    avg_response_latency_sec: 1.7,
    signal_to_noise_ratio: 0.24,
    interruption_count: 0,
    longest_monologue_sec: 98,
    candidate_questions_asked: 3,
  },
  skill_analysis: [
    { parameter_id: "TECHNICAL_DEPTH", rating: 5, reasoning: "Explained partition assignment, cache eviction trade-offs, and a specific incident's root cause without being prompted — SME-level depth an interviewer doesn't have to extract.", evidence_quotes: ["We used a sticky partition assignor because round-robin was causing multi-second rebalance gaps during deploys", "I chose an LRU eviction policy over TTL because our access pattern was heavily skewed toward recently-viewed items"] },
    { parameter_id: "PROBLEM_SOLVING", rating: 5, reasoning: "Asked clarifying questions before proposing a diagnosis in every ambiguous scenario, then reasoned through two competing hypotheses out loud before committing.", evidence_quotes: ["Before I answer — is this a gradual degradation or a sudden spike?", "If it's sudden I'd check recent deploys first, then network, then downstream dependencies in that order"] },
    { parameter_id: "STAR_ALIGNMENT", rating: 5, reasoning: "Every story closed with a quantified Result directly tied to the Action taken, not a vague 'it went well'.", evidence_quotes: ["That cut our p99 latency by 30 percent within the same sprint", "We caught it in the logs before anyone filed a ticket and shipped the fix same-day"] },
    { parameter_id: "COMMUNICATION_SNR", rating: 5, reasoning: "Answer-first throughout — led with the conclusion, then backed it with two or three specifics, and stopped instead of restating.", evidence_quotes: ["Short answer: yes, and here's why", "The trade-off was write throughput, which we accepted and scaled around with read replicas"] },
    { parameter_id: "RESULT_ORIENTATION", rating: 4, reasoning: "Quantified outcomes in four of five answers with hard numbers; one answer described a strong process without closing on an explicit metric.", evidence_quotes: ["that cut our p99 latency by about 30 percent", "we rolled that out and it held up fine, though I don't have an exact number on adoption"] },
    { parameter_id: "OWNERSHIP_ETHICS", rating: 5, reasoning: "Volunteered a story about catching and fixing their own production bug before it was reported, and explicitly credited the team rather than taking sole credit.", evidence_quotes: ["I caught it myself in the logs before anyone filed a ticket, so I just fixed it and wrote up what happened", "I didn't wait for someone to assign it to me"] },
    { parameter_id: "ADAPTABILITY_GROWTH", rating: 5, reasoning: "Took a correction from the interviewer mid-answer, incorporated it immediately without getting defensive, and named the specific adjustment.", evidence_quotes: ["Oh good catch, yeah that would race — I'd add a lock there", "That's a fair point, let me revise that"] },
    { parameter_id: "EDGE_CASE_MASTERY", rating: 4, reasoning: "Proactively named a failure mode in two of three system questions before being asked; the third stayed at the happy path until prompted.", evidence_quotes: ["the one thing I'd worry about is a partial write if the process dies mid-flush", "if that failed we'd need a retry with backoff, though honestly I hadn't thought about it until now"] },
  ],
  question_walkthrough: [
    { question_number: 1, key_takeaway: "Opened with a specific, quantified win (p99 latency cut) instead of a generic self-intro — set a strong first impression immediately.", signal_ids: ["TECHNICAL_DEPTH", "RESULT_ORIENTATION"] },
    { question_number: 2, key_takeaway: "Named the partition-assignor trade-off unprompted — this is the single strongest technical moment in the transcript, the kind of detail that separates 'used the tool' from 'understands the tool'.", signal_ids: ["TECHNICAL_DEPTH", "PROBLEM_SOLVING"] },
    { question_number: 3, key_takeaway: "Told the production-bug story with full ownership and a same-day fix, without waiting to be asked — textbook proactive ownership.", signal_ids: ["OWNERSHIP_ETHICS", "STAR_ALIGNMENT"] },
    { question_number: 4, key_takeaway: "Took a live correction on a race condition well, revised the answer on the spot instead of getting defensive.", signal_ids: ["ADAPTABILITY_GROWTH"] },
    { question_number: 5, key_takeaway: "Walked the happy path fluently and named one failure mode unprompted, though didn't go further until asked — the one place this session stayed at 'very good' instead of 'exceptional'.", signal_ids: ["EDGE_CASE_MASTERY"] },
  ],
  priority_risks: [],
  model_answers: [],
  path_to_next_tier: "Already at the top tier for this rubric — the only stretch is proactively naming a failure mode on every system question, not just most of them.",
  behavioral_insights: {
    star_adherence_score: 96,
    confidence_level: "High",
    confidence_rationale: "Based on 5 substantive, technically detailed answers with consistent quantified outcomes across every question.",
    red_flags: [],
  },
  actionable_feedback: {
    strengths: [
      "SME-level technical depth — explains trade-offs unprompted, not just what was chosen",
      "Every story closes with a quantified, action-linked result",
      "Proactive ownership — caught and fixed their own bug before being asked",
    ],
    growth_areas: [
      "Edge case awareness is strong but not yet fully proactive on every question — still occasionally waits to be asked",
    ],
    top_priority_fix:
      "This session is Staff-ready as-is. The one stretch goal: proactively name a failure mode on every system question, not just most of them — that's the last gap between 'very strong' and 'exceptional' here.",
  },
};

// ---- No Hire scenario — most signals rated 1-2 with independently written
// reasoning/evidence matched to that performance level (see note above the
// Strong Hire scenario on why this isn't derived from MOCK_DEBRIEF).
// Checks that many stacked framework + model-answer callouts don't break
// card spacing.
const NO_HIRE_DEBRIEF: NewDebrief = {
  summary: {
    recommendation: "No Hire",
    hire_probability: 22,
    overall_impression:
      "I never got past surface-level descriptions — every time I pushed for how or why, I got restated context instead of a decision. I can't verify real understanding from this transcript, and that's a no.",
  },
  metrics: {
    talk_to_listen_ratio: "58/42",
    avg_response_latency_sec: 4.1,
    signal_to_noise_ratio: 0.04,
    interruption_count: 0,
    longest_monologue_sec: 187,
    candidate_questions_asked: 0,
  },
  skill_analysis: [
    { parameter_id: "TECHNICAL_DEPTH", rating: 1, reasoning: "Named tools without being able to explain how they worked or why they were chosen over alternatives, even when probed directly.", evidence_quotes: ["We used Kubernetes because it's the industry standard and everyone uses it these days", "I'm not totally sure how the caching worked, I just used what was already set up"] },
    { parameter_id: "PROBLEM_SOLVING", rating: 1, reasoning: "Jumped straight to a guess when faced with an ambiguous scenario instead of asking a clarifying question, then couldn't recover when the guess was wrong.", evidence_quotes: ["I'd just restart the service, that usually fixes it", "Yeah I'm not sure what else I'd check, maybe just wait and see"] },
    { parameter_id: "STAR_ALIGNMENT", rating: 3, reasoning: "Stories had a recognizable situation and action but the result step was routinely left as 'it worked out' with no number attached.", evidence_quotes: ["So we shipped that and it went pretty well after that", "The team was happier with the new process, I think"] },
    { parameter_id: "COMMUNICATION_SNR", rating: 1, reasoning: "Most of the airtime was spent narrating thought process or restating the question rather than delivering content, making it hard to extract an actual answer.", evidence_quotes: ["So basically what happened was, let me think about this for a second, so the way it worked was", "Yeah so I guess the way I'd think about it is, it's kind of like, there's a few ways to approach it"] },
    { parameter_id: "RESULT_ORIENTATION", rating: 1, reasoning: "No answer in the session closed with a quantified outcome — every story stopped at 'we shipped it' or 'it went fine'.", evidence_quotes: ["we rolled that out and didn't get any complaints after", "it's been running okay since then as far as I know"] },
    { parameter_id: "OWNERSHIP_ETHICS", rating: 3, reasoning: "Described completing assigned tasks reliably, but every example was reactive — nothing volunteered or taken on beyond what was explicitly asked.", evidence_quotes: ["I did what was in the ticket and closed it out", "if something breaks I usually wait for someone to flag it before I look into it"] },
    { parameter_id: "ADAPTABILITY_GROWTH", rating: 1, reasoning: "Became visibly defensive when the interviewer pointed out a flaw in the approach, and did not revise the answer even after the hint.", evidence_quotes: ["No I think it would have been fine, we just didn't hit that case", "I mean, it worked for us so I'm not sure what the issue is"] },
    { parameter_id: "EDGE_CASE_MASTERY", rating: 1, reasoning: "Described only the happy path in every system question and did not raise a single failure mode even when directly asked what could go wrong.", evidence_quotes: ["In the normal case it just processes the queue in order", "Oh yeah I guess if that failed we'd need to handle it somehow"] },
  ],
  question_walkthrough: [
    { question_number: 1, key_takeaway: "Opened with a vague summary of experience with no specific project or outcome named — didn't cost much on its own, but set a low-signal tone for the session.", signal_ids: ["COMMUNICATION_SNR"] },
    { question_number: 2, key_takeaway: "Named Kubernetes and a caching layer but couldn't explain either beyond 'it's standard' when probed — the moment the interview shifted from cautious optimism to concern.", signal_ids: ["TECHNICAL_DEPTH"] },
    { question_number: 3, key_takeaway: "Guessed a fix ('just restart it') without diagnosing the actual scenario, and had no fallback when told the guess didn't hold — a real gap for anything beyond the most junior on-call rotation.", signal_ids: ["PROBLEM_SOLVING"] },
    { question_number: 4, key_takeaway: "Got defensive when the interviewer pointed out an edge case the approach missed, rather than incorporating the feedback — this is the single most damaging moment in the transcript.", signal_ids: ["ADAPTABILITY_GROWTH"] },
    { question_number: 5, key_takeaway: "Described the queue processor's happy path only, and even when asked directly what could go wrong, gave an uncertain, unprompted-feeling answer.", signal_ids: ["EDGE_CASE_MASTERY"] },
  ],
  priority_risks: [
    {
      title: "Evidence gap",
      description: "Names tools without the reasoning to back them, and can't recover when a guess doesn't hold — claims without proof, twice over.",
      related_signal_ids: ["TECHNICAL_DEPTH", "PROBLEM_SOLVING"],
    },
    {
      title: "No closing impact",
      description: "Every story stops at 'it worked' — never a number, never a measurable outcome across the whole session.",
      related_signal_ids: ["COMMUNICATION_SNR", "RESULT_ORIENTATION"],
    },
    {
      title: "Defensive under pushback",
      description: "When the interviewer pointed out a real flaw, the response was to defend the original answer instead of incorporating the feedback — this is a harder gap to close than the technical ones.",
      related_signal_ids: ["ADAPTABILITY_GROWTH", "EDGE_CASE_MASTERY"],
    },
  ],
  model_answers: [
    {
      question_number: 3,
      parameter_id: "PROBLEM_SOLVING",
      your_quote: "I'd just restart the service, that usually fixes it",
      why_it_hurt: "Jumping straight to a fix without diagnosing reads as guessing, not problem-solving — and the interviewer has no way to know if the guess was a lucky one.",
      framework: "Answer → Reasoning → Trade-off",
      model_excerpt:
        "Before I restart anything, I'd want to know: is this affecting all requests or a subset? If it's sudden, I'd check what deployed in the last hour first, since that's the highest-probability cause. I'd only restart as a last resort, since that can mask the real issue and I'd want a fix, not just a Band-Aid.",
    },
    {
      question_number: 4,
      parameter_id: "ADAPTABILITY_GROWTH",
      your_quote: "No I think it would have been fine, we just didn't hit that case",
      why_it_hurt: "This is the single most damaging moment in the transcript — defending the original answer instead of engaging with a flaw a senior interviewer just handed them for free.",
      framework: "Situation → Action → Result",
      model_excerpt:
        "Good catch — you're right, that would break under concurrent access. I'd add a lock around that section, or better, make the operation idempotent so it's safe either way. I should have caught that myself before you pointed it out.",
    },
    {
      question_number: 5,
      parameter_id: "EDGE_CASE_MASTERY",
      your_quote: "In the normal case it just processes the queue in order",
      why_it_hurt: "Stopping at the happy path and waiting to be asked what could go wrong reads as reactive, not senior — and even when asked directly, the answer stayed uncertain.",
      framework: "Answer → Reasoning → Trade-off",
      model_excerpt:
        "Normally it processes the queue in order. Two things I'd want to handle: a message that fails repeatedly shouldn't block the whole queue forever, so I'd move it to a dead-letter queue after N retries. And if the consumer crashes mid-processing, I'd want idempotent handlers so we don't silently drop or double-process a message.",
    },
  ],
  path_to_next_tier: "This session is missing the basics across the board, not one gap — but the fastest single fix is the defensiveness moment in Q4: an interviewer forgives a technical gap far more readily than a poor reaction to being corrected.",
  behavioral_insights: {
    star_adherence_score: 24,
    confidence_level: "Low",
    confidence_rationale: "Based on 5 answers, but 4 of them lacked enough specificity to confidently separate genuine gaps from nervousness or unfamiliarity with interview format.",
    red_flags: [
      "No quantified outcome in 4 of 5 answers",
      "Could not explain a core technology choice when probed",
      "Never proactively raised a failure mode or edge case",
      "Became defensive rather than incorporating interviewer feedback",
    ],
  },
  actionable_feedback: {
    strengths: [
      "Reliable on explicitly assigned work — nothing described here was left unfinished",
    ],
    growth_areas: [
      "Technical claims don't hold up under a second-level probe — comfortable naming tools, not explaining them",
      "No quantified outcome anywhere in the session — every story stops at 'it worked'",
      "Responded to interviewer feedback with defensiveness rather than incorporating it — this is the harder gap to close before the depth gap",
    ],
    top_priority_fix:
      "Before anything else: the next time an interviewer points out a flaw, practice pausing and asking 'can you say more about that?' instead of defending the original answer. Everything else here is trainable with practice; that reaction pattern is the one an interviewer will remember most.",
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
      <DevDrillMock />
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs text-amber-700 font-medium">
        dev preview — /dev/debrief — mock data, no DB or LLM call — try ?scenario=strong or ?scenario=nohire — &quot;Try it yourself&quot; is mocked here, not calling the real API
      </div>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <DebriefReportView
          session={MOCK_SESSION}
          debrief={debrief}
          sessionId="dev-preview-session"
          qas={MOCK_QAS}
          history={MOCK_HISTORY}
        />
      </div>
    </div>
  );
}
