import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { assertSessionOwner } from "@/lib/session-auth";

// Map free-text outcome → binary hire signal for calibration.
// Anything not matching the "hired" vocabulary counts as not-hired (0).
function isHiredOutcome(outcome: string): boolean {
  const normalized = outcome.trim().toLowerCase();
  return /\b(hired|offer|offered|selected|accepted|pass(ed)?)\b/.test(normalized);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const authCheck = await assertSessionOwner(sessionId);
    if (!authCheck.ok) return authCheck.response;

    const { actual_outcome, company_type } = await req.json();

    if (!actual_outcome && !company_type) {
      return NextResponse.json(
        { error: "actual_outcome or company_type is required" },
        { status: 400 }
      );
    }

    const result = await sql`
      UPDATE debriefs
      SET
        actual_outcome = COALESCE(${actual_outcome ?? null}, actual_outcome),
        company_type   = COALESCE(${company_type ?? null}, company_type)
      WHERE session_id = ${sessionId}
      RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "Debrief not found for this session" }, { status: 404 });
    }

    // Backfill the calibration loop so drift between predicted hire_probability
    // (ai_score, 0–100) and the real outcome can be measured. Binary mapping:
    // hired = 1, else 0. discrepancy_score is normalized 0–1. Non-fatal: a
    // session with no calibration_loops row simply updates 0 rows.
    if (actual_outcome) {
      const outcomeScore = isHiredOutcome(actual_outcome) ? 1 : 0;
      await sql`
        UPDATE calibration_loops
        SET
          actual_outcome    = ${actual_outcome},
          discrepancy_score = ABS(ai_score / 100.0 - ${outcomeScore})
        WHERE session_id = ${sessionId}
      `.catch((e) => console.error("[calibration_loops backfill failed]", e));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/sessions/[sessionId]/outcome]", err);
    return NextResponse.json({ error: "Failed to update outcome" }, { status: 500 });
  }
}
