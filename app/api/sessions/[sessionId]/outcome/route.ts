import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { actual_outcome, company_type } = await req.json();

    if (!actual_outcome && !company_type) {
      return NextResponse.json(
        { error: "actual_outcome or company_type is required" },
        { status: 400 }
      );
    }

    const result = await sql`
      UPDATE debriefs
      SET
        actual_outcome = COALESCE(${actual_outcome ?? null}, actual_outcome),
        company_type   = COALESCE(${company_type ?? null}, company_type)
      WHERE session_id = ${sessionId}
      RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "Debrief not found for this session" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/sessions/[sessionId]/outcome]", err);
    return NextResponse.json({ error: "Failed to update outcome" }, { status: 500 });
  }
}
