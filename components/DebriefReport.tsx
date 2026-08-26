"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { CANONICAL_FRAMEWORKS, type CanonicalFramework } from "@/lib/rubric-researched";
import { SIGNAL_META, computeSignalTrends } from "@/lib/signals";
import { DrillPractice } from "@/components/DrillPractice";

const FRAMEWORKS_BY_NAME = new Map<string, CanonicalFramework>(
  Object.values(CANONICAL_FRAMEWORKS).map((f) => [f.name, f])
);

// ---- Types ----

interface SkillAnalysis {
  parameter_id: string;
  rating: number;
  reasoning: string;
  evidence_quotes: string[];
}

interface QuestionWalkthroughEntry {
  question_number: number;
  key_takeaway: string;
  signal_ids: string[];
}

interface ModelAnswer {
  question_number: number;
  parameter_id: string;
  your_quote: string;
  why_it_hurt: string;
  framework: string;
  model_excerpt: string;
}

interface PriorityRisk {
  title: string;
  description: string;
  related_signal_ids: string[];
}

interface NewDebrief {
  summary: {
    recommendation: "Strong Hire" | "Hire" | "Borderline" | "No Hire";
    // Internal-only field (see CLAUDE.md non-negotiable rules) — the API
    // strips it before this ever reaches the client. Optional here so the
    // type doesn't imply the UI should ever read or render it.
    hire_probability?: number;
    overall_impression: string;
  };
  metrics: {
    talk_to_listen_ratio: string;
    avg_response_latency_sec: number;
    signal_to_noise_ratio: number;
    interruption_count: number;
    longest_monologue_sec?: number;
    candidate_questions_asked?: number;
  };
  skill_analysis: SkillAnalysis[];
  question_walkthrough?: QuestionWalkthroughEntry[];
  priority_risks?: PriorityRisk[];
  model_answers?: ModelAnswer[];
  path_to_next_tier?: string;
  behavioral_insights: {
    star_adherence_score: number;
    confidence_level: "High" | "Medium" | "Low";
    confidence_rationale?: string;
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

export type Debrief = NewDebrief | LegacyDebrief;
export type { NewDebrief };

interface HistorySkill {
  parameter_id: string;
  rating: number;
}

export interface HistoryEntry {
  session_id: string;
  date: string; // ISO timestamp
  role: string;
  company: string;
  round_type: string;
  skill_analysis: HistorySkill[];
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
  history?: HistoryEntry[];
  qas?: { question_number: number; question: string }[];
}

// ---- Helpers ----

function isNewDebrief(d: Debrief): d is NewDebrief {
  return "skill_analysis" in d && Array.isArray((d as NewDebrief).skill_analysis);
}

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

  const talkStatusLabel =
    talkPct >= 60 && talkPct <= 75 ? "Ideal range" :
    talkPct > 75 && talkPct <= 78  ? "Slightly high" :
    talkPct > 78                   ? "Monologuing risk" :
    talkPct >= 55                  ? "Slightly low" : "Passive risk";

  const talkYours =
    talkPct >= 60 && talkPct <= 75
      ? `Your ${talkPct}% is in the target range — you drove the conversation without crowding the interviewer out.`
      : talkPct > 78
      ? `At ${talkPct}%, you were talking so much the interviewer may not have gotten through everything they wanted to ask. Practice pausing to check in after each 60–90 second block.`
      : talkPct < 55
      ? `At ${talkPct}%, you didn't say enough for the interviewer to confidently judge your fit. You need to speak more — not longer, but more substantively.`
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
      why:         "This is how interviewers read confidence and how well you read the room, at the same time. Too little and the interviewer doesn't have enough to go on. Too much and you're not leaving room for them to steer or ask follow-ups.",
      bench:       "Target: 60–75%. Above 78% risks talking so much the interviewer can't get through their questions. Below 55% risks coming across passive or underprepared.",
      yours:       talkYours,
    },
    {
      // Was labeled "Signal-to-Noise" — direct feedback flagged that a high
      // number here read as contradicting a low Communication Clarity / STAR
      // rating elsewhere ("wait, am I high-signal or verbose?"). Renamed to
      // "Content Density" and the copy now explicitly says this measures
      // substance, not structure — a candidate can score well here and
      // still lose points on Communication Clarity/Story Structure above
      // for being disorganized. That's not a contradiction, it's two
      // different things, and now the label says so.
      label:       "Content Density",
      value:       snr != null ? `${(snr * 100).toFixed(0)}%` : "N/A",
      status:      getSNRStatus(snr),
      statusLabel: snr >= 0.15 ? "High density" : snr >= 0.10 ? "Good" : snr >= 0.05 ? "Some filler" : "Verbosity flag",
      what:        "How much of what you said was substance — specific results, technical terms, action verbs — vs. filler. This measures density, not structure: see Communication Clarity and Story Structure below for how well-organized it was.",
      why:         "Senior interviewers unconsciously penalise candidates who take 5 minutes to say what takes 1. High density is necessary but not sufficient — dense content still needs to be organized to land.",
      bench:       "Above 15% is strong content density. Below 5% is a Verbosity flag — mostly filler, little substance.",
      yours:       snr >= 0.15
        ? `Your ${(snr * 100).toFixed(0)}% is strong — the substance is there. If your structure scores below are lower, the gap isn't what you said, it's how it was organized.`
        : snr >= 0.10
        ? `Your ${(snr * 100).toFixed(0)}% is solid. Tighten by cutting preamble ("That's a great question…") and restating less.`
        : snr >= 0.05
        ? `Your ${(snr * 100).toFixed(0)}% has room to improve. Practice answer-first delivery: lead with the result, then explain.`
        : `Your ${(snr * 100).toFixed(0)}% is a Verbosity flag. Focus on cutting filler entirely and structuring answers with the Answer → Evidence → Impact framework.`,
    },
    {
      label:       "Avg Response Latency",
      value:       latency != null ? `${latency}s` : "N/A",
      status:      getLatencyStatus(latency),
      statusLabel: latency >= 1.2 && latency <= 2.0 ? "Composed" : latency > 3.5 ? "Hesitant" : latency < 0.5 ? "Cuts in early" : latency > 2.0 ? "Acceptable" : "Watch",
      what:        "Average pause before you began answering, measured from when the interviewer finished speaking.",
      why:         "The pause tells an interviewer how prepared you are, in both directions. Too long suggests you're unprepared or anxious. Too short suggests you're not fully listening — or cutting in before they're done.",
      bench:       "Target: 1.2–2.0s (composed). Above that starts to read as hesitant; below 0.5s starts to read as cutting people off.",
      yours:       latency >= 1.2 && latency <= 2.0
        ? `Your ${latency}s average is in the composed range — thoughtful without hesitation.`
        : latency > 3.5
        ? `Your ${latency}s average reads as hesitant — interviewers, especially at fast-moving companies, notice the pause. Practice answering out loud so you reach your point faster.`
        : latency < 0.5
        ? `Your ${latency}s average is too fast — it can read as cutting in, or as not fully processing the question. Allow a beat before responding.`
        : latency > 2.0
        ? `Your ${latency}s is slightly above the ideal window. Not a flag, but drilling common question types will bring this down.`
        : `Your ${latency}s is on the lower edge of the ideal window. Fine, but ensure you're fully absorbing multi-part questions before starting.`,
    },
    {
      label:       "Interruptions",
      value:       interr != null ? String(interr) : "N/A",
      status:      getInterruptionStatus(interr),
      statusLabel: interr === 0 ? "Clean" : interr === 1 ? "Minimal" : interr === 2 ? "At the limit" : "Talks over people",
      what:        "How many times you spoke over or cut off the interviewer before they finished.",
      why:         "Interruptions are a direct signal of how well you listen and collaborate. Leadership and people-facing roles are especially strict about this. Interviewers notice a pattern, not a one-off.",
      bench:       "Target: fewer than 2 per session. More than that reads as not letting the interviewer finish. Note: 0 interruptions combined with a low talk ratio can read as passive rather than a good listener.",
      yours:       interr === 0
        ? "Zero interruptions — clean active listening throughout the session."
        : interr === 1
        ? "One interruption — a non-issue. Stay mindful of it in longer sessions."
        : interr === 2
        ? "Two interruptions puts you at the limit. Two more in a future session becomes a pattern interviewers consciously note."
        : `${interr} interruptions is enough that it reads as not letting the interviewer finish, which most roles will flag. Practice holding back until their sentence is fully complete.`,
    },
  ];
}

// Restrained, three-color semantic palette (emerald/amber/red) plus a neutral
// gray tier — no blue. Blue-badge-everywhere is exactly the generic-SaaS-AI
// look this redesign is moving away from.
const metricStatusStyle: Record<MetricStatus, { card: string; badge: string; bar: string }> = {
  ideal: { card: "border-emerald-200/70 bg-emerald-50/40", badge: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500" },
  good:  { card: "border-gray-200 bg-white",                badge: "bg-gray-100 text-gray-600",       bar: "bg-gray-400"    },
  watch: { card: "border-amber-200/70 bg-amber-50/40",      badge: "bg-amber-100 text-amber-700",     bar: "bg-amber-500"   },
  flag:  { card: "border-red-200/70 bg-red-50/40",          badge: "bg-red-100 text-red-700",         bar: "bg-red-500"     },
};

function MetricCard({ m }: { m: MetricConfig }) {
  const style = metricStatusStyle[m.status];
  return (
    <div className={`rounded-xl border p-5 space-y-3 ${style.card}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase">{m.label}</p>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${style.badge}`}>
          {m.statusLabel}
        </span>
      </div>
      <p className="font-mono text-3xl font-semibold text-gray-950 tabular-nums">{m.value}</p>
      <div className="space-y-2 border-t border-gray-200/70 pt-3">
        <p className="text-xs text-gray-500 leading-relaxed"><span className="font-semibold text-gray-700">What it measures — </span>{m.what}</p>
        <p className="text-xs text-gray-500 leading-relaxed"><span className="font-semibold text-gray-700">Benchmark — </span>{m.bench}</p>
        <p className="text-xs text-gray-800 leading-relaxed font-medium pt-1">{m.yours}</p>
      </div>
    </div>
  );
}

// For stats with no research-backed benchmark yet (Backlog #10/#11: real
// instrumentation data that's genuinely useful but doesn't have an
// ideal/watch/flag threshold behind it) — shown plainly rather than
// inventing a graded band the way MetricCard does for the four
// research-backed metrics.
function PlainStat({ label, value, blurb }: { label: string; value: string; blurb: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 space-y-2">
      <p className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase">{label}</p>
      <p className="font-mono text-3xl font-semibold text-gray-950 tabular-nums">{value}</p>
      <p className="text-xs text-gray-500 leading-relaxed border-t border-gray-200/70 pt-3">{blurb}</p>
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
      <span className="flex items-center gap-1" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i <= filled ? "bg-gray-950" : "bg-gray-200"
            }`}
          />
        ))}
      </span>
      <span className="ml-1.5 font-mono text-xs text-gray-400 tabular-nums">{rating}/5</span>
    </div>
  );
}

const recommendationStyle: Record<string, { bg: string; text: string; border: string }> = {
  "Strong Hire": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "Hire":        { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "Borderline":  { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200"   },
  "No Hire":     { bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200"     },
  "On the Fence":{ bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200"   },
};

const confidenceStyle: Record<string, string> = {
  High:   "bg-emerald-100 text-emerald-700",
  Medium: "bg-amber-100 text-amber-700",
  Low:    "bg-red-100 text-red-700",
};

// Section eyebrow — numbered, editorial. Gives the report a sense of
// authored structure rather than a dumped grid of cards.
function SectionHeading({ n, title, sub }: { n: string; title: string; sub?: string }) {
  return (
    <div className="flex items-start gap-4">
      <span className="font-mono text-xs text-gray-300 pt-1 shrink-0" aria-hidden="true">{n}</span>
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-gray-950 tracking-tight">{title}</h2>
        {sub && <p className="text-sm text-gray-500 leading-relaxed max-w-xl">{sub}</p>}
      </div>
    </div>
  );
}

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

  return (
    <DebriefReportView
      session={data.session}
      debrief={data.debrief}
      sessionId={sessionId}
      history={data.history ?? []}
      qas={data.qas ?? []}
    />
  );
}

// Presentational body, split out from the data-fetching wrapper above so it
// can also be rendered from a mock-data dev preview route without a DB.
export function DebriefReportView({
  session,
  debrief,
  sessionId,
  history = [],
  qas = [],
}: {
  session: SessionData["session"];
  debrief: Debrief;
  sessionId?: string;
  history?: HistoryEntry[];
  qas?: { question_number: number; question: string }[];
}) {
  // ---- Legacy fallback ----
  if (!isNewDebrief(debrief)) {
    const legacy = debrief as LegacyDebrief;
    const vStyle = recommendationStyle[legacy.verdict] ?? recommendationStyle["On the Fence"];
    return (
      <div className="max-w-xl mx-auto space-y-8 pb-16">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          This report was generated with an older format — some newer sections may be missing.
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <h2 className="text-xs font-semibold tracking-widest text-gray-400 uppercase">What went well</h2>
            <ul className="space-y-2">
              {legacy.strengths?.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700"><span className="text-green-500 shrink-0" aria-hidden="true">✓</span>{s}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <h2 className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Where to improve</h2>
            <ul className="space-y-2">
              {legacy.gaps?.map((g, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700"><span className="text-red-400 shrink-0" aria-hidden="true">✗</span>{g}</li>
              ))}
            </ul>
          </div>
        </div>
        {legacy.closing && (
          <p className="text-gray-600 italic text-sm leading-relaxed">&ldquo;{legacy.closing}&rdquo;</p>
        )}
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">← Start another interview</Link>
      </div>
    );
  }

  // ---- New schema ----
  const d = debrief as NewDebrief;
  const rStyle = recommendationStyle[d.summary.recommendation] ?? recommendationStyle["Borderline"];
  const walkthrough = d.question_walkthrough ?? [];
  const priorityRisks = d.priority_risks ?? [];
  const modelAnswers = d.model_answers ?? [];
  const questionByNumber = new Map(qas.map((qa) => [qa.question_number, qa.question]));

  // "What Helped" — the positive half of what used to be the flat "Key
  // Moments" section, still verbatim-evidence-backed per explicit feedback
  // that this is the strongest part of the report ("double down on this").
  // Paired against priority_risks (the consolidated root causes) instead of
  // a matching list of negative moments — negatives get the deeper
  // Observed/Problem/Better treatment in "Moments That Cost You Signal"
  // below instead of being duplicated here.
  const topStrengthSignals = [...d.skill_analysis]
    .sort((a, b) => b.rating - a.rating)
    .filter((s) => s.rating >= 4)
    .slice(0, 3);

  // Cross-interview trend — see lib/signals.ts for the shared math (also
  // used account-wide by the /progress dashboard).
  const signalTrends = computeSignalTrends(d.skill_analysis, history, "Today");

  return (
    <div className="max-w-2xl mx-auto pb-16 space-y-12">

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
        <p className="text-xs text-gray-400 leading-relaxed max-w-md">
          A &ldquo;signal&rdquo; is anything in your answer that tells an interviewer whether you&apos;re a fit — a clear story, a real number, how you handle pushback. This report scores 8 of them.
        </p>
      </div>

      {/* Verdict Banner — deliberately NOT sticky: a `sticky` element here has
          no bounded parent height, so it pins to the top of the viewport for
          the entire scroll of the report and permanently covers whatever's
          underneath (confirmed via persona review, both desktop and mobile —
          this was a real, severe bug, not a style nit). */}
      <div className="rounded-xl bg-gray-950 text-white p-6 space-y-4 shadow-lg">
        <div>
          <h2 className="text-xs font-semibold tracking-widest text-gray-500 uppercase mb-3">Interview Outcome</h2>
          <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold border ${rStyle.bg} ${rStyle.text} ${rStyle.border}`}>
            {d.summary.recommendation}
          </span>
          <p className="mt-2 text-xs text-gray-400">This is our read on a practice round — not a real hiring decision.</p>
        </div>
        {/* overall_impression is written in the interviewer's own first-person
            voice (see lib/groq.ts prompt) — the verdict they'd actually say
            out loud, not a topic summary. Styled as a quote and made the
            visual centerpiece of the banner per direct feedback that this
            line is the strongest sentence in the report and should be
            elevated, not buried. */}
        <blockquote className="text-lg text-white leading-snug font-medium border-t border-gray-800 pt-4">
          &ldquo;{d.summary.overall_impression}&rdquo;
        </blockquote>
      </div>

      {/* Above-the-fold quick nav — this report runs long, and a first-time
          reader shouldn't have to scroll past everything to find the part
          they care about (flagged directly by persona review: "nothing
          above the fold beyond the outcome badge"). */}
      <nav aria-label="Jump to section" className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {[
          { href: "risks", label: "What Helped / Hurt", shown: topStrengthSignals.length > 0 || priorityRisks.length > 0 },
          { href: "moments", label: "Moments That Hurt You", shown: modelAnswers.length > 0 },
          { href: "signal-analysis", label: "Signal Analysis", shown: true },
          { href: "pattern", label: "Recurring Pattern", shown: signalTrends.length > 0 },
          { href: "metrics", label: "Conversational Metrics", shown: true },
          { href: "action-plan", label: "Action Plan", shown: true },
        ]
          // Only link to sections that will actually render — an anchor
          // pointing at an id that isn't in the DOM just does nothing on
          // click, which reads as a broken link, not an empty state
          // (reported directly: "not clickable and I don't see that
          // section" — the nav promised something the page didn't have).
          .filter((item) => item.shown)
          .map(({ href, label }) => (
          <a key={href} href={`#${href}`} className="text-gray-400 hover:text-gray-950 underline underline-offset-4 decoration-gray-200 hover:decoration-gray-400 transition-colors">
            {label}
          </a>
        ))}
      </nav>

      {/* ═══ 01 — What Helped / What Hurt ═══
          Direct feedback: "the candidate doesn't need 14 things to improve,
          they need 2-3 root causes — everything else becomes supporting
          evidence." This is the new primary read, ahead of the 8-signal
          detail below. */}
      {(topStrengthSignals.length > 0 || priorityRisks.length > 0) && (
        <div id="risks" className="space-y-6 scroll-mt-20">
          <SectionHeading
            n="01"
            title="What Helped / What Hurt"
            sub="Not 8 separate scores — the handful of root causes underneath them. Everything further down is the evidence behind these."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {topStrengthSignals.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[10px] font-semibold tracking-wider text-emerald-600 uppercase">What helped</h3>
                <div className="space-y-3">
                  {topStrengthSignals.map((s) => (
                    <div key={s.parameter_id} className="border-l-2 border-emerald-300 pl-3 space-y-1">
                      <p className="text-sm font-semibold text-gray-900">{SIGNAL_META[s.parameter_id]?.name ?? s.parameter_id}</p>
                      {s.evidence_quotes?.[0] && (
                        <p className="text-xs text-gray-400 italic">&ldquo;{s.evidence_quotes[0]}&rdquo;</p>
                      )}
                      <p className="text-sm text-gray-600 leading-relaxed">{s.reasoning}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {priorityRisks.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[10px] font-semibold tracking-wider text-red-500 uppercase">What hurt</h3>
                <div className="space-y-3">
                  {priorityRisks.map((r) => (
                    <div key={r.title} className="border-l-2 border-red-300 pl-3 space-y-1">
                      <p className="text-sm font-semibold text-gray-900">{r.title}</p>
                      <p className="text-sm text-gray-600 leading-relaxed">{r.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ 02 — What Happened: the question-by-question walkthrough ═══ */}
      {walkthrough.length > 0 && (
        <div className="space-y-6">
          <SectionHeading
            n="02"
            title="What Happened"
            sub="A walkthrough of the interview itself — what you said in each answer, and what it signaled to the interviewer."
          />
          <ol className="relative space-y-0">
            {walkthrough
              .slice()
              .sort((a, b) => a.question_number - b.question_number)
              .map((entry, i, arr) => (
                <li key={entry.question_number} className="relative flex gap-4 pb-6 last:pb-0">
                  {/* timeline rail */}
                  <div className="flex flex-col items-center shrink-0">
                    <span className="w-7 h-7 rounded-full bg-gray-950 text-white text-[11px] font-bold flex items-center justify-center font-mono">
                      {entry.question_number}
                    </span>
                    {i < arr.length - 1 && <span className="w-px flex-1 bg-gray-200 mt-1" aria-hidden="true" />}
                  </div>
                  <div className="space-y-2 pt-0.5 min-w-0">
                    <p className="text-sm text-gray-800 leading-relaxed">{entry.key_takeaway}</p>
                    {entry.signal_ids?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {entry.signal_ids.map((sid) => (
                          <span key={sid} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            {SIGNAL_META[sid]?.name ?? sid}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
          </ol>
        </div>
      )}

      {/* ═══ 03 — Moments That Cost You Signal ═══
          Observed → Problem → Better, grounded in a real quote every time.
          Direct feedback named this exact structure as the single biggest
          upgrade the report could make: "every weakness should show the
          exact moment where it happened, the interviewer interpretation of
          that moment, and the better response." */}
      {modelAnswers.length > 0 && (
        <div id="moments" className="space-y-6 scroll-mt-20">
          <SectionHeading
            n="03"
            title="Moments That Hurt You"
            sub="The exact moments behind your biggest risks — what you said, what it likely signaled, and what a stronger version sounds like."
          />
          <div className="space-y-5">
            {modelAnswers.map((ma, i) => (
              <div key={`${ma.question_number}-${i}`} className="rounded-xl border border-gray-100 p-5 space-y-4">
                <p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
                  Q{ma.question_number} · {SIGNAL_META[ma.parameter_id]?.name ?? ma.parameter_id}
                </p>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">You said</p>
                  <blockquote className="text-sm text-gray-700 italic border-l-2 border-gray-200 pl-3 leading-relaxed">
                    &ldquo;{ma.your_quote}&rdquo;
                  </blockquote>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold tracking-wider text-red-500 uppercase">Why it hurt</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{ma.why_it_hurt}</p>
                </div>
                <div className="rounded-lg bg-emerald-50/50 border border-emerald-100 p-3.5 space-y-2.5">
                  <p className="text-[10px] font-semibold tracking-wider text-emerald-700 uppercase">
                    Try this instead — {ma.framework}
                  </p>
                  <p className="text-sm text-gray-800 leading-relaxed italic">&ldquo;{ma.model_excerpt}&rdquo;</p>
                  {FRAMEWORKS_BY_NAME.get(ma.framework) && (
                    <ol className="space-y-1 border-t border-emerald-100 pt-2">
                      {FRAMEWORKS_BY_NAME.get(ma.framework)!.steps.map((step, i) => (
                        <li key={i} className="flex items-baseline gap-2 text-xs text-emerald-800/80">
                          <span className="font-mono text-emerald-700/50 shrink-0">{i + 1}.</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                {sessionId && questionByNumber.get(ma.question_number) && (
                  <DrillPractice
                    sessionId={sessionId}
                    questionNumber={ma.question_number}
                    question={questionByNumber.get(ma.question_number)!}
                    parameterId={ma.parameter_id}
                    signalName={SIGNAL_META[ma.parameter_id]?.name ?? ma.parameter_id}
                    originalRating={d.skill_analysis.find((s) => s.parameter_id === ma.parameter_id)?.rating ?? 0}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ 04 — Signal Analysis — supporting evidence, not the primary
          read. Collapsed by default: the 8 individual scores are what the
          sections above are built FROM, not a parallel list to re-scan. ═══ */}
      <div id="signal-analysis" className="space-y-6 scroll-mt-20">
        <SectionHeading
          n="04"
          title="Signal Analysis"
          sub="The 8 signals behind the sections above, each backed by a direct quote from what you said. Expand any for the full detail."
        />
        <div className="space-y-3">
          {d.skill_analysis.map((skill) => {
            const meta = SIGNAL_META[skill.parameter_id];
            const barsLabel = getBarsLabel(skill.parameter_id, skill.rating);
            const accent =
              skill.rating >= 4 ? "border-l-emerald-300" :
              skill.rating >= 3 ? "border-l-gray-300" :
              "border-l-red-300";
            return (
              <details
                key={skill.parameter_id}
                className={`group rounded-xl border border-gray-100 border-l-4 ${accent}`}
              >
                <summary className="cursor-pointer list-none p-5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase">
                      {meta?.name ?? skill.parameter_id}
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{meta?.blurb}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <RatingDots rating={skill.rating} />
                    <span className="text-gray-300 transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
                  </div>
                </summary>
                <div className="px-5 pb-5 space-y-3 border-t border-gray-100 pt-3">
                  <span className={clsx("inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full",
                    skill.rating >= 4 ? "bg-emerald-50 text-emerald-700" :
                    skill.rating >= 3 ? "bg-gray-100 text-gray-600" :
                    "bg-red-50 text-red-600"
                  )}>
                    {barsLabel}
                  </span>
                  <p className="text-sm text-gray-700 leading-relaxed">{skill.reasoning}</p>
                  {skill.evidence_quotes?.length > 0 && (
                    <div className="space-y-2 border-l-2 border-gray-200 pl-3 mt-2">
                      {skill.evidence_quotes.slice(0, 2).map((q, i) => (
                        <p key={i} className="text-xs text-gray-500 italic leading-relaxed">&ldquo;{q}&rdquo;</p>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      </div>

      {/* ═══ 05 — Your Recurring Pattern — cross-interview trend. Direct
          feedback: "are these weaknesses recurring across interviews?" —
          this is the difference between a report and a training system. ═══ */}
      {signalTrends.length > 0 && (
        <div id="pattern" className="space-y-6 scroll-mt-20">
          <SectionHeading
            n="05"
            title="Your Recurring Pattern"
            sub="How these same signals scored in your past sessions, not just this one."
          />
          <div className="space-y-3">
            {signalTrends.map((t) => (
              <div key={t.parameter_id} className="rounded-lg border border-gray-100 p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900">{SIGNAL_META[t.parameter_id]?.name ?? t.parameter_id}</p>
                  {t.recurring ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                      {t.streak}-session pattern
                    </span>
                  ) : t.improving ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                      Improving
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {t.points.map((p, i) => (
                    <span key={i} className="flex items-center gap-1.5">
                      <span className={clsx(
                        "text-xs font-mono px-2 py-1 rounded-md whitespace-nowrap",
                        p.isCurrent ? "bg-gray-950 text-white" :
                        p.rating <= 2 ? "bg-red-50 text-red-600" :
                        p.rating === 3 ? "bg-amber-50 text-amber-700" :
                        "bg-emerald-50 text-emerald-700"
                      )}>
                        {p.label}: {p.rating}/5
                      </span>
                      {i < t.points.length - 1 && <span className="text-gray-300" aria-hidden="true">→</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ 06 — Conversational Metrics ═══ */}
      <div id="metrics" className="space-y-6 scroll-mt-20">
        <SectionHeading
          n="06"
          title="Conversational Metrics"
          sub="How the interview flowed, independent of content — measured against interview-research benchmarks."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {buildMetrics(d.metrics).map((m) => (
            <MetricCard key={m.label} m={m} />
          ))}
        </div>
        {(d.metrics.longest_monologue_sec !== undefined || d.metrics.candidate_questions_asked !== undefined) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {d.metrics.longest_monologue_sec !== undefined && (
              <PlainStat
                label="Longest Monologue"
                value={`${d.metrics.longest_monologue_sec}s`}
                blurb="Your single longest answer, start to finish. No universal benchmark yet — worth tracking against your own past sessions rather than a fixed target."
              />
            )}
            {d.metrics.candidate_questions_asked !== undefined && (
              <PlainStat
                label="Questions You Asked"
                value={String(d.metrics.candidate_questions_asked)}
                blurb="How many clarifying or exploratory questions you asked the interviewer. Interviewers read genuine curiosity as engagement — asking zero across a whole session can read as passive."
              />
            )}
          </div>
        )}
      </div>

      {/* ═══ 07 — Behavioral Insights ═══ */}
      <div className="space-y-6">
        <SectionHeading n="07" title="Behavioral Insights" />
        <div className="flex flex-wrap items-stretch gap-3">
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 max-w-xs">
            <h3 className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase mb-2">Story Structure Score</h3>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden shrink-0">
                <div
                  className="h-full bg-gray-900 rounded-full transition-all"
                  style={{ width: `${d.behavioral_insights?.star_adherence_score ?? 0}%` }}
                />
              </div>
              <span className="font-mono text-sm font-semibold text-gray-900 tabular-nums">
                {d.behavioral_insights?.star_adherence_score ?? "—"}<span className="text-gray-400 font-normal">/100</span>
              </span>
            </div>
            <p className="text-xs text-gray-400 leading-snug">How consistently your stories followed Situation → Action → Result across the whole session.</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 max-w-xs">
            <h3 className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase mb-2">Confidence</h3>
            <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full mb-1.5 ${
              confidenceStyle[d.behavioral_insights?.confidence_level ?? "Medium"]
            }`}>
              {d.behavioral_insights?.confidence_level ?? "—"}
            </span>
            <p className="text-xs text-gray-400 leading-snug">
              {d.behavioral_insights?.confidence_rationale || "How sure this read is, based on how consistent you were across answers."}
            </p>
          </div>
        </div>
        {d.behavioral_insights?.red_flags?.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">Where This Could Cost You</h3>
            <ul className="space-y-1.5">
              {d.behavioral_insights.red_flags.map((flag, i) => (
                <li key={i} className="flex gap-2 text-sm text-red-700">
                  <span className="shrink-0 mt-0.5" aria-hidden="true">⚠</span>
                  <span>{flag}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ═══ 08 — What Would Move The Verdict — the counterfactual. Direct
          feedback: "candidates don't care whether they got a 2/5 in Edge
          Case Awareness, they care what impression they left, and what
          would have changed it." ═══ */}
      {d.path_to_next_tier && (
        <div className="space-y-4">
          <SectionHeading n="08" title="What Would Move The Verdict" sub="The one thing that, if demonstrated, would most likely change the outcome." />
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
            <p className="text-sm text-gray-800 leading-relaxed">{d.path_to_next_tier}</p>
          </div>
        </div>
      )}

      {/* ═══ 09 — Action Plan ═══ */}
      <div id="action-plan" className="space-y-6 scroll-mt-20">
        <SectionHeading n="09" title="Action Plan" sub="What to fix before your next round." />
        {d.actionable_feedback?.growth_areas?.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-[10px] font-semibold tracking-wider text-amber-600 uppercase">Growth Areas</h3>
            <ul className="space-y-2">
              {d.actionable_feedback.growth_areas.map((g, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700">
                  <span className="text-amber-500 mt-0.5 shrink-0" aria-hidden="true">→</span>
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {d.actionable_feedback?.top_priority_fix && (
          <div className="rounded-xl border border-gray-900 bg-gray-950 px-5 py-4">
            <h3 className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase mb-2">Before Your Next Interview</h3>
            <p className="text-sm text-white leading-relaxed">{d.actionable_feedback.top_priority_fix}</p>
          </div>
        )}
      </div>

      <div className="pt-2">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
          ← Start another interview
        </Link>
      </div>
    </div>
  );
}
