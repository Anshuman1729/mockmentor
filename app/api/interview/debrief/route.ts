import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { generateDebrief } from "@/lib/anthropic";

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
      },
      qas.map((qa) => ({
        question_number: qa.question_number,
        question: qa.question,
        answer: qa.answer,
      }))
    );

    const inserted = await sql`
      INSERT INTO debriefs (session_id, debrief_data)
      VALUES (${sessionId}, ${JSON.stringify(debrief)}::jsonb)
      RETURNING *
    `;

    await sql`
      UPDATE sessions SET status = 'completed', updated_at = NOW() WHERE id = ${sessionId}
    `;

    return NextResponse.json({ debrief: inserted[0] });
  } catch (err) {
    console.error("[POST /api/interview/debrief]", err);
    return NextResponse.json(
      { error: "Failed to generate debrief" },
      { status: 500 }
    );
  }
}
