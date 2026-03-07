"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import JDFallback from "./JDFallback";

const ROUND_TYPES = [
  "Technical Screen",
  "Technical Deep Dive",
  "System Design",
  "Behavioral",
  "Final Round",
  "HR Screen",
  "Case Study",
];

export default function SetupForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    role: "",
    company: "",
    yoe: "",
    round_type: "",
    jd_url: "",
    background: "",
  });
  const [jdContent, setJdContent] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [fetchingJD, setFetchingJD] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeParsed, setResumeParsed] = useState<string | null>(null);
  const [parsingResume, setParsingResume] = useState(false);

  function handleChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
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

    if (!form.role || !form.company || !form.yoe || !form.round_type) {
      setError("Please fill in all required fields.");
      return;
    }

    let finalJdContent = jdContent;

    // Try to fetch JD if URL provided and we don't have content yet
    if (form.jd_url && !jdContent && !showFallback) {
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

    if (!finalJdContent) {
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

  return (
    <Card className="w-full max-w-xl shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Start Your Mock Interview</CardTitle>
        <CardDescription>
          Fill in your details and we&apos;ll run a personalized mock
          interview tailored to the job description.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role">Target Role</Label>
              <Input
                id="role"
                placeholder="e.g. Senior Engineer"
                value={form.role}
                onChange={(e) => handleChange("role", e.target.value)}
                required
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="round">Interview Round</Label>
              <Select
                value={form.round_type}
                onValueChange={(v) => handleChange("round_type", v)}
              >
                <SelectTrigger id="round">
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
            </div>
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
            {parsingResume && (
              <p className="text-xs text-muted-foreground">Reading resume…</p>
            )}
            {resumeParsed && !parsingResume && (
              <p className="text-xs text-green-600 font-medium">
                Resume parsed ({resumeParsed.length.toLocaleString()} chars) — AI will use it to personalise questions.
              </p>
            )}
            {!resumeParsed && !parsingResume && (
              <p className="text-xs text-muted-foreground">
                Upload your resume so the AI can ask relevant follow-ups and give personalised feedback.
              </p>
            )}
          </div>

          {!showFallback && (
            <div className="space-y-2">
              <Label htmlFor="jd_url">Job Description URL</Label>
              <Input
                id="jd_url"
                type="url"
                placeholder="https://company.com/jobs/..."
                value={form.jd_url}
                onChange={(e) => handleChange("jd_url", e.target.value)}
              />
            </div>
          )}

          {showFallback && (
            <JDFallback
              onContent={(content) => {
                setJdContent(content);
                setError(null);
              }}
            />
          )}

          {jdContent && !showFallback && (
            <p className="text-sm text-green-600 font-medium">
              Job description fetched ({jdContent.length.toLocaleString()} chars)
            </p>
          )}

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={fetchingJD || submitting}
          >
            {fetchingJD
              ? "Fetching JD..."
              : submitting
              ? "Starting interview..."
              : "Start Interview"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
