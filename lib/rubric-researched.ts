/**
 * PrepSignals: The "Source of Truth" Rubric & Grading Engine
 * Synthesized from: BarRaiser, FloCareer, Noota, Cockroach Labs, and Big Tech (Google/Amazon)
 * 
 * Logic: Evidence-First -> Behavioral Anchors (BARS) -> Weighted Normalization
 */

export type SignalLevel = 1 | 2 | 3 | 4 | 5;

export interface BehavioralAnchor {
  score: SignalLevel;
  label: string;
  criteria: string;
}

export interface SignalParameter {
  id: string;
  name: string;
  weight: number;
  anchors: BehavioralAnchor[];
}

/**
 * CONVERSATIONAL INTELLIGENCE METRICS (The "Vibe Proxies")
 * These are computed from transcript metadata before the LLM grades content.
 */
export const CONV_INTEL_CONFIG = {
  // Signal-to-Noise Ratio (SNR): High signal per 100 words
  // SNR = (Tech_Keywords + Action_Verbs + Results) / Total_Words
  SNR_THRESHOLD: {
    CONCISE: 0.15, // >15% is "Strong Hire" (Executive Presence)
    RAMBLING: 0.05 // <5% is a "Verbosity" Red Flag
  },
  
  // Talk-to-Listen Ratio: Candidate should speak 65-80%
  TALK_RATIO: {
    MIN: 0.60,
    IDEAL: 0.72,
    MAX: 0.85 // >90% is "Monologuing" Red Flag
  },
  
  // Response Latency (Hesitation)
  LATENCY_SEC: {
    THOUGHTFUL: [1, 3],
    HESITANT: 5 // >5s is a "Prep Gap" Flag
  },

  // Interruption Limit
  MAX_INTERRUPTIONS: 2
};

/**
 * THE 8 CORE PARAMETERS (Role-Specific & Universal)
 */
export const INTERVIEW_RUBRIC: Record<string, SignalParameter> = {
  TECHNICAL_DEPTH: {
    id: "TECHNICAL_DEPTH",
    name: "Technical Depth & Density",
    weight: 0.20,
    anchors: [
      { score: 1, label: "Unsatisfactory", criteria: "No technical depth; uses vague or incorrect terminology." },
      { score: 3, label: "Proficient", criteria: "Uses correct jargon; explains 'how' things work but misses 'why'." },
      { score: 5, label: "Exceptional", criteria: "SME Status; high technical density; proactive mention of trade-offs." }
    ]
  },
  PROBLEM_SOLVING: {
    id: "PROBLEM_SOLVING",
    name: "Problem Solving & Critical Thinking",
    weight: 0.15,
    anchors: [
      { score: 1, label: "Rigid", criteria: "Struggles with ambiguity; fails to adjust to curveballs." },
      { score: 3, label: "Adaptive", criteria: "Reaches functional solutions; handles hints well." },
      { score: 5, label: "Strategic", criteria: "Proactively identifies edge cases; optimizes independently." }
    ]
  },
  STAR_ALIGNMENT: {
    id: "STAR_ALIGNMENT",
    name: "STAR Method Alignment",
    weight: 0.15,
    anchors: [
      { score: 1, label: "Disorganized", criteria: "Rambles; no clear beginning or end to stories." },
      { score: 3, label: "Structured", criteria: "Clear Situation/Task/Action, but Result is weak." },
      { score: 5, label: "Highly Structured", criteria: "Clear STAR flow; Result is quantifiable and directly linked to Action." }
    ]
  },
  COMMUNICATION_SNR: {
    id: "COMMUNICATION_SNR",
    name: "Communication (Signal-to-Noise)",
    weight: 0.12,
    anchors: [
      { score: 1, label: "Vague/Wordy", criteria: "Low SNR; takes 5 minutes to say what takes 1." },
      { score: 3, label: "Direct", criteria: "Answers the question first; moderate filler usage." },
      { score: 5, label: "Concise", criteria: "Executive Presence; high signal; zero filler; Answer-First approach." }
    ]
  },
  RESULT_ORIENTATION: {
    id: "RESULT_ORIENTATION",
    name: "Result Orientation (Impact)",
    weight: 0.13,
    anchors: [
      { score: 1, label: "Input-focused", criteria: "Talks only about tasks/efforts, not outcomes." },
      { score: 3, label: "Output-focused", criteria: "Mentions completions/delivery but lacks %, $, or time saved." },
      { score: 5, label: "Impact-focused", criteria: "Quantifies impact across multiple answers with specific results." }
    ]
  },
  OWNERSHIP_ETHICS: {
    id: "OWNERSHIP_ETHICS",
    name: "Ownership & Initiative",
    weight: 0.10,
    anchors: [
      { score: 1, label: "Passive", criteria: "Does only what is assigned; avoids responsibility for failure." },
      { score: 3, label: "Reliable", criteria: "Completes tasks; owns mistakes." },
      { score: 5, label: "Proactive", criteria: "Demonstrates 'Ownership' by solving problems outside direct scope." }
    ]
  },
  ADAPTABILITY_GROWTH: {
    id: "ADAPTABILITY_GROWTH",
    name: "Adaptability & Growth Mindset",
    weight: 0.08,
    anchors: [
      { score: 1, label: "Resistant", criteria: "Defensive about feedback; ignores interviewer hints." },
      { score: 3, label: "Receptive", criteria: "Incorporates feedback when prompted; shows learning path." },
      { score: 5, label: "Growth-focused", criteria: "Seeks feedback; treats constraints as opportunities; learns fast." }
    ]
  },
  EDGE_CASE_MASTERY: {
    id: "EDGE_CASE_MASTERY",
    name: "Edge Case & Risk Awareness",
    weight: 0.07,
    anchors: [
      { score: 1, label: "Surface-level", criteria: "Misses failure modes; assumes 'Happy Path' only." },
      { score: 3, label: "Aware", criteria: "Identifies basic edge cases (null checks, errors) when asked." },
      { score: 5, label: "Preemptive", criteria: "Proactively identifies race conditions, scale bottlenecks, and risks." }
    ]
  }
};

/**
 * SIGNAL → FRAMEWORK LOOKUP (Finding #4)
 * Deterministic, not LLM-generated — same philosophy as hire_probability.
 * Surfaced in the UI for any signal rated <=3, so every "you're weak here"
 * comes with a concrete "here's the structure to fix it" rather than just
 * an observation with no path forward.
 */
export interface SignalFramework {
  name: string;        // short, memorable name for the framework
  steps: string[];     // the structure, in order
  howToApply: string;  // one line connecting the framework to this specific signal
}

export const SIGNAL_FRAMEWORKS: Record<string, SignalFramework> = {
  TECHNICAL_DEPTH: {
    name: "What → How → Why → Trade-off",
    steps: ["State what you built or used", "Explain how it works, briefly", "Explain why you chose it over the obvious alternative", "Name the trade-off you accepted"],
    howToApply: "Most answers stop at 'what' and 'how'. The 'why' and the trade-off are what separate a proficient answer from an exceptional one — they're what an interviewer can't get from a resume.",
  },
  PROBLEM_SOLVING: {
    name: "Clarify → Approach → Trade-offs → Validate",
    steps: ["Clarify the ambiguity or constraint before diving in", "State your approach in one sentence", "Weigh at least one trade-off out loud", "Say how you'd validate the solution worked"],
    howToApply: "Jumping straight to a solution reads as rigid. Naming the ambiguity first — even briefly — is what signals strategic thinking under uncertainty.",
  },
  STAR_ALIGNMENT: {
    name: "STAR",
    steps: ["Situation — the context in one or two sentences", "Task — what you specifically were responsible for", "Action — what you actually did, in first person", "Result — a quantified outcome"],
    howToApply: "The Result step is almost always the weakest part of a STAR answer. If you can't attach a number, attach a comparison ('faster than before', 'fewer than the prior approach') instead of leaving it open-ended.",
  },
  COMMUNICATION_SNR: {
    name: "Answer-first (BLUF)",
    steps: ["Lead with the one-sentence answer", "Back it with 2-3 supporting details", "Stop — resist the urge to restate what you already said"],
    howToApply: "Burying the answer inside a longer story forces the interviewer to extract it themselves. Say the conclusion first, then justify it.",
  },
  RESULT_ORIENTATION: {
    name: "Situation → Complication → Resolution → Impact",
    steps: ["Situation — what was happening", "Complication — what was actually broken or at risk", "Resolution — what you changed", "Impact — a specific number: %, $, time, or count"],
    howToApply: "Describing the resolution without the impact number is the single most common gap. Even a rough estimate ('roughly halved') is stronger than no number at all.",
  },
  OWNERSHIP_ETHICS: {
    name: "Own It",
    steps: ["Name the problem, including your role in it if relevant", "State the decision you made without waiting to be told", "Describe action taken beyond your explicit scope", "Own the outcome — credit or blame — without deflecting"],
    howToApply: "Ownership reads clearest when you describe acting before being asked, and when you own a mistake in first person instead of describing it passively.",
  },
  ADAPTABILITY_GROWTH: {
    name: "Feedback Loop",
    steps: ["What changed or what feedback you received", "How you adjusted your approach", "What you'd do differently next time"],
    howToApply: "Interviewers are listening for a specific adjustment, not just 'I learned a lot'. Name the one thing you changed and why it was the right change.",
  },
  EDGE_CASE_MASTERY: {
    name: "Happy Path + Two",
    steps: ["Describe the happy path solution", "Proactively name one failure mode or edge case", "Name a second, less obvious one", "Say how you'd catch or handle each"],
    howToApply: "Waiting for the interviewer to ask 'what if X fails' reads as reactive. Naming a failure mode before they ask is what reads as senior.",
  },
};

/**
 * CALCULATOR LOGIC (Vibe-Proofing)
 * Normalizes scores by Weight and applies Seniority Modifiers.
 */
export function calculateNormalizedScore(
  rawScores: Record<string, number>, // 1-5 scale
  seniority: 'Junior' | 'Mid' | 'Senior'
): number {
  let totalWeightedScore = 0;
  let totalPossibleWeight = 0;

  // Seniority Modifiers (Industry Standard: Expect more on Depth/Impact for Seniors)
  const modifiers: Record<string, Record<string, number>> = {
    Junior: { TECHNICAL_DEPTH: 1.2, STAR_ALIGNMENT: 1.0 },
    Senior: { TECHNICAL_DEPTH: 0.8, EDGE_CASE_MASTERY: 1.5, RESULT_ORIENTATION: 1.3 }
  };

  for (const key in INTERVIEW_RUBRIC) {
    const param = INTERVIEW_RUBRIC[key];
    const score = rawScores[key] || 0;
    const modifier = modifiers[seniority]?.[key] || 1.0;
    
    totalWeightedScore += (score * param.weight * modifier);
    totalPossibleWeight += (5 * param.weight * modifier); // Max score is 5
  }

  // Returns 0-100% Hire Probability
  return Math.round((totalWeightedScore / totalPossibleWeight) * 100);
}
