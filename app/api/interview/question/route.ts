import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { generateNextQuestion, SeedQuestion } from "@/lib/groq";

const QUESTIONS_BY_ROUND: Record<string, number> = {
  screening: 5,
  technical: 8,
  final: 10,
  behavioural: 7,
};

function getTotalQuestions(roundType: string): number {
  return QUESTIONS_BY_ROUND[roundType] ?? 7;
}

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

    const totalQuestions = getTotalQuestions(session.round_type);
    const answeredCount = qas.filter((qa) => qa.answer !== null).length;

    // Check if interview is complete
    if (answeredCount >= totalQuestions) {
      return NextResponse.json({ done: true });
    }

    // Check if there's an unanswered question already (don't generate new one)
    const unanswered = qas.find((qa) => qa.answer === null);
    if (unanswered) {
      return NextResponse.json({
        questionId: unanswered.id,
        question: unanswered.question,
        questionNumber: unanswered.question_number,
        total: totalQuestions,
        done: false,
      });
    }

    // Look up a seed question for this company + round, excluding already-used seeds
    const usedSeedIds = qas
      .map((qa) => qa.seed_question_id)
      .filter(Boolean) as string[];
    const companySlug = session.company.toLowerCase().replace(/[^a-z0-9]/g, "");
    const excludeIds =
      usedSeedIds.length > 0
        ? usedSeedIds
        : ["00000000-0000-0000-0000-000000000000"];

    let seed: SeedQuestion | null = null;
    try {
      const seeds = await sql`
        SELECT q.id, q.question_text, q.expected_signals
        FROM question_bank q
        JOIN companies c ON c.id = q.company_id
        WHERE q.round_type = ${session.round_type}
          AND (
            c.id = ${companySlug}
            OR c.name ILIKE ${session.company}
            OR c.id = 'generic'
          )
          AND q.id != ALL(${excludeIds}::uuid[])
        ORDER BY
          CASE WHEN c.id = ${companySlug} OR c.name ILIKE ${session.company} THEN 0 ELSE 1 END,
          RANDOM()
        LIMIT 1
      `;
      seed = (seeds[0] as SeedQuestion) ?? null;
    } catch (e) {
      console.warn("[seed lookup failed — falling back to unseeded]", e);
    }

    // Generate the next question
    const question = await generateNextQuestion(
      {
        role: session.role,
        company: session.company,
        yoe: session.yoe,
        round_type: session.round_type,
        jd_content: session.jd_content,
        background: session.background,
        total_questions: totalQuestions,
      },
      qas.map((qa) => ({
        question_number: qa.question_number,
        question: qa.question,
        answer: qa.answer,
      })),
      seed ?? undefined
    );

    const nextNumber = qas.length + 1;

    const inserted = await sql`
      INSERT INTO qa_pairs (session_id, question_number, question, seed_question_id)
      VALUES (${sessionId}, ${nextNumber}, ${question}, ${seed?.id ?? null})
      RETURNING id
    `;

    return NextResponse.json({
      questionId: inserted[0].id,
      question,
      questionNumber: nextNumber,
      total: totalQuestions,
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
