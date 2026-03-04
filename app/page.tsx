import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";
import { ChevronRight, Mic, BarChart2, Mail } from "lucide-react";

export default async function LandingPage() {
  const { userId } = await auth();
  const isSignedIn = !!userId;

  return (
    <div className="flex flex-col items-center w-full">
      {/* ── Hero ── */}
      <section className="flex flex-col items-center text-center gap-6 py-20 px-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
          ✦ Free to start · No credit card
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
          Know exactly where you&apos;d lose the offer —
          <br />
          <span className="text-primary">before you walk in.</span>
        </h1>

        <p className="text-muted-foreground text-lg max-w-xl leading-relaxed">
          MockMentor runs a personalized mock interview from your job
          description and gives you a signal-by-signal debrief — so you walk
          into the real thing ready.
        </p>

        <div className="flex gap-3 flex-wrap justify-center">
          {isSignedIn ? (
            <Button asChild size="lg" className="gap-2">
              <Link href="/dashboard">
                Go to Dashboard
                <ChevronRight className="w-4 h-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg" className="gap-2">
                <Link href="/sign-up">
                  Start Free Mock Interview
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/sign-in">Sign in</Link>
              </Button>
            </>
          )}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="w-full border-t border-border py-16 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-10">
          {[
            {
              icon: <Mic className="w-5 h-5" />,
              title: "Voice-first interview",
              desc: "Speak your answers naturally. AI transcribes in real-time using Groq Whisper — built for Indian English accents.",
            },
            {
              icon: <BarChart2 className="w-5 h-5" />,
              title: "Signal scoring",
              desc: "8 behavioral signals scored 0–10. Structured thinking, ownership, business impact framing, and more.",
            },
            {
              icon: <Mail className="w-5 h-5" />,
              title: "Debrief emailed to you",
              desc: "Full analysis with hire probability, strengths, gaps, and a fix plan — sent to your inbox after every session.",
            },
          ].map((f) => (
            <div key={f.title} className="flex flex-col gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                {f.icon}
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="w-full border-t border-border py-16 px-4 bg-muted/30">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-12">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Paste your JD",
                desc: "Drop in the job description URL or paste it directly. We pull the context.",
              },
              {
                step: "2",
                title: "Answer questions aloud",
                desc: "Role-specific questions based on your company, YOE, and round type. Speak naturally.",
              },
              {
                step: "3",
                title: "Get your debrief",
                desc: "Signal scores, hire probability, and a specific fix plan — delivered to your inbox.",
              },
            ].map((h) => (
              <div
                key={h.step}
                className="flex flex-col items-center gap-3 text-center"
              >
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center">
                  {h.step}
                </div>
                <h3 className="font-semibold">{h.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {h.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="w-full border-t border-border py-16 px-4 text-center">
        <div className="max-w-xl mx-auto space-y-4">
          <h2 className="text-2xl font-bold">Ready to prep smarter?</h2>
          <p className="text-muted-foreground">
            Free to start. No credit card required.
          </p>
          <div className="pt-2">
            {isSignedIn ? (
              <Button asChild size="lg" className="gap-2">
                <Link href="/dashboard">
                  Go to Dashboard
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg" className="gap-2">
                <Link href="/sign-up">
                  Start Free Mock Interview
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
