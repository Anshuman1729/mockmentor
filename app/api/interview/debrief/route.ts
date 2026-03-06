import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { generateDebrief } from "@/lib/groq";
import { sendDebriefEmail } from "@/lib/email";
import { calculateNormalizedScore } from "@/lib/rubric-researched";

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

    const debrief = await generateDebrief(
      {
        role: session.role,
        company: session.company,
        yoe: session.yoe,
        round_type: session.round_type,
        jd_content: session.jd_content,
        background: session.background,
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
    const seniority = session.yoe <= 2 ? "Junior" : session.yoe <= 5 ? "Mid" : "Senior";
    const hireProbability = calculateNormalizedScore(rawScores, seniority);
    const recommendation =
      hireProbability >= 80 ? "Strong Hire" :
      hireProbability >= 65 ? "Hire" :
      hireProbability >= 45 ? "Borderline" : "No Hire";

    // Inject computed values (overwrite LLM placeholders)
    debrief.summary.hire_probability = hireProbability;
    debrief.summary.recommendation = recommendation as typeof debrief.summary.recommendation;

    // Extract reasoning for shadow scoring (stored separately, not in user-facing debrief_data)
    const reasoning = debrief.skill_analysis.map((s) => ({
      parameter_id: s.parameter_id,
      reasoning: s.reasoning,
    }));

    const inserted = await sql`
      INSERT INTO debriefs (session_id, debrief_data, reasoning)
      VALUES (${sessionId}, ${JSON.stringify(debrief)}::jsonb, ${JSON.stringify(reasoning)}::jsonb)
      RETURNING *
    `;

    await sql`
      UPDATE sessions SET status = 'completed', updated_at = NOW() WHERE id = ${sessionId}
    `;

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
