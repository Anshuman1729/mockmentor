import ProgressDashboard from "@/components/ProgressDashboard";

// Dev-only, DB-free preview of /progress — realistic mock data spanning
// several sessions so the chronic/improving/breakdown logic can be visually
// checked without a live database. See /dev/debrief for the same pattern.

const MOCK_ANALYTICS_SESSIONS = [
  {
    session_id: "mock-a",
    role: "Senior Backend Engineer",
    company: "Datadog",
    round_type: "Technical Screen",
    company_stage: "Series B",
    date: "2026-07-20T10:00:00Z",
    recommendation: "Borderline",
    skill_analysis: [
      { parameter_id: "TECHNICAL_DEPTH", rating: 2 },
      { parameter_id: "COMMUNICATION_SNR", rating: 2 },
      { parameter_id: "STAR_ALIGNMENT", rating: 2 },
      { parameter_id: "EDGE_CASE_MASTERY", rating: 3 },
      { parameter_id: "OWNERSHIP_ETHICS", rating: 4 },
    ],
  },
  {
    session_id: "mock-b",
    role: "Senior Backend Engineer",
    company: "Notion",
    round_type: "Technical Deep Dive",
    company_stage: "Series B",
    date: "2026-08-01T10:00:00Z",
    recommendation: "Borderline",
    skill_analysis: [
      { parameter_id: "TECHNICAL_DEPTH", rating: 2 },
      { parameter_id: "COMMUNICATION_SNR", rating: 2 },
      { parameter_id: "STAR_ALIGNMENT", rating: 3 },
      { parameter_id: "EDGE_CASE_MASTERY", rating: 3 },
      { parameter_id: "OWNERSHIP_ETHICS", rating: 4 },
    ],
  },
  {
    session_id: "mock-c",
    role: "Senior Backend Engineer",
    company: "Stripe",
    round_type: "Behavioral",
    company_stage: "Public",
    date: "2026-08-10T10:00:00Z",
    recommendation: "Hire",
    skill_analysis: [
      { parameter_id: "TECHNICAL_DEPTH", rating: 3 },
      { parameter_id: "COMMUNICATION_SNR", rating: 4 },
      { parameter_id: "STAR_ALIGNMENT", rating: 4 },
      { parameter_id: "EDGE_CASE_MASTERY", rating: 3 },
      { parameter_id: "OWNERSHIP_ETHICS", rating: 5 },
    ],
  },
  {
    session_id: "mock-d",
    role: "Senior Backend Engineer",
    company: "Anthropic",
    round_type: "Technical Deep Dive",
    company_stage: "Series B",
    date: "2026-08-22T10:00:00Z",
    recommendation: "Hire",
    skill_analysis: [
      { parameter_id: "TECHNICAL_DEPTH", rating: 2 },
      { parameter_id: "COMMUNICATION_SNR", rating: 3 },
      { parameter_id: "STAR_ALIGNMENT", rating: 3 },
      { parameter_id: "EDGE_CASE_MASTERY", rating: 2 },
      { parameter_id: "OWNERSHIP_ETHICS", rating: 4 },
      { parameter_id: "PROBLEM_SOLVING", rating: 2 },
      { parameter_id: "ADAPTABILITY_GROWTH", rating: 3 },
      { parameter_id: "RESULT_ORIENTATION", rating: 3 },
    ],
  },
  // Every signal improving at once — a real pattern in early usage (a rough
  // first session makes almost anything after it read as "improved"), and
  // exactly the case that stress-tests SignalCardGrid's cap/expand instead
  // of dumping 8 near-identical cards down the page.
  {
    session_id: "mock-e",
    role: "Senior Backend Engineer",
    company: "Figma",
    round_type: "Technical Deep Dive",
    company_stage: "Series B",
    date: "2026-08-25T10:00:00Z",
    recommendation: "Hire",
    skill_analysis: [
      { parameter_id: "TECHNICAL_DEPTH", rating: 3 },
      { parameter_id: "COMMUNICATION_SNR", rating: 4 },
      { parameter_id: "STAR_ALIGNMENT", rating: 4 },
      { parameter_id: "EDGE_CASE_MASTERY", rating: 3 },
      { parameter_id: "OWNERSHIP_ETHICS", rating: 5 },
      { parameter_id: "PROBLEM_SOLVING", rating: 4 },
      { parameter_id: "ADAPTABILITY_GROWTH", rating: 4 },
      { parameter_id: "RESULT_ORIENTATION", rating: 4 },
    ],
  },
];

const MOCK_SESSION_HISTORY_ROWS = MOCK_ANALYTICS_SESSIONS.map((s) => ({
  id: s.session_id,
  role: s.role,
  company: s.company,
  yoe: 5,
  round_type: s.round_type,
  created_at: s.date,
  status: "completed",
  hire_recommendation: s.recommendation,
})).reverse();

export default function DevProgressPreview() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-950">My Progress</h1>
        <p className="text-gray-500 text-sm">
          Patterns across all your practice interviews — what&apos;s chronically weak, what&apos;s improving, and how you compare across rounds.
        </p>
      </div>
      <ProgressDashboard
        initialSessions={MOCK_ANALYTICS_SESSIONS}
        sessionHistoryProps={{ initialSessions: MOCK_SESSION_HISTORY_ROWS }}
      />
    </div>
  );
}
