import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { generateNextQuestion } from "@/lib/anthropic";

const TOTAL_QUESTIONS = 7;

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const sessions = await sql`SELECT * FROM sessions WHERE id = ${sessionId}`;
    if (sessions.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    const session = sessions[0];

    const qas = await sql`
      SELECT * FROM qa_pairs WHERE session_id = ${sessionId} ORDER BY question_number ASC
    `;

    const answeredCount = qas.filter((qa) => qa.answer !== null).length;

    // Check if interview is complete
    if (answeredCount >= TOTAL_QUESTIONS) {
      return NextResponse.json({ done: true });
    }

    // Check if there's an unanswered question already (don't generate new one)
    const unanswered = qas.find((qa) => qa.answer === null);
    if (unanswered) {
      return NextResponse.json({
        questionId: unanswered.id,
        question: unanswered.question,
        questionNumber: unanswered.question_number,
        total: TOTAL_QUESTIONS,
        done: false,
      });
    }

    // Generate the next question
    const question = await generateNextQuestion(
      {
        role: session.role,
        company: session.company,
        yoe: session.yoe,
        round_type: session.round_type,
        jd_content: session.jd_content,
      },
      qas.map((qa) => ({
        question_number: qa.question_number,
        question: qa.question,
        answer: qa.answer,
      }))
    );

    const nextNumber = qas.length + 1;

    const inserted = await sql`
      INSERT INTO qa_pairs (session_id, question_number, question)
      VALUES (${sessionId}, ${nextNumber}, ${question})
      RETURNING id
    `;

    return NextResponse.json({
      questionId: inserted[0].id,
      question,
      questionNumber: nextNumber,
      total: TOTAL_QUESTIONS,
      done: false,
    });
  } catch (err) {
    console.error("[POST /api/interview/question]", err);
    return NextResponse.json(
      { error: "Failed to generate question" },
      { status: 500 }
    );
  }
}
