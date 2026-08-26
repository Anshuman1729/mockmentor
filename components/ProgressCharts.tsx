"use client";

import { useId, useState } from "react";

// Hand-rolled SVG charts for /progress — "show, don't tell": a rating going
// 2 → 2 → 3 → 4 across sessions is a shape, not just an up-arrow next to a
// number. No charting library; these are single-series magnitude/sequential
// data (a rating over time, a score by category), which the dataviz skill
// scopes out of categorical-palette validation — one hue is the correct,
// safe default here. Domain is fixed at 1–5 (the rubric's actual scale) so
// the shape is never a zoomed-in illusion of volatility.

const DOMAIN: [number, number] = [1, 5];

function yFor(value: number, height: number, domain: [number, number] = DOMAIN): number {
  const [min, max] = domain;
  const clamped = Math.min(max, Math.max(min, value));
  return height - ((clamped - min) / (max - min)) * height;
}

function linePath(values: number[], width: number, height: number, domain?: [number, number]): string {
  if (values.length === 0) return "";
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  return values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(2)} ${yFor(v, height, domain).toFixed(2)}`)
    .join(" ");
}

function statusColor(value: number): string {
  if (value <= 2.5) return "#ef4444"; // red-500 — matches the app's existing weak/flag color
  if (value < 4) return "#f59e0b"; // amber-500 — watch
  return "#10b981"; // emerald-500 — strong
}

// The headline chart: overall average signal score per session, over time.
// The one chart a first-timer should be able to read in two seconds:
// "is the line going up." Points are focusable + hoverable — same tooltip
// content either way — and every value is also visible as plain text below
// (the existing "All Interviews" list), so nothing is gated behind hover.
export function OverallTrendChart({
  points,
}: {
  points: { label: string; sub: string; value: number }[];
}) {
  const [active, setActive] = useState<number | null>(null);
  const width = 100;
  const height = 36;
  const values = points.map((p) => p.value);
  const path = linePath(values, width, height);
  const areaPath = `${path} L ${width} ${height} L 0 ${height} Z`;
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const gradId = useId();

  if (points.length < 2) return null;

  const activePoint = active !== null ? points[active] : null;
  const activeX = active !== null ? active * step : 0;

  return (
    <div className="relative rounded-xl border border-gray-100 bg-white p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">Overall score over time</p>
        <p className="font-mono text-sm font-semibold text-gray-950 tabular-nums">
          {values[values.length - 1].toFixed(1)}/5
        </p>
      </div>
      <div className="relative mt-3">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-24 overflow-visible">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#030712" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#030712" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Recessive gridlines at the 1 and 5 domain edges */}
          <line x1="0" y1={height} x2={width} y2={height} stroke="#e5e7eb" strokeWidth="0.4" />
          <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
          <path d={path} fill="none" stroke="#030712" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={i * step}
              cy={yFor(p.value, height)}
              r={i === active ? 2.6 : 1.8}
              fill="#030712"
              stroke="white"
              strokeWidth="1"
              tabIndex={0}
              role="button"
              aria-label={`${p.label}: ${p.value.toFixed(1)} out of 5`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              style={{ cursor: "pointer" }}
            />
          ))}
        </svg>
        {activePoint && (
          <div
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-gray-950 px-2.5 py-1.5 text-xs text-white shadow-lg"
            style={{ left: `${activeX}%` }}
          >
            <p className="font-semibold">{activePoint.value.toFixed(1)}/5</p>
            <p className="text-[10px] text-gray-300">{activePoint.label} · {activePoint.sub}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Small-multiple sparkline for one signal's trajectory across sessions —
// used in a grid (see SignalCardGrid in ProgressDashboard) so 8 signals
// read as 8 shapes at a glance instead of 8 rows of "average · arrow".
export function SignalSparkline({ values }: { values: number[] }) {
  const width = 100;
  const height = 24;
  const path = linePath(values, width, height);
  const color = statusColor(values[values.length - 1]);
  const step = values.length > 1 ? width / (values.length - 1) : 0;

  if (values.length < 2) return null;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-8 mt-2 overflow-visible">
      <path d={path} fill="none" stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      {values.map((v, i) => {
        const isLast = i === values.length - 1;
        return (
          <circle
            key={i}
            cx={i * step}
            cy={yFor(v, height)}
            r={isLast ? 2.2 : 1.3}
            fill={isLast ? color : "white"}
            stroke={color}
            strokeWidth="1"
          />
        );
      })}
    </svg>
  );
}

// Horizontal bar chart for the round-type / company-stage breakdowns —
// "compare magnitude" is a bar chart's job, not a table of numbers. Single
// hue (gray-950), value labeled at the bar's tip per the mark spec.
export function HorizontalBarChart({
  bars,
}: {
  bars: { label: string; value: number; count: number }[];
}) {
  const [min, max] = DOMAIN;
  return (
    <div className="space-y-3">
      {bars.map((b) => {
        const pct = ((Math.min(max, Math.max(min, b.value)) - min) / (max - min)) * 100;
        return (
          <div key={b.label} className="space-y-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium text-gray-700">{b.label}</span>
              <span className="text-gray-400">{b.count} session{b.count !== 1 ? "s" : ""}</span>
            </div>
            <div className="relative h-3 rounded-full bg-gray-100" title={`${b.value.toFixed(1)}/5`}>
              <div
                className="h-full rounded-full bg-gray-950 transition-all"
                style={{ width: `${Math.max(pct, 4)}%` }}
              />
              <span
                className="absolute top-1/2 -translate-y-1/2 text-[10px] font-mono font-semibold tabular-nums"
                style={{
                  left: pct > 85 ? undefined : `calc(${Math.max(pct, 4)}% + 6px)`,
                  right: pct > 85 ? "6px" : undefined,
                  color: pct > 85 ? "white" : "#111827",
                }}
              >
                {b.value.toFixed(1)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
