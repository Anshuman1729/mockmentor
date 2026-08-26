import Mixpanel from "mixpanel";
import { createHash } from "crypto";

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

// distinctId must be Clerk's stable userId, never user_email — emails can
// change, which would fragment a user's history across two Mixpanel
// profiles. Never pass hire_probability or raw signal scores in properties
// — those stay internal per the non-negotiable rule in CLAUDE.md; a
// bucketed recommendation (strong_hire/hire/borderline/no_hire) is the most
// granular outcome data that should ever leave this app for a third-party
// vendor. Properties with a null/undefined value are dropped rather than
// sent as null, per Mixpanel's own data-hygiene convention.
export function track(
  event: string,
  distinctId: string,
  properties: Record<string, unknown> = {}
): void {
  try {
    const client = getClient();
    if (!client) return;
    const cleaned = Object.fromEntries(
      Object.entries(properties).filter(([, v]) => v !== null && v !== undefined)
    );
    client.track(event, { distinct_id: distinctId, ...cleaned });
  } catch (err) {
    console.error(`[analytics] failed to track "${event}"`, err);
  }
}

// One-time (or infrequent) profile write so a user reads as their email in
// the Mixpanel UI instead of a bare Clerk ID — call at most once per session
// creation, not on every event.
export function setProfile(distinctId: string, properties: Record<string, unknown>): void {
  try {
    const client = getClient();
    if (!client) return;
    client.people.set(distinctId, properties);
  } catch (err) {
    console.error("[analytics] failed to set profile", err);
  }
}

// Deterministic $insert_id for server-side dedup against client-side retries
// (e.g. a fetch() that times out but actually succeeded, then retries). Same
// inputs -> same id -> Mixpanel drops the second ingestion; different inputs
// (a genuinely new attempt) still produce a distinct id.
export function stableInsertId(...parts: string[]): string {
  return createHash("sha256").update(parts.join(":")).digest("hex");
}
