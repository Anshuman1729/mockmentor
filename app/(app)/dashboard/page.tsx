import SetupForm from "@/components/SetupForm";
import SessionHistory from "@/components/SessionHistory";

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

      <div className="w-full max-w-2xl">
        <div className="border-t border-gray-100 mb-8" />
        <div className="space-y-4">
          <h2 className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Past Interviews</h2>
          <SessionHistory />
        </div>
      </div>
    </div>
  );
}
