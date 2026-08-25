import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { sql } from "@/lib/db";

const MIN_ANSWER_LENGTH = 50;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { questionId, answer, answer_duration_sec } = await req.json();

    if (!questionId || answer === undefined || answer === null) {
      return NextResponse.json(
        { error: "questionId and answer are required" },
        { status: 400 }
      );
    }

    if (typeof answer !== "string" || answer.trim().length < MIN_ANSWER_LENGTH) {
      return NextResponse.json(
        { error: `Answer must be at least ${MIN_ANSWER_LENGTH} characters.` },
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
