-- MockMentor Database Schema
-- Source of truth: keep in sync with Tech Architecture doc Section 3
-- Run against Neon project: tiny-haze-91379160 / branch: br-dry-glade-aj2knn42

-- ─── sessions ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email  TEXT        NOT NULL,
  role        TEXT        NOT NULL,
  company     TEXT        NOT NULL,
  yoe         INTEGER     NOT NULL,
  round_type  TEXT        NOT NULL,  -- screening | technical | final | behavioural
  jd_content  TEXT,
  background  TEXT,                  -- user's profile/background (TMAY step)
  status      TEXT        NOT NULL DEFAULT 'active',  -- active | completed
  created_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
  company_stage TEXT,
  candidate_questions_asked INTEGER DEFAULT 0,
  domain      TEXT
);

-- ─── qa_pairs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qa_pairs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_number INTEGER     NOT NULL,
  question        TEXT        NOT NULL,
  answer          TEXT,               -- NULL until user submits
  created_at      TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ─── debriefs ────────────────────────────────────────────────────────────────
-- debrief_data JSONB contract:
-- {
--   "overall_summary": string,
--   "hire_probability": number (0-100),
--   "hire_recommendation": "Strong Hire" | "Borderline" | "No Hire",
--   "improvement_condition": string,
--   "signals": [
--     { "name": string, "score": number (0-10), "status": "Strong"|"Moderate"|"Weak", "explanation": string }
--   ],
--   "strengths": [{ "title": string, "explanation": string }],
--   "weaknesses": [{ "title": string, "explanation": string, "fix": string }],
--   "improvement_actions": [string]
-- }
CREATE TABLE IF NOT EXISTS debriefs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  debrief_data JSONB      NOT NULL,
  created_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ─── companies ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  industry  TEXT
);

-- ─── question_bank ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS question_bank (
  id               UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       TEXT      REFERENCES companies(id),
  question_text    TEXT      NOT NULL,
  round_type       TEXT,
  tags             TEXT[],
  domain           TEXT[],
  difficulty       INTEGER,
  ideal_keywords   TEXT[],
  expected_signals TEXT[]
);

CREATE INDEX IF NOT EXISTS idx_domain ON question_bank USING GIN (domain);

-- ─── calibration_loops ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calibration_loops (
  id                UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID      REFERENCES sessions(id) ON DELETE CASCADE,
  ai_score          FLOAT,
  llm_reasoning     JSONB,
  discrepancy_score FLOAT,
  actual_outcome    TEXT
);

-- ─── users (to add with Clerk integration — Week 1) ──────────────────────────
-- After adding this table:
--   1. sessions.user_email → sessions.user_id UUID FK → users.id
--   2. Remove user_email from sessions
--   3. Update lib/groq.ts prompts and all API routes accordingly
--
-- CREATE TABLE IF NOT EXISTS users (
--   id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
--   clerk_id         TEXT        UNIQUE NOT NULL,
--   email            TEXT        UNIQUE NOT NULL,
--   plan             TEXT        NOT NULL DEFAULT 'free',  -- free | sprint | deepdive
--   plan_expires_at  TIMESTAMP,    -- NULL for free, date for paid
--   created_at       TIMESTAMP   NOT NULL DEFAULT NOW()
-- );
