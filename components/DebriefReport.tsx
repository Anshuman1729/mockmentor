"use client";

import { useEffect, useState } from "react";

// ---- Types ----

interface SkillAnalysis {
  parameter_id: string;
  rating: number;
  reasoning: string;
  evidence_quotes: string[];
}

interface NewDebrief {
  summary: {
    recommendation: "Strong Hire" | "Hire" | "Borderline" | "No Hire";
    hire_probability: number;
    overall_impression: string;
  };
  metrics: {
    talk_to_listen_ratio: string;
    avg_response_latency_sec: number;
    signal_to_noise_ratio: number;
    interruption_count: number;
  };
  skill_analysis: SkillAnalysis[];
  behavioral_insights: {
    star_adherence_score: number;
    confidence_level: "High" | "Medium" | "Low";
    red_flags: string[];
  };
  actionable_feedback: {
    strengths: string[];
    growth_areas: string[];
    top_priority_fix: string;
  };
}

interface LegacyDebrief {
  verdict: string;
  overall: string;
  strengths: string[];
  gaps: string[];
  question_highlights: { question: string; note: string; positive: boolean }[];
  closing: string;
}

type Debrief = NewDebrief | LegacyDebrief;

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

// ---- Helpers ----

function isNewDebrief(d: Debrief): d is NewDebrief {
  return "skill_analysis" in d && Array.isArray((d as NewDebrief).skill_analysis);
}

const SIGNAL_META: Record<string, { name: string; bars: [string, string, string] }> = {
  TECHNICAL_DEPTH:     { name: "Technical Depth",       bars: ["Unsatisfactory", "Proficient", "Exceptional"]     },
  PROBLEM_SOLVING:     { name: "Problem Solving",        bars: ["Rigid", "Adaptive", "Strategic"]                 },
  STAR_ALIGNMENT:      { name: "STAR Alignment",         bars: ["Disorganized", "Structured", "Highly Structured"] },
  COMMUNICATION_SNR:   { name: "Communication SNR",      bars: ["Vague/Wordy", "Direct", "Concise"]               },
  RESULT_ORIENTATION:  { name: "Result Orientation",     bars: ["Input-focused", "Output-focused", "Impact-focused"]},
  OWNERSHIP_ETHICS:    { name: "Ownership & Initiative", bars: ["Passive", "Reliable", "Proactive"]               },
  ADAPTABILITY_GROWTH: { name: "Adaptability",           bars: ["Resistant", "Receptive", "Growth-focused"]       },
  EDGE_CASE_MASTERY:   { name: "Edge Case Awareness",    bars: ["Surface-level", "Aware", "Preemptive"]           },
};

// ---- Metric helpers ----

type MetricStatus = "ideal" | "good" | "watch" | "flag";

interface MetricConfig {
  label: string;
  value: string;
  status: MetricStatus;
  statusLabel: string;
  what: string;   // what this metric measures
  why: string;    // why it matters
  bench: string;  // benchmark / ideal range
  yours: string;  // what the candidate's score means
}

// Research-backed thresholds (BarRaiser / FloCareer / Noota synthesis)
// Talk ratio: target 60–75%, ceiling flag >78% (Monologuing), floor flag <55% (Passive)
// Latency: target 1.2–2.0s, high = Indecisive, low = Interruptive
// Interruptions: target <2, >2 = Dominating
// SNR: target >15%, <5% = Verbosity red flag

function getTalkRatioStatus(ratio: string): MetricStatus {
  const pct = parseInt(ratio.split("/")[0] ?? "0");
  if (pct >= 60 && pct <= 75) return "ideal";
  if (pct > 75 && pct <= 78) return "good";   // slightly high but not flagged
  if (pct > 78 || (pct >= 55 && pct < 60)) return "watch"; // ceiling / floor approach
  return "flag";                                // >80% Monologuing or <55% Passive
}

function getSNRStatus(snr: number): MetricStatus {
  if (snr >= 0.15) return "ideal";
  if (snr >= 0.10) return "good";
  if (snr >= 0.05) return "watch";
  return "flag";
}

function getLatencyStatus(sec: number): MetricStatus {
  if (sec >= 1.2 && sec <= 2.0) return "ideal";
  if (sec > 2.0 && sec <= 3.5) return "good";
  if (sec > 3.5 || (sec >= 0.5 && sec < 1.2)) return "watch";
  return "flag"; // >5s Indecisive or <0.5s Interruptive
}

function getInterruptionStatus(count: number): MetricStatus {
  if (count === 0) return "ideal";
  if (count === 1) return "good";
  if (count === 2) return "watch"; // at the limit
  return "flag";                   // >2 = Dominating
}

function buildMetrics(m: NewDebrief["metrics"]): MetricConfig[] {
  const talkPct = parseInt((m?.talk_to_listen_ratio ?? "0").split("/")[0]);
  const snr     = m?.signal_to_noise_ratio ?? 0;
  const latency = m?.avg_response_latency_sec ?? 2;
  const interr  = m?.interruption_count ?? 0;

  // Talk ratio risk labels
  const talkStatusLabel =
    talkPct >= 60 && talkPct <= 75 ? "Ideal range" :
    talkPct > 75 && talkPct <= 78  ? "Slightly high" :
    talkPct > 78                   ? "Monologuing risk" :
    talkPct >= 55                  ? "Slightly low" : "Passive risk";

  const talkYours =
    talkPct >= 60 && talkPct <= 75
      ? `Your ${talkPct}% is in the target range — you drove the conversation without crowding the interviewer out.`
      : talkPct > 78
      ? `At ${talkPct}%, you triggered the Ceiling Rule: the interviewer may not have been able to finish the structured rubric. Practice pausing to check for alignment after each 60–90 second block.`
      : talkPct < 55
      ? `At ${talkPct}%, you've hit the Floor Rule: there wasn't enough signal for a confident hire decision. You need to speak more — not longer, but more substantively.`
      : talkPct > 75
      ? `At ${talkPct}%, you're just above the ideal ceiling. Tighten answers and leave deliberate space for follow-ups.`
      : `At ${talkPct}%, you were slightly passive. Push yourself to elaborate on the 'how' and 'why' in your answers.`;

  return [
    {
      label:       "Talk / Listen",
      value:       m?.talk_to_listen_ratio ?? "N/A",
      status:      getTalkRatioStatus(m?.talk_to_listen_ratio ?? "0/100"),
      statusLabel: talkStatusLabel,
      what:        "The share of the conversation you held vs. the interviewer.",
      why:         "This is how interviewers proxy confidence and EQ simultaneously. Too little means insufficient signal to make a hire decision. Too much means you lack conciseness or the ability to read the room.",
      bench:       "Target: 60–75%. Above 78% risks Monologuing (interviewer couldn't complete the rubric). Below 55% risks a No Hire due to insufficient signal.",
      yours:       talkYours,
    },
    {
      label:       "Signal-to-Noise",
      value:       snr != null ? `${(snr * 100).toFixed(0)}%` : "N/A",
      status:      getSNRStatus(snr),
      statusLabel: snr >= 0.15 ? "High signal" : snr >= 0.10 ? "Good" : snr >= 0.05 ? "Some filler" : "Verbosity flag",
      what:        "The density of substantive content — specific results, technical terms, action verbs — relative to total words spoken.",
      why:         "Senior interviewers unconsciously penalise candidates who take 5 minutes to say what takes 1. High SNR is the clearest proxy for executive presence in a transcript.",
      bench:       "Strong Hire threshold: >15%. Below 5% is a Verbosity red flag.",
      yours:       snr >= 0.15
        ? `Your ${(snr * 100).toFixed(0)}% crosses the Strong Hire threshold for communication density.`
        : snr >= 0.10
        ? `Your ${(snr * 100).toFixed(0)}% is solid. Tighten by cutting preamble ("That's a great question…") and restating less.`
        : snr >= 0.05
        ? `Your ${(snr * 100).toFixed(0)}% has room to improve. Practice answer-first delivery: lead with the result, then explain.`
        : `Your ${(snr * 100).toFixed(0)}% is a Verbosity flag. Focus on cutting filler entirely and structuring answers with the STAR method.`,
    },
    {
      label:       "Avg Response Latency",
      value:       latency != null ? `${latency}s` : "N/A",
      status:      getLatencyStatus(latency),
      statusLabel: latency >= 1.2 && latency <= 2.0 ? "Composed" : latency > 3.5 ? "Indecisive" : latency < 0.5 ? "Interruptive" : latency > 2.0 ? "Acceptable" : "Watch",
      what:        "Average pause before you began answering, measured from when the interviewer finished speaking.",
      why:         "The pause is a seniority signal in both directions. Too long suggests you're unprepared or anxious. Too short suggests you're not listening fully — or are interruptive.",
      bench:       "Target: 1.2–2.0s (composed). Above that trends toward Indecisive; below 0.5s trends toward Interruptive.",
      yours:       latency >= 1.2 && latency <= 2.0
        ? `Your ${latency}s average is in the composed range — thoughtful without hesitation.`
        : latency > 3.5
        ? `Your ${latency}s average reads as Indecisive. Interviewers at fast-paced companies (startups, FAANG) notice this. Practice out loud so you reach answers faster.`
        : latency < 0.5
        ? `Your ${latency}s average is too fast — it can read as Interruptive or as not fully processing the question. Allow a beat before responding.`
        : latency > 2.0
        ? `Your ${latency}s is slightly above the ideal window. Not a flag, but drilling common question types will bring this down.`
        : `Your ${latency}s is on the lower edge of the ideal window. Fine, but ensure you're fully absorbing multi-part questions before starting.`,
    },
    {
      label:       "Interruptions",
      value:       interr != null ? String(interr) : "N/A",
      status:      getInterruptionStatus(interr),
      statusLabel: interr === 0 ? "Clean" : interr === 1 ? "Minimal" : interr === 2 ? "At the limit" : "Dominating",
      what:        "How many times you spoke over or cut off the interviewer before they finished.",
      why:         "Interruptions are a direct signal of EQ and collaborative style. High-stake roles (PM, leadership) require strong active listening. Interviewers flag patterns, not one-offs.",
      bench:       "Target: fewer than 2 per session. Above 2 is Dominating — a poor collaborator flag. Note: 0 interruptions with low talk ratio can signal Submissive.",
      yours:       interr === 0
        ? "Zero interruptions — clean active listening throughout the session."
        : interr === 1
        ? "One interruption — a non-issue. Stay mindful of it in longer sessions."
        : interr === 2
        ? "Two interruptions puts you at the limit. Two more in a future session becomes a pattern interviewers consciously note."
        : `${interr} interruptions crosses into Dominating territory — a collaborator flag for most roles. Practice holding back until the interviewer's sentence is fully complete.`,
    },
  ];
}

const metricStatusStyle: Record<MetricStatus, { card: string; badge: string }> = {
  ideal: { card: "border-emerald-100 bg-emerald-50/40", badge: "bg-emerald-100 text-emerald-700" },
  good:  { card: "border-blue-100 bg-blue-50/30",       badge: "bg-blue-100 text-blue-700"       },
  watch: { card: "border-amber-100 bg-amber-50/30",     badge: "bg-amber-100 text-amber-700"     },
  flag:  { card: "border-red-100 bg-red-50/30",         badge: "bg-red-100 text-red-700"         },
};

function MetricCard({ m }: { m: MetricConfig }) {
  const style = metricStatusStyle[m.status];
  return (
    <div className={`rounded-lg border p-4 space-y-2 ${style.card}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase">{m.label}</p>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${style.badge}`}>
          {m.statusLabel}
        </span>
      </div>
      <p className="font-mono text-2xl font-semibold text-gray-900 tabular-nums">{m.value}</p>
      <div className="space-y-1.5 border-t border-gray-200/60 pt-2">
        <p className="text-xs text-gray-500 leading-relaxed"><span className="font-medium text-gray-700">What: </span>{m.what}</p>
        <p className="text-xs text-gray-500 leading-relaxed"><span className="font-medium text-gray-700">Benchmark: </span>{m.bench}</p>
        <p className="text-xs text-gray-700 leading-relaxed font-medium">{m.yours}</p>
      </div>
    </div>
  );
}

function getBarsLabel(parameterId: string, rating: number): string {
  const meta = SIGNAL_META[parameterId];
  if (!meta) return "";
  if (rating <= 1.5) return meta.bars[0];
  if (rating <= 3.5) return meta.bars[1];
  return meta.bars[2];
}

function RatingDots({ rating }: { rating: number }) {
  const filled = Math.round(rating);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`w-2.5 h-2.5 rounded-full transition-colors ${
            i <= filled ? "bg-gray-900" : "bg-gray-200"
          }`}
        />
      ))}
      <span className="ml-1.5 font-mono text-xs text-gray-400 tabular-nums">{rating}/5</span>
    </div>
  );
}

const recommendationStyle: Record<string, { bg: string; text: string; border: string }> = {
  "Strong Hire": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "Hire":        { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200"    },
  "Borderline":  { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200"   },
  "No Hire":     { bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200"     },
  "On the Fence":{ bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200"   },
};

const confidenceStyle: Record<string, string> = {
  High:   "bg-emerald-100 text-emerald-700",
  Medium: "bg-amber-100 text-amber-700",
  Low:    "bg-red-100 text-red-700",
};

// ---- Main Component ----

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

  // ---- Legacy fallback ----
  if (!isNewDebrief(debrief)) {
    const legacy = debrief as LegacyDebrief;
    const vStyle = recommendationStyle[legacy.verdict] ?? recommendationStyle["On the Fence"];
    return (
      <div className="max-w-xl mx-auto space-y-8 pb-16">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Legacy report — generated before the Week 2 schema update.
        </div>
        <div className="space-y-3 pt-2">
          <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Interview Feedback</p>
          <h1 className="text-2xl font-semibold text-gray-900 leading-snug">
            {session.role}<span className="text-gray-400 font-normal"> · {session.company}</span>
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>{session.round_type}</span><span>·</span>
            <span>{session.yoe} yr{session.yoe !== 1 ? "s" : ""} exp</span>
          </div>
        </div>
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold ${vStyle.bg} ${vStyle.text} ${vStyle.border}`}>
          {legacy.verdict}
        </div>
        <p className="text-gray-800 leading-relaxed text-[15px]">{legacy.overall}</p>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase">What went well</p>
            <ul className="space-y-2">
              {legacy.strengths?.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700"><span className="text-green-500 shrink-0">✓</span>{s}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Where to improve</p>
            <ul className="space-y-2">
              {legacy.gaps?.map((g, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700"><span className="text-red-400 shrink-0">✗</span>{g}</li>
              ))}
            </ul>
          </div>
        </div>
        {legacy.closing && (
          <p className="text-gray-600 italic text-sm leading-relaxed">"{legacy.closing}"</p>
        )}
        <a href="/" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">← Start another interview</a>
      </div>
    );
  }

  // ---- New schema ----
  const d = debrief as NewDebrief;
  const rStyle = recommendationStyle[d.summary.recommendation] ?? recommendationStyle["Borderline"];

  return (
    <div className="max-w-2xl mx-auto pb-16 space-y-10">

      {/* Header */}
      <div className="space-y-3 pt-2">
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Interview Signal Report</p>
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

      {/* Verdict Banner */}
      <div className="rounded-xl bg-gray-950 text-white p-6 space-y-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase mb-3">Interview Outcome</p>
          <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold border ${rStyle.bg} ${rStyle.text} ${rStyle.border}`}>
            {d.summary.recommendation}
          </span>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed border-t border-gray-800 pt-4">
          {d.summary.overall_impression}
        </p>
      </div>

      {/* Conversational Metrics */}
      <div className="space-y-3">
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Conversational Metrics</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {buildMetrics(d.metrics).map((m) => (
            <MetricCard key={m.label} m={m} />
          ))}
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* 8-Signal Grid */}
      <div className="space-y-4">
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Signal Analysis</p>
        {/* Radar chart placeholder — BACKLOG #3 (requires recharts install) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {d.skill_analysis.map((skill) => {
            const meta = SIGNAL_META[skill.parameter_id];
            const barsLabel = getBarsLabel(skill.parameter_id, skill.rating);
            const cardAccent =
              skill.rating >= 4 ? "border-emerald-100 hover:border-emerald-200" :
              skill.rating >= 3 ? "border-gray-100 hover:border-gray-200" :
              "border-red-100 hover:border-red-200";
            return (
              <div
                key={skill.parameter_id}
                className={`rounded-xl border p-5 space-y-3 transition-colors ${cardAccent}`}
              >
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase">
                    {meta?.name ?? skill.parameter_id}
                  </p>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <RatingDots rating={skill.rating} />
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                      skill.rating >= 4 ? "bg-emerald-50 text-emerald-700" :
                      skill.rating >= 3 ? "bg-blue-50 text-blue-700" :
                      "bg-red-50 text-red-600"
                    }`}>
                      {barsLabel}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{skill.reasoning}</p>
                {skill.evidence_quotes?.length > 0 && (
                  <div className="space-y-2 border-l-2 border-gray-200 pl-3 mt-2">
                    {skill.evidence_quotes.slice(0, 2).map((q, i) => (
                      <p key={i} className="text-xs text-gray-500 italic leading-relaxed">"{q}"</p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* Key Moments — derived from skill_analysis highs and lows */}
      {(() => {
        const sorted = [...d.skill_analysis].sort((a, b) => b.rating - a.rating);
        const positive = sorted.filter((s) => s.rating >= 4).slice(0, 2);
        const critical = sorted.filter((s) => s.rating <= 2).slice(0, 2);
        const moments = [
          ...positive.map((s) => ({ ...s, positive: true })),
          ...critical.map((s) => ({ ...s, positive: false })),
        ];
        if (moments.length === 0) return null;
        return (
          <div className="space-y-4">
            <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Key Moments</p>
            <div className="space-y-3">
              {moments.map((m) => (
                <div key={m.parameter_id} className="flex gap-3">
                  <span className={`mt-1 shrink-0 text-xs font-bold ${m.positive ? "text-emerald-500" : "text-red-400"}`}>
                    {m.positive ? "+" : "−"}
                  </span>
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
                      {SIGNAL_META[m.parameter_id]?.name ?? m.parameter_id}
                    </p>
                    {m.evidence_quotes?.[0] && (
                      <p className="text-xs text-gray-400 italic">"{m.evidence_quotes[0]}"</p>
                    )}
                    <p className="text-sm text-gray-700">{m.reasoning}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <hr className="border-gray-100" />

      {/* Behavioral Insights */}
      <div className="space-y-4">
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Behavioral Insights</p>
        <div className="flex flex-wrap items-stretch gap-3">
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase mb-2">STAR Adherence</p>
            <div className="flex items-center gap-3">
              <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gray-900 rounded-full transition-all"
                  style={{ width: `${d.behavioral_insights?.star_adherence_score ?? 0}%` }}
                />
              </div>
              <span className="font-mono text-sm font-semibold text-gray-900 tabular-nums">
                {d.behavioral_insights?.star_adherence_score ?? "—"}
              </span>
            </div>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase mb-2">Confidence</p>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              confidenceStyle[d.behavioral_insights?.confidence_level ?? "Medium"]
            }`}>
              {d.behavioral_insights?.confidence_level ?? "—"}
            </span>
          </div>
        </div>
        {d.behavioral_insights?.red_flags?.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">Red Flags</p>
            <ul className="space-y-1.5">
              {d.behavioral_insights.red_flags.map((flag, i) => (
                <li key={i} className="flex gap-2 text-sm text-red-700">
                  <span className="shrink-0 mt-0.5">⚠</span>
                  <span>{flag}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <hr className="border-gray-100" />

      {/* Actionable Feedback */}
      <div className="space-y-5">
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Actionable Feedback</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-3">
            <p className="text-[10px] font-semibold tracking-wider text-emerald-600 uppercase">Strengths</p>
            <ul className="space-y-2">
              {d.actionable_feedback?.strengths?.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700">
                  <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <p className="text-[10px] font-semibold tracking-wider text-amber-600 uppercase">Growth Areas</p>
            <ul className="space-y-2">
              {d.actionable_feedback?.growth_areas?.map((g, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700">
                  <span className="text-amber-500 mt-0.5 shrink-0">→</span>
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {d.actionable_feedback?.top_priority_fix && (
          <div className="rounded-xl border border-gray-900 bg-gray-950 px-5 py-4">
            <p className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase mb-2">Top Priority Fix</p>
            <p className="text-sm text-white leading-relaxed">{d.actionable_feedback.top_priority_fix}</p>
          </div>
        )}
      </div>

      <div className="pt-2">
        <a href="/" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
          ← Start another interview
        </a>
      </div>
    </div>
  );
}
