// Shared round-type config — the single source of truth for how many
// questions a round asks and how a raw round_type value (as stored on
// sessions, e.g. "Technical Deep Dive") maps to the normalized snake_case
// keys used everywhere else (question generation, feedback config, seeding).
// Extracted out of app/api/interview/question/route.ts so lib/feedback-config.ts
// can't drift from the same round-type list.

export const QUESTIONS_BY_ROUND: Record<string, number> = {
  technical_screen: 5,
  technical_deep_dive: 8,
  system_design: 6,
  behavioural: 7,
  final: 8,
  hr_screen: 5,
  case_study: 5,
};

export function normalizeRoundType(raw: string): string {
  const map: Record<string, string> = {
    "technical screen": "technical_screen",
    "technical deep dive": "technical_deep_dive",
    "system design": "system_design",
    "behavioral": "behavioural",
    "behavioural": "behavioural",
    "final round": "final",
    "hr screen": "hr_screen",
    "case study": "case_study",
    // passthrough for already-normalized values
    "screening": "technical_screen",
    "technical": "technical_screen",
    "final": "final",
  };
  return map[raw.toLowerCase()] ?? "technical_screen";
}

export function seedRoundType(normalized: string): string {
  if (normalized === "behavioural" || normalized === "hr_screen") return "behavioural";
  return "technical";
}

export function getTotalQuestions(roundType: string): number {
  return QUESTIONS_BY_ROUND[roundType] ?? 7;
}
