import { NextRequest, NextResponse } from "next/server";
import { assertSessionOwner } from "@/lib/session-auth";
import { sql } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const authCheck = await assertSessionOwner(sessionId);
    if (!authCheck.ok) return authCheck.response;
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
    const authCheck = await assertSessionOwner(sessionId);
    if (!authCheck.ok) return authCheck.response;

    const sessions = await sql`
      SELECT * FROM sessions WHERE id = ${sessionId}
    `;

    const qas = await sql`
      SELECT * FROM qa_pairs WHERE session_id = ${sessionId} ORDER BY question_number ASC
    `;

    const debriefs = await sql`
      SELECT * FROM debriefs WHERE session_id = ${sessionId}
    `;

    const debriefRow = debriefs[0] ?? null;
    // hire_probability is internal-only (see CLAUDE.md non-negotiable rules) —
    // strip it here rather than relying on the UI to simply not render it,
    // since the raw field would otherwise be visible in the network response.
    const debrief = debriefRow?.debrief_data
      ? {
          ...debriefRow.debrief_data,
          summary: Object.fromEntries(
            Object.entries(debriefRow.debrief_data.summary ?? {}).filter(
              ([key]) => key !== "hire_probability"
            )
          ),
        }
      : null;

    // Cross-interview trend data (see DebriefReport.tsx "Your Recurring
    // Pattern"): the same user's other completed, debriefed sessions, so a
    // signal that's weak again can be flagged as a pattern instead of a
    // one-off. Scoped to this user only, oldest first, capped at 10 so a
    // long-time user doesn't drag in their entire history on every load.
    const userEmail = sessions[0]?.user_email;
    let history: Array<{
      session_id: string;
      date: string;
      role: string;
      company: string;
      round_type: string;
      skill_analysis: { parameter_id: string; rating: number }[];
    }> = [];
    if (userEmail) {
      const pastRows = await sql`
        SELECT s.id AS session_id, s.role, s.company, s.round_type, s.created_at, d.debrief_data
        FROM sessions s
        JOIN debriefs d ON d.session_id = s.id
        WHERE s.user_email = ${userEmail} AND s.id != ${sessionId} AND s.status = 'completed'
          AND s.round_type != 'quick_test'
        ORDER BY s.created_at ASC
        LIMIT 10
      `;
      history = pastRows
        .filter((r) => Array.isArray(r.debrief_data?.skill_analysis))
        .map((r) => ({
          session_id: r.session_id,
          date: r.created_at,
          role: r.role,
          company: r.company,
          round_type: r.round_type,
          skill_analysis: r.debrief_data.skill_analysis.map((s: { parameter_id: string; rating: number }) => ({
            parameter_id: s.parameter_id,
            rating: s.rating,
          })),
        }));
    }

    return NextResponse.json({
      session: sessions[0],
      qas,
      debrief,
      history,
    });
  } catch (err) {
    console.error("[GET /api/sessions/[sessionId]]", err);
    return NextResponse.json({ error: "Failed to fetch session" }, { status: 500 });
  }
}
