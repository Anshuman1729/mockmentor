// Single source of truth for round_type normalization and question counts.
//
// Previously `app/api/interview/question/route.ts` and
// `app/api/interview/debrief/route.ts` each maintained their own independent
// normalization map, and they disagreed: the question route folded legacy
// `round_type = "technical"` into `technical_screen` (5 questions), but the
// debrief route treated `"technical"` as its own key requiring 8 questions.
// A session with that legacy round_type would generate 5 questions then
// never satisfy the debrief route's completeness gate
// (`qas.length >= totalQuestions`) — permanently stuck, unable to ever get a
// debrief. There was also a fallback mismatch (`?? 7` in the debrief route
// vs `?? "technical_screen"` in the question route) that generalized this
// into a whole class of bug for any unrecognized round_type value.
//
// This module is the shared fix: both routes now normalize and resolve
// question counts through the exact same code path.

export const QUESTIONS_BY_ROUND: Record<string, number> = {
  technical_screen: 5,
  technical_deep_dive: 8,
  system_design: 6,
  behavioural: 7,
  final: 8,
  hr_screen: 5,
  case_study: 5,
  // Hidden 1-question test shortcut (app/api/dev/quick-test) — real
  // round_type, not a bypass hack, so it's explicit and traceable through
  // this exact same map rather than a separate gate.
  quick_test: 1,
};

const DEFAULT_ROUND_TYPE = "technical_screen";

// Every alias reachable from the current UI (SetupForm.tsx's ROUND_TYPES,
// lowercased) plus legacy/back-compat values previously handled by the two
// routes' now-deleted inline maps. Canonical keys (already matching
// QUESTIONS_BY_ROUND) don't need entries here — normalizeRoundType falls
// through to the raw lowercased value when there's no alias, and that value
// is accepted as-is if it's already a valid key in QUESTIONS_BY_ROUND.
const ROUND_TYPE_ALIASES: Record<string, string> = {
  "technical screen": "technical_screen",
  "technical deep dive": "technical_deep_dive",
  "system design": "system_design",
  "behavioral": "behavioural",
  "final round": "final",
  "hr screen": "hr_screen",
  "case study": "case_study",
  // Legacy passthrough values from old sessions.
  "screening": "technical_screen",
  "technical": "technical_screen",
};

/**
 * Normalizes a raw round_type value (whatever casing/spacing it was stored
 * or submitted with) into one of the canonical keys of QUESTIONS_BY_ROUND.
 * Unrecognized/empty/null/undefined values fall back to DEFAULT_ROUND_TYPE.
 * Idempotent: normalizing an already-canonical key returns it unchanged.
 */
export function normalizeRoundType(raw: string | null | undefined): string {
  const key = (raw ?? "").trim().toLowerCase();
  const aliased = ROUND_TYPE_ALIASES[key] ?? key;
  return aliased in QUESTIONS_BY_ROUND ? aliased : DEFAULT_ROUND_TYPE;
}

/** Total question count for a (possibly non-normalized) round_type value. */
export function getTotalQuestions(raw: string | null | undefined): number {
  return QUESTIONS_BY_ROUND[normalizeRoundType(raw)];
}

/**
 * generateDomainQuestion() has no HR/behavioral awareness — it always asks
 * deep-expertise technical questions regardless of round type. It must only
 * be used for technical-style rounds, and the same technical/behavioural
 * split is used to select which round_type of seed question to fetch from
 * question_bank.
 */
export function seedRoundType(raw: string): "technical" | "behavioural" {
  const normalized = normalizeRoundType(raw);
  return normalized === "behavioural" || normalized === "hr_screen" ? "behavioural" : "technical";
}
