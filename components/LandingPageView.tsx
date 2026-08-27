"use client";

import { useEffect } from "react";
import { trackClient } from "@/lib/analytics-client";

// Fire-once mount tracker for the landing page — funnel stage 1 (anonymous
// visit). A tiny client leaf rendered from the server-component landing
// page, same pattern as <Analytics /> and <InteractivePreview />.
export default function LandingPageView() {
  useEffect(() => {
    trackClient("landing_page_viewed");
  }, []);

  return null;
}
