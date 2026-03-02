import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface QuestionHighlight {
  question: string;
  note: string;
  positive: boolean;
}

interface Debrief {
  verdict: string;
  overall: string;
  strengths: string[];
  gaps: string[];
  question_highlights: QuestionHighlight[];
  closing: string;
}

interface Session {
  role: string;
  company: string;
  round_type: string;
  yoe: number;
  user_email: string;
}

const verdictColor: Record<string, string> = {
  "Strong Hire": "#16a34a",
  "Hire":        "#2563eb",
  "On the Fence":"#d97706",
  "No Hire":     "#dc2626",
};

const verdictIcon: Record<string, string> = {
  "Strong Hire": "✓",
  "Hire":        "✓",
  "On the Fence":"~",
  "No Hire":     "✗",
};

function buildEmailHtml(session: Session, debrief: Debrief): string {
  const color  = verdictColor[debrief.verdict] ?? "#6b7280";
  const icon   = verdictIcon[debrief.verdict]  ?? "~";
  const strengths = Array.isArray(debrief.strengths) ? debrief.strengths : [];
  const gaps      = Array.isArray(debrief.gaps)      ? debrief.gaps      : [];
  const highlights = Array.isArray(debrief.question_highlights)
    ? debrief.question_highlights : [];

  const strengthRows = strengths
    .map((s) => `<li style="margin-bottom:6px;color:#374151;">&checkmark;&nbsp;${s}</li>`)
    .join("");

  const gapRows = gaps
    .map((g) => `<li style="margin-bottom:6px;color:#374151;">&#x2717;&nbsp;${g}</li>`)
    .join("");

  const highlightRows = highlights
    .map(
      (h) => `
      <div style="display:flex;gap:12px;margin-bottom:14px;">
        <span style="flex-shrink:0;font-weight:700;color:${h.positive ? "#16a34a" : "#ef4444"};">
          ${h.positive ? "+" : "−"}
        </span>
        <div>
          <p style="margin:0 0 2px;font-size:12px;color:#9ca3af;font-style:italic;">"${h.question}"</p>
          <p style="margin:0;font-size:14px;color:#374151;">${h.note}</p>
        </div>
      </div>`
    )
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
            <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.1em;color:#6b7280;text-transform:uppercase;">MockMentor</p>
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

            <!-- Verdict badge -->
            <div style="display:inline-block;padding:8px 16px;border-radius:999px;border:1px solid ${color}22;background:${color}11;margin-bottom:24px;">
              <span style="font-size:14px;font-weight:600;color:${color};">${icon}&nbsp; ${debrief.verdict}</span>
            </div>

            <!-- Overall -->
            <p style="margin:0 0 6px;font-size:10px;font-weight:600;letter-spacing:0.1em;color:#9ca3af;text-transform:uppercase;">Overall</p>
            <p style="margin:0 0 28px;font-size:15px;color:#1f2937;line-height:1.6;">${debrief.overall}</p>

            <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 28px;">

            <!-- Strengths & Gaps -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr valign="top">
                <td width="48%">
                  <p style="margin:0 0 10px;font-size:10px;font-weight:600;letter-spacing:0.1em;color:#9ca3af;text-transform:uppercase;">What went well</p>
                  <ul style="margin:0;padding:0 0 0 0;list-style:none;">${strengthRows}</ul>
                </td>
                <td width="4%"></td>
                <td width="48%">
                  <p style="margin:0 0 10px;font-size:10px;font-weight:600;letter-spacing:0.1em;color:#9ca3af;text-transform:uppercase;">Where to improve</p>
                  <ul style="margin:0;padding:0 0 0 0;list-style:none;">${gapRows}</ul>
                </td>
              </tr>
            </table>

            ${highlights.length > 0 ? `
            <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 28px;">

            <!-- Highlights -->
            <p style="margin:0 0 14px;font-size:10px;font-weight:600;letter-spacing:0.1em;color:#9ca3af;text-transform:uppercase;">Specific moments</p>
            ${highlightRows}
            ` : ""}

            <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 28px;">

            <!-- Closing -->
            <p style="margin:0 0 6px;font-size:10px;font-weight:600;letter-spacing:0.1em;color:#9ca3af;text-transform:uppercase;">My advice</p>
            <p style="margin:0 0 32px;font-size:15px;color:#1f2937;line-height:1.6;font-style:italic;">"${debrief.closing}"</p>

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
