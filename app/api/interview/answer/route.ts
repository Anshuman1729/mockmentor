import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { questionId, answer, answer_duration_sec } = await req.json();

    if (!questionId || answer === undefined || answer === null) {
      return NextResponse.json(
        { error: "questionId and answer are required" },
        { status: 400 }
      );
    }

    const result = await sql`
      UPDATE qa_pairs
      SET
        answer = ${answer},
        answer_duration_sec = ${answer_duration_sec ?? null}
      WHERE id = ${questionId}
      RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/interview/answer]", err);
    return NextResponse.json({ error: "Failed to save answer" }, { status: 500 });
  }
}
