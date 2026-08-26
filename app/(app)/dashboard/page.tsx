import Link from "next/link";
import SetupForm from "@/components/SetupForm";

export default function DashboardPage() {
  return (
    <div className="flex flex-col items-center gap-8 pb-20">
      <div className="text-center space-y-2 max-w-xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-950">
          Start a new mock interview
        </h1>
        <p className="text-gray-500 text-sm">
          Paste your JD, answer questions aloud, get your signal debrief.
        </p>
      </div>

      <SetupForm />

      <Link
        href="/progress"
        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:border-gray-400 hover:text-gray-950 transition-colors"
      >
        See your past interviews &amp; progress →
      </Link>
    </div>
  );
}
