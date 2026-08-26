import { NextRequest, NextResponse } from "next/server";
import { scorePreviewAnswer } from "@/lib/groq";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// Public, unauthenticated endpoint (see proxy.ts's isPublicRoute) — the
// landing page's "try it, no signup" preview. Guardrails are deliberately
// lightweight (see CLAUDE.md handoff notes): a per-IP rate limit and a hard
// input cap, no captcha. Cost is further bounded by a short max_tokens and
// low reasoning effort on the Groq call itself (see scorePreviewAnswer).
const RATE_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 }; // 5 requests/hour/IP
const MIN_ANSWER_LENGTH = 20;
const MAX_ANSWER_LENGTH = 600;

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rate = checkRateLimit(`preview-analysis:${ip}`, RATE_LIMIT);
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Too many tries — take a short break and try again in a bit." },
        { status: 429, headers: { "Retry-After": Math.ceil(rate.retryAfterMs / 1000).toString() } }
      );
    }

    const { answer } = await req.json();
    if (typeof answer !== "string" || answer.trim().length < MIN_ANSWER_LENGTH) {
      return NextResponse.json(
        { error: "Write a few sentences so there's something real to read." },
        { status: 400 }
      );
    }
    if (answer.length > MAX_ANSWER_LENGTH) {
      return NextResponse.json(
        { error: `Keep it under ${MAX_ANSWER_LENGTH} characters for the sample read.` },
        { status: 400 }
      );
    }

    const { result } = await scorePreviewAnswer(answer.trim());
    return NextResponse.json(result);
  } catch (err) {
    console.error("[POST /api/preview-analysis]", err);
    return NextResponse.json({ error: "Couldn't generate a sample read — try again." }, { status: 500 });
  }
}
