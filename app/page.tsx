import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";
import { ChevronRight, Mic, BarChart2, Mail, CheckCircle } from "lucide-react";

export default async function LandingPage() {
  const { userId } = await auth();
  const isSignedIn = !!userId;

  return (
    <div className="flex flex-col w-full -mx-6 -mt-10">
      {/* ── Hero ── */}
      <section className="flex flex-col items-center text-center gap-8 py-24 px-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs text-blue-700 font-medium">
          ✦ AI Mock Interviews · Built for Indian tech roles
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-tight max-w-3xl">
          Know exactly where you&apos;d lose the offer —{" "}
          <span className="text-blue-600">before you walk in.</span>
        </h1>

        <p className="text-gray-500 text-lg max-w-xl leading-relaxed">
          Speak your answers aloud. Get scored on 8 interview signals — with
          evidence quotes, not vibes. Debrief report sent to your inbox, free.
        </p>

        <div className="flex gap-3 flex-wrap justify-center">
          {isSignedIn ? (
            <Button
              asChild
              size="lg"
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Link href="/dashboard">
                Go to Dashboard
                <ChevronRight className="w-4 h-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Button
                asChild
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Link href="/sign-up">Start Free Mock Interview →</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/sign-in">Sign in</Link>
              </Button>
            </>
          )}
        </div>

        {/* Trust bar */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center text-sm text-gray-500">
          {[
            "500+ mock sessions",
            "8 interview signals scored",
            "Free to start",
            "No credit card",
          ].map((item) => (
            <span key={item} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* ── Pain Section ── */}
      <section className="w-full bg-gray-950 text-white py-16 px-6">
        <div className="max-w-2xl mx-auto text-center space-y-5">
          <h2 className="text-3xl sm:text-4xl font-bold leading-tight">
            Most candidates don&apos;t know why they failed.
          </h2>
          <p className="text-gray-400 text-lg leading-relaxed">
            Hiring managers see hundreds of candidates. The difference between
            Hire and No Hire isn&apos;t talent — it&apos;s signal. Most
            candidates never get that signal. PrepSignals gives it to you before
            you walk in.
          </p>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="w-full py-20 px-6 bg-gray-50 border-t border-gray-100">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-14">
            How it works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                step: "1",
                title: "Paste your JD",
                desc: "Drop in the job description URL or paste it directly. PrepSignals pulls the context and tailors every question to your role.",
              },
              {
                step: "2",
                title: "Answer questions aloud",
                desc: "Role-specific questions based on your company, YOE, and round type. Speak naturally — Groq Whisper handles Indian English accents well.",
              },
              {
                step: "3",
                title: "Get your debrief",
                desc: "8 signals scored with evidence, talk ratio, hire recommendation, and a specific fix plan — delivered to your inbox.",
              },
            ].map((h) => (
              <div
                key={h.step}
                className="flex flex-col gap-4 p-6 bg-white rounded-2xl border border-gray-100 shadow-sm"
              >
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-lg flex items-center justify-center flex-shrink-0">
                  {h.step}
                </div>
                <h3 className="font-semibold text-gray-900">{h.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{h.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Deep-Dive ── */}
      <section className="w-full py-20 px-6 border-t border-gray-100">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-14">
            Built different
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                icon: <Mic className="w-5 h-5" />,
                title: "Voice-first, Indian English",
                desc: "Groq Whisper with STT prompt biasing. Reliably transcribes OLAP, SvelteKit, and domain jargon — not just clean American English.",
                badge: "Powered by Groq Whisper",
              },
              {
                icon: <BarChart2 className="w-5 h-5" />,
                title: "8 signals scored 0–5",
                desc: "BARS framework with verbatim evidence quotes. Technical Depth, STAR Alignment, Business Impact framing, Ownership — scored with receipts.",
                badge: "Evidence-first scoring",
              },
              {
                icon: <Mail className="w-5 h-5" />,
                title: "Debrief to your inbox",
                desc: "Signal grid, talk-to-listen ratio, hire/no-hire recommendation. Not a vague 'good job' — a structured report you can act on.",
                badge: "Email + in-app",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="flex flex-col gap-4 p-6 rounded-2xl border border-gray-100 bg-white shadow-sm"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  {f.icon}
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-900">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
                <span className="mt-auto text-xs text-blue-600 font-medium bg-blue-50 rounded-full px-3 py-1 w-fit">
                  {f.badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── "What You Get" Preview ── */}
      <section className="w-full py-20 px-6 bg-gray-50 border-t border-gray-100">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12 space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold">
              A signal report, not a vague pep talk
            </h2>
            <p className="text-gray-500">
              Here&apos;s what lands in your inbox after every session.
            </p>
          </div>

          {/* Debrief mockup card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="bg-gray-950 px-6 py-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 mb-1">
                  PrepSignals Debrief · Senior Product Manager · Zepto
                </p>
                <p className="text-white font-semibold">
                  Interview Signal Report
                </p>
              </div>
              <span className="bg-emerald-500 text-white text-sm font-bold px-4 py-1.5 rounded-full">
                Hire
              </span>
            </div>

            {/* Signal bars */}
            <div className="px-6 py-5 border-b border-gray-100 space-y-4">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                Signal Scores
              </p>
              {[
                { label: "Technical Depth", score: 4, max: 5 },
                { label: "STAR Alignment", score: 3, max: 5 },
                { label: "Business Impact Framing", score: 4, max: 5 },
                { label: "Ownership & Accountability", score: 3, max: 5 },
              ].map((signal) => (
                <div key={signal.label} className="flex items-center gap-3">
                  <span className="text-sm text-gray-700 w-52 flex-shrink-0">
                    {signal.label}
                  </span>
                  <div className="flex gap-1">
                    {Array.from({ length: signal.max }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-7 h-2 rounded-full ${
                          i < signal.score ? "bg-blue-600" : "bg-gray-100"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {signal.score}/{signal.max}
                  </span>
                </div>
              ))}
            </div>

            {/* Evidence quote */}
            <div className="px-6 py-5 border-b border-gray-100">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-3">
                Evidence Quote · Technical Depth
              </p>
              <blockquote className="text-sm text-gray-700 italic border-l-2 border-blue-500 pl-3 leading-relaxed">
                &ldquo;We used event-driven architecture with Kafka to decouple
                the inventory service — latency dropped from 400ms to under
                80ms.&rdquo;
              </blockquote>
            </div>

            {/* Metric */}
            <div className="px-6 py-5 flex items-center gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">
                  Talk-to-Listen Ratio
                </p>
                <p className="text-2xl font-bold text-gray-900">68/32</p>
              </div>
              <span className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full font-medium">
                Ideal range (60–75%)
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="w-full py-20 px-6 border-t border-gray-100">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">
            Early users
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                quote:
                  "The questions were surprisingly specific to my JD. I could tell it actually read the job description. The debrief had things I'd never noticed about how I answer — really useful.",
                name: "Priya M.",
                role: "Product Manager",
              },
              {
                quote:
                  "The key moments section is what got me. It pointed to the exact answer where I lost points and why. That's the kind of feedback you only get from a brutal senior interviewer.",
                name: "Karan S.",
                role: "Senior Engineer",
              },
            ].map((t) => (
              <div
                key={t.name}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4"
              >
                <p className="text-gray-700 leading-relaxed text-sm">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">
                    {t.name}
                  </p>
                  <p className="text-xs text-gray-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing Teaser ── */}
      <section className="w-full py-20 px-6 bg-gray-50 border-t border-gray-100">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12 space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold">Simple pricing</h2>
            <p className="text-gray-500">
              Start free. Upgrade when you need more.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Free */}
            <div className="bg-white rounded-2xl border-2 border-blue-600 shadow-sm p-6 space-y-5">
              <div>
                <p className="font-bold text-gray-900 text-lg">Free</p>
                <p className="text-3xl font-bold mt-1">₹0</p>
                <p className="text-xs text-gray-500 mt-1">forever</p>
              </div>
              <ul className="space-y-2.5 text-sm text-gray-600">
                {["1 mock interview", "Full signal debrief", "Email report"].map(
                  (f) => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      {f}
                    </li>
                  )
                )}
              </ul>
              <Button
                asChild
                size="sm"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Link href="/sign-up">Start here</Link>
              </Button>
            </div>

            {/* Sprint */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5 opacity-60">
              <div>
                <p className="font-bold text-gray-900 text-lg">Sprint</p>
                <p className="text-3xl font-bold mt-1">₹1,999</p>
                <p className="text-xs text-gray-500 mt-1">per month</p>
              </div>
              <ul className="space-y-2.5 text-sm text-gray-600">
                {[
                  "Unlimited mocks",
                  "All 8 signals",
                  "Conversation metrics",
                  "Priority email",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button size="sm" className="w-full" variant="outline" disabled>
                Coming soon
              </Button>
            </div>

            {/* Deep Dive */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5 opacity-60">
              <div>
                <p className="font-bold text-gray-900 text-lg">Deep Dive</p>
                <p className="text-3xl font-bold mt-1">₹2,999</p>
                <p className="text-xs text-gray-500 mt-1">per month</p>
              </div>
              <ul className="space-y-2.5 text-sm text-gray-600">
                {[
                  "Everything in Sprint",
                  "Resume alignment",
                  "PDF report",
                  "Benchmark comparisons",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button size="sm" className="w-full" variant="outline" disabled>
                Coming soon
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="w-full py-24 px-6 border-t border-gray-100 text-center">
        <div className="max-w-xl mx-auto space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold">
            Ready to find your signal gaps?
          </h2>
          <p className="text-gray-500 text-lg">
            Free to start. No credit card. Get your debrief in under 30
            minutes.
          </p>
          {isSignedIn ? (
            <Button
              asChild
              size="lg"
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Link href="/dashboard">
                Go to Dashboard
                <ChevronRight className="w-4 h-4" />
              </Link>
            </Button>
          ) : (
            <Button
              asChild
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Link href="/sign-up">Start Free Mock Interview →</Link>
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
