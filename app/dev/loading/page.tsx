import DebriefLoadingScreen from "@/components/DebriefLoadingScreen";

// Dev-only preview of the debrief-generation loading screen shown inside
// InterviewRoom. See /dev/debrief for the same pattern applied to the
// report itself.
export default function LoadingPreview() {
  return (
    <>
      <DebriefLoadingScreen />
      <p className="fixed bottom-6 inset-x-0 text-center text-xs text-gray-600 z-50">
        dev preview — /dev/loading
      </p>
    </>
  );
}
