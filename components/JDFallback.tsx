"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface JDFallbackProps {
  onContent: (content: string) => void;
}

export default function JDFallback({ onContent }: JDFallbackProps) {
  const [text, setText] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    onContent(e.target.value);
  }

  return (
    <div className="space-y-2 rounded-md border border-yellow-300 bg-yellow-50 p-4">
      <p className="text-sm font-medium text-yellow-800">
        Could not fetch the JD from that URL. Please paste the job description below.
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
