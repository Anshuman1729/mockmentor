import { NextRequest, NextResponse } from "next/server";
import { assertSessionOwner } from "@/lib/session-auth";
import { sql } from "@/lib/db";
import { generateNextQuestion, generateDomainQuestion, SeedQuestion } from "@/lib/groq";
import { normalizeRoundType, seedRoundType, getTotalQuestions } from "@/lib/round-types";

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();
    const authCheck = await assertSessionOwner(sessionId);
    if (!authCheck.ok) return authCheck.response;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const sessions = await sql`SELECT * FROM sessions WHERE id = ${sessionId}`;
    if (sessions.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    const session = sessions[0];
    const normalizedRound = normalizeRoundType(session.round_type ?? "");

    const qas = await sql`
      SELECT * FROM qa_pairs WHERE session_id = ${sessionId} ORDER BY question_number ASC
    `;

    const totalQuestions = getTotalQuestions(normalizedRound);
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
        WHERE q.round_type = ${seedRoundType(normalizedRound)}
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
    const sessionContext = {
      role: session.role,
      company: session.company,
      yoe: session.yoe,
      round_type: normalizedRound,
      jd_content: session.jd_content,
      background: session.background,
      company_stage: session.company_stage,
      domain: session.domain,
      total_questions: totalQuestions,
    };
    const qaHistoryForGen = qas.map((qa) => ({
      question_number: qa.question_number,
      question: qa.question,
      answer: qa.answer,
    }));

    // generateDomainQuestion() has no HR/behavioral awareness — it always asks
    // deep-expertise technical questions regardless of round type. It must
    // only be used for technical-style rounds (the same technical/behavioural
    // split already used for seed matching above), or an HR screen / behavioral
    // round gets senior-level technical questions it explicitly should never ask.
    const isTechnicalRound = seedRoundType(normalizedRound) === "technical";

    async function generate(): Promise<string> {
      if (!seed && session.domain && isTechnicalRound) {
        return generateDomainQuestion(sessionContext, qaHistoryForGen);
      }
      return generateNextQuestion(sessionContext, qaHistoryForGen, seed ?? undefined);
    }

    // The model occasionally returns an empty completion (e.g. a reasoning
    // model burning its whole token budget on hidden reasoning before ever
    // emitting the answer). Retry once rather than silently persisting and
    // serving blank question text — an empty "success" is worse than a
    // clear failure the client already knows how to retry.
    let question = (await generate()).trim();
    if (!question) {
      console.warn("[question] empty completion, retrying once", { sessionId, round: normalizedRound });
      question = (await generate()).trim();
    }
    if (!question) {
      console.error("[question] empty completion after retry", { sessionId, round: normalizedRound });
      return NextResponse.json({ error: "Failed to generate a question — please try again." }, { status: 502 });
    }

    const nextNumber = qas.length + 1;

    const inserted = await sql`
      INSERT INTO qa_pairs (session_id, question_number, question, seed_question_id)
      VALUES (${sessionId}, ${nextNumber}, ${question}, ${seed?.id ?? null})
      RETURNING id
    `;

    // Auto-cache: if actually domain-generated (no seed + has domain + technical
    // round — same gate as generate() above), store in question_bank for future
    // candidates. Fire-and-forget — do not await. Must match the generate() gate
    // exactly, or an HR/behavioral question (generated via generateNextQuestion)
    // would get miscategorized as a technical domain seed for future sessions.
    if (!seed && session.domain && isTechnicalRound) {
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
