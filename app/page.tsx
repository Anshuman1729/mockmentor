import SetupForm from "@/components/SetupForm";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center space-y-2 max-w-xl">
        <h1 className="text-3xl font-bold tracking-tight">
          Your AI Interview Coach
        </h1>
        <p className="text-muted-foreground text-base">
          MockMentor runs a personalized mock interview from your job description
          and gives you a structured debrief — so you walk into the real thing
          ready.
        </p>
      </div>
      <SetupForm />
    </div>
  );
}
