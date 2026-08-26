// Shared numbered section header used across the debrief report and any
// section appended after it (e.g. PostInterviewFeedback) — split out of
// DebriefReport.tsx so both can use it without a circular import.
export function SectionHeading({ n, title, sub }: { n: string; title: string; sub?: string }) {
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
