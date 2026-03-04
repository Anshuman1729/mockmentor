import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { user_email, role, company, yoe, round_type, jd_content, background } =
      await req.json();

    if (!user_email || !role || !company || !yoe || !round_type || !jd_content) {
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
