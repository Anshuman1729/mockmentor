#!/usr/bin/env node
/**
 * MockMentor — Test Debrief Seeder
 *
 * Usage (from mockmentor/ directory):
 *   npm run test:debrief           → inserts mock debrief directly (no LLM, instant)
 *   npm run test:debrief:live      → inserts QA pairs, calls real API (dev server must be running)
 *   npm run test:debrief -- --clean → deletes all test sessions before seeding
 *
 * Prints a localhost URL you can visit immediately.
 */

import { neon } from "@neondatabase/serverless";
import { randomUUID } from "crypto";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set. Run with: node --env-file=.env.local scripts/seed-test-debrief.mjs");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const live  = process.argv.includes("--live");
const clean = process.argv.includes("--clean");

// ---- Test Session ----
const SESSION_ID = randomUUID();
const SESSION = {
  id:         SESSION_ID,
  user_email: "test@mockmentor.dev",
  role:       "Product Manager",
  company:    "Acme Corp",
  yoe:        3,
  round_type: "technical",
  jd_content: `We are looking for a Senior Product Manager to lead our core product.
You will own the roadmap, work cross-functionally with engineering and design, and drive adoption.
Requirements: 3+ years PM experience, data-driven mindset, experience with B2B SaaS.`,
  background: `I am a PM with 3 years at a B2B SaaS startup.
I led the launch of our analytics dashboard which increased retention by 23%.
I work closely with engineering and have experience with SQL and Mixpanel.`,
  status: "completed",
};

const QA_PAIRS = [
  {
    question_number: 1,
    question: "Tell me about yourself and your PM background.",
    answer:   "I have been a PM at a B2B SaaS startup for 3 years. I led the launch of our analytics dashboard, which increased user retention by 23% and reduced churn by 11%. Before that I was an analyst, so I am very comfortable in data.",
  },
  {
    question_number: 2,
    question: "How do you prioritize features when stakeholders have conflicting priorities?",
    answer:   "I use RICE scoring combined with customer impact data from Mixpanel and NPS surveys. I map features against our quarterly OKRs and then present the trade-offs to stakeholders with data to back my recommendation. I try to depersonalise the conversation — it's not my opinion vs yours, it's what the data says.",
  },
  {
    question_number: 3,
    question: "Describe a time you had to make a difficult product decision with incomplete data.",
    answer:   "We had to decide whether to build a native mobile app or keep investing in our responsive web. We had limited mobile usage data. I ran a 2-week experiment — we sent a survey to churned users asking if mobile was a factor. 31% said yes. That was enough signal to greenlight a mobile MVP. It shipped in Q3 and contributed to a 15% reduction in churn in that cohort.",
  },
  {
    question_number: 4,
    question: "How do you work with engineers who push back on your roadmap?",
    answer:   "I try to understand their concern first — usually it's either technical debt, unclear scope, or timeline pressure. I bring engineers into discovery early so they're not surprised. If there's a genuine disagreement I ask them to help me understand the risk and we find a middle ground. I rarely override engineering judgment on technical feasibility.",
  },
  {
    question_number: 5,
    question: "Tell me about a feature you built that failed.",
    answer:   "We shipped a team commenting feature inside reports. I was convinced users wanted it based on a few customer interviews. After 3 months, under 4% of users had used it. I killed it, wrote a post-mortem, and reallocated the engineering time. The lesson was that a few loud customers don't represent the silent majority.",
  },
];

// ---- Mock Debrief (pre-built, no LLM needed) ----
const MOCK_DEBRIEF = {
  summary: {
    recommendation:     "Hire",
    hire_probability:   68,
    overall_impression: "Strong data-driven PM with clear ownership and structured communication. Demonstrates real impact through quantified results in most answers. Edge case awareness and deep technical trade-off thinking are the clearest gaps to close before a Strong Hire threshold.",
  },
  metrics: {
    talk_to_listen_ratio:    "73/27",
    avg_response_latency_sec: 2.0,
    signal_to_noise_ratio:    0.19,
    interruption_count:       0,
  },
  skill_analysis: [
    {
      parameter_id:    "TECHNICAL_DEPTH",
      rating:           3,
      reasoning:        "Comfortable with analytics tools and data, and references SQL and Mixpanel confidently. But does not discuss technical trade-offs at an architectural level — stops at 'what' without explaining 'why'.",
      evidence_quotes:  ["I am very comfortable in data", "I use RICE scoring combined with customer impact data from Mixpanel"],
    },
    {
      parameter_id:    "PROBLEM_SOLVING",
      rating:           4,
      reasoning:        "Proactively ran an experiment to resolve ambiguity on the mobile vs web decision. Framed the problem clearly before proposing a solution. Did not wait for perfect data.",
      evidence_quotes:  ["I ran a 2-week experiment — we sent a survey to churned users", "31% said yes. That was enough signal to greenlight a mobile MVP"],
    },
    {
      parameter_id:    "STAR_ALIGNMENT",
      rating:           4,
      reasoning:        "Consistently follows a clear Situation → Action → Result structure. Most stories have quantified results. The commenting feature failure story was especially well-structured.",
      evidence_quotes:  ["After 3 months, under 4% of users had used it. I killed it", "contributed to a 15% reduction in churn in that cohort"],
    },
    {
      parameter_id:    "COMMUNICATION_SNR",
      rating:           4,
      reasoning:        "Answer-first pattern throughout. Concise without sacrificing substance. The depersonalisation framing ('it's not my opinion vs yours') showed executive communication instincts.",
      evidence_quotes:  ["I try to depersonalise the conversation — it's not my opinion vs yours, it's what the data says", "I bring engineers into discovery early so they're not surprised"],
    },
    {
      parameter_id:    "RESULT_ORIENTATION",
      rating:           4,
      reasoning:        "Three of five answers had specific metrics. 23% retention lift, 15% churn reduction, 31% survey signal. One answer (stakeholder prioritisation) was process-heavy without a stated outcome.",
      evidence_quotes:  ["increased user retention by 23% and reduced churn by 11%", "contributed to a 15% reduction in churn in that cohort"],
    },
    {
      parameter_id:    "OWNERSHIP_ETHICS",
      rating:           5,
      reasoning:        "Killed a feature they championed, wrote a post-mortem, and framed it as a learning — not a blame exercise. This is textbook ownership. Explicitly avoided overriding engineering judgment.",
      evidence_quotes:  ["I killed it, wrote a post-mortem, and reallocated the engineering time", "I rarely override engineering judgment on technical feasibility"],
    },
    {
      parameter_id:    "ADAPTABILITY_GROWTH",
      rating:           4,
      reasoning:        "Post-mortem after the commenting failure shows genuine reflection. Lesson was insightful and specific ('a few loud customers don't represent the silent majority'). Did not show a learning arc across the session.",
      evidence_quotes:  ["The lesson was that a few loud customers don't represent the silent majority", "I wrote a post-mortem"],
    },
    {
      parameter_id:    "EDGE_CASE_MASTERY",
      rating:           2,
      reasoning:        "No proactive mention of failure modes, risks, or what could go wrong in any of the proposed approaches. The mobile MVP decision lacked any discussion of what happens if the experiment is wrong.",
      evidence_quotes:  ["31% said yes. That was enough signal", "I try to understand their concern first"],
    },
  ],
  behavioral_insights: {
    star_adherence_score: 78,
    confidence_level:     "Medium",
    red_flags:            [],
  },
  actionable_feedback: {
    strengths: [
      "Consistently quantifies impact — 3 of 5 answers had specific metrics",
      "Demonstrated textbook ownership by killing a feature and doing a post-mortem",
      "Answer-first, low-filler communication with strong executive presence instincts",
    ],
    growth_areas: [
      "Edge case and risk awareness — never proactively raised what could go wrong",
      "Technical depth at trade-off level — goes wide but not deep on why architectural choices matter",
    ],
    top_priority_fix:
      "In every answer, add one sentence about what could go wrong and how you'd catch it early. Interviewers at senior level expect proactive risk thinking, not just solution-building.",
  },
};

// ---- Runner ----

async function main() {
  if (clean) {
    const deleted = await sql`DELETE FROM sessions WHERE user_email = 'test@mockmentor.dev' RETURNING id`;
    console.log(`Cleaned ${deleted.length} existing test session(s).`);
  }

  // Insert session
  await sql`
    INSERT INTO sessions (id, user_email, role, company, yoe, round_type, jd_content, background, status)
    VALUES (
      ${SESSION.id}::uuid,
      ${SESSION.user_email},
      ${SESSION.role},
      ${SESSION.company},
      ${SESSION.yoe},
      ${SESSION.round_type},
      ${SESSION.jd_content},
      ${SESSION.background},
      ${SESSION.status}
    )
  `;

  // Insert QA pairs
  for (const qa of QA_PAIRS) {
    await sql`
      INSERT INTO qa_pairs (session_id, question_number, question, answer)
      VALUES (${SESSION.id}::uuid, ${qa.question_number}, ${qa.question}, ${qa.answer})
    `;
  }

  if (live) {
    // Requires dev server running on :3000
    console.log("Calling /api/interview/debrief (LLM + rubric scoring)...");
    const res = await fetch("http://localhost:3000/api/interview/debrief", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ sessionId: SESSION.id }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("API error:", err);
      process.exit(1);
    }
    console.log("Debrief generated via real LLM + deterministic rubric scoring.\n");
  } else {
    // Insert mock debrief directly — no LLM call
    await sql`
      INSERT INTO debriefs (session_id, debrief_data)
      VALUES (${SESSION.id}::uuid, ${JSON.stringify(MOCK_DEBRIEF)}::jsonb)
    `;
    console.log("Mock debrief inserted (no LLM call).\n");
  }

  console.log("Test session ready:");
  console.log(`  http://localhost:3000/debrief/${SESSION.id}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
