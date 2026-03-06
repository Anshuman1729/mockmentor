import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

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
