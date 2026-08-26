import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { assertSessionOwner } from "@/lib/session-auth";
import { sql } from "@/lib/db";
import { scoreDrillAttempt } from "@/lib/groq";
import { track, stableInsertId } from "@/lib/analytics";

const VALID_SIGNALS = new Set([
  "TECHNICAL_DEPTH", "PROBLEM_SOLVING", "STAR_ALIGNMENT", "COMMUNICATION_SNR",
  "RESULT_ORIENTATION", "OWNERSHIP_ETHICS", "ADAPTABILITY_GROWTH", "EDGE_CASE_MASTERY",
]);

// Ephemeral by design — no DB write. This is a practice rescore, not part of
// the real interview record; scoring one answer against one signal is cheap
// enough to just call the LLM fresh each time, and not persisting means the
// candidate can retry as many times as they want without cluttering their
// actual session history.
export async function POST(req: NextRequest) {
  try {
    const { sessionId, question, parameter_id, original_rating, attempt_answer } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }
    const authCheck = await assertSessionOwner(sessionId);
    if (!authCheck.ok) return authCheck.response;

    if (typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }
    if (typeof parameter_id !== "string" || !VALID_SIGNALS.has(parameter_id)) {
      return NextResponse.json({ error: "parameter_id must be one of the 8 rubric signals" }, { status: 400 });
    }
    if (typeof original_rating !== "number" || original_rating < 1 || original_rating > 5) {
      return NextResponse.json({ error: "original_rating must be a number 1-5" }, { status: 400 });
    }
    if (typeof attempt_answer !== "string" || attempt_answer.trim().length < 20) {
      return NextResponse.json({ error: "Give it a real attempt — at least a couple of sentences." }, { status: 400 });
    }

    const sessions = await sql`SELECT role, company FROM sessions WHERE id = ${sessionId}`;
    if (sessions.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    const session = sessions[0];

    const { result } = await scoreDrillAttempt({
      question,
      parameter_id,
      original_rating,
      attempt_answer,
      role: session.role,
      company: session.company,
    });

    // $insert_id is content-derived (not random): an exact-duplicate retry
    // of the same attempt dedupes, but a genuinely different attempt on the
    // same question/signal still counts as its own event.
    const { userId } = await auth();
    if (userId) {
      track("drill_used", userId, {
        parameter_id,
        original_rating,
        new_rating: result.rating,
        $insert_id: stableInsertId(sessionId, parameter_id, attempt_answer.trim()),
      });
    }

    return NextResponse.json({ new_rating: result.rating, new_reasoning: result.reasoning });
  } catch (err) {
    console.error("[POST /api/interview/drill]", err);
    return NextResponse.json({ error: "Failed to score your attempt" }, { status: 500 });
  }
}
