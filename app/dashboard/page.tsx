import SetupForm from "@/components/SetupForm";
import SessionHistory from "@/components/SessionHistory";

export default function DashboardPage() {
  return (
    <div className="flex flex-col items-center gap-8 pb-20">
      <div className="text-center space-y-2 max-w-xl">
        <h1 className="text-2xl font-bold tracking-tight">
          Start a New Mock Interview
        </h1>
        <p className="text-muted-foreground text-sm">
          Paste your JD, answer questions aloud, get your signal debrief.
        </p>
      </div>

      <SetupForm />

      <div className="w-full max-w-2xl">
        <div className="border-t border-border mb-8" />
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Past Interviews</h2>
          <SessionHistory />
        </div>
      </div>
    </div>
  );
}
