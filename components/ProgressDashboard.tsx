"use client";

import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { SIGNAL_META, computeSignalTrends, type SkillRating } from "@/lib/signals";
import { RecommendationBadge } from "@/components/SessionHistory";
import SessionHistory from "@/components/SessionHistory";
import { OverallTrendChart, SignalSparkline, HorizontalBarChart } from "@/components/ProgressCharts";

interface AnalyticsSession {
  session_id: string;
  role: string;
  company: string;
  round_type: string;
  company_stage: string | null;
  date: string;
  recommendation: string | null;
  skill_analysis: SkillRating[];
}

function avg(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// Per-signal average rating across every session, plus a simple trend arrow
// comparing the second half of the account's history to the first half —
// not a single-session blip, a real shift over time.
function buildSignalAverages(sessions: AnalyticsSession[]) {
  const bySignal = new Map<string, number[]>();
  for (const s of sessions) {
    for (const skill of s.skill_analysis) {
      if (!bySignal.has(skill.parameter_id)) bySignal.set(skill.parameter_id, []);
      bySignal.get(skill.parameter_id)!.push(skill.rating);
    }
  }
  return [...bySignal.entries()]
    .map(([parameter_id, ratings]) => {
      const mid = Math.ceil(ratings.length / 2);
      const firstHalf = ratings.slice(0, mid);
      const secondHalf = ratings.slice(mid);
      const trend =
        secondHalf.length === 0 || firstHalf.length === 0
          ? "flat"
          : avg(secondHalf) - avg(firstHalf) > 0.4
          ? "up"
          : avg(firstHalf) - avg(secondHalf) > 0.4
          ? "down"
          : "flat";
      return { parameter_id, average: avg(ratings), count: ratings.length, trend };
    })
    .sort((a, b) => a.average - b.average);
}

// One point per session, oldest first — the overall trend line's data.
function buildOverallTrend(sessions: AnalyticsSession[]) {
  return sessions.map((s) => ({
    label: new Date(s.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    sub: `${s.company} · ${s.round_type}`,
    value: avg(s.skill_analysis.map((sk) => sk.rating)),
  }));
}

// Chronological rating series per signal (oldest first) — the shape a
// sparkline draws. Distinct from buildSignalAverages: that one collapses to
// a single number, this one keeps every point.
function buildSignalSeries(sessions: AnalyticsSession[]): Map<string, number[]> {
  const bySignal = new Map<string, number[]>();
  for (const s of sessions) {
    for (const skill of s.skill_analysis) {
      if (!bySignal.has(skill.parameter_id)) bySignal.set(skill.parameter_id, []);
      bySignal.get(skill.parameter_id)!.push(skill.rating);
    }
  }
  return bySignal;
}

// Groups sessions by a key (round type / company stage) and averages the
// overall signal score within each group — only meaningful once there are
// at least 2 sessions in at least 2 distinct groups, otherwise it's just
// restating a single data point as a "breakdown."
function buildGroupBreakdown(sessions: AnalyticsSession[], key: "round_type" | "company_stage") {
  const groups = new Map<string, number[]>();
  for (const s of sessions) {
    const label = s[key];
    if (!label) continue;
    const sessionAvg = avg(s.skill_analysis.map((sk) => sk.rating));
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(sessionAvg);
  }
  const entries = [...groups.entries()]
    .map(([label, avgs]) => ({ label, average: avg(avgs), count: avgs.length }))
    .sort((a, b) => b.average - a.average);
  return entries.length >= 2 ? entries : [];
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-14 text-center space-y-2 max-w-xl mx-auto">
      <p className="text-sm font-semibold text-gray-700">No completed interviews yet</p>
      <p className="text-sm text-gray-500">
        Once you finish your first mock interview, this is where you&apos;ll see your patterns — what&apos;s chronically weak, what&apos;s improving, and how you compare across rounds.
      </p>
    </div>
  );
}

function SparseState({ count }: { count: number }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-6 text-center space-y-1 max-w-xl mx-auto">
      <p className="text-sm font-semibold text-gray-700">
        {count === 1 ? "You've completed 1 interview" : `You've completed ${count} interviews`}
      </p>
      <p className="text-xs text-gray-500">
        Complete a couple more mock interviews and we&apos;ll start surfacing real patterns here — one or two sessions isn&apos;t enough to tell a trend from a one-off yet.
      </p>
    </div>
  );
}

function SignalArrow({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "up") return <span className="text-emerald-600 font-bold" aria-label="improving">↑</span>;
  if (trend === "down") return <span className="text-red-500 font-bold" aria-label="declining">↓</span>;
  return <span className="text-gray-300 font-bold" aria-label="steady">→</span>;
}

// A 2-column grid with a collapse point — without this, a session where
// every signal happens to move the same direction (common early on, when
// even a small jump off a rough first session reads as "improved") turns
// into a full-width wall of 6-8 near-identical cards, which is exactly the
// "looks ugly" failure mode: technically correct, visually monotonous.
function SignalCardGrid({ items, cap = 6 }: { items: { key: string; content: ReactNode }[]; cap?: number }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, cap);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item) => (
          <div key={item.key}>{item.content}</div>
        ))}
      </div>
      {items.length > cap && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-semibold text-gray-500 hover:text-gray-900 underline underline-offset-4 decoration-gray-300 hover:decoration-gray-500 transition-colors"
        >
          {expanded ? "Show fewer" : `Show ${items.length - cap} more`}
        </button>
      )}
    </div>
  );
}

// `initialSessions` lets a DB-free preview (see /dev/progress) inject mock
// data instead of hitting the network — same pattern as DebriefReportView
// taking props directly rather than fetching itself, and as SessionHistory's
// own `initialSessions` prop below. Normal usage omits it and the component
// fetches as before. `sessionHistoryProps` similarly threads mock data down
// into the embedded <SessionHistory> "All Interviews" list.
export default function ProgressDashboard({
  initialSessions,
  sessionHistoryProps,
}: {
  initialSessions?: AnalyticsSession[];
  sessionHistoryProps?: ComponentProps<typeof SessionHistory>;
} = {}) {
  const [sessions, setSessions] = useState<AnalyticsSession[] | null>(initialSessions ?? null);

  useEffect(() => {
    if (initialSessions !== undefined) return;
    fetch("/api/sessions/analytics")
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions ?? []))
      .catch(() => setSessions([]));
  }, [initialSessions]);

  if (sessions === null) {
    return (
      <div className="space-y-3 max-w-2xl mx-auto w-full">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="space-y-10 max-w-2xl mx-auto w-full">
        <EmptyState />
      </div>
    );
  }

  const latest = sessions[sessions.length - 1];
  const earlier = sessions.slice(0, -1);
  const trends = computeSignalTrends(latest.skill_analysis, earlier, "Most recent");
  const chronic = trends.filter((t) => t.recurring);
  const improving = trends.filter((t) => t.improving);
  const signalAverages = buildSignalAverages(sessions);
  const signalSeries = buildSignalSeries(sessions);
  const overallTrend = buildOverallTrend(sessions);
  const roundBreakdown = buildGroupBreakdown(sessions, "round_type");
  const stageBreakdown = buildGroupBreakdown(sessions, "company_stage");

  return (
    <div className="space-y-12 max-w-4xl mx-auto w-full pb-16">
      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">Completed</p>
          <p className="mt-1 text-2xl font-semibold text-gray-950">{sessions.length}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">Most recent read</p>
          <div className="mt-1.5"><RecommendationBadge rec={latest.recommendation} /></div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 col-span-2 sm:col-span-1">
          <p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">Chronically weak</p>
          <p className="mt-1 text-2xl font-semibold text-gray-950">{chronic.length}</p>
        </div>
      </div>

      {sessions.length < 3 && <SparseState count={sessions.length} />}

      {overallTrend.length >= 2 && <OverallTrendChart points={overallTrend} />}

      {(chronic.length > 0 || improving.length > 0) && (
        <div className="space-y-8">
          {chronic.length > 0 && (
            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Still showing up, interview after interview</h2>
                <p className="text-xs text-gray-500 mt-0.5">Weak in your last 2+ sessions and not yet improving — worth deliberately drilling before your next real interview.</p>
              </div>
              <SignalCardGrid
                items={chronic.map((t) => {
                  const meta = SIGNAL_META[t.parameter_id];
                  return {
                    key: t.parameter_id,
                    content: (
                      <div className="h-full rounded-lg border-l-2 border-l-red-300 bg-red-50/40 border border-red-200/70 px-4 py-3">
                        <p className="text-sm font-semibold text-gray-900">{meta?.name ?? t.parameter_id}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{meta?.blurb}</p>
                        <p className="text-xs text-red-700 mt-1 font-medium">Weak for {t.streak} session{t.streak !== 1 ? "s" : ""} in a row</p>
                      </div>
                    ),
                  };
                })}
              />
            </div>
          )}

          {improving.length > 0 && (
            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">What&apos;s getting better</h2>
                <p className="text-xs text-gray-500 mt-0.5">Scored higher this time than your immediately preceding session.</p>
              </div>
              <SignalCardGrid
                items={improving.map((t) => {
                  const meta = SIGNAL_META[t.parameter_id];
                  return {
                    key: t.parameter_id,
                    content: (
                      <div className="h-full rounded-lg border-l-2 border-l-emerald-300 bg-emerald-50/40 border border-emerald-200/70 px-4 py-3">
                        <p className="text-sm font-semibold text-gray-900">{meta?.name ?? t.parameter_id}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{meta?.blurb}</p>
                      </div>
                    ),
                  };
                })}
              />
            </div>
          )}
        </div>
      )}

      {signalAverages.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Your trajectory, signal by signal</h2>
            <p className="text-xs text-gray-500 mt-0.5">Every completed interview, oldest to most recent. The shape is the story — a flat line is a plateau, not just a number.</p>
          </div>
          <SignalCardGrid
            items={signalAverages.map((s) => {
              const meta = SIGNAL_META[s.parameter_id];
              const series = signalSeries.get(s.parameter_id) ?? [];
              return {
                key: s.parameter_id,
                content: (
                  <div className="h-full rounded-lg border border-gray-100 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900">{meta?.name ?? s.parameter_id}</span>
                      <span className="flex items-center gap-1.5 font-mono text-sm font-semibold text-gray-950 tabular-nums">
                        {s.average.toFixed(1)}/5
                        <SignalArrow trend={s.trend as "up" | "down" | "flat"} />
                      </span>
                    </div>
                    <SignalSparkline values={series} />
                  </div>
                ),
              };
            })}
          />
        </div>
      )}

      {(roundBreakdown.length > 0 || stageBreakdown.length > 0) && (
        <div className="grid gap-6 sm:grid-cols-2">
          {roundBreakdown.length > 0 && (
            <div className="space-y-3 rounded-xl border border-gray-100 p-4">
              <h2 className="text-sm font-semibold text-gray-900">By round type</h2>
              <HorizontalBarChart bars={roundBreakdown.map((g) => ({ label: g.label, value: g.average, count: g.count }))} />
            </div>
          )}
          {stageBreakdown.length > 0 && (
            <div className="space-y-3 rounded-xl border border-gray-100 p-4">
              <h2 className="text-sm font-semibold text-gray-900">By company stage</h2>
              <HorizontalBarChart bars={stageBreakdown.map((g) => ({ label: g.label, value: g.average, count: g.count }))} />
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div className="border-t border-gray-100 pt-8">
          <h2 className="text-xs font-semibold tracking-widest text-gray-400 uppercase">All Interviews</h2>
        </div>
        <SessionHistory {...sessionHistoryProps} />
      </div>
    </div>
  );
}
