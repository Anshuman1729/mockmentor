"use client";

import { useEffect } from "react";

// Dev-only: intercepts POST /api/interview/drill on this preview page only,
// so DrillPractice's full "Before -> After" result UI can be visually
// verified without a live DB, Clerk session, or GROQ_API_KEY. Never
// imported outside /dev/debrief.
export function DevDrillMock() {
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url === "/api/interview/drill" && init?.method === "POST") {
        await new Promise((r) => setTimeout(r, 600)); // simulate latency
        const body = JSON.parse((init.body as string) ?? "{}");
        const improved = body.attempt_answer?.length > 80;
        const newRating = improved ? Math.min(5, body.original_rating + 2) : Math.min(5, body.original_rating + 1);
        return new Response(
          JSON.stringify({
            new_rating: newRating,
            new_reasoning: improved
              ? "Much stronger — you named the specific mechanism and the trade-off this time, not just the tool."
              : "A little better, but still light on the reasoning behind the choice — try naming what you'd do differently and why.",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(input, init);
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
