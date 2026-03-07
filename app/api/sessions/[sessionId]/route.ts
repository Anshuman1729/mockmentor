import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await req.json();
    const { background, candidate_questions_asked } = body;

    if (background !== undefined) {
      if (typeof background !== "string") {
        return NextResponse.json({ error: "background must be a string" }, { status: 400 });
      }
      await sql`
        UPDATE sessions SET background = ${background}, updated_at = NOW() WHERE id = ${sessionId}
      `;
    }

    if (candidate_questions_asked !== undefined) {
      if (typeof candidate_questions_asked !== "number") {
        return NextResponse.json({ error: "candidate_questions_asked must be a number" }, { status: 400 });
      }
      await sql`
        UPDATE sessions SET candidate_questions_asked = ${candidate_questions_asked}, updated_at = NOW() WHERE id = ${sessionId}
      `;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/sessions/[sessionId]]", err);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    const sessions = await sql`
      SELECT * FROM sessions WHERE id = ${sessionId}
    `;
    if (sessions.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const qas = await sql`
      SELECT * FROM qa_pairs WHERE session_id = ${sessionId} ORDER BY question_number ASC
    `;

    const debriefs = await sql`
      SELECT * FROM debriefs WHERE session_id = ${sessionId}
    `;

    // debrief_data is JSONB — parse it out of the row
    const debriefRow = debriefs[0] ?? null;
    const debrief = debriefRow?.debrief_data ?? null;

    return NextResponse.json({
      session: sessions[0],
      qas,
      debrief,
    });
  } catch (err) {
    console.error("[GET /api/sessions/[sessionId]]", err);
    return NextResponse.json({ error: "Failed to fetch session" }, { status: 500 });
  }
}
