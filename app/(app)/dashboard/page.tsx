import Link from "next/link";
import SetupForm from "@/components/SetupForm";

export default function DashboardPage() {
  return (
    <div className="flex flex-col items-center gap-10 pb-20">
      <div className="text-center space-y-2 max-w-xl pt-2">
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
        className="text-sm font-medium text-gray-500 hover:text-gray-950 underline underline-offset-4 decoration-gray-300 hover:decoration-gray-500 transition-colors"
      >
        See your past interviews &amp; progress →
      </Link>
    </div>
  );
}
