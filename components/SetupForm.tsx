"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  FileText,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import JDFallback from "./JDFallback";

const COMPANY_STAGES = ["Seed", "Series A", "Series B", "Public"];

const ROUND_TYPES = [
  "Technical Screen",
  "Technical Deep Dive",
  "System Design",
  "Behavioral",
  "Final Round",
  "HR Screen",
  "Case Study",
];

const STEPS = [
  {
    key: "basics",
    label: "The Basics",
    icon: ClipboardList,
    title: "Tell us about the role",
    subtitle: "This shapes which questions we ask you.",
  },
  {
    key: "personalize",
    label: "Personalize",
    icon: Sparkles,
    title: "Personalize it",
    subtitle: "Optional — skip it if you're short on time.",
  },
  {
    key: "jd",
    label: "Job Description",
    icon: FileText,
    title: "Add the job description",
    subtitle: "We turn this into role-specific interview questions.",
  },
] as const;

export default function SetupForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    role: "",
    company: "",
    yoe: "",
    round_type: "",
    company_stage: "",
    domain: "",
    jd_url: "",
    background: "",
  });
  const [jdContent, setJdContent] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [fetchingJD, setFetchingJD] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeParsed, setResumeParsed] = useState<string | null>(null);
  const [parsingResume, setParsingResume] = useState(false);

  const basicsComplete = Boolean(form.role && form.company && form.yoe && form.round_type);
  const showManualJD = manualEntry || showFallback;

  function handleChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  function goToStep(index: number) {
    setError(null);
    setStep(index);
  }

  function handleContinue() {
    if (step === 0 && !basicsComplete) {
      setError("Fill in all fields to continue.");
      return;
    }
    setError(null);
    setStep((s) => s + 1);
  }

  function switchToManualJD() {
    setManualEntry(true);
    setShowFallback(false);
  }

  function switchToLinkJD() {
    setManualEntry(false);
    setShowFallback(false);
    setJdContent(null);
  }

  async function handleResumeChange(file: File | null) {
    setResumeFile(file);
    setResumeParsed(null);
    if (!file) return;
    setParsingResume(true);
    try {
      const fd = new FormData();
      fd.append("resume", file);
      const res = await fetch("/api/parse-resume", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.text) {
        setResumeParsed(data.text);
        setForm((prev) => ({ ...prev, background: data.text }));
      } else {
        setError(data.error ?? "Failed to parse resume");
        setResumeFile(null);
      }
    } catch {
      setError("Failed to parse resume");
      setResumeFile(null);
    } finally {
      setParsingResume(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!basicsComplete) {
      setError("Please fill in all required fields.");
      setStep(0);
      return;
    }

    let finalJdContent = jdContent;

    // Try to fetch JD if URL provided and we don't have content yet
    if (form.jd_url && !jdContent && !showManualJD) {
      setFetchingJD(true);
      try {
        const res = await fetch("/api/fetch-jd", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: form.jd_url }),
        });
        const data = await res.json();
        if (res.ok && data.content) {
          finalJdContent = data.content;
          setJdContent(data.content);
        } else {
          setShowFallback(true);
          setFetchingJD(false);
          return;
        }
      } catch {
        setShowFallback(true);
        setFetchingJD(false);
        return;
      }
      setFetchingJD(false);
    }

    if (!finalJdContent || !finalJdContent.trim()) {
      setError("Please provide a job description (via URL or manual paste).");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: form.role,
          company: form.company,
          yoe: Number(form.yoe),
          round_type: form.round_type,
          company_stage: form.company_stage || null,
          domain: form.domain || null,
          jd_content: finalJdContent,
          background: form.background || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create session");

      router.push(`/interview/${data.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  const current = STEPS[step];
  const CurrentIcon = current.icon;
  const isLastStep = step === STEPS.length - 1;

  return (
    <Card className="w-full max-w-2xl rounded-3xl border-gray-100 shadow-2xl shadow-gray-200/50 py-8">
      <CardContent>
        <p className="mb-6 text-sm text-gray-500">
          Takes about 2 minutes. Tell us about the role, then we&apos;ll turn your job description into questions you can practice out loud.
        </p>

        {/* Stepper */}
        <div className="mb-8">
          <div className="flex items-center">
            {STEPS.map((s, i) => {
              const isActive = i === step;
              const isDone = i < step;
              const clickable = isDone;
              return (
                <div key={s.key} className="flex flex-1 items-center last:flex-none">
                  <button
                    type="button"
                    onClick={() => clickable && goToStep(i)}
                    disabled={!clickable}
                    aria-current={isActive ? "step" : undefined}
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors",
                      isDone && "bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer",
                      isActive && "bg-gray-950 text-white",
                      !isDone && !isActive && "bg-gray-100 text-gray-400"
                    )}
                  >
                    {isDone ? <Check className="w-4 h-4" /> : i + 1}
                  </button>
                  {i < STEPS.length - 1 && (
                    <div
                      className={cn(
                        "mx-2 h-px flex-1 transition-colors",
                        isDone ? "bg-emerald-500" : "bg-gray-100"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs font-semibold text-gray-400">
            Step {step + 1} of {STEPS.length} <span className="text-gray-300">·</span>{" "}
            <span className="text-gray-950">{current.label}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gray-950 text-white">
              <CurrentIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-950">{current.title}</h2>
              <p className="text-xs text-gray-500">{current.subtitle}</p>
            </div>
          </div>

          {step === 0 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Target Role</Label>
                  <Input
                    id="role"
                    placeholder="e.g. Senior Engineer"
                    value={form.role}
                    onChange={(e) => handleChange("role", e.target.value)}
                    required
                    aria-required="true"
                    aria-describedby={error ? "form-error" : undefined}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    placeholder="e.g. Stripe"
                    value={form.company}
                    onChange={(e) => handleChange("company", e.target.value)}
                    required
                    aria-required="true"
                    aria-describedby={error ? "form-error" : undefined}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="yoe">Years of Experience</Label>
                  <Input
                    id="yoe"
                    type="number"
                    min="0"
                    max="50"
                    placeholder="e.g. 4"
                    value={form.yoe}
                    onChange={(e) => handleChange("yoe", e.target.value)}
                    required
                    aria-required="true"
                    aria-describedby={error ? "form-error" : undefined}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="round">Interview Round</Label>
                  <Select
                    value={form.round_type}
                    onValueChange={(v) => handleChange("round_type", v)}
                  >
                    <SelectTrigger id="round" className="min-h-[44px]" aria-required="true" aria-describedby={error ? "form-error" : undefined}>
                      <SelectValue placeholder="Select round" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROUND_TYPES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Not sure which one? &ldquo;Technical Screen&rdquo; is usually the first round a company runs, so it&apos;s a safe place to start.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="company_stage">
                  Company Stage <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Select
                  value={form.company_stage}
                  onValueChange={(v) => handleChange("company_stage", v)}
                >
                  <SelectTrigger id="company_stage">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="domain">
                  Domain / Specialization{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="domain"
                  placeholder="e.g. Battery Management Systems, ML Infra"
                  value={form.domain}
                  onChange={(e) => handleChange("domain", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Helps us pick domain-specific questions. Leave blank for general software engineering.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="resume">
                  Resume <span className="text-muted-foreground font-normal">(optional · PDF)</span>
                </Label>
                <Input
                  id="resume"
                  type="file"
                  accept="application/pdf"
                  disabled={parsingResume}
                  onChange={(e) => handleResumeChange(e.target.files?.[0] ?? null)}
                  className="cursor-pointer"
                />
                <div aria-live="polite">
                  {parsingResume && (
                    <p className="text-xs text-muted-foreground">Reading resume…</p>
                  )}
                  {resumeParsed && !parsingResume && (
                    <p className="text-xs text-emerald-600 font-medium">
                      Resume parsed ({resumeParsed.length.toLocaleString()} chars) — AI will use it to personalise questions.
                    </p>
                  )}
                  {!resumeParsed && !parsingResume && (
                    <p className="text-xs text-muted-foreground">
                      Upload your resume so the AI can ask relevant follow-ups and give personalised feedback.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              {!showManualJD && (
                <div className="space-y-2">
                  <Label htmlFor="jd_url">Job Description URL</Label>
                  <Input
                    id="jd_url"
                    type="url"
                    placeholder="https://company.com/jobs/..."
                    value={form.jd_url}
                    onChange={(e) => handleChange("jd_url", e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={switchToManualJD}
                    className="text-xs font-semibold text-gray-500 underline underline-offset-2 hover:text-gray-950"
                  >
                    Don&apos;t have a link? Paste the description instead.
                  </button>
                </div>
              )}

              {showManualJD && (
                <div className="space-y-2">
                  <JDFallback
                    reason={showFallback ? "failed" : "manual"}
                    onContent={(content) => {
                      setJdContent(content);
                      setError(null);
                    }}
                  />
                  <button
                    type="button"
                    onClick={switchToLinkJD}
                    className="text-xs font-semibold text-gray-500 underline underline-offset-2 hover:text-gray-950"
                  >
                    Have a link instead? Switch back.
                  </button>
                </div>
              )}

              {jdContent && !showManualJD && (
                <p className="text-sm text-emerald-600 font-medium" aria-live="polite">
                  Job description fetched ({jdContent.length.toLocaleString()} chars)
                </p>
              )}
            </div>
          )}

          {error && (
            <p id="form-error" role="alert" className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex items-center gap-3 pt-2">
            {step > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => goToStep(step - 1)}
                className="h-[44px]"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
            )}

            {!isLastStep ? (
              <Button key="continue" type="button" onClick={handleContinue} className="flex-1 h-[44px]">
                Continue <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                key="submit"
                type="submit"
                className="flex-1 h-[44px]"
                disabled={fetchingJD || submitting}
              >
                {fetchingJD || submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {fetchingJD
                  ? "Fetching JD..."
                  : submitting
                  ? "Starting interview..."
                  : "Start Interview"}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
