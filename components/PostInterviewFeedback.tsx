"use client";

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { SectionHeading } from "@/components/SectionHeading";
import { getFeedbackQuestions, type FeedbackQuestion } from "@/lib/feedback-config";

// Preview/staging-only section (see BACKLOG.md) — collects structured,
// round-aware feedback after a session so real usage, not just persona
// review, drives the next round of product decisions. The question set is
// computed client-side via the same deterministic getFeedbackQuestions()
// the API validates against, so this renders instantly (no fetch needed
// for the question list itself, and it still works in the DB-free
// /dev/debrief preview). Only the submit call and the best-effort "resume
// my answers" hydration touch the network.
export function PostInterviewFeedback({
  sessionId,
  roundType,
  questionCount,
}: {
  sessionId: string;
  roundType: string;
  questionCount: number;
}) {
  const questions = useMemo(() => getFeedbackQuestions(roundType, questionCount), [roundType, questionCount]);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Best-effort hydration of previously-saved answers (e.g. a reload after
  // partially filling this out). Failure here is silent — the form still
  // works, it just starts blank instead of resumed.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/feedback`);
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled || !json.answers) return;
        setAnswers(json.answers);
        if (questions.length > 0 && Object.keys(json.answers).length >= questions.length) {
          setSubmitted(true);
        }
      } catch {
        // network/DB unavailable (e.g. dev preview) — form still renders blank
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [sessionId, questions.length]);

  function setAnswer(id: string, value: string | number) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  async function handleSubmit() {
    const missing = questions.filter((q) => q.required && answers[q.id] === undefined);
    if (missing.length > 0) {
      setError("Please answer every question before submitting.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save feedback");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (questions.length === 0) return null;

  return (
    <div className="space-y-6">
      <SectionHeading
        n="10"
        title="Help Us Improve"
        sub="A few quick questions about this specific interview — this shapes what we build next."
      />
      {submitted ? (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
          Thanks — your feedback was saved.
        </div>
      ) : (
        <div className="space-y-6">
          {questions.map((q) => (
            <FeedbackQuestionField key={q.id} question={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
          ))}
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 rounded-md bg-gray-950 text-white text-xs font-semibold disabled:opacity-40 hover:bg-gray-800 transition-colors"
          >
            {submitting ? "Saving…" : "Submit feedback"}
          </button>
        </div>
      )}
    </div>
  );
}

function FeedbackQuestionField({
  question,
  value,
  onChange,
}: {
  question: FeedbackQuestion;
  value: string | number | undefined;
  onChange: (value: string | number) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-800">
        {question.prompt}
        {!question.required && <span className="text-gray-400"> (optional)</span>}
      </p>
      {question.helpText && <p className="text-xs text-gray-400">{question.helpText}</p>}

      {question.type === "rating" && (
        <div className="flex gap-2" role="radiogroup" aria-label={question.prompt}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              onClick={() => onChange(n)}
              className={clsx(
                "w-9 h-9 rounded-md border text-sm font-semibold transition-colors",
                value === n
                  ? "bg-gray-950 border-gray-950 text-white"
                  : "border-gray-200 text-gray-600 hover:border-gray-400"
              )}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {question.type === "single_select" && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={question.prompt}>
          {question.options?.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={value === opt.value}
              onClick={() => onChange(opt.value)}
              className={clsx(
                "px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors",
                value === opt.value
                  ? "bg-gray-950 border-gray-950 text-white"
                  : "border-gray-200 text-gray-600 hover:border-gray-400"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {question.type === "text" && (
        <textarea
          rows={3}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          aria-label={question.prompt}
          className="w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
        />
      )}
    </div>
  );
}
