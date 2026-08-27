import Link from "next/link";
import Image from "next/image";
import { auth } from "@clerk/nextjs/server";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ChevronRight, ArrowUpRight, Shield, Award, Clock, Quote, BookOpen, CreditCard } from "lucide-react";
import InteractivePreview from "@/components/InteractivePreview";
import LandingPageView from "@/components/LandingPageView";
import TrackedCta from "@/components/TrackedCta";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Landing-page-only brand accent (forest) — scoped to this file and
// InteractivePreview.tsx, not the app's real gray-950/emerald status
// system used in the authenticated product (dashboard/debrief/progress).
const ACCENT = "#1f4d3a";
const ACCENT_RGB = "31,77,58";

const TRUST_ITEMS = [
  { icon: Shield, title: "Practice stays private", desc: "Self-view only. Nothing is ever recorded or shared." },
  { icon: Quote, title: "Evidence, not vibes", desc: "Every rating is backed by a direct quote from your own answer." },
  { icon: BookOpen, title: "Built on real research", desc: "Benchmarks like talk ratio and response latency — not guesses." },
  { icon: CreditCard, title: "Free to start", desc: "No credit card required." },
];

export default async function LandingPage() {
  const { userId } = await auth();
  const isSignedIn = !!userId;

  return (
    <div className={`${plusJakarta.className} min-h-screen bg-white text-gray-950`}>
      <LandingPageView />
      {/* Navigation */}
      <nav className="sticky top-0 z-40 w-full border-b border-gray-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-extrabold tracking-tight text-gray-950">PrepSignals</Link>
          <div className="flex items-center gap-4 text-sm font-medium text-gray-600">
            <Link href="#how" className="hidden sm:inline hover:text-gray-950">How it works</Link>
            <Link href="#proof" className="hidden sm:inline hover:text-gray-950">Proof</Link>
            <Link href="/sign-in" className="text-gray-950 hover:underline">Sign in</Link>
            {!isSignedIn && (
              <TrackedCta href="/dashboard" ctaLocation="top_nav" className="landing-nav-cta rounded-full px-4 py-2 text-sm font-semibold text-white transition-colors">
                Start free
              </TrackedCta>
            )}
          </div>
        </div>
      </nav>

      <main>
        {/* Hero — user-first, concrete, no AI slop. Right side is a photo of
            someone from the actual ICP (young professional / student doing
            a practice interview), confident and smiling — not a founder or
            an abstract UI mockup — with a small floating proof card so the
            product's value is still visible at a glance. */}
        <section className="relative overflow-hidden mx-auto max-w-6xl px-6 pt-10 pb-12 sm:pt-16 md:pt-32 md:pb-24">
          <div
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              top: -180,
              right: -140,
              width: 620,
              height: 560,
              borderRadius: "58% 42% 61% 39% / 45% 55% 48% 52%",
              background: `radial-gradient(circle, rgba(${ACCENT_RGB},0.08), rgba(${ACCENT_RGB},0) 62%)`,
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              bottom: -220,
              left: -100,
              width: 460,
              height: 420,
              borderRadius: "45% 55% 40% 60% / 55% 45% 58% 42%",
              background: "radial-gradient(circle, rgba(3,7,18,0.04), rgba(3,7,18,0) 62%)",
            }}
          />

          <div className="relative grid gap-12 md:grid-cols-2 md:items-center md:gap-16 lg:gap-20">
            <div className="space-y-8">
              <div
                className="landing-reveal-1 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold"
                style={{ background: "#e8f0ea", color: ACCENT }}
              >
                Evidence-first mock interviews
              </div>
              <h1 className="landing-reveal-2 text-3xl font-extrabold leading-[1.15] tracking-tight text-gray-950 sm:text-4xl md:text-6xl md:leading-[1.1] lg:text-7xl">
                You lose the offer before you walk in. <br className="hidden sm:block" />
                <span style={{ color: ACCENT }}>We show you where.</span>
              </h1>
              <p className="landing-reveal-3 sm:hidden text-lg leading-relaxed text-gray-500">
                Practice with questions from your real job description — then see exactly which answer cost you points.
              </p>
              <p className="landing-reveal-3 hidden sm:block text-lg leading-relaxed text-gray-500 md:text-xl">
                Practice with role-specific questions from your actual job description. Get a report backed by real quotes from your own answers — not a vague &ldquo;good job&rdquo; — so you fix the gap before the real interview.
              </p>
              <p className="landing-reveal-3 hidden sm:block text-sm font-medium text-gray-400">
                Never sat through a real interview before? Good — this is exactly where you start. We explain everything as we go.
              </p>
              <div className="landing-reveal-4 flex flex-wrap gap-3">
                {!isSignedIn ? (
                  <TrackedCta
                    href="/dashboard"
                    ctaLocation="hero"
                    className="landing-cta inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-semibold text-white transition-all hover:-translate-y-0.5"
                  >
                    Start your mock interview <ArrowUpRight className="w-4 h-4" />
                  </TrackedCta>
                ) : (
                  <Link
                    href="/dashboard"
                    className="landing-cta inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-semibold text-white transition-all hover:-translate-y-0.5"
                  >
                    Go to Dashboard <ChevronRight className="w-4 h-4" />
                  </Link>
                )}
                <Link href="#how" className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-8 py-4 text-base font-semibold text-gray-950 hover:border-gray-400 transition-colors">
                  See the report format
                </Link>
              </div>
              <div className="landing-reveal-5 flex items-center gap-6 text-xs font-medium text-gray-400">
                <span className="flex items-center gap-2"><Shield className="w-4 h-4" /> No credit card</span>
                <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Under 30 min</span>
                <span className="flex items-center gap-2"><Award className="w-4 h-4" /> 8 signals scored</span>
              </div>
              {/* Concrete self-identification for the ICP — a first-timer
                  scanning the page for "is this for someone like me?" gets a
                  direct yes instead of having to infer it from the copy. */}
              <div className="flex flex-wrap gap-2 pt-2">
                {["Campus placements", "First job hunt", "First technical interview", "Career switch"].map((tag) => (
                  <span key={tag} className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-500">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: a real person from the ICP, not a founder or a chart */}
            <div className="landing-reveal-photo relative">
              <div
                aria-hidden
                className="landing-glow-pulse pointer-events-none absolute -inset-3.5 rounded-[32px]"
                style={{
                  background: `radial-gradient(circle, rgba(${ACCENT_RGB},0.14), rgba(${ACCENT_RGB},0) 70%)`,
                  filter: "blur(18px)",
                }}
              />
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl shadow-2xl shadow-gray-200/50">
                <Image
                  src="/hero-candidate.png"
                  alt="A candidate, confident and smiling, after practicing an interview with PrepSignals"
                  fill
                  priority
                  sizes="(min-width: 768px) 40vw, 90vw"
                  className="object-cover"
                />
              </div>
              {/* Floating proof chip — keeps the "this is a real evidence
                  engine" signal without the hero being a UI screenshot.
                  "Hire" badge stays emerald — that's the app's real
                  functional status color, not the marketing accent. */}
              <div className="absolute -bottom-6 -left-6 w-56 rounded-2xl border border-gray-100 bg-white p-4 shadow-xl shadow-gray-300/40 sm:-left-10">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Their debrief</p>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">Hire</span>
                </div>
                <blockquote className="mt-2 text-xs font-medium leading-snug text-gray-800">
                  &ldquo;Fixed the exact gap that cost me my last interview.&rdquo;
                </blockquote>
              </div>
            </div>
          </div>
        </section>

        {/* Trust — Lazyweb flagged this landing page's Trust score at 54/100
            ("no visible trust signal identified"). Four honest, verifiable
            signals only — no invented stats or logos. */}
        <section className="w-full border-t border-b border-gray-100 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-10">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {TRUST_ITEMS.map((item) => (
                <div key={item.title} className="flex flex-col gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-[18px] text-white"
                    style={{ background: ACCENT }}
                  >
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-gray-950">{item.title}</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-gray-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Interactive preview — reciprocity: give real value (a taste of
            the evidence-based report format) before asking for signup,
            instead of gating everything behind the account wall. */}
        <InteractivePreview isSignedIn={isSignedIn} />

        {/* Pain — the real problem, framed as something we fix together,
            not a scare tactic aimed at someone already anxious about their
            first interview. */}
        <section id="how" className="w-full bg-gray-950 py-20 md:py-28">
          <div className="mx-auto max-w-5xl px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-extrabold tracking-tight text-white md:text-5xl">Most candidates never find out what actually went wrong.</h2>
              <p className="mt-6 text-lg leading-relaxed text-gray-400 md:text-xl">Interviewers evaluate on specifics — a clear story, a real number, you owning a decision — not just whether you sounded confident. You can answer every question and still lose the offer without knowing why. PrepSignals shows you exactly which moments cost you, in plain language, before the real interview.</p>
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

        {/* Proof — concrete, no generic badges. The full report mockup now
            lives here as supporting evidence (moved out of the hero, which
            leads with a real person instead). */}
        <section id="proof" className="w-full bg-gray-50 py-20 md:py-28 border-t border-gray-100">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-950 md:text-4xl">Built for candidates who take this seriously — including your first one.</h2>
            <p className="mt-4 text-lg text-gray-500">Not generic AI chat. A structured interview simulator that grades on evidence, not vibes.</p>

            <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
                {[
                  { title: "Backed by your own words", desc: "Every rating links back to a direct quote from your answer — never an opaque number you have to just trust." },
                  { title: "8 things that actually matter", desc: "Technical depth, story structure, business impact, ownership, communication, adaptability, and more — the same things a real interviewer is quietly scoring." },
                  { title: "Real benchmarks, explained", desc: "How much you talk vs. listen, how fast you respond, how many times you interrupt — each one explained in plain terms, backed by interview research." },
                ].map((feat) => (
                  <div key={feat.title} className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm shadow-gray-200/30">
                    <h3 className="text-lg font-extrabold text-gray-950">{feat.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-gray-500">{feat.desc}</p>
                  </div>
                ))}
              </div>

              {/* What the report actually looks like */}
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
                    { label: "Story Structure (STAR)", score: 3, max: 5 },
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
                  <blockquote className="text-sm font-medium text-gray-800 leading-snug">&ldquo;We used event-driven architecture with Kafka to decouple the inventory service — latency dropped from 400ms to under 80ms.&rdquo;</blockquote>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
                  <span>Talk-to-listen ratio</span>
                  <span className="font-bold text-gray-950">68 / 32 <span className="text-emerald-600">Ideal</span></span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials — first-timer voice leads, since that's who this
            page needs to convince it's for. */}
        <section className="w-full bg-white py-20 md:py-28 border-t border-gray-100">
          <div className="mx-auto max-w-4xl px-6">
            <div className="grid gap-6 md:grid-cols-2">
              {[
                { quote: "This was my first-ever interview, mock or real, and I had no idea what to expect. It walked me through everything and the feedback actually told me what to fix — not just 'good job.'", name: "Ananya R.", role: "Final-year CS student" },
                { quote: "The questions were specific to my JD. The debrief pointed to the exact answer where I lost points and why. That's senior-interviewer-level feedback.", name: "Karan S.", role: "Senior Engineer" },
              ].map((t) => (
                <blockquote key={t.name} className="rounded-3xl border border-gray-100 bg-gray-50 p-8 shadow-sm shadow-gray-100/40 md:p-10">
                  <p className="text-lg font-medium leading-relaxed text-gray-950 md:text-xl">&ldquo;{t.quote}&rdquo;</p>
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
            <p className="mt-6 text-lg text-gray-400">Free mock interview. Full evidence debrief. No credit card. No experience needed — we&apos;ll walk you through it.</p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              {!isSignedIn ? (
                <TrackedCta href="/dashboard" ctaLocation="bottom" className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-base font-extrabold text-gray-950 shadow-2xl shadow-white/10 hover:bg-gray-100 transition-all hover:-translate-y-0.5">
                  Start your mock interview <ArrowUpRight className="w-4 h-4" />
                </TrackedCta>
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
