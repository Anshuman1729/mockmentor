import { NextRequest, NextResponse } from "next/server";
import { assertSessionOwner } from "@/lib/session-auth";
import { sql } from "@/lib/db";
import { getFeedbackQuestions, type FeedbackQuestion } from "@/lib/feedback-config";

const MAX_TEXT_LENGTH = 2000;

function validateAnswer(question: FeedbackQuestion, value: unknown): string | number | null {
  if (question.type === "rating") {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) return null;
    return value;
  }
  if (question.type === "single_select") {
    if (typeof value !== "string" || !question.options?.some((o) => o.value === value)) return null;
    return value;
  }
  // text
  if (typeof value !== "string" || value.length > MAX_TEXT_LENGTH) return null;
  return value;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const authCheck = await assertSessionOwner(sessionId);
    if (!authCheck.ok) return authCheck.response;

    const sessions = await sql`SELECT round_type FROM sessions WHERE id = ${sessionId}`;
    if (sessions.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM qa_pairs WHERE session_id = ${sessionId}`;
    const questions = getFeedbackQuestions(sessions[0].round_type, count);

    const existing = await sql`
      SELECT question_id, answer FROM post_interview_feedback WHERE session_id = ${sessionId}
    `;
    const answers = Object.fromEntries(existing.map((r) => [r.question_id, r.answer]));

    return NextResponse.json({ questions, answers });
  } catch (err) {
    console.error("[GET /api/sessions/[sessionId]/feedback]", err);
    return NextResponse.json({ error: "Failed to load feedback form" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const authCheck = await assertSessionOwner(sessionId);
    if (!authCheck.ok) return authCheck.response;

    const { answers } = await req.json();
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
      return NextResponse.json({ error: "answers object is required" }, { status: 400 });
    }

    const sessions = await sql`SELECT round_type FROM sessions WHERE id = ${sessionId}`;
    if (sessions.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM qa_pairs WHERE session_id = ${sessionId}`;
    const validQuestions = new Map(
      getFeedbackQuestions(sessions[0].round_type, count).map((q) => [q.id, q])
    );

    const rows: { question_id: string; answer: string | number }[] = [];
    for (const [questionId, rawValue] of Object.entries(answers)) {
      const question = validQuestions.get(questionId);
      if (!question) continue; // unknown/stale question id — ignore rather than fail the whole submission
      const validated = validateAnswer(question, rawValue);
      if (validated === null) {
        return NextResponse.json({ error: `Invalid answer for "${questionId}"` }, { status: 400 });
      }
      rows.push({ question_id: questionId, answer: validated });
    }

    for (const row of rows) {
      await sql`
        INSERT INTO post_interview_feedback (session_id, question_id, answer)
        VALUES (${sessionId}, ${row.question_id}, ${JSON.stringify(row.answer)}::jsonb)
        ON CONFLICT (session_id, question_id)
        DO UPDATE SET answer = ${JSON.stringify(row.answer)}::jsonb, updated_at = NOW()
      `;
    }

    return NextResponse.json({ ok: true, saved: rows.length });
  } catch (err) {
    console.error("[POST /api/sessions/[sessionId]/feedback]", err);
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }
}
