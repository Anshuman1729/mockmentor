import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SkillAnalysis {
  parameter_id: string;
  rating: number;
  reasoning: string;
  evidence_quotes: string[];
}

interface Debrief {
  summary: {
    recommendation: string;
    hire_probability: number;
    overall_impression: string;
  };
  skill_analysis: SkillAnalysis[];
  actionable_feedback: {
    strengths: string[];
    growth_areas: string[];
    top_priority_fix: string;
  };
}

interface Session {
  role: string;
  company: string;
  round_type: string;
  yoe: number;
  user_email: string;
}

const recommendationColor: Record<string, string> = {
  "Strong Hire": "#16a34a",
  "Hire":        "#2563eb",
  "Borderline":  "#d97706",
  "No Hire":     "#dc2626",
};

const SIGNAL_NAME: Record<string, string> = {
  TECHNICAL_DEPTH:     "Technical Depth",
  PROBLEM_SOLVING:     "Problem Solving",
  STAR_ALIGNMENT:      "STAR Alignment",
  COMMUNICATION_SNR:   "Communication SNR",
  RESULT_ORIENTATION:  "Result Orientation",
  OWNERSHIP_ETHICS:    "Ownership & Initiative",
  ADAPTABILITY_GROWTH: "Adaptability",
  EDGE_CASE_MASTERY:   "Edge Case Awareness",
};

function ratingDots(rating: number): string {
  const filled = Math.round(rating);
  return [1, 2, 3, 4, 5]
    .map((i) => `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${i <= filled ? "#111827" : "#e5e7eb"};margin-right:3px;"></span>`)
    .join("");
}

function buildEmailHtml(session: Session, debrief: Debrief): string {
  const rec   = debrief.summary?.recommendation ?? "Borderline";
  const color = recommendationColor[rec] ?? "#6b7280";
  const prob  = debrief.summary?.hire_probability ?? 0;

  const strengths    = Array.isArray(debrief.actionable_feedback?.strengths)    ? debrief.actionable_feedback.strengths    : [];
  const growthAreas  = Array.isArray(debrief.actionable_feedback?.growth_areas) ? debrief.actionable_feedback.growth_areas : [];
  const topFix       = debrief.actionable_feedback?.top_priority_fix ?? "";
  const skillAnalysis = Array.isArray(debrief.skill_analysis) ? debrief.skill_analysis.slice(0, 3) : [];

  const strengthRows = strengths
    .map((s) => `<li style="margin-bottom:6px;color:#374151;">&checkmark;&nbsp;${s}</li>`)
    .join("");

  const growthRows = growthAreas
    .map((g) => `<li style="margin-bottom:6px;color:#374151;">&#8594;&nbsp;${g}</li>`)
    .join("");

  const signalRows = skillAnalysis
    .map((skill) => {
      const quote = skill.evidence_quotes?.[0] ?? "";
      return `
      <div style="margin-bottom:16px;padding:14px;background:#f9fafb;border-radius:8px;border:1px solid #f3f4f6;">
        <p style="margin:0 0 6px;font-size:10px;font-weight:600;letter-spacing:0.08em;color:#9ca3af;text-transform:uppercase;">${SIGNAL_NAME[skill.parameter_id] ?? skill.parameter_id}</p>
        <div style="margin-bottom:6px;">${ratingDots(skill.rating)}<span style="font-size:11px;color:#6b7280;margin-left:6px;font-family:monospace;">${skill.rating}/5</span></div>
        ${quote ? `<p style="margin:0;font-size:12px;color:#6b7280;font-style:italic;border-left:2px solid #e5e7eb;padding-left:8px;">"${quote}"</p>` : ""}
      </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>MockMentor Debrief</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;max-width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#030712;padding:28px 32px;">
            <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.1em;color:#6b7280;text-transform:uppercase;">MockMentor · Interview Signal Report</p>
            <h1 style="margin:6px 0 0;font-size:20px;font-weight:600;color:#ffffff;line-height:1.3;">
              ${session.role}
              <span style="color:#6b7280;font-weight:400;"> · ${session.company}</span>
            </h1>
            <p style="margin:6px 0 0;font-size:12px;color:#6b7280;">
              ${session.round_type} &middot; ${session.yoe} yr${session.yoe !== 1 ? "s" : ""} exp
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">

            <!-- Hire Probability -->
            <div style="margin-bottom:24px;">
              <p style="margin:0 0 6px;font-size:10px;font-weight:600;letter-spacing:0.1em;color:#9ca3af;text-transform:uppercase;">Hire Probability</p>
              <div style="display:flex;align-items:baseline;gap:12px;">
                <span style="font-size:48px;font-weight:700;font-family:monospace;color:#111827;line-height:1;">${prob}%</span>
                <span style="display:inline-block;padding:4px 12px;border-radius:999px;border:1px solid ${color}33;background:${color}11;font-size:12px;font-weight:600;color:${color};">${rec}</span>
              </div>
            </div>

            <!-- Overall Impression -->
            <p style="margin:0 0 6px;font-size:10px;font-weight:600;letter-spacing:0.1em;color:#9ca3af;text-transform:uppercase;">Overall</p>
            <p style="margin:0 0 28px;font-size:15px;color:#1f2937;line-height:1.6;">${debrief.summary?.overall_impression ?? ""}</p>

            <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 28px;">

            <!-- Top 3 Signals -->
            ${skillAnalysis.length > 0 ? `
            <p style="margin:0 0 14px;font-size:10px;font-weight:600;letter-spacing:0.1em;color:#9ca3af;text-transform:uppercase;">Signal Highlights</p>
            ${signalRows}
            <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 28px;">
            ` : ""}

            <!-- Strengths & Growth Areas -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr valign="top">
                <td width="48%">
                  <p style="margin:0 0 10px;font-size:10px;font-weight:600;letter-spacing:0.1em;color:#16a34a;text-transform:uppercase;">Strengths</p>
                  <ul style="margin:0;padding:0;list-style:none;">${strengthRows}</ul>
                </td>
                <td width="4%"></td>
                <td width="48%">
                  <p style="margin:0 0 10px;font-size:10px;font-weight:600;letter-spacing:0.1em;color:#d97706;text-transform:uppercase;">Growth Areas</p>
                  <ul style="margin:0;padding:0;list-style:none;">${growthRows}</ul>
                </td>
              </tr>
            </table>

            ${topFix ? `
            <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 28px;">

            <!-- Top Priority Fix -->
            <div style="background:#030712;border-radius:8px;padding:16px 20px;margin-bottom:28px;">
              <p style="margin:0 0 6px;font-size:10px;font-weight:600;letter-spacing:0.1em;color:#6b7280;text-transform:uppercase;">Top Priority Fix</p>
              <p style="margin:0;font-size:14px;color:#ffffff;line-height:1.6;">${topFix}</p>
            </div>
            ` : ""}

            <!-- CTA -->
            <a href="https://mockmentor-mu.vercel.app"
               style="display:inline-block;padding:10px 20px;background:#030712;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">
              Practice another interview →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">
              MockMentor · AI-powered mock interviews
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendDebriefEmail(session: Session, debrief: Debrief) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — skipping email");
    return;
  }
  try {
    await resend.emails.send({
      from: "MockMentor <onboarding@resend.dev>",
      to: [session.user_email],
      subject: `Your interview debrief — ${session.role} at ${session.company}`,
      html: buildEmailHtml(session, debrief),
    });
  } catch (err) {
    // Non-fatal — log but don't break the response
    console.error("[email] Failed to send debrief email:", err);
  }
}
