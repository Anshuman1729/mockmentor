// Shared signal metadata + cross-session trend math. Single source of truth
// for both the per-session debrief ("Your Recurring Pattern" in
// DebriefReport.tsx) and the account-level /progress dashboard — both need
// the exact same "is this signal chronically weak / improving" logic, and
// duplicating it would let the two pages disagree about the same data.

// `blurb` is a plain-English one-liner shown regardless of rating — without
// it, a signal that scores well never explains what it even measured, which
// reads as jargon (STAR, SNR) to anyone who didn't already know the term.
//
// `bars` used to be generic tier words ("Proficient", "Exceptional") — direct
// feedback called that "false precision": a label that doesn't tell you what
// differentiates a 2 from a 3 for THIS signal. Rewritten as short behavioral
// descriptions, so the label itself is a diagnosis, not just a rung on a
// ladder.
export const SIGNAL_META: Record<string, { name: string; blurb: string; bars: [string, string, string] }> = {
  TECHNICAL_DEPTH:     { name: "Technical Depth",       blurb: "How deep your technical explanations went — not just naming tools, but explaining how and why.",              bars: ["Claims competence without demonstrating it", "Explains what and how, not why", "Explains what, how, and why — plus trade-offs"] },
  PROBLEM_SOLVING:     { name: "Problem Solving",        blurb: "How you handled ambiguity and worked through a problem you hadn't seen before.",                              bars: ["Freezes or guesses under ambiguity", "Reaches a working solution with hints", "Names the ambiguity and solves it independently"] },
  STAR_ALIGNMENT:      { name: "Story Structure (STAR)", blurb: "Whether your stories followed Situation → Task → Action → Result, ending in a real outcome.",                  bars: ["No clear beginning, middle, or end", "Clear story, but the result is vague or missing", "Clear story that ends in a quantified result"] },
  COMMUNICATION_SNR:   { name: "Communication Clarity",  blurb: "How much of what you said was substance vs. filler — answer-first and concise, or padded and roundabout.",    bars: ["Buries the point in filler and restating", "Answers the question, with some filler", "Leads with the answer, no filler"] },
  RESULT_ORIENTATION:  { name: "Result Orientation",     blurb: "Whether you closed answers with a measurable outcome, not just a description of what you did.",               bars: ["Describes effort, not outcomes", "States what shipped, no measurable outcome", "States a specific, measurable outcome"] },
  OWNERSHIP_ETHICS:    { name: "Ownership & Initiative", blurb: "Whether you took initiative and owned outcomes — good and bad — without being asked.",                        bars: ["Waits to be told what to do", "Does the job, owns their own mistakes", "Acts before being asked, owns outcomes beyond scope"] },
  ADAPTABILITY_GROWTH: { name: "Adaptability",           blurb: "How you responded to hints, pushback, or feedback in the moment.",                                            bars: ["Gets defensive when challenged", "Adjusts when prompted", "Seeks out feedback and adjusts unprompted"] },
  EDGE_CASE_MASTERY:   { name: "Edge Case Awareness",    blurb: "Whether you proactively named risks and failure modes, or only when asked.",                                  bars: ["Assumes the happy path only", "Names an edge case when asked", "Names edge cases before being asked"] },
};

export interface SkillRating {
  parameter_id: string;
  rating: number;
}

export interface HistorySession {
  date: string;
  skill_analysis: SkillRating[];
}

export interface TrendPoint {
  label: string;
  rating: number;
  isCurrent: boolean;
}

export interface SignalTrend {
  parameter_id: string;
  points: TrendPoint[];
  recurring: boolean;
  streak: number;
  improving: boolean;
}

// For each signal in `current`, look at how it scored across `history`
// (oldest first) and append current's rating as the last point. Skips a
// signal entirely if there's no past data for it, or if it's never once
// been weak (nothing to track). "Recurring" = weak in the current point AND
// the immediately preceding point(s) — not necessarily every session ever,
// which would be too strict to be useful after just a few weak sessions in
// a row. "Improving" = better than the single most recent prior session —
// real progress, regardless of absolute level. The two are mutually
// exclusive by design: getting better shouldn't read as "still a pattern."
export function computeSignalTrends(
  current: SkillRating[],
  history: HistorySession[],
  currentLabel = "Today"
): SignalTrend[] {
  return current
    .map((skill) => {
      const pastPoints = history
        .filter((h) => h.skill_analysis.some((s) => s.parameter_id === skill.parameter_id))
        .map((h) => ({
          label: new Date(h.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          rating: h.skill_analysis.find((s) => s.parameter_id === skill.parameter_id)!.rating,
          isCurrent: false,
        }));
      if (pastPoints.length === 0) return null;
      if (skill.rating > 3 && pastPoints.every((p) => p.rating > 3)) return null; // never a problem — nothing to surface
      const points = [...pastPoints, { label: currentLabel, rating: skill.rating, isCurrent: true }];
      let streak = 0;
      for (let i = points.length - 1; i >= 0 && points[i].rating <= 3; i--) streak++;
      const improving = skill.rating > pastPoints[pastPoints.length - 1].rating;
      return {
        parameter_id: skill.parameter_id,
        points,
        recurring: streak >= 2 && !improving,
        streak,
        improving,
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);
}
