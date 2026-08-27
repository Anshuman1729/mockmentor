"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { trackClient } from "@/lib/analytics-client";

const ACCENT = "#1f4d3a";
const SAMPLE_QUESTION = "Tell me about a time you had to debug a critical issue under pressure.";
const MAX_ANSWER_LENGTH = 600;
const MIN_ANSWER_LENGTH = 20;

interface PreviewResult {
  score: number;
  evidence_quote: string;
  feedback: string;
}

export default function InteractivePreview({ isSignedIn }: { isSignedIn: boolean }) {
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PreviewResult | null>(null);

  async function handleReveal() {
    setError(null);
    if (answer.trim().length < MIN_ANSWER_LENGTH) {
      setError("Write a few sentences so there's something real to read.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/preview-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't generate a sample read.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="w-full border-t border-b border-gray-100 bg-gray-50 py-14 md:py-20">
      <div className="mx-auto max-w-2xl px-6">
        <span className="text-[11px] font-bold tracking-widest text-gray-400">TRY IT — NO SIGNUP</span>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-gray-950 md:text-3xl">
          See what an evidence-based read actually looks like.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-500 md:text-base">
          Type how you&apos;d answer the question below. We&apos;ll show you the kind of feedback you&apos;d get back — a real evidence quote, not just a score.
        </p>

        <div className="mt-6 space-y-4 rounded-[22px] border border-gray-200 bg-white p-6">
          <div>
            <span className="text-[10px] font-bold tracking-widest text-gray-400">SAMPLE QUESTION</span>
            <p className="mt-1.5 text-base font-semibold leading-snug text-gray-950 md:text-lg">
              {SAMPLE_QUESTION}
            </p>
          </div>

          <textarea
            placeholder="Type how you'd answer…"
            rows={4}
            maxLength={MAX_ANSWER_LENGTH}
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value);
              setResult(null);
              setError(null);
            }}
            className="w-full rounded-2xl border border-gray-200 p-3.5 text-sm text-gray-950 outline-none focus:border-gray-400"
          />

          {error && <p className="text-xs font-medium text-red-600">{error}</p>}

          {!result ? (
            <button
              type="button"
              onClick={handleReveal}
              disabled={loading}
              className="landing-cta inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Reading your answer…
                </>
              ) : (
                <>
                  See a sample read
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          ) : (
            <div className="space-y-3.5 border-t border-gray-100 pt-4" aria-live="polite">
              <span className="text-[10px] font-bold tracking-widest text-gray-400">YOUR READ</span>

              <div className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs font-medium text-gray-600">Technical Depth</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full" style={{ width: `${(result.score / 5) * 100}%`, background: ACCENT }} />
                </div>
                <span className="text-xs font-bold text-gray-950">{result.score}</span>
              </div>

              {result.evidence_quote && (
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-sm font-medium leading-snug text-gray-800">
                    &ldquo;{result.evidence_quote}&rdquo;
                  </p>
                </div>
              )}

              <p className="text-xs leading-relaxed text-gray-500">{result.feedback}</p>

              <p className="text-[11px] font-semibold leading-relaxed" style={{ color: ACCENT }}>
                This is a real read of what you typed above. Your real mock interview scores every answer against your actual job description.
              </p>

              <Link
                href="/dashboard"
                onClick={() => trackClient("cta_clicked", { cta_location: "preview_post_reveal" })}
                className="landing-cta inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white"
              >
                {isSignedIn ? "Go to Dashboard" : "Start your real mock interview"}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
