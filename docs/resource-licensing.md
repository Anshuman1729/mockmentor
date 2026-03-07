# Resource Database & Licensing Analysis (PrepSignals)

This document tracks all external datasets, repositories, and articles used to inform the PrepSignals scoring logic and question database.

## 1. High-Freedom Resources (Safe for Commercial/Derivative Use)
These resources are used for **direct question ingestion** and **logic implementation**.

| Source | License | Usage in PrepSignals |
| :--- | :--- | :--- |
| [realabbas/big-companies-interview-questions](https://github.com/realabbas/big-companies-interview-questions) | **CC0-1.0** | **Direct Ingestion:** Used to populate the company-specific question database. |
| [cockroachlabs/open-sourced-interview-process](https://github.com/cockroachlabs/open-sourced-interview-process) | **CC0-1.0** | **Logic Refinement:** Used for the 1-5 BARS scale and "Evidence-Based" scoring logic. |

---

## 2. Restricted Resources (Fair Use / Structural Reference Only)
These repositories **do not have a license**. To avoid copyright liability, we **MUST NOT** copy their text or code directly. We use them only for high-level structural inspiration (e.g., "how they categorize roles").

| Source | License | Risk Level | PrepSignals Policy |
| :--- | :--- | :--- | :--- |
| [Appsilon/awesome-interview-questions](https://github.com/Appsilon/awesome-interview-questions) | None | Medium | **Structural only:** Used to understand Senior vs. Junior mapping. Do not copy questions. |
| [GoodNotes/interviews](https://github.com/GoodNotes/interviews) | None | Medium | **Process only:** Used to understand the "Passion Talk" concept. Do not copy exercises. |
| [HireAbo/5000-jobs](https://github.com/HireAbo/awesome-interview-questions-5000-jobs) | None | Medium | **Domain only:** Used to see which jobs are high-demand. Do not ingest their DB. |
| [blentz100/Interview-Questions](https://github.com/blentz100/Interview-Questions) | None | Medium | **General ideas:** Used for topic categorization only. |

---

## 3. Educational / Article References (Logic-Only)
These are articles used to ground our "Gold Standard" metrics. They are used under "Fair Use" for logic and strategy, not for content redistribution.

- **Noota Interview Metrics Guide:** Used for "Talk-to-Listen Ratio" and "Response Latency" logic.
- **BarRaiser / FloCareer Research:** Used for the "STAR Method Analysis" and "Signal-to-Noise Ratio" definitions.
- **Forbes / Glassdoor Research:** Used for identifying top-tier company "Branded Traits" (Googleyness, Amazon LPs).

---

## 4. Compliance Guidelines for Implementation (for Claude Code)

1.  **Do not scrape:** Never perform automated scraping of the "Restricted" GitHub repos.
2.  **Clean Room Logic:** When implementing the "Seniority Modifiers" or "Passion Talk" logic, do not reference the original source code. Write the implementation from scratch based on the *strategy* discussed.
3.  **Attribution:** While not strictly required for CC0, we should maintain this document as an audit trail of where our logic comes from to ensure transparency.
4.  **License Addition:** If we ever redistribute our own question database, we must ensure it only contains questions from CC0 sources or original content.
