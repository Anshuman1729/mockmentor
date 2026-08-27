"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DebriefLoadingScreen from "@/components/DebriefLoadingScreen";

// Hidden production shortcut — not linked from anywhere in the app, and the
// API route behind this (app/api/dev/quick-test) fails closed unless the
// signed-in caller's email matches DEV_TEST_ALLOWED_EMAIL. Generates a real
// 1-question debrief through the exact production pipeline (same Groq
// calls, same error handling) without a full 5-8 question interview.
export default function QuickTestPage() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dev/quick-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: role.trim() || undefined,
          company: company.trim() || undefined,
          answer: answer.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          res.status === 403
            ? "Not authorized for this test route."
            : data.error ?? "Quick test failed."
        );
      }
      router.push(`/debrief/${data.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  if (loading) return <DebriefLoadingScreen />;

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-xl font-bold text-gray-950">Quick Test Debrief</h1>
      <p className="mt-2 text-sm text-gray-500">
        Generates a real 1-question debrief through the actual production pipeline. Leave any field blank for a sensible default.
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-600">Role (default: Software Engineer)</label>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 p-2.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600">Company (default: Test Co)</label>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 p-2.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600">Answer (default: a canned sample answer)</label>
          <textarea
            rows={5}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 p-2.5 text-sm"
          />
        </div>

        {error && <p className="text-xs font-medium text-red-600">{error}</p>}

        <button
          type="button"
          onClick={handleGenerate}
          className="w-full rounded-full bg-gray-950 px-6 py-3 text-sm font-semibold text-white"
        >
          Generate Test Debrief
        </button>
      </div>
    </div>
  );
}
