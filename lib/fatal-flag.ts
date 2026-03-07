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
