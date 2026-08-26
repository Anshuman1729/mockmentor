#!/usr/bin/env node
/**
 * PrepSignals — Analytics Baseline
 *
 * Computes the return-usage and completion-funnel numbers Mixpanel will start
 * tracking going forward, but from EXISTING rows — so we get a real "before"
 * baseline immediately instead of waiting weeks for new events to accumulate.
 *
 * Usage: node --env-file=.env.local scripts/analytics-baseline.mjs
 */

import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set. Run with: node --env-file=.env.local scripts/analytics-baseline.mjs");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const [{ total_users }] = await sql`
  SELECT COUNT(DISTINCT user_email) AS total_users FROM sessions
`;

const [{ total_sessions }] = await sql`
  SELECT COUNT(*) AS total_sessions FROM sessions
`;

const [{ completed_sessions }] = await sql`
  SELECT COUNT(*) AS completed_sessions FROM sessions WHERE status = 'completed'
`;

const [{ debriefed_sessions }] = await sql`
  SELECT COUNT(*) AS debriefed_sessions FROM sessions s
  JOIN debriefs d ON d.session_id = s.id
`;

// Return usage: users whose 2nd+ session exists at all (regardless of completion)
const [{ returning_users }] = await sql`
  SELECT COUNT(*) AS returning_users FROM (
    SELECT user_email FROM sessions GROUP BY user_email HAVING COUNT(*) >= 2
  ) t
`;

const [{ drilled_sessions }] = await sql`
  SELECT COUNT(DISTINCT session_id) AS drilled_sessions FROM calibration_loops
`;

const pct = (n, d) => (Number(d) === 0 ? "n/a" : `${((Number(n) / Number(d)) * 100).toFixed(1)}%`);

console.log("PrepSignals — Analytics Baseline (computed from existing DB rows)");
console.log("=".repeat(66));
console.log(`Total distinct users:        ${total_users}`);
console.log(`Total sessions created:      ${total_sessions}`);
console.log(`  → completed:               ${completed_sessions} (${pct(completed_sessions, total_sessions)} of created)`);
console.log(`  → debriefed:               ${debriefed_sessions} (${pct(debriefed_sessions, total_sessions)} of created)`);
console.log("");
console.log(`Returning users (2+ sessions): ${returning_users} (${pct(returning_users, total_users)} of all users)`);
console.log("");
console.log(`Sessions with a calibration_loops row: ${drilled_sessions}`);
console.log("  Note: this is NOT drill-loop usage — calibration_loops logs on every");
console.log("  debrief generation, unrelated to POST /api/interview/drill. There is");
console.log("  no historical drill-usage data; that number only starts existing once");
console.log("  the new drill_used Mixpanel event has been live for a while.");
