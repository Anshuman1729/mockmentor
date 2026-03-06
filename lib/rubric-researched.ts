/**
 * MockMentor: The "Source of Truth" Rubric & Grading Engine
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
