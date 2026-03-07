# PrepSignals Engine: The Science of Automated Interview Calibration

> **Status:** Internal/Founder Confidential  
> **Domain:** Business Logic, Psychometrics, and NLP Strategy  
> **Author:** Founder / Solo-preneur Strategy

---

## 1. Executive Summary: The "Vibe-to-Value" Problem
Most AI interview tools simply "summarize" a transcript. This is a low-value "vibe check." 
**PrepSignals** operates as a **Calibration Engine**. It uses **Behaviorally Anchored Rating Scales (BARS)** and **Conversational Intelligence (CI)** to quantify subjective performance. 

This document explains the math and logic inside `rubric-researched.ts`.

---

## 2. The 8 Signal Architecture (The "What")
We evaluate candidates across 8 distinct dimensions. This prevents "Halo Bias" (where one good answer makes the whole interview seem good).

| Signal | Logic | Target Metric |
| :--- | :--- | :--- |
| **Technical Depth** | SME Status / Density | Technical Keyword Frequency |
| **Problem Solving** | Adaptive Reasoning | Curveball Recovery Rate |
| **STAR Alignment** | Narrative Structure | S-T-A-R Component Presence |
| **Communication** | Signal-to-Noise Ratio (SNR) | Information Density per 100 words |
| **Result Orientation** | Impact focus | Quantifiable "R" (%, $, Time) |
| **Ownership** | Bias for Action | Initiative-based Evidence |
| **Adaptability** | Growth Mindset | Feedback Incorporation Speed |
| **Edge Case Mastery** | Risk Awareness | Failure-mode Identification |

---

## 3. Conversational Intelligence (CI) Math
Before we grade the *content*, we grade the *delivery*. This is our "Behavioral Proxy."

### **A. Signal-to-Noise Ratio (SNR)**
**The Math:**  
$$SNR = \frac{\text{Signal Words (Keywords + Verbs + Results)}}{\text{Total Word Count}}$$

*   **Logic:** A high word count is a **liability**, not an asset. 
*   **The Benchmarks:**
    *   **SNR > 0.15:** Executive Presence (Concise/High Signal).
    *   **SNR < 0.05:** Rambling (Low Signal/Filler-heavy).

### **B. Talk-to-Listen Ratio (TLR)**
**The Math:**  
$$TLR = \frac{\text{Candidate Talk Time}}{\text{Total Interview Time}}$$

*   **The "Gold Standard":** **60% – 75%**
*   **The "Ceiling" (>78%):** Flagged as **Monologuing**. It indicates a lack of "Reading the Room" (Emotional Intelligence).
*   **The "Floor" (<55%):** Flagged as **Passive**. The candidate is "pulling teeth"; they aren't providing enough data for a "Hire" decision.

### **C. Response Latency (Hesitation)**
**The Math:**  
$$\text{Latency} = T_{\text{StartAnswer}} - T_{\text{EndQuestion}}$$

*   **1.2s – 2.0s:** **Ideal (Thoughtful).** Indicates the candidate is processing, not just reciting a script.
*   **> 5.0s:** **Hesitant.** Indicates a lack of preparedness or a "knowledge gap."

---

## 4. The Scoring Logic: Weighted Normalization
We don't just "average" the 1-5 scores. We use **Weighted Normalization** because some signals are more important than others.

### **The Formula:**
$$\text{Hire Probability} = \frac{\sum (\text{Score}_i \times \text{Weight}_i \times \text{Modifier}_{\text{seniority}})}{\sum (5 \times \text{Weight}_i \times \text{Modifier}_{\text{seniority}})} \times 100$$

### **Seniority Modifiers (The "Seniority Gap")**
We adjust weights based on the role level. 

*   **Junior Candidate:** We weigh **Technical Depth (1.2x)** higher. We assume they are still learning "Ownership" and "Edge Cases."
*   **Senior Candidate:** We weigh **Edge Case Mastery (1.5x)** and **Result Orientation (1.3x)** much higher. We *assume* they have Technical Depth, so we lower its weight to **0.8x**. 

**Visual Example:**
- **Junior:** High score in Coding = 90% Hire Prob.
- **Senior:** High score in Coding + Low score in Edge Cases = **65% Hire Prob.** (Because a Senior *must* see the risks).

---

## 5. Visualizing the "Interview Shape" (Radar Chart)
We use a **5-axis Radar Chart** for the top 5 signals. This reveals the candidate's **"Archetype."**

1.  **The "Expert IC":** Pointy toward Technical Depth and Problem Solving.
2.  **The "Leader":** Pointy toward Communication, Ownership, and Results.
3.  **The "Ideal Hire":** A balanced, large pentagon.

**The "Gap" Visualization:** We overlay the **User's Shape** on top of the **Ideal Hire Shape** (Gray). The "Missing Area" is the roadmap for their improvement.

---

## 6. Eliminating Subjectivity (The Evidence Anchor)
To prevent the AI from "hallucinating" a high score, we use a **"Clean-Room Audit."**

1.  **Step 1:** AI extracts **Verbatim Quotes** (The Evidence).
2.  **Step 2:** AI maps those quotes to a **Behavioral Anchor (BARS)**.
3.  **Step 3:** The **Scoring Logic** (Typescript) calculates the final number.

**Key Rule:** If there is no quote, the AI cannot give a score above 2/5. This forces **Evidence-Based Grading.**

---

## 7. Investor/Co-founder Value Proposition
- **Scalability:** One human recruiter can't grade 1,000 interviews with this rigor. PrepSignals can.
- **Bias Reduction:** By using **Resume-Blind Scoring**, we judge the performance, not the pedigree.
- **Feedback Loop:** We track `AI_Score` vs. `Actual_Hiring_Outcome`. This allows us to **calibrate** the weights over time to match real-world success.
