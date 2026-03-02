"use client";

import { useEffect, useState } from "react";

interface QuestionHighlight {
  question: string;
  note: string;
  positive: boolean;
}

interface Debrief {
  verdict: "Strong Hire" | "Hire" | "On the Fence" | "No Hire";
  overall: string;
  strengths: string[];
  gaps: string[];
  question_highlights: QuestionHighlight[];
  closing: string;
}

interface SessionData {
  session: {
    role: string;
    company: string;
    round_type: string;
    yoe: number;
    user_email: string;
  };
  debrief: Debrief | null;
}

const verdictStyle: Record<string, { bg: string; text: string; border: string }> = {
  "Strong Hire": { bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200" },
  "Hire":        { bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200"  },
  "On the Fence":{ bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200" },
  "No Hire":     { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200"   },
};

export default function DebriefReport({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load report");
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <div className="w-10 h-10 border-4 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading your feedback...</p>
      </div>
    );
  }

  if (error || !data) {
    return <p className="text-red-600 text-center">{error ?? "Report not found."}</p>;
  }

  if (!data.debrief) {
    return <p className="text-gray-500 text-center">Debrief not available yet.</p>;
  }

  const { session, debrief } = data;
  const vStyle = verdictStyle[debrief.verdict] ?? verdictStyle["On the Fence"];
  const strengths = Array.isArray(debrief.strengths) ? debrief.strengths : [];
  const gaps = Array.isArray(debrief.gaps) ? debrief.gaps : [];
  const highlights = Array.isArray(debrief.question_highlights) ? debrief.question_highlights : [];

  return (
    <div className="max-w-xl mx-auto space-y-8 pb-16">

      {/* Header */}
      <div className="space-y-3 pt-2">
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase">
          Interview Feedback
        </p>
        <h1 className="text-2xl font-semibold text-gray-900 leading-snug">
          {session.role}
          <span className="text-gray-400 font-normal"> · {session.company}</span>
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span>{session.round_type}</span>
          <span>·</span>
          <span>{session.yoe} yr{session.yoe !== 1 ? "s" : ""} exp</span>
          <span>·</span>
          <span>{session.user_email}</span>
        </div>
      </div>

      {/* Verdict */}
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold ${vStyle.bg} ${vStyle.text} ${vStyle.border}`}>
        <span className="text-base">
          {debrief.verdict === "Strong Hire" ? "✓" :
           debrief.verdict === "Hire" ? "✓" :
           debrief.verdict === "On the Fence" ? "~" : "✗"}
        </span>
        {debrief.verdict}
      </div>

      {/* Overall impression */}
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Overall</p>
        <p className="text-gray-800 leading-relaxed text-[15px]">{debrief.overall}</p>
      </div>

      <hr className="border-gray-100" />

      {/* Strengths + Gaps side by side */}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-3">
          <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase">What went well</p>
          <ul className="space-y-2">
            {strengths.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700">
                <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Where to improve</p>
          <ul className="space-y-2">
            {gaps.map((g, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700">
                <span className="text-red-400 mt-0.5 shrink-0">✗</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* Question moments */}
      {highlights.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Specific moments</p>
          <div className="space-y-3">
            {highlights.map((h, i) => (
              <div key={i} className="flex gap-3">
                <span className={`mt-1 shrink-0 text-xs font-bold ${h.positive ? "text-green-500" : "text-red-400"}`}>
                  {h.positive ? "+" : "−"}
                </span>
                <div className="space-y-0.5">
                  <p className="text-xs text-gray-400 italic">"{h.question}"</p>
                  <p className="text-sm text-gray-700">{h.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <hr className="border-gray-100" />

      {/* Closing advice */}
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase">My advice</p>
        <p className="text-gray-800 leading-relaxed text-[15px] italic">"{debrief.closing}"</p>
      </div>

      <div className="pt-2">
        <a href="/" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
          ← Start another interview
        </a>
      </div>
    </div>
  );
}
