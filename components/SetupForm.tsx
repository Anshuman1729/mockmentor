"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    user_email: "",
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

  function handleChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.user_email || !form.role || !form.company || !form.yoe || !form.round_type) {
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
          user_email: form.user_email,
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
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={form.user_email}
              onChange={(e) => handleChange("user_email", e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
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

          <div className="grid grid-cols-2 gap-4">
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
            <Label htmlFor="background">
              Your Background <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="background"
              placeholder="Briefly describe your current role and relevant experience — e.g. 'I'm a PM at Tata Communications with 3 years in B2B SaaS, led cross-functional teams across procurement and risk.'"
              value={form.background}
              onChange={(e) => handleChange("background", e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Helps the AI ask relevant follow-ups and give personalised feedback.
            </p>
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
