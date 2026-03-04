import Groq from "groq-sdk";

// Lazy client — only instantiated on first use (avoids build-time env var errors)
let _client: Groq | null = null;
function getClient(): Groq {
  if (!_client) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY environment variable is not set");
    }
    _client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _client;
}

const MODEL = "llama-3.3-70b-versatile";

export interface QAPair {
  question_number: number;
  question: string;
  answer: string | null;
}

export interface SessionContext {
  role: string;
  company: string;
  yoe: number;
  round_type: string;
  jd_content: string;
  background?: string | null;
}

export async function generateNextQuestion(
  session: SessionContext,
  previousQAs: QAPair[]
): Promise<string> {
  const answeredCount = previousQAs.filter((qa) => qa.answer !== null).length;
  const totalTarget = 7;

  const qaHistory =
    previousQAs
      .filter((qa) => qa.answer !== null)
      .map((qa) => `Q${qa.question_number}: ${qa.question}\nA: ${qa.answer}`)
      .join("\n\n") || "No previous questions yet.";

  const backgroundSection = session.background
    ? `\nCandidate Background:\n${session.background}\n`
    : "";

  const systemPrompt = `You are a senior interviewer at ${session.company}. You are conducting a ${session.round_type} interview for a ${session.role} position. The candidate has ${session.yoe} year(s) of experience.
${backgroundSection}
Job Description:
${session.jd_content.slice(0, 4000)}

You ask ONE focused question per turn. Alternate between:
- Technical questions: tools, systems, architecture, problem-solving directly relevant to the JD
- Soft skill / behavioral questions: conflict resolution, leadership, communication style, how they handle pressure, confidence indicators

Target ${totalTarget} questions total. You have asked ${answeredCount} so far.
${answeredCount < totalTarget / 2 ? "Start with a technical question." : answeredCount % 2 === 0 ? "Ask a behavioral question this time." : "Ask a technical question this time."}

Output ONLY the next interview question. No preamble, no labels, no explanation.`;

  const completion = await getClient().chat.completions.create({
    model: MODEL,
    max_tokens: 300,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Previous Q&As:\n${qaHistory}\n\nProvide the next interview question.`,
      },
    ],
  });

  return completion.choices[0].message.content?.trim() ?? "";
}

export interface DebriefReport {
  verdict: "Strong Hire" | "Hire" | "On the Fence" | "No Hire";
  overall: string;
  strengths: string[];
  gaps: string[];
  question_highlights: { question: string; note: string; positive: boolean }[];
  closing: string;
}

export async function generateDebrief(
  session: SessionContext,
  qas: QAPair[]
): Promise<DebriefReport> {
  const qaText = qas
    .map(
      (qa) =>
        `Q${qa.question_number}: ${qa.question}\nAnswer: ${qa.answer ?? "(no answer provided)"}`
    )
    .join("\n\n");

  const backgroundLine = session.background
    ? `- Background: ${session.background}\n`
    : "";

  const systemPrompt = `You are the interviewer who just completed this mock interview. Write an honest, direct post-interview summary as if speaking face-to-face with the candidate. Use "you" throughout. Be specific — reference actual things they said.

Session details:
- Role: ${session.role}
- Company: ${session.company}
- Round type: ${session.round_type}
- Years of experience: ${session.yoe}
${backgroundLine}
Job Description (excerpt):
${session.jd_content.slice(0, 3000)}

Interview Q&As:
${qaText}

Return raw JSON only (no markdown, no code block):
{
  "verdict": "Strong Hire" | "Hire" | "On the Fence" | "No Hire",
  "overall": "2-3 sentences. Your candid first impression. Speak naturally, as a real interviewer would — not as a report.",
  "strengths": ["2-3 specific things they did well, referencing actual answers"],
  "gaps": ["2-3 specific weaknesses or gaps observed, referencing actual answers"],
  "question_highlights": [
    { "question": "exact question text", "note": "1 honest sentence about how they handled it", "positive": true or false }
  ],
  "closing": "One sentence of parting advice — the single most important thing they should work on before their next interview."
}

Include 3-4 question_highlights, a mix of positive and critical. Be direct and specific, not generic.`;

  const completion = await getClient().chat.completions.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Generate the structured debrief report." },
    ],
  });

  const raw = completion.choices[0].message.content?.trim() ?? "";
  // Strip markdown code block if present
  const jsonStr = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(jsonStr) as DebriefReport;
}
