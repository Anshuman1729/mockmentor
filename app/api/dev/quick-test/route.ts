import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { sql } from "@/lib/db";
import { track } from "@/lib/analytics";

const MIN_ANSWER_LENGTH = 20;
const DEFAULT_ANSWER =
  "I led a migration of our checkout service from a monolith to a queue-based architecture after we saw p99 latency spike past 2 seconds during traffic peaks. I profiled the request path first, found the bottleneck was synchronous payment-provider calls blocking the whole request, and moved those onto a retry-backed queue with async status polling. That cut p99 latency to under 400ms and let us handle 3x peak traffic without adding servers.";
const DEFAULT_QUESTION =
  "Tell me about a time you solved a hard technical problem under a tight deadline and what trade-offs you made.";

// Hidden production shortcut for testing the debrief pipeline (report
// generation, error handling, Mixpanel funnel events) without going through
// a full 5-8 question interview every time. Real Groq API call, real DB
// rows — not a mock — so it's gated harder than "an obscure URL": only a
// signed-in user whose email matches DEV_TEST_ALLOWED_EMAIL can reach it at
// all (fails closed if that env var isn't set). round_type 'quick_test'
// keeps these sessions out of GET /api/sessions, /api/sessions/analytics,
// and the cross-session "history" trend data, so repeated test runs never
// pollute real account analytics — see lib/round-types.ts's QUESTIONS_BY_ROUND
// for the matching completeness-gate entry.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await currentUser();
    const user_email = user?.emailAddresses[0]?.emailAddress ?? `${userId}@clerk.dev`;

    const allowedEmail = process.env.DEV_TEST_ALLOWED_EMAIL;
    if (!allowedEmail || user_email !== allowedEmail) {
      return NextResponse.json({ error: "Not authorized for this test route" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const role = typeof body.role === "string" && body.role.trim() ? body.role.trim() : "Software Engineer";
    const company = typeof body.company === "string" && body.company.trim() ? body.company.trim() : "Test Co";
    const yoe = typeof body.yoe === "number" && body.yoe > 0 ? body.yoe : 3;
    const answer =
      typeof body.answer === "string" && body.answer.trim().length >= MIN_ANSWER_LENGTH
        ? body.answer.trim()
        : DEFAULT_ANSWER;

    const priorSessions = await sql`
      SELECT COUNT(*) FROM sessions WHERE user_email = ${user_email}
    `;
    const sessionNumber = Number(priorSessions[0].count) + 1;

    const rows = await sql`
      INSERT INTO sessions (user_email, role, company, yoe, round_type, jd_content, status)
      VALUES (${user_email}, ${role}, ${company}, ${yoe}, 'quick_test', 'Quick-test session — no real job description provided.', 'active')
      RETURNING id
    `;
    const sessionId = rows[0].id;

    await sql`
      INSERT INTO qa_pairs (session_id, question_number, question, answer)
      VALUES (${sessionId}, 1, ${DEFAULT_QUESTION}, ${answer})
    `;

    track("session_started", userId, {
      role, company, round_type: "quick_test",
      session_number: sessionNumber,
      is_test: true,
      $insert_id: sessionId,
    });

    // Reuse the exact production debrief-generation path (same completeness
    // gate, same Groq calls, same error handling, same analytics) rather
    // than duplicating any of it — forward the caller's cookies so
    // assertSessionOwner/auth() inside that route see the same signed-in user.
    const debriefRes = await fetch(new URL("/api/interview/debrief", req.nextUrl.origin), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: req.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({ sessionId }),
    });
    const debriefData = await debriefRes.json();
    if (!debriefRes.ok) {
      // Forward the real error/status — seeing the actual failure (e.g. a
      // genuine 413) is the point of this route, not a wrapped generic one.
      return NextResponse.json(debriefData, { status: debriefRes.status });
    }

    return NextResponse.json({ sessionId });
  } catch (err) {
    console.error("[POST /api/dev/quick-test]", err);
    return NextResponse.json({ error: "Quick test failed" }, { status: 500 });
  }
}
