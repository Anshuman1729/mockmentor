import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { generateDebrief } from "@/lib/groq";
import { sendDebriefEmail } from "@/lib/email";
import { calculateNormalizedScore } from "@/lib/rubric-researched";
import { checkFatalFlag } from "@/lib/fatal-flag";

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const sessions = await sql`SELECT * FROM sessions WHERE id = ${sessionId}`;
    if (sessions.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    const session = sessions[0];

    // Check if debrief already exists
    const existing = await sql`SELECT * FROM debriefs WHERE session_id = ${sessionId}`;
    if (existing.length > 0) {
      return NextResponse.json({ debrief: existing[0] });
    }

    const qas = await sql`
      SELECT * FROM qa_pairs WHERE session_id = ${sessionId} ORDER BY question_number ASC
    `;

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

    // Fix B: Fatal flag — >30% zero-signal → force No Hire, cap hire_probability ≤30
    const QUESTIONS_BY_ROUND: Record<string, number> = {
      screening: 5, technical: 8, final: 10, behavioural: 7,
    };
    const totalQuestions = QUESTIONS_BY_ROUND[session.round_type?.toLowerCase()] ?? 7;
    const fatalFlag = checkFatalFlag(
      qas.map((qa) => ({ question_number: qa.question_number, answer: qa.answer })),
      totalQuestions
    );
    if (fatalFlag.triggered) {
      hireProbability = Math.min(hireProbability, 30);
      debrief.summary.recommendation = "No Hire";
      debrief.summary.overall_impression =
        `[FATAL FLAG] ${Math.round(fatalFlag.skipRate * 100)}% of questions received zero-signal responses. ` +
        debrief.summary.overall_impression;
    }

    // Inject computed values (overwrite LLM placeholders)
    debrief.summary.hire_probability = hireProbability;
    debrief.summary.recommendation = debrief.summary.recommendation as typeof debrief.summary.recommendation;

    // Extract reasoning for shadow scoring (stored separately, not in user-facing debrief_data)
    const reasoning = debrief.skill_analysis.map((s) => ({
      parameter_id: s.parameter_id,
      reasoning: s.reasoning,
    }));

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

    return NextResponse.json({ debrief: inserted[0] });
  } catch (err) {
    console.error("[POST /api/interview/debrief]", err);
    return NextResponse.json(
      { error: "Failed to generate debrief" },
      { status: 500 }
    );
  }
}
