"use client";

import { useEffect, useState } from "react";

const DEBRIEF_MESSAGES = [
  { label: "Reading your transcript", sub: "Pulling everything you said into context…"          },
  { label: "Understanding what you said", sub: "Finding what landed and what fell flat…"          },
  { label: "Checking the evidence",   sub: "Pinning scores to verbatim quotes from your answers…"},
  { label: "Writing your feedback",   sub: "Turning scores into specific, actionable notes…"    },
  { label: "Compiling your report",   sub: "Almost there — putting it all together…"            },
];

// Full-screen debrief-generation loading state. Shared by InterviewRoom
// (the real generating-debrief step) and /dev/loading (a DB-free preview
// of the same screen) so the two can't drift out of sync.
export default function DebriefLoadingScreen() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const cycle = setInterval(() => {
      // Fade out, advance, fade in
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % DEBRIEF_MESSAGES.length);
        setVisible(true);
      }, 300);
    }, 2500);
    return () => clearInterval(cycle);
  }, []);

  const msg = DEBRIEF_MESSAGES[idx];

  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center gap-8 text-white z-50 px-4 sm:px-6">
      {/* Spinner */}
      <div className="w-12 h-12 border-4 border-gray-700 border-t-white rounded-full animate-spin" />

      {/* Cycling message */}
      <div
        className="text-center space-y-2 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <p className="text-lg font-semibold tracking-tight">{msg.label}</p>
        <p className="text-sm text-gray-400 max-w-xs">{msg.sub}</p>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1.5">
        {DEBRIEF_MESSAGES.map((_, i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full transition-colors duration-300"
            style={{ background: i === idx ? "#ffffff" : "#374151" }}
          />
        ))}
      </div>
    </div>
  );
}
