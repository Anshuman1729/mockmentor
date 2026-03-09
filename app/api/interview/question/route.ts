import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { generateNextQuestion, generateDomainQuestion, SeedQuestion } from "@/lib/groq";

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

    // Look up a seed question — priority: domain → company → generic
    const usedSeedIds = qas
      .map((qa) => qa.seed_question_id)
      .filter(Boolean) as string[];
    const companySlug = session.company.toLowerCase().replace(/[^a-z0-9]/g, "");
    const domainSlug = session.domain
      ? (session.domain as string).toLowerCase().replace(/[^a-z0-9]+/g, "_")
      : null;
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
          AND q.id != ALL(${excludeIds}::uuid[])
          AND (
            (${domainSlug} IS NOT NULL AND ${domainSlug} = ANY(q.domain))
            OR c.id = ${companySlug}
            OR c.name ILIKE ${session.company}
            OR c.id = 'generic'
          )
        ORDER BY
          CASE
            WHEN ${domainSlug} IS NOT NULL AND ${domainSlug} = ANY(q.domain) THEN 0
            WHEN c.id = ${companySlug} OR c.name ILIKE ${session.company} THEN 1
            ELSE 2
          END,
          RANDOM()
        LIMIT 1
      `;
      seed = (seeds[0] as SeedQuestion) ?? null;
    } catch (e) {
      console.warn("[seed lookup failed — falling back to unseeded]", e);
    }

    // If no seed found AND user has a domain → use domain-specific generation
    let question: string;
    if (!seed && session.domain) {
      question = await generateDomainQuestion(
        {
          role: session.role,
          company: session.company,
          yoe: session.yoe,
          round_type: session.round_type,
          jd_content: session.jd_content,
          background: session.background,
          company_stage: session.company_stage,
          domain: session.domain,
          total_questions: totalQuestions,
        },
        qas.map((qa) => ({
          question_number: qa.question_number,
          question: qa.question,
          answer: qa.answer,
        }))
      );
    } else {
      question = await generateNextQuestion(
        {
          role: session.role,
          company: session.company,
          yoe: session.yoe,
          round_type: session.round_type,
          jd_content: session.jd_content,
          background: session.background,
          company_stage: session.company_stage,
          domain: session.domain,
          total_questions: totalQuestions,
        },
        qas.map((qa) => ({
          question_number: qa.question_number,
          question: qa.question,
          answer: qa.answer,
        })),
        seed ?? undefined
      );
    }

    const nextNumber = qas.length + 1;

    const inserted = await sql`
      INSERT INTO qa_pairs (session_id, question_number, question, seed_question_id)
      VALUES (${sessionId}, ${nextNumber}, ${question}, ${seed?.id ?? null})
      RETURNING id
    `;

    // Auto-cache: if domain-generated (no seed + has domain), store in question_bank
    // for future candidates. Fire-and-forget — do not await.
    if (!seed && session.domain) {
      const domainSlug = (session.domain as string)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_");
      sql`
        INSERT INTO question_bank (company_id, question_text, round_type, domain, expected_signals, difficulty, tags, ideal_keywords)
        VALUES ('generic', ${question}, ${session.round_type}, ARRAY[${domainSlug}], '{}', 3, '{}', '{}')
      `.catch((err: unknown) => {
        console.warn("[auto-cache] failed to cache domain question:", err);
      });
    }

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
