import mixpanel from "mixpanel-browser";

// Client-side counterpart to lib/analytics.ts, for the anonymous/pre-auth
// top-of-funnel stages a server-side-only call can never see (landing page
// visit, CTA click, setup form completion before sign-up). Same philosophy:
// lazy init, fail open (never throw into a click handler), drop
// null/undefined properties. Session Replay is explicitly disabled
// (record_sessions_percent: 0) — considered and declined, see BACKLOG.md.
let _initialized = false;

function ensureInit(): boolean {
  if (typeof window === "undefined") return false;
  if (_initialized) return true;
  const token = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
  if (!token) {
    console.warn("[analytics-client] NEXT_PUBLIC_MIXPANEL_TOKEN not set — events will be dropped");
    return false;
  }
  mixpanel.init(token, {
    autocapture: false,
    record_sessions_percent: 0,
    persistence: "localStorage",
  });
  _initialized = true;
  return true;
}

export function trackClient(event: string, properties: Record<string, unknown> = {}): void {
  try {
    if (!ensureInit()) return;
    const cleaned = Object.fromEntries(
      Object.entries(properties).filter(([, v]) => v !== null && v !== undefined)
    );
    mixpanel.track(event, cleaned);
  } catch (err) {
    console.error(`[analytics-client] failed to track "${event}"`, err);
  }
}

// Merges this browser's pre-login (anonymous device-id) activity into the
// authenticated profile — Mixpanel's Simplified ID Merge. userId must be
// the same Clerk userId used as distinct_id server-side (lib/analytics.ts)
// so client and server events land on one person, not two.
export function identifyClient(userId: string): void {
  try {
    if (!ensureInit()) return;
    mixpanel.identify(userId);
  } catch (err) {
    console.error("[analytics-client] failed to identify", err);
  }
}
