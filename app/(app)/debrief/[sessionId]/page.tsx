import DebriefReport from "@/components/DebriefReport";

export default async function DebriefPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  // DebriefReport renders its own header + verdict banner immediately below
  // this — a second "Interview Complete" heading here was redundant and
  // styled inconsistently with the rest of the report (generic
  // font-bold/text-2xl vs. the editorial system used everywhere else).
  return <DebriefReport sessionId={sessionId} />;
}
