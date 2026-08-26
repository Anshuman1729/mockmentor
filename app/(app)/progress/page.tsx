import ProgressDashboard from "@/components/ProgressDashboard";

export default function ProgressPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-2 max-w-xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-950">My Progress</h1>
        <p className="text-gray-500 text-sm">
          Patterns across all your practice interviews — what&apos;s chronically weak, what&apos;s improving, and how you compare across rounds.
        </p>
      </div>

      <ProgressDashboard />
    </div>
  );
}
