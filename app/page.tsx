import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";
import { ChevronRight, ArrowUpRight, Shield, Award, Clock } from "lucide-react";

export default async function LandingPage() {
  const { userId } = await auth();
  const isSignedIn = !!userId;

  return (
    <div className="min-h-screen bg-white text-gray-950">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 w-full border-b border-gray-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-extrabold tracking-tight text-gray-950">PrepSignals</Link>
          <div className="flex items-center gap-4 text-sm font-medium text-gray-600">
            <Link href="#how" className="hidden sm:inline hover:text-gray-950">How it works</Link>
            <Link href="#proof" className="hidden sm:inline hover:text-gray-950">Proof</Link>
            <Link href="/sign-in" className="text-gray-950 hover:underline">Sign in</Link>
            {!isSignedIn && (
              <Link href="/sign-up" className="rounded-full bg-gray-950 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 transition-colors">
                Start free
              </Link>
            )}
          </div>
        </div>
      </nav>

      <main>
        {/* Hero — user-first, concrete, no AI slop */}
        <section className="mx-auto max-w-6xl px-6 pt-24 pb-16 md:pt-36 md:pb-24">
          <div className="grid gap-12 md:grid-cols-2 md:items-center md:gap-16 lg:gap-20">
            <div className="space-y-8">
              <h1 className="text-5xl font-extrabold leading-[1.1] tracking-tight text-gray-950 md:text-6xl lg:text-7xl">
                You lose the offer before you walk in. <br/>
                <span className="text-gray-400">We show you where.</span>
              </h1>
              <p className="text-lg leading-relaxed text-gray-500 md:text-xl">
                Practice with role-specific questions from your actual job description. Get an evidence-backed signal report — not a vague "good job" — so you fix the gap before the real interview.
              </p>
              <div className="flex flex-wrap gap-3">
                {!isSignedIn ? (
                  <Link href="/sign-up" className="inline-flex items-center gap-2 rounded-full bg-gray-950 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-gray-950/10 hover:bg-gray-800 transition-all hover:-translate-y-0.5">
                    Start your mock interview <ArrowUpRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-gray-950 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-gray-950/10 hover:bg-gray-800 transition-all hover:-translate-y-0.5">
                    Go to Dashboard <ChevronRight className="w-4 h-4" />
                  </Link>
                )}
                <Link href="#how" className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-8 py-4 text-base font-semibold text-gray-950 hover:border-gray-400 transition-colors">
                  See the report format
                </Link>
              </div>
              <div className="flex items-center gap-6 text-xs font-medium text-gray-400">
                <span className="flex items-center gap-2"><Shield className="w-4 h-4" /> No credit card</span>
                <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Under 30 min</span>
                <span className="flex items-center gap-2"><Award className="w-4 h-4" /> 8 signals scored</span>
              </div>
            </div>

            {/* Right: concrete mock debrief preview */}
            <div className="relative">
              <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-2xl shadow-gray-200/50 md:p-8">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Debrief · Senior Engineer · Stripe</p>
                    <h3 className="text-base font-bold text-gray-950">Interview Signal Report</h3>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">Hire</span>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Technical Depth", score: 4, max: 5 },
                    { label: "STAR Alignment", score: 3, max: 5 },
                    { label: "Business Impact", score: 4, max: 5 },
                    { label: "Ownership", score: 3, max: 5 },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center gap-3">
                      <span className="w-28 text-xs font-medium text-gray-600 truncate">{s.label}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full bg-gray-950" style={{ width: `${(s.score / s.max) * 100}%` }} />
                      </div>
                      <span className="w-5 text-xs font-bold text-gray-950">{s.score}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Evidence Quote · Technical Depth</p>
                  <blockquote className="text-sm font-medium text-gray-800 leading-snug">"We used event-driven architecture with Kafka to decouple the inventory service — latency dropped from 400ms to under 80ms."</blockquote>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
                  <span>Talk-to-listen ratio</span>
                  <span className="font-bold text-gray-950">68 / 32 <span className="text-emerald-600">Ideal</span></span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pain — serious, no generic AI copy */}
        <section id="how" className="w-full bg-gray-950 py-20 md:py-28">
          <div className="mx-auto max-w-5xl px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-extrabold tracking-tight text-white md:text-5xl">Most candidates never see their signal gap.</h2>
              <p className="mt-6 text-lg leading-relaxed text-gray-400 md:text-xl">Hiring managers evaluate on evidence — not vibes. You answer well, but if you miss the signal (STAR structure, business framing, ownership cues) you lose the offer without knowing why. PrepSignals gives you that signal before the real round.</p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {[
                { step: "01", title: "Paste your job description", desc: "We pull the role, company stage, and domain so questions match your actual interview." },
                { step: "02", title: "Speak naturally", desc: "Voice-first mock interview. We transcribe with bias correction for Indian English and domain jargon." },
                { step: "03", title: "Get the signal report", desc: "8 signals scored with verbatim quotes, conversation metrics, and a 4-bucket recommendation." },
              ].map((item) => (
                <div key={item.step} className="rounded-2xl border border-white/10 bg-white/5 p-6 hover:bg-white/[0.07] transition-colors">
                  <span className="text-xs font-extrabold text-gray-500">STEP {item.step}</span>
                  <h3 className="mt-3 text-xl font-bold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Proof — concrete, no generic badges */}
        <section id="proof" className="w-full bg-gray-50 py-20 md:py-28 border-t border-gray-100">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-950 md:text-4xl">Built for serious candidates.</h2>
            <p className="mt-4 text-lg text-gray-500">Not generic AI chat. A structured interview simulator with evidence-first scoring.</p>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {[
                { title: "Evidence-first scoring", desc: "Every signal rating links to a verbatim quote from your answer — not an opaque number." },
                { title: "8 interview signals", desc: "BARS framework: Technical Depth, STAR Alignment, Business Impact, Ownership, Communication, Adaptability, and more." },
                { title: "Real benchmarks", desc: "Talk ratio targets (60–75%), latency thresholds, interruption limits — backed by interview research." },
              ].map((feat) => (
                <div key={feat.title} className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm shadow-gray-200/30">
                  <h3 className="text-lg font-extrabold text-gray-950">{feat.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-gray-500">{feat.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials — serious, specific */}
        <section className="w-full bg-white py-20 md:py-28 border-t border-gray-100">
          <div className="mx-auto max-w-4xl px-6">
            <div className="grid gap-6 md:grid-cols-2">
              {[
                { quote: "The questions were specific to my JD. The debrief pointed to the exact answer where I lost points and why. That's senior-interviewer-level feedback.", name: "Karan S.", role: "Senior Engineer" },
                { quote: "The key moments section is what got me. It pointed out my STAR alignment gap with a real quote. I fixed it before my final round.", name: "Priya M.", role: "Product Manager" },
              ].map((t) => (
                <blockquote key={t.name} className="rounded-3xl border border-gray-100 bg-gray-50 p-8 shadow-sm shadow-gray-100/40 md:p-10">
                  <p className="text-lg font-medium leading-relaxed text-gray-950 md:text-xl">"{t.quote}"</p>
                  <footer className="mt-6 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gray-950 flex items-center justify-center text-xs font-extrabold text-white">{t.name[0]}</div>
                    <div>
                      <p className="text-sm font-bold text-gray-950">{t.name}</p>
                      <p className="text-xs text-gray-400">{t.role}</p>
                    </div>
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        {/* CTA — direct, no ambiguity */}
        <section className="w-full bg-gray-950 py-20 md:py-28">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-white md:text-5xl">Find your signal gap before the offer.</h2>
            <p className="mt-6 text-lg text-gray-400">Free mock interview. Full evidence debrief. No credit card.</p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              {!isSignedIn ? (
                <Link href="/sign-up" className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-base font-extrabold text-gray-950 shadow-2xl shadow-white/10 hover:bg-gray-100 transition-all hover:-translate-y-0.5">
                  Start your mock interview <ArrowUpRight className="w-4 h-4" />
                </Link>
              ) : (
                <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-base font-extrabold text-gray-950 shadow-2xl shadow-white/10 hover:bg-gray-100 transition-all hover:-translate-y-0.5">
                  Go to Dashboard <ChevronRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
