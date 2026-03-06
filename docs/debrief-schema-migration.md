# Strategy: Debrief Schema Migration (Week 2)

## 1. Goal
Transition the `debriefs.debrief_data` JSONB column from a generic summary to an **Evidence-First AI Report** containing conversational intelligence, 1-5 BARS scoring, and verbatim audit trails.

---

## 2. Target JSON Schema (The "Source of Truth")

```json
{
  "summary": {
    "recommendation": "Strong Hire | Hire | Borderline | No Hire",
    "hire_probability": 82,
    "overall_impression": "2-3 sentences of human-like feedback."
  },
  "metrics": {
    "talk_to_listen_ratio": "72/28",
    "avg_response_latency_sec": 2.1,
    "signal_to_noise_ratio": 0.18,
    "interruption_count": 0
  },
  "skill_analysis": [
    {
      "parameter_id": "TECHNICAL_DEPTH",
      "rating": 4.5,
      "reasoning": "Detailed explanation of why this score was given.",
      "evidence_quotes": [
        "I optimized the SQL query using a composite index...",
        "We used a distributed lock to handle race conditions."
      ]
    }
    // ... total 8 parameters from rubric-researched.ts
  ],
  "behavioral_insights": {
    "star_adherence_score": 85,
    "confidence_level": "High | Medium | Low",
    "red_flags": []
  },
  "actionable_feedback": {
    "strengths": ["Clear architectural foresight", "Concise technical delivery"],
    "growth_areas": ["Could provide more quantifiable results in behavioral answers"],
    "top_priority_fix": "Practice quantifying the 'Result' in the STAR method."
  }
}
```

---

## 3. Database Migration (SQL)

The existing `debriefs` table uses a `JSONB` column. No structural change is needed to the table itself, but we should add the `reasoning` column to store LLM "Shadow Scoring" for founder audits.

```sql
-- Run against Neon Postgres
ALTER TABLE debriefs ADD COLUMN IF NOT EXISTS reasoning JSONB;
COMMENT ON COLUMN debriefs.reasoning IS 'Internal-only: The raw LLM thought process for each signal (Shadow Scoring).';

-- Add outcome tracking (Backlog Item #9)
ALTER TABLE debriefs ADD COLUMN IF NOT EXISTS actual_outcome TEXT; -- 'hired' | 'rejected' | 'pending'
ALTER TABLE debriefs ADD COLUMN IF NOT EXISTS company_type TEXT;    -- 'MAANG' | 'Startup' | 'Service'
```

---

## 4. Implementation Steps (Execution Phase)

### Step 1: Update `lib/groq.ts`
- Replace `DebriefReport` interface with the new schema.
- Rewrite `generateDebrief()` prompt to enforce **Evidence Extraction**.
- **The Prompt Update:** "For every signal score from 1-5, you MUST provide at least 2 verbatim quotes from the transcript as evidence."

### Step 2: Update `components/DebriefReport.tsx`
- Replace the simple strengths/gaps list with a **Grid of 8 Signals**.
- Add a **Radar Chart** (using Recharts) for the 5 highest-weight signals.
- Add a "Conversational Metrics" sidebar (Talk-ratio, SNR).

### Step 3: Calculation Logic
- In the `api/sessions/[sessionId]/debrief` route (or equivalent), use `calculateNormalizedScore()` from `rubric-researched.ts` to compute the `hire_probability` instead of letting the LLM hallucinate it.

---

## 5. Validation Checklist
- [ ] Transcript evidence quotes are actually verbatim.
- [ ] Hire probability matches the weighted math in `rubric-researched.ts`.
- [ ] UI handles missing metrics gracefully for older sessions.
