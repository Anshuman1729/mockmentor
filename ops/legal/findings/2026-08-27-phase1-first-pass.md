# Phase 0/1 First-Pass Compliance Review — PrepSignals
**Date:** 2026-08-27
**Author:** Director of Compliance (temporarily elevated, Phase 0 — no reports yet)
**Scope:** Codebase-only review (Read/Grep/Glob/WebSearch/WebFetch access). No production data, no live payment integration exists yet. Grounded against DPDP Act 2023 (+ DPDP Rules 2025), IT Act 2000 + IT Rules 2021, Consumer Protection Act 2019 + Consumer Protection (E-Commerce) Rules 2020, Indian Contract Act 1872, and RBI's e-mandate (recurring payment) framework.

**Model note (per my agent mandate):** I run on Sonnet. Findings 4 and 5 below touch cross-border data transfer and payments specifically — both are flagged **"recommend Opus review"** and should not be treated as final without a re-run under Opus.

---

## Summary table

| # | Finding | Area | Law | Severity |
|---|---|---|---|---|
| 1 | No Privacy Policy or Terms of Service exist anywhere in the product | Contract Act / IT Rules 2021 / DPDP notice | Contract Act 1872, IT Rules 2021, DPDP Act §5 | **Critical** |
| 2 | Camera/mic consent is a native browser permission prompt + passive on-screen text only — no affirmative-action consent capture, nothing itemized, nothing persisted | Consent | DPDP Act §5, §6 | **High** |
| 3 | No data retention policy or deletion/erasure mechanism anywhere in the codebase or schema | Retention / erasure | DPDP Act §8(7), §12, §13 | **High** |
| 4 | Cross-border processing of voice data (Groq, US) and auth data (Clerk, US) is undisclosed to users; transfer itself is currently lawful but unnotified | Cross-border transfer | DPDP Act §16 + DPDP Rules 2025, r.15 | **Medium** (transfer legality) / **High** (disclosure gap) — **recommend Opus review** |
| 5 | Planned subscription tiers (₹1,999 / ₹2,999, "/30 days") have no live payment code yet, but the phrasing implies recurring billing without any of the RBI e-mandate or CPA e-commerce disclosure scaffolding decided | Payments | RBI e-mandate framework (Oct 2021), CPA 2019 + E-Commerce Rules 2020 r.5 | **Informational / pre-launch** — **recommend Opus review before build starts** |
| 6 | `hire_probability` leak-prevention is correctly implemented at the API layer — noted as a positive control, not a gap | Internal | N/A (non-negotiable rule) | **Positive finding** |
| 7 | Debrief email (Resend) sent from `onboarding@resend.dev`, Resend's shared sandbox sender domain, not a verified PrepSignals domain | Trust / deliverability | Not a specific statutory violation; flagged for completeness | **Low** |

---

## Finding 1 — No Privacy Policy or Terms of Service exist anywhere in the product (Critical)

**What I checked:** Grepped the entire repo for `privacy`, `terms`, `consent` (case-insensitive) across `app/`, `components/`, and globbed for `app/**/privacy*` and `app/**/terms*` routes. Also checked `app/page.tsx`'s footer/CTA links directly.

**What I found:** There is no `/privacy` or `/terms` route, no footer link to either, and no consent checkbox anywhere in `SetupForm.tsx`, the landing page, or `InterviewRoom.tsx`'s TMAY step. The only user-facing data-handling statement in the entire product is one sentence of body copy on the TMAY screen (`components/InterviewRoom.tsx:456-458`):

> "Quick heads up: this is just practice — nothing here affects a real job. Your camera is only for you to see yourself; it's never recorded or sent anywhere. Only your spoken answers are used to generate your feedback."

That sentence is accurate to what the code does (see Finding 2 for verification), but it is marketing copy embedded in a React component, not a legal document, and it does not attempt to cover retention, third-party processors (Groq, Sarvam, Clerk, Resend, Neon), user rights, or a grievance/contact mechanism.

**Why this matters, specifically:**
- **Contract Act 1872:** With no ToS presented or accepted anywhere in the flow, there is no contract governing the relationship at all — meaning PrepSignals currently has *no* enforceable disclaimer that this isn't a real hiring decision, no liability limitation, no IP/ownership terms over user-submitted answers/resumes, and no dispute-resolution clause. The in-app "this is just practice" sentence is not a binding term; it's UX copy a user could plausibly ignore or not see if they scroll past. If a user later disputes anything (e.g., contests a debrief, requests data deletion, or claims reliance on the tool for a real hiring decision), there is nothing that was actually agreed to.
- **IT Rules 2021:** Rule 3(1)(a) of the IT (Intermediary Guidelines and Digital Media Ethics Code) Rules 2021 (and the base data-fiduciary obligation under DPDP) requires a body handling personal data online to publish a privacy policy. None exists.
- **DPDP Act 2023, §5:** Every consent request must be accompanied or preceded by a notice giving an itemized description of what personal data is collected, the specific purpose, how to withdraw consent, and how to complain to the Data Protection Board. A privacy policy is the standard vehicle for this; with none published, there is no compliant notice mechanism at all, independent of the consent-capture gap in Finding 2.
- **Consumer Protection Act 2019 + Consumer Protection (E-Commerce) Rules 2020, Rule 5:** Once paid tiers go live, Rule 5 requires disclosure of the legal entity's name/address, grievance officer contact and response timelines, and return/refund/cancellation terms. None of that scaffolding exists yet — this is a pre-launch blocker, not just a nice-to-have.

**Recommendation (not drafted as final — per my mandate I do not draft ToS/Privacy Policy language as anything other than a flagged recommendation for Anshuman's review):** This needs an actual Privacy Policy + ToS written and published before any paid tier goes live, and ideally before broader user growth given the audio/video collection already happening today on the free tier. Publishing either is itself an Article II item (ToS/Privacy Policy changes require Anshuman directly) — I'm flagging the gap, not attempting to fill it.

---

## Finding 2 — Camera/mic consent relies solely on the native browser permission prompt; no affirmative in-app consent, no itemized notice, nothing persisted (High)

**What I checked:** `components/InterviewRoom.tsx` (camera effect, lines 91-107; audio recording via `hooks/useAudioRecorder.ts`), and the DB schema (`db/schema.sql`) for any consent-timestamp column.

**What I verified is actually true (confirming vs. the CLAUDE.md claim):**
- Camera: `getUserMedia({ video: true, audio: false })` (`InterviewRoom.tsx:95`) — the resulting `MediaStream` is only ever assigned to a local `<video>` element (`videoRef.current.srcObject = stream`) for self-view. It is never captured to a `Blob`, never passed to `MediaRecorder`, and never sent to any API route. **The "camera is self-view-only, never recorded" claim in CLAUDE.md and in the TMAY copy is accurate as implemented.**
- Microphone: `getUserMedia({ audio: true })` (`hooks/useAudioRecorder.ts:35`) is genuinely recorded via `MediaRecorder` and uploaded as a Blob to `/api/transcribe` (Groq Whisper) on submit. The raw audio bytes are not persisted to any database or disk in this repo — `app/api/transcribe/route.ts` converts the upload to a Buffer, sends it to Groq, and returns only `transcription.text`; nothing is written to Neon. Only the resulting **transcript text** is persisted (`qa_pairs.answer`, `sessions.background`).

**The gap:** Consent for both camera and mic is obtained exclusively through the browser's native OS/browser permission dialog, triggered automatically on component mount — there is no in-app checkbox, no "I agree" action, and no record of consent (no `consent_given_at` or equivalent column anywhere in `db/schema.sql`). The one disclosure sentence on the TMAY screen doesn't mention that audio is sent to Groq (a third party, and a foreign one — see Finding 4), doesn't mention that the transcript is retained indefinitely (see Finding 3), and doesn't mention that the transcript feeds an internal `hire_probability` score.

**Why this matters:** DPDP Act 2023 §6 requires consent to be "free, specific, informed, unconditional, and unambiguous... given through a clear affirmative action," and it must be limited to what's necessary and demonstrable if challenged. A native browser permission grant (which many users click through without reading) is not the same as a specific, informed, demonstrable affirmative action under the Act, and it isn't preceded by the itemized §5 notice described in Finding 1.

**Recommendation:** Once a Privacy Policy exists, add an explicit, logged consent step before camera/mic access is requested (a checkbox or equivalent affirmative click, stored with a timestamp), and expand the TMAY disclosure to name the actual downstream processors and retention posture. Flagging for Anshuman's review — not drafting the actual consent copy, per my mandate.

---

## Finding 3 — No data retention policy or deletion/erasure mechanism anywhere (High)

**What I checked:** `db/schema.sql` in full, and searched the whole repo for any retention/TTL/purge/cron/deletion logic, plus every `app/api/**/route.ts` for a `DELETE` handler.

**What I found:**
- `db/schema.sql` has no retention-related column on any table (`sessions`, `qa_pairs`, `debriefs`, `calibration_loops`) — no `expires_at`, no soft-delete flag, nothing.
- Zero `export async function DELETE` handlers exist anywhere under `app/api/`. There is no user-facing "delete my session" or "delete my account/data" endpoint at all.
- No scheduled job, cron script, or cleanup script exists in `scripts/` for purging old sessions, transcripts, or debriefs.
- Per CLAUDE.md, `debriefs.reasoning` (internal shadow scoring) and `calibration_loops.llm_reasoning` also persist indefinitely with the same no-erasure posture, even though these are explicitly internal-only fields never meant for user consumption — meaning the data with the least product justification for existing is retained just as indefinitely as the rest.

**Why this matters:** DPDP Act §8(7) requires a data fiduciary to erase personal data once the purpose for processing is no longer being served (subject to any legal retention requirement) and to cause processors to do the same. §12/§13 give the Data Principal a right to request erasure and correction. With no deletion mechanism, PrepSignals currently cannot honor an erasure request even if Anshuman personally wanted to act on one today — there's no code path for it.

Note: voice audio itself is not the retained artifact here (confirmed in Finding 2 — it's discarded after transcription), so the exposure is specifically the transcript text, the debrief content (including internal reasoning), and resume text extracted via `/api/parse-resume` (which is also not persisted server-side — it's returned to the client and only stored to the extent it's later submitted as `jd_content`/`background` on session creation).

**Recommendation:** This is a natural first build item for the future Compliance Associate seat (see hiring spec) — a data map of what's collected, where it lives, and a defined retention schedule, followed by an actual erasure endpoint. Flagging the gap now; not proposing a specific retention period as final since that's a product/legal decision for Anshuman, not something I should assert unilaterally.

---

## Finding 4 — Cross-border transfer of voice data (Groq) and auth data (Clerk) is undisclosed; the transfer itself is currently lawful but unmonitored (Medium legality / High disclosure gap) — recommend Opus review

**What I checked:** `app/api/transcribe/route.ts`, `lib/groq.ts`, `app/api/tts/route.ts`, and researched DPDP Act 2023 §16 and DPDP Rules 2025 r.15 current status via web search.

**What I found:**
- **Groq** (`app/api/transcribe/route.ts`, `lib/groq.ts`) is a US-based inference provider. Every interview answer's raw audio is sent to Groq for Whisper transcription, and every transcript is sent again to Groq's `gpt-oss-120b` for question generation and debrief scoring. This is a genuine, routine cross-border transfer of voice-derived personal data (and arguably voice itself, transiently, before transcription) to a foreign processor.
- **Sarvam AI** (`app/api/tts/route.ts`) is the TTS provider (`bulbul:v3`, India-headquartered per public information) — this direction is PrepSignals sending *its own* interview-question text to Sarvam to synthesize audio for the user to hear. It is not sending user personal data to Sarvam (the text being spoken is the interviewer's scripted/generated question, not the candidate's answer), so this is a materially different and lower-risk data flow than the Groq path.
- **Clerk** (auth) is also a US-based provider holding user email and auth identity data — a second cross-border flow not mentioned in CLAUDE.md's list but present via the stack.
- **Current DPDP legal status (via web search):** §16 of the DPDP Act 2023 uses a "blocklist" model — transfers are permitted to any country *except* ones the Central Government explicitly restricts by notification. As of the sources I found, the Central Government has **not yet published** a restricted-country list, and the cross-border provisions under DPDP Rules 2025 are being brought into force on a staggered timeline following a November 2025 notification. On the current public record, sending data to Groq (US) is not itself unlawful today — there is no active blocklist to violate.

**Why this is still flagged High on the disclosure side:** Lawfulness of the destination country is a separate question from whether the transfer was disclosed to the user. Nothing in the product tells a user their spoken answer is sent to a US company for processing, or names any processor at all — this compounds Finding 1 (no notice mechanism) and Finding 2 (consent not itemized). Even a transfer to an unrestricted country still needs to appear in the §5 notice as part of "the personal data and the purpose for which [it] is proposed to be processed," and typically a competent privacy policy names sub-processors and their location. It's also worth noting the restricted-country list is not published *yet* — this is a live regulatory area that could change under PrepSignals with no monitoring currently in place.

**Why I'm flagging this for Opus review specifically:** cross-border data-transfer analysis is one of the two areas my own mandate calls out as higher-stakes than routine review. I'm not treating my Sonnet-run legal read on §16's current applicability as final — this specific question (is the Groq/Clerk data flow currently compliant, and what exactly needs to go in the processor-disclosure section of a future privacy policy) should be re-run manually under Opus before anyone treats it as settled.

---

## Finding 5 — Planned subscription tiers have no live payment code, but should be designed against RBI/CPA requirements before PhonePe integration starts (Informational / pre-launch) — recommend Opus review

**What I checked:** Grepped the full repo for `PhonePe`, `payment`, `subscription`, `razorpay`, `stripe`, `auto-renew`, `recurring` — confirmed against `BACKLOG.md` line 263 ("no payment gateway, no pricing decided — so the funnel stops at interview completion for now") and PRD status in CLAUDE.md (PhonePe payment: "Not started"). The landing page's earlier pricing-teaser section (described in `BACKLOG.md`) has since been removed entirely in the ICP-first redesign — `app/page.tsx` currently shows no pricing UI at all, only a "Free to start / No credit card required" trust badge.

**What I found:** There is genuinely no payment-adjacent code live in the product today. This finding is purely forward-looking, ahead of the eventual PhonePe integration CLAUDE.md and BACKLOG.md both reference as planned:
- **RBI e-mandate framework (in force since Oct 2021):** if the ₹1,999/₹2,999 tiers are implemented as auto-renewing recurring billing (UPI Autopay / card e-mandate) rather than a one-time charge that simply grants 30 days of access, RBI requires: Additional Factor Authentication at mandate setup, a pre-debit notification sent to the customer at least 24 hours before each recurring charge (naming merchant, amount, date, and mandate reference), and the customer must retain the ability to view, modify, or cancel the mandate at any time. None of this exists in code yet because no payment code exists yet — but it needs to be a day-one design constraint of the PhonePe integration, not a retrofit.
- **CPA 2019 + Consumer Protection (E-Commerce) Rules 2020, Rule 5:** once any paid tier is live, mandatory disclosures include the legal entity's name and registered address, grievance officer name/contact/response-time commitment, total price including all charges, and a clearly stated cancellation/refund/return policy. None of this scaffolding (a grievance officer, a refund policy) currently exists anywhere in the product or its docs.
- **Open product question that changes which regime applies:** CLAUDE.md's phrasing ("Sprint (₹1,999/30 days)") is ambiguous between (a) a one-time payment that grants a fixed 30-day access window with no auto-renewal, versus (b) a genuinely recurring auto-debit subscription. This materially changes RBI applicability — (a) is a simple one-time transaction with ordinary CPA disclosure obligations; (b) additionally triggers the full e-mandate framework above. This is a product decision Anshuman should make explicitly before PhonePe wiring begins, since it's cheaper to design once correctly than to retrofit e-mandate compliance onto an already-built one-time-charge flow.

**Why I'm flagging this for Opus review specifically:** payment structure is the other area my mandate calls out as higher-stakes. Since real money movement and any actual PhonePe/payment integration is an Article II item requiring Anshuman directly regardless of what any agent seat's tier allows, I'm not attempting to design the flow — I'm surfacing the regulatory shape of the two paths (recurring vs. one-time) so that decision can be made deliberately, and recommending the specific payment/RBI questions get a manual Opus pass before implementation starts, not just my Sonnet-run read.

---

## Finding 6 — `hire_probability` non-exposure is correctly implemented (positive finding, not a gap)

**What I checked:** `app/api/sessions/[sessionId]/route.ts`, `app/api/sessions/analytics/route.ts`, `app/api/interview/drill/route.ts`, `lib/email.ts`.

**What I found:** This is worth recording as a control that's actually working, not just absence of a finding. `GET /api/sessions/[sessionId]/route.ts:63-75` explicitly strips `hire_probability` from `debrief_data.summary` server-side before the response is constructed, with a code comment noting this is deliberate ("strip it here rather than relying on the UI... since the raw field would otherwise be visible in the network response"). The internal `debriefs.reasoning` column is never selected into the client-facing response at all (only `debrief_data` fields are spread into the returned object). The debrief email template (`lib/email.ts`) and the drill-scoring route also don't reference `hire_probability`. This is the correct pattern — enforced at the API boundary, not just in UI rendering — and should be the model other internal-only fields follow.

---

## Finding 7 — Debrief email sent from Resend's shared sandbox domain (Low)

**What I checked:** `lib/email.ts:189` — `from: "PrepSignals <onboarding@resend.dev>"`.

**What I found:** This is Resend's shared onboarding/test sender domain, not a verified PrepSignals-owned domain. This isn't a specific statutory violation I can point to, but it's worth flagging alongside Finding 1: once a real Privacy Policy exists and states who is processing user data, the actual communications sent to users (this debrief email, containing the hire recommendation and evidence quotes) should come from an identifiable, verified sender domain consistent with that policy, both for deliverability and for basic consumer-trust/identifiability expectations under CPA 2019's general disclosure spirit. Low severity, but cheap to fix whenever domain verification is set up — flagging for completeness rather than as a compliance blocker.

---

## What I did not find (explicitly checked, came back clean)
- No evidence of `hire_probability` or internal BARS/rubric internals leaking into any user-facing surface (API responses, email, drill route) — see Finding 6.
- No payment/subscription code exists yet to review for actual RBI/CPA violations — Finding 5 is forward-looking only.
- Camera video is genuinely never recorded or transmitted, consistent with CLAUDE.md's claim — see Finding 2.
- Raw interview audio is genuinely never persisted to the database — only the Whisper transcript is stored.

## Article II items I did not attempt
Per my mandate, I have not drafted actual ToS/Privacy Policy language, have not touched any payment or pricing structure, and have not made any DB schema or product code change. Findings 1, 3, 4, and 5 above all eventually require an Anshuman-owned action (publishing a policy, approving a retention schedule, approving a cross-border disclosure statement, and designing the payment flow) — I've flagged each clearly rather than attempting any of them.
