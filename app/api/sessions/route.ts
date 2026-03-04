import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { sql } from "@/lib/db";

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
        s.id,
        s.role,
        s.company,
        s.yoe,
        s.round_type,
        s.created_at,
        s.status,
        d.debrief_data->>'hire_recommendation' AS hire_recommendation,
        (d.debrief_data->>'hire_probability')::int AS hire_probability
      FROM sessions s
      LEFT JOIN debriefs d ON d.session_id = s.id
      WHERE s.user_email = ${user_email}
      ORDER BY s.created_at DESC
    `;

    return NextResponse.json({ sessions: rows });
  } catch (err) {
    console.error("[GET /api/sessions]", err);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    const user_email =
      user?.emailAddresses[0]?.emailAddress ?? `${userId}@clerk.dev`;

    const { role, company, yoe, round_type, jd_content, background } =
      await req.json();

    if (!role || !company || !yoe || !round_type || !jd_content) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    const rows = await sql`
      INSERT INTO sessions (user_email, role, company, yoe, round_type, jd_content, background)
      VALUES (${user_email}, ${role}, ${company}, ${Number(yoe)}, ${round_type}, ${jd_content}, ${background ?? null})
      RETURNING id
    `;

    return NextResponse.json({ sessionId: rows[0].id });
  } catch (err) {
    console.error("[POST /api/sessions]", err);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
