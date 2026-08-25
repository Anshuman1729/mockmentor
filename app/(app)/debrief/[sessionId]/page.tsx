import DebriefReport from "@/components/DebriefReport";

export default async function DebriefPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold">Interview Complete</h2>
        <p className="text-muted-foreground text-sm">
          Here&apos;s your personalized debrief based on your answers.
        </p>
      </div>
      <DebriefReport sessionId={sessionId} />
    </div>
  );
}
