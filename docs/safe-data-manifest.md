# Safe Data Manifest (PrepSignals)

This is the "Green List" of authorized resources that PrepSignals can use **without legal obligations or restrictions**. These sources are either Public Domain (CC0) or original intellectual property derived through clean-room research.

---

## 1. Primary Data Sources (CC0 - Public Domain)
*These can be directly ingested into the PrepSignals database for question generation.*

### **A. Big Companies Interview Questions**
- **Source:** [realabbas/big-companies-interview-questions](https://github.com/realabbas/big-companies-interview-questions)
- **License:** **CC0-1.0** (No rights reserved)
- **Scope:** 200+ Companies, 10,000+ Questions.
- **Top Targets for Ingestion:**
  - **Amazon:** 833 Questions (Leadership Principles + Technical)
  - **Google:** 500+ Questions (GCA + Technical)
  - **Microsoft:** 400+ Questions
  - **Meta:** 300+ Questions
- **Usage Strategy:** Map `company` name in PrepSignals sessions to these folders to pull "Real World" seed questions.

### **B. Cockroach Labs Interview Process**
- **Source:** [cockroachlabs/open-sourced-interview-process](https://github.com/cockroachlabs/open-sourced-interview-process)
- **License:** **CC0-1.0** (No rights reserved)
- **Scope:** Engineering rubrics, 1.0-4.0 scoring scale, "Curveball" exercise concepts.
- **Usage Strategy:** Adopted the 4-point (converted to 5-point BARS) grading logic and "Hiring Committee" evidence-first model.

---

## 2. Derived Intellectual Property (PrepSignals Original)
*These are logic-only concepts developed in this session. They are legally "clean" because they represent original implementation of industry concepts.*

### **A. The "New 8" Universal Signals**
1. Technical Depth
2. Problem Solving
3. STAR Alignment
4. Communication (SNR)
5. Result Orientation
6. Ownership & Ethics
7. Adaptability & Growth
8. Edge Case Mastery

### **B. Conversational Intelligence Formulas**
- **Signal-to-Noise Ratio (SNR):** `(High_Signal_Words / Total_Words)`
- **Response Latency Thresholds:** 1-3s (Ideal), >5s (Hesitation).
- **Talk-to-Listen Ratio:** 72/28 (Ideal candidate-to-interviewer balance).

---

## 3. Usage Guidelines for Developers
1. **Question Ingestion:** You may copy-paste or programmatically ingest any content from **Category 1** (realabbas, cockroachlabs).
2. **Logic Implementation:** You may use any math or logic defined in **Category 2** without attribution.
3. **Avoidance:** Do not use content from unlicensed repositories (GoodNotes, Appsilon, HireAbo) in this manifest. If you need inspiration from them, treat them as "read-only" research and re-write the logic from scratch.

---
**Status:** ✅ Fully Authorized for Commercial Use.
