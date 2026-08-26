import Link from "next/link";
import { BookOpen, CreditCard, Quote, Shield } from "lucide-react";
import SetupForm from "@/components/SetupForm";

const TRUST_ITEMS = [
  { icon: Shield, title: "Practice stays private", desc: "Self-view only. Nothing is ever recorded or shared." },
  { icon: Quote, title: "Evidence, not vibes", desc: "Every rating is backed by a direct quote from your own answer." },
  { icon: BookOpen, title: "Built on real research", desc: "Benchmarks like talk ratio and response latency — not guesses." },
  { icon: CreditCard, title: "Free to start", desc: "No credit card required." },
];

const TESTIMONIAL = {
  quote:
    "This was my first-ever interview, mock or real, and I had no idea what to expect. It walked me through everything and the feedback actually told me what to fix — not just 'good job.'",
  name: "Ananya R.",
  role: "Final-year CS student",
};

export default function DashboardPage() {
  return (
    <div className="flex flex-col items-center gap-8 pb-20">
      <div className="text-center space-y-2 max-w-xl">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1.5 text-[11px] font-bold text-emerald-700">
          Free &middot; No credit card
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-950">
          Start a new mock interview
        </h1>
        <p className="text-gray-500 text-sm">
          Paste your JD, answer questions aloud, get your signal debrief.
        </p>
      </div>

      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="flex justify-center lg:justify-end">
          <SetupForm />
        </div>

        <div className="flex w-full max-w-md flex-col gap-5 mx-auto lg:mx-0">
          <div className="rounded-3xl border border-gray-100 p-6">
            <p className="mb-4 text-[11px] font-bold tracking-widest text-gray-400">
              WHY CANDIDATES TRUST THIS
            </p>
            <div className="flex flex-col gap-4">
              {TRUST_ITEMS.map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-950">{item.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <blockquote className="rounded-3xl border border-gray-100 bg-gray-50 p-6">
            <p className="mb-3 text-[11px] font-bold tracking-widest text-gray-400">
              FROM PEOPLE WHO USED IT
            </p>
            <p className="text-sm font-medium leading-relaxed text-gray-800">
              &ldquo;{TESTIMONIAL.quote}&rdquo;
            </p>
            <footer className="mt-4 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-950 text-[11px] font-extrabold text-white">
                {TESTIMONIAL.name[0]}
              </div>
              <div>
                <p className="text-xs font-bold text-gray-950">{TESTIMONIAL.name}</p>
                <p className="text-[11px] text-gray-400">{TESTIMONIAL.role}</p>
              </div>
            </footer>
          </blockquote>
        </div>
      </div>

      <Link
        href="/progress"
        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:border-gray-400 hover:text-gray-950 transition-colors"
      >
        See your past interviews &amp; progress →
      </Link>
    </div>
  );
}
