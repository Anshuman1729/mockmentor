"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Briefcase, Clock } from "lucide-react";

interface SessionSummary {
  id: string;
  role: string;
  company: string;
  yoe: number;
  round_type: string;
  created_at: string;
  status: string;
  hire_recommendation: string | null;
  hire_probability: number | null;
}

function RecommendationBadge({ rec }: { rec: string | null }) {
  if (!rec)
    return (
      <Badge variant="secondary" className="text-xs">
        In Progress
      </Badge>
    );
  if (rec === "Strong Hire")
    return (
      <Badge className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20">
        {rec}
      </Badge>
    );
  if (rec === "Borderline")
    return (
      <Badge className="text-xs bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20">
        {rec}
      </Badge>
    );
  return (
    <Badge className="text-xs bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/20">
      {rec}
    </Badge>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function SessionHistory() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions ?? []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[72px] rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
        No past interviews yet. Complete your first mock above.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sessions.map((s) => (
        <Card
          key={s.id}
          className="border-border/60 hover:border-border transition-colors"
        >
          <CardContent className="py-4 px-5 flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">
                  {s.role}
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    @ {s.company}
                  </span>
                </span>
                <RecommendationBadge rec={s.hire_recommendation} />
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3 h-3" />
                  {s.round_type} · {s.yoe} YOE
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(s.created_at)}
                </span>
                {s.hire_probability !== null && (
                  <span className="font-medium">
                    {s.hire_probability}% hire probability
                  </span>
                )}
              </div>
            </div>
            <Button asChild variant="ghost" size="sm" className="shrink-0 gap-1">
              <Link href={`/debrief/${s.id}`}>
                {s.hire_recommendation ? "View Debrief" : "Resume"}
                <ArrowRight className="w-3 h-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
