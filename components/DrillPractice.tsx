"use client";

import { useState } from "react";

// Closes the loop the report otherwise leaves open at "here's a better
// answer": Rewrite -> Drill -> Retry. The candidate types their own attempt,
// it gets scored fresh against the same signal, and they see whether it
// actually moved the number — not just whether they made an effort.
export function DrillPractice({
  sessionId,
  questionNumber,
  question,
  parameterId,
  signalName,
  originalRating,
}: {
  sessionId: string;
  questionNumber: number;
  question: string;
  parameterId: string;
  signalName: string;
  originalRating: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ new_rating: number; new_reasoning: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (answer.trim().length < 20) {
      setError("Give it a real attempt — at least a couple of sentences.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/interview/drill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          question,
          parameter_id: parameterId,
          original_rating: originalRating,
          attempt_answer: answer,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to score your attempt");
      setResult({ new_rating: data.new_rating, new_reasoning: data.new_reasoning });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function handleTryAgain() {
    setResult(null);
    setAnswer("");
    setError(null);
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="text-xs font-semibold text-gray-500 hover:text-gray-900 underline underline-offset-4 decoration-gray-300 hover:decoration-gray-500 transition-colors"
      >
        Try it yourself →
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
      <p className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase">
        Your turn — answer Q{questionNumber} again
      </p>
      <p className="text-sm text-gray-700 italic">&ldquo;{question}&rdquo;</p>

      {!result ? (
        <>
          <textarea
            rows={4}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your rewritten answer..."
            disabled={submitting}
            aria-label="Your rewritten answer"
            className="w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
          />
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-2 rounded-md bg-gray-950 text-white text-xs font-semibold disabled:opacity-40 hover:bg-gray-800 transition-colors"
            >
              {submitting ? "Scoring…" : "Score my attempt"}
            </button>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              disabled={submitting}
              className="px-3 py-2 text-xs text-gray-500 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-3" role="status" aria-live="polite">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase">{signalName}</span>
            <div className="flex items-center gap-2 font-mono text-sm">
              <span className="text-gray-400">{originalRating}/5</span>
              <span className="text-gray-300" aria-hidden="true">→</span>
              <span className={`font-bold ${result.new_rating > originalRating ? "text-emerald-600" : result.new_rating === originalRating ? "text-gray-700" : "text-red-600"}`}>
                {result.new_rating}/5
              </span>
            </div>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{result.new_reasoning}</p>
          <button
            type="button"
            onClick={handleTryAgain}
            className="text-xs font-semibold text-gray-500 hover:text-gray-900 underline underline-offset-4 decoration-gray-300 hover:decoration-gray-500 transition-colors"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
