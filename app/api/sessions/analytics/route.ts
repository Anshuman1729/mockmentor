import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { sql } from "@/lib/db";

// Account-wide data for /progress: every completed, debriefed session for
// this user, oldest first, with just enough per-session detail (signal
// ratings, round type, company stage, recommendation) to compute trends and
// breakdowns client-side. Same shape as the per-session `history` query in
// GET /api/sessions/[sessionId], but not scoped to "exclude one session" and
// not capped at 10 — this IS the full picture the trend page is for.
export async function GET(_req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    const user_email =
      user?.emailAddresses[0]?.emailAddress ?? `${userId}@clerk.dev`;

    const rows = await sql`
      SELECT
        s.id AS session_id,
        s.role,
        s.company,
        s.round_type,
        s.company_stage,
        s.created_at,
        d.debrief_data->>'hire_recommendation' AS hire_recommendation,
        d.debrief_data->'summary'->>'recommendation' AS summary_recommendation,
        d.debrief_data->'skill_analysis' AS skill_analysis
      FROM sessions s
      JOIN debriefs d ON d.session_id = s.id
      WHERE s.user_email = ${user_email} AND s.status = 'completed'
      ORDER BY s.created_at ASC
      LIMIT 100
    `;

    const sessions = rows
      .filter((r) => Array.isArray(r.skill_analysis))
      .map((r) => ({
        session_id: r.session_id as string,
        role: r.role as string,
        company: r.company as string,
        round_type: r.round_type as string,
        company_stage: (r.company_stage as string | null) ?? null,
        date: r.created_at as string,
        recommendation: (r.summary_recommendation ?? r.hire_recommendation ?? null) as string | null,
        skill_analysis: r.skill_analysis as { parameter_id: string; rating: number }[],
      }));

    return NextResponse.json({ sessions });
  } catch (err) {
    console.error("[GET /api/sessions/analytics]", err);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
