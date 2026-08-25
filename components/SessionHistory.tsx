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
}

function RecommendationBadge({ rec }: { rec: string | null }) {
  if (!rec)
    return (
      <Badge variant="secondary" className="text-xs">
        In Progress
      </Badge>
    );
  if (rec === "Strong Hire" || rec === "Hire")
    return (
      <Badge className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
        {rec}
      </Badge>
    );
  if (rec === "Borderline")
    return (
      <Badge className="text-xs bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100">
        {rec}
      </Badge>
    );
  return (
    <Badge className="text-xs bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">
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
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3 h-3" />
                  {s.round_type} · {s.yoe} YOE
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(s.created_at)}
                </span>
              </div>
            </div>
            <Button asChild variant="ghost" size="sm" className="shrink-0 gap-1 h-[44px]">
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
