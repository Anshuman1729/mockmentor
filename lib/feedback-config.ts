// Post-interview feedback form — deterministic, not LLM-generated (same
// "deterministic where possible" philosophy as lib/rubric-researched.ts).
// The question set is a function of (round_type, question_count):
// UNIVERSAL_QUESTIONS always apply; ROUND_TYPE_QUESTIONS adds markers
// specific to what a good interviewer in that round actually does (an HR
// screen and a system design round are graded on different things); and
// LONG_ROUND_QUESTION is appended when the round asked enough questions
// that coherence-across-length becomes something worth asking about.
//
// This form is only wired into the app on a preview/staging deployment —
// see BACKLOG.md for the branch/DB-isolation notes. Not intended to reach
// production as-is.

import { normalizeRoundType, QUESTIONS_BY_ROUND } from "@/lib/round-types";

export type FeedbackQuestionType = "rating" | "single_select" | "text";

export interface FeedbackQuestion {
  id: string;
  type: FeedbackQuestionType;
  prompt: string;
  helpText?: string;
  options?: { value: string; label: string }[]; // single_select only
  required: boolean;
}

// Asked on every round, regardless of type or length.
const UNIVERSAL_QUESTIONS: FeedbackQuestion[] = [
  {
    id: "realism",
    type: "rating",
    prompt: "How realistic did this feel compared to a real interview?",
    required: true,
  },
  {
    id: "voice_quality",
    type: "rating",
    prompt: "How natural did the interviewer's voice and pacing feel?",
    required: true,
  },
  {
    id: "would_use_again",
    type: "single_select",
    prompt: "Would you do another mock interview like this before a real one?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "maybe", label: "Maybe" },
      { value: "no", label: "No" },
    ],
    required: true,
  },
  {
    id: "open_feedback",
    type: "text",
    prompt: "Anything that felt off, broken, or worth telling us?",
    helpText: "Optional — bugs, confusing moments, anything.",
    required: false,
  },
];

// Round-specific quality markers — what "the interviewer did this well"
// actually means differs by round type, so these can't be one shared list.
// technical_screen/technical_deep_dive share a marker set (same skill,
// different depth), as do behavioural/hr_screen (same conversational
// style) — kept as named constants rather than repeated per key.
const TECHNICAL_MARKERS: FeedbackQuestion[] = [
  {
    id: "technical_depth_match",
    type: "rating",
    prompt: "Did the technical questions match the seniority level you selected?",
    required: true,
  },
  {
    id: "followup_realism",
    type: "rating",
    prompt: "Did follow-up questions feel like genuine probing on your answer, or generic?",
    required: true,
  },
];

const CONVERSATIONAL_MARKERS: FeedbackQuestion[] = [
  {
    id: "star_probing",
    type: "rating",
    prompt: "Did the interviewer probe for specifics (what you actually did) rather than accepting a vague answer?",
    required: true,
  },
  {
    id: "genuine_curiosity",
    type: "rating",
    prompt: "Did it feel like genuine curiosity about you, or box-checking?",
    required: true,
  },
];

const ROUND_TYPE_QUESTIONS: Record<string, FeedbackQuestion[]> = {
  technical_screen: TECHNICAL_MARKERS,
  technical_deep_dive: TECHNICAL_MARKERS,
  system_design: [
    {
      id: "constraint_realism",
      type: "rating",
      prompt: "Did the interviewer push on trade-offs and constraints the way a real system design round would?",
      required: true,
    },
    {
      id: "scope_pacing",
      type: "rating",
      prompt: "Did the round's pace match how far you'd typically get in a real system design round?",
      required: true,
    },
  ],
  behavioural: CONVERSATIONAL_MARKERS,
  hr_screen: CONVERSATIONAL_MARKERS,
  final: [
    {
      id: "holistic_feel",
      type: "rating",
      prompt: "Did it feel like a final-round conversation — higher-level, less rote — rather than a repeat of earlier rounds?",
      required: true,
    },
  ],
  case_study: [
    {
      id: "case_realism",
      type: "rating",
      prompt: "Did the case scenario feel like something a real interviewer would actually present?",
      required: true,
    },
    {
      id: "ambiguity_handling",
      type: "rating",
      prompt: "Did the interviewer respond well when you asked clarifying questions, the way a real case interviewer would?",
      required: true,
    },
  ],
};

// Appended when the round asked enough questions for a candidate to
// actually notice drift (repeats, lost context) across the conversation.
// Matches the two 8-question round types in QUESTIONS_BY_ROUND.
const LONG_ROUND_THRESHOLD = Math.max(...Object.values(QUESTIONS_BY_ROUND));

const LONG_ROUND_QUESTION: FeedbackQuestion = {
  id: "coherence_across_length",
  type: "rating",
  prompt: "Across this many questions, did the interview stay coherent — no repeats, no forgetting earlier context?",
  required: true,
};

// roundType is the raw value as stored on sessions.round_type (e.g.
// "Technical Deep Dive", the SetupForm label) — normalizeRoundType maps it
// to the snake_case key used above.
export function getFeedbackQuestions(roundType: string, questionCount: number): FeedbackQuestion[] {
  const normalized = normalizeRoundType(roundType);
  const roundSpecific = ROUND_TYPE_QUESTIONS[normalized] ?? [];
  const questions = [...UNIVERSAL_QUESTIONS, ...roundSpecific];
  if (questionCount >= LONG_ROUND_THRESHOLD) {
    questions.push(LONG_ROUND_QUESTION);
  }
  return questions;
}
