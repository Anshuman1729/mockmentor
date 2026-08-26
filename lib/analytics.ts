import Mixpanel from "mixpanel";

// Lazy client — only instantiated on first use (avoids build-time env var errors,
// same pattern as lib/groq.ts and lib/db.ts). Analytics must never break the
// product: track() swallows every failure instead of throwing, so a missing
// token, a network error, or a Mixpanel outage just means a dropped event.
let _client: Mixpanel.Mixpanel | null = null;
let _warnedMissingToken = false;

function getClient(): Mixpanel.Mixpanel | null {
  if (!process.env.MIXPANEL_TOKEN) {
    if (!_warnedMissingToken) {
      console.warn("[analytics] MIXPANEL_TOKEN not set — events will be dropped");
      _warnedMissingToken = true;
    }
    return null;
  }
  if (!_client) {
    _client = Mixpanel.init(process.env.MIXPANEL_TOKEN);
  }
  return _client;
}

// distinctId is user_email — already the app's primary user identifier
// (sessions.user_email), so this introduces no new PII beyond what's already
// stored. Never pass hire_probability or raw signal scores in properties —
// those stay internal per the non-negotiable rule in CLAUDE.md; a bucketed
// recommendation (Strong Hire/Hire/Borderline/No Hire) is the most granular
// outcome data that should ever leave this app for a third-party vendor.
export function track(
  event: string,
  distinctId: string,
  properties: Record<string, unknown> = {}
): void {
  try {
    const client = getClient();
    if (!client) return;
    client.track(event, { distinct_id: distinctId, ...properties });
  } catch (err) {
    console.error(`[analytics] failed to track "${event}"`, err);
  }
}
