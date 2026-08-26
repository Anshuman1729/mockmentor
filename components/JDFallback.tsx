"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface JDFallbackProps {
  onContent: (content: string) => void;
  /** "failed" = the URL fetch didn't work (warning tone). "manual" = the candidate chose to paste instead (neutral tone). */
  reason?: "failed" | "manual";
}

export default function JDFallback({ onContent, reason = "failed" }: JDFallbackProps) {
  const [text, setText] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    onContent(e.target.value);
  }

  const isFailure = reason === "failed";

  return (
    <div
      className={cn(
        "space-y-2 rounded-xl border p-4",
        isFailure ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-gray-50"
      )}
    >
      <p className={cn("text-sm font-medium", isFailure ? "text-amber-800" : "text-gray-700")}>
        {isFailure
          ? "Could not fetch the JD from that URL. Please paste the job description below."
          : "Paste the job description text below."}
      </p>
      <Label htmlFor="jd-manual">Job Description (paste here)</Label>
      <Textarea
        id="jd-manual"
        rows={8}
        placeholder="Paste the full job description text here..."
        value={text}
        onChange={handleChange}
        className="bg-white"
      />
    </div>
  );
}
