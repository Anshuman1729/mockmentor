import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { assertSessionOwner } from "@/lib/session-auth";
import { sql } from "@/lib/db";
import { generateDebrief } from "@/lib/groq";
import { sendDebriefEmail } from "@/lib/email";
import { calculateNormalizedScore } from "@/lib/rubric-researched";
import { checkFatalFlag, applyFatalFlag } from "@/lib/fatal-flag";
import { track, stableInsertId } from "@/lib/analytics";
import { getTotalQuestions } from "@/lib/round-types";

export async function POST(req: NextRequest) {
  // Hoisted out of the try block so the catch block below can attribute a
  // failure event to the right session/user — previously these were
  // try-scoped consts, and a debrief-generation failure had zero analytics
  // visibility (indistinguishable from the user just closing the tab).
  let sessionId: string | undefined;
  let userId: string | null = null;
  try {
    ({ sessionId } = await req.json());
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }
    const authCheck = await assertSessionOwner(sessionId);
    if (!authCheck.ok) return authCheck.response;
    ({ userId } = await auth());

    const sessions = await sql`SELECT * FROM sessions WHERE id = ${sessionId}`;
    if (sessions.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    const session = sessions[0];

    // Check if debrief already exists
    const existing = await sql`SELECT * FROM debriefs WHERE session_id = ${sessionId}`;
    if (existing.length > 0) {
      // Deliberate: never return the full row — debrief_data.summary.hire_probability
      // and the internal reasoning column must never reach the client. See the
      // non-negotiable rule against exposing hire_probability/BARS internals.
      const { id, session_id, created_at } = existing[0];
      return NextResponse.json({ debrief: { id, session_id, created_at } });
    }

    const qas = await sql`
      SELECT * FROM qa_pairs WHERE session_id = ${sessionId} ORDER BY question_number ASC
    `;

    // Round-type → total question count, shared by the completeness gate below
    // and the Fatal Flag check further down. Resolved via the shared
    // lib/round-types module — see that file's header comment for why this
    // used to be a separate, disagreeing map from /api/interview/question's
    // (that inconsistency is what this shared module removes; the two
    // routes now always resolve the same round_type to the same count).
    const totalQuestions = getTotalQuestions(session.round_type);

    // Completeness gate: any skipped (unanswered) question blocks report
    // generation entirely — zero tolerance, distinct from Fatal Flag's
    // post-hoc score penalty for weak-but-complete sessions.
    const hasIncompleteAnswer =
      qas.some((qa) => qa.answer === null) || qas.length < totalQuestions;
    if (hasIncompleteAnswer) {
      return NextResponse.json(
        {
          error: "Interview incomplete — every question must be answered before a report can be generated.",
          code: "INCOMPLETE_SESSION",
          answeredCount: qas.filter((qa) => qa.answer !== null).length,
          totalQuestions,
        },
        { status: 422 }
      );
    }

    const { report: debrief, usage } = await generateDebrief(
      {
        role: session.role,
        company: session.company,
        yoe: session.yoe,
        round_type: session.round_type,
        jd_content: session.jd_content,
        background: session.background,
        company_stage: session.company_stage ?? null,
      },
      qas.map((qa) => ({
        question_number: qa.question_number,
        question: qa.question,
        answer: qa.answer,
      }))
    );

    // Compute hire_probability deterministically from rubric scores
    const rawScores: Record<string, number> = {};
    for (const skill of debrief.skill_analysis) {
      rawScores[skill.parameter_id] = skill.rating;
    }
    // Fix A: default any uncovered signal to 0 so calculateNormalizedScore penalises gaps
    const ALL_SIGNALS = [
      "TECHNICAL_DEPTH", "PROBLEM_SOLVING", "STAR_ALIGNMENT", "COMMUNICATION_SNR",
      "RESULT_ORIENTATION", "OWNERSHIP_ETHICS", "ADAPTABILITY_GROWTH", "EDGE_CASE_MASTERY",
    ];
    for (const sig of ALL_SIGNALS) {
      if (!(sig in rawScores)) rawScores[sig] = 0;
    }

    const seniority = session.yoe <= 2 ? "Junior" : session.yoe <= 5 ? "Mid" : "Senior";
    let hireProbability = calculateNormalizedScore(rawScores, seniority);

    // Tier 2: if a seed's expected signals scored ≤2, apply targeted penalty
    const seedIds = qas
      .map((qa) => qa.seed_question_id)
      .filter(Boolean) as string[];
    if (seedIds.length > 0) {
      try {
        const seedRows = await sql`
          SELECT expected_signals FROM question_bank WHERE id = ANY(${seedIds}::uuid[])
        `;
        const targetedSignals = new Set(
          seedRows.flatMap((r) => (r.expected_signals as string[]) ?? [])
        );
        let tier2Penalty = 0;
        for (const sig of targetedSignals) {
          if ((rawScores[sig] ?? 0) <= 2) tier2Penalty += 3;
        }
        if (tier2Penalty > 0) {
          hireProbability = Math.max(0, hireProbability - tier2Penalty);
          console.log(`[tier2] Applied ${tier2Penalty}pt penalty for weak targeted signals`);
        }
      } catch (e) {
        console.warn("[tier2 penalty failed — skipping]", e);
      }
    }

    const recommendation =
      hireProbability >= 80 ? "Strong Hire" :
      hireProbability >= 65 ? "Hire" :
      hireProbability >= 45 ? "Borderline" : "No Hire";
    debrief.summary.recommendation = recommendation as typeof debrief.summary.recommendation;

    // Fix B: Fatal flag — >30% zero-signal → force No Hire, cap hire_probability ≤30.
    // applyFatalFlag never touches overall_impression — that field is user-facing
    // (rendered as the interviewer's first-person verdict quote) and must never
    // carry an internal bracketed marker prefix.
    // Math.max guard: for every current-UI session the completeness gate
    // above already guarantees qas.length >= totalQuestions (generation
    // stops exactly at totalQuestions), so this is a no-op in that path. It
    // only protects a legacy row that happens to hold more QA pairs than
    // the newly-resolved totalQuestions from being scored against a
    // too-small denominator and getting an inflated (and wrong) skip rate.
    const fatalFlag = checkFatalFlag(
      qas.map((qa) => ({ question_number: qa.question_number, answer: qa.answer })),
      Math.max(totalQuestions, qas.length)
    );
    const fatalFlagResult = applyFatalFlag(
      hireProbability,
      debrief.summary.recommendation,
      fatalFlag
    );
    hireProbability = fatalFlagResult.hireProbability;
    debrief.summary.recommendation = fatalFlagResult.recommendation;

    // Inject computed values (overwrite LLM placeholders)
    debrief.summary.hire_probability = hireProbability;
    debrief.summary.recommendation = debrief.summary.recommendation as typeof debrief.summary.recommendation;

    // Backlog #10/#11: both already collected via real instrumentation
    // (answer_duration_sec per answer, candidate_questions_asked per
    // session) but never surfaced in the debrief — inject them here rather
    // than asking the LLM to estimate what we've already measured.
    const durations = qas
      .map((qa) => qa.answer_duration_sec)
      .filter((d): d is number => typeof d === "number");
    if (durations.length > 0) {
      debrief.metrics.longest_monologue_sec = Math.max(...durations);
    }
    debrief.metrics.candidate_questions_asked = session.candidate_questions_asked ?? 0;

    // Extract reasoning for shadow scoring (stored separately, not in user-facing debrief_data).
    // NOTE: older rows in this JSONB column are a bare array (just `signals`) —
    // any future reader of debriefs.reasoning must handle both shapes.
    const signalReasoning = debrief.skill_analysis.map((s) => ({
      parameter_id: s.parameter_id,
      reasoning: s.reasoning,
    }));
    const reasoning = { signals: signalReasoning, fatal_flag: fatalFlagResult.internalNote };

    const inserted = await sql`
      INSERT INTO debriefs (session_id, debrief_data, reasoning, tokens_used)
      VALUES (
        ${sessionId},
        ${JSON.stringify(debrief)}::jsonb,
        ${JSON.stringify(reasoning)}::jsonb,
        ${JSON.stringify(usage)}::jsonb
      )
      RETURNING *
    `;

    await sql`
      UPDATE sessions SET status = 'completed', updated_at = NOW() WHERE id = ${sessionId}
    `;

    // Bucketed recommendation only — never hire_probability or raw signal
    // scores, per the non-negotiable rule against exposing the % anywhere,
    // including to a third-party analytics vendor. Value is lowercased/
    // snake_cased for the analytics property per Mixpanel's enum convention;
    // the Title Case UI copy in debrief.summary.recommendation is untouched.
    // interview_depth reuses totalQuestions (already round-type-normalized
    // above via the shared lib/round-types module) rather than a fresh
    // lookup — this file and /api/interview/question now always agree on
    // round-type normalization and question counts, so there's no longer a
    // risk of the two disagreeing here.
    track("session_completed", userId ?? session.user_email, {
      round_type: session.round_type,
      recommendation: debrief.summary.recommendation.toLowerCase().replace(/\s+/g, "_"),
      interview_depth: totalQuestions,
      session_duration_sec: Math.round((Date.now() - new Date(session.created_at).getTime()) / 1000),
      // Lets this stay visible in Mixpanel for verifying the pipeline works
      // (the whole point of the quick-test route) while staying filterable
      // out of any real funnel/retention analysis.
      is_test: session.round_type === "quick_test" ? true : undefined,
      $insert_id: stableInsertId(sessionId, "session_completed"),
    });

    // Log calibration loop (actual_outcome and discrepancy_score filled later via outcome API)
    await sql`
      INSERT INTO calibration_loops (session_id, ai_score, llm_reasoning)
      VALUES (${sessionId}, ${hireProbability}, ${JSON.stringify(reasoning)}::jsonb)
    `.catch((e) => console.error("[calibration_loops insert failed]", e));

    // Send debrief email (non-fatal if it fails)
    await sendDebriefEmail(
      {
        role:       session.role,
        company:    session.company,
        round_type: session.round_type,
        yoe:        session.yoe,
        user_email: session.user_email,
      },
      debrief
    );

    // Deliberate: never return the full row — debrief_data.summary.hire_probability
    // and the internal reasoning column must never reach the client. See the
    // non-negotiable rule against exposing hire_probability/BARS internals.
    const { id, session_id, created_at } = inserted[0];
    return NextResponse.json({ debrief: { id, session_id, created_at } });
  } catch (err) {
    console.error("[POST /api/interview/debrief]", err);
    // Only ever surface our own known-safe, user-facing retry messages from
    // generateDebrief (truncated/malformed/incomplete LLM response) — never
    // an arbitrary caught error's message, which could leak internals (DB
    // errors, stack details, etc.). Everything else stays the generic message.
    const KNOWN_SAFE_MESSAGES = new Map([
      ["The report generation ran out of room and was cut off — please try again.", "truncated"],
      ["The report came back malformed — please try again.", "malformed"],
      ["The report came back incomplete — please try again.", "incomplete_response"],
      ["This interview's transcript is too large for the AI service's current capacity — please contact support.", "transcript_too_large"],
      ["The AI service is rate-limited right now — please wait a minute and try again.", "rate_limited"],
      ["Your interview transcript was too long for the report to process — please contact support.", "transcript_too_long"],
      ["The AI service returned an unexpected error — please try again in a moment.", "upstream_error"],
    ]);
    const reason = err instanceof Error ? KNOWN_SAFE_MESSAGES.get(err.message) : undefined;
    const message = reason ? (err as Error).message : "Failed to generate debrief";

    // Own event, not folded into session_completed — a failure here means
    // the session did NOT complete, so this has to stay visibly distinct in
    // the funnel from both a successful completion and silent user drop-off.
    if (sessionId) {
      track("debrief_generation_failed", userId ?? "unknown", {
        reason: reason ?? "unknown",
        $insert_id: stableInsertId(sessionId, "debrief_generation_failed", reason ?? "unknown"),
      });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
