export const FATAL_FLAG_THRESHOLD = 0.30;

const ZERO_SIGNAL_PHRASES = [
  "i don't know",
  "i dont know",
  "i do not know",
  "pass",
  "skip",
  "no idea",
  "i have no experience",
  "not sure",
  "no clue",
];

export function isZeroSignal(answer: string | null): boolean {
  if (answer === null || answer.trim() === "") return true;

  const trimmed = answer.trim().toLowerCase();

  for (const phrase of ZERO_SIGNAL_PHRASES) {
    if (trimmed === phrase || trimmed.startsWith(phrase + " ") || trimmed.startsWith(phrase + ".") || trimmed.startsWith(phrase + ",")) {
      return true;
    }
  }

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount < 10) return true;

  return false;
}

export interface FatalFlagResult {
  triggered: boolean;
  skipCount: number;
  totalQuestions: number;
  skipRate: number;
  zeroSignalQuestionNumbers: number[];
}

export function checkFatalFlag(
  qas: Array<{ question_number: number; answer: string | null }>,
  totalQuestions: number
): FatalFlagResult {
  const zeroSignalQuestionNumbers: number[] = [];

  // Count zero-signal answers among answered questions
  for (const qa of qas) {
    if (isZeroSignal(qa.answer)) {
      zeroSignalQuestionNumbers.push(qa.question_number);
    }
  }

  // Count unasked questions (never received an answer at all)
  const answeredNumbers = new Set(qas.map((qa) => qa.question_number));
  for (let i = 1; i <= totalQuestions; i++) {
    if (!answeredNumbers.has(i)) {
      zeroSignalQuestionNumbers.push(i);
    }
  }

  const skipCount = zeroSignalQuestionNumbers.length;
  const skipRate = skipCount / totalQuestions;
  const triggered = skipRate > FATAL_FLAG_THRESHOLD;

  return { triggered, skipCount, totalQuestions, skipRate, zeroSignalQuestionNumbers };
}

export interface FatalFlagInternalNote {
  triggered: boolean;
  skip_count: number;
  total_questions: number;
  skip_rate: number;
  zero_signal_question_numbers: number[];
}

// Matches DebriefReport["summary"]["recommendation"] in lib/groq.ts — not imported
// from there to avoid a circular dependency (groq.ts doesn't import this file, but
// keeping this file dependency-free for the standalone unit tests is preferable).
export type Recommendation = "Strong Hire" | "Hire" | "Borderline" | "No Hire";

// Internal-only: this return value feeds debriefs.reasoning (never returned to the client).
// Never wire any of it into a user-facing string — see CLAUDE.md's non-negotiable rules.
export function applyFatalFlag(
  hireProbability: number,
  recommendation: Recommendation,
  result: FatalFlagResult
): { hireProbability: number; recommendation: Recommendation; internalNote: FatalFlagInternalNote } {
  const internalNote: FatalFlagInternalNote = {
    triggered: result.triggered,
    skip_count: result.skipCount,
    total_questions: result.totalQuestions,
    skip_rate: result.skipRate,
    zero_signal_question_numbers: result.zeroSignalQuestionNumbers,
  };
  if (!result.triggered) {
    return { hireProbability, recommendation, internalNote };
  }
  return {
    hireProbability: Math.min(hireProbability, 30),
    recommendation: "No Hire",
    internalNote,
  };
}
