"use client";

import Link from "next/link";
import { trackClient } from "@/lib/analytics-client";

// Funnel stage 2 (CTA clicked) — a plain Link can't carry an onClick from
// the server-component landing page, so conversion-intent CTAs render this
// small client leaf instead. cta_location differentiates the click site;
// kept as one event + property rather than a new event name per button.
export default function TrackedCta({
  href,
  ctaLocation,
  className,
  children,
}: {
  href: string;
  ctaLocation: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackClient("cta_clicked", { cta_location: ctaLocation })}
    >
      {children}
    </Link>
  );
}
