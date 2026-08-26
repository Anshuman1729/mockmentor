"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const ACCENT = "#1f4d3a";

export default function InteractivePreview({ isSignedIn }: { isSignedIn: boolean }) {
  const [revealed, setRevealed] = useState(false);

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
              Tell me about a time you had to debug a critical issue under pressure.
            </p>
          </div>

          <textarea
            placeholder="Type how you'd answer…"
            rows={4}
            className="w-full rounded-2xl border border-gray-200 p-3.5 text-sm text-gray-950 outline-none focus:border-gray-400"
          />

          {!revealed ? (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="landing-cta inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white"
            >
              See a sample read
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="space-y-3.5 border-t border-gray-100 pt-4" aria-live="polite">
              <span className="text-[10px] font-bold tracking-widest text-gray-400">EXAMPLE READ</span>

              <div className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs font-medium text-gray-600">Technical Depth</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full" style={{ width: "80%", background: ACCENT }} />
                </div>
                <span className="text-xs font-bold text-gray-950">4</span>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-sm font-medium leading-snug text-gray-800">
                  &ldquo;We used distributed tracing to isolate the failing service, then rolled back the deploy while we prepared a proper fix — cut the incident from 40 minutes to under 10.&rdquo;
                </p>
              </div>

              <p className="text-xs leading-relaxed text-gray-500">
                Specific tools plus a clear before/after number — that&apos;s what makes a technical answer credible, not just correct.
              </p>

              <p className="text-[11px] leading-relaxed text-gray-400">
                This is an example read, not an analysis of what you typed above. Your real mock interview scores your actual answers against your actual job description.
              </p>

              <Link
                href={isSignedIn ? "/dashboard" : "/sign-up"}
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
