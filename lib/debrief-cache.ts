// In-memory, per-process TTL cache for a debrief's call-1 scoring output,
// keyed by session_id. Same known limitation as lib/rate-limit.ts: single
// instance, resets on redeploy, doesn't share state across instances on
// Vercel — accepted as a best-effort optimisation, never as the correctness
// mechanism (see docs/plans/debrief-tpm-fix.md §5). A retry that lands on a
// different lambda instance simply misses and re-runs both Groq calls, which
// is exactly today's behaviour — no regression on miss.
//
// Purpose: when call 2 (synthesis) is deferred because the TPM window is
// exhausted, call 1's scoring result is stashed here so a client retry can
// skip call 1 entirely and go straight to call 2 — the retry then only needs
// ~7,700 tokens instead of ~15,100, comfortably fitting a fresh window.
//
// Only ever written after the debrief route's completeness gate has passed,
// so a cached scoring can never correspond to a session that later gains
// answers — sessions are effectively immutable once complete, making
// session_id alone a safe key.

import type { CoreScoring } from "./groq";

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ENTRIES = 200;

interface CacheEntry {
  scoring: CoreScoring;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function evictExpired(): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
}

export function setCachedScoring(sessionId: string, scoring: CoreScoring): void {
  evictExpired();
  if (cache.size >= MAX_ENTRIES && !cache.has(sessionId)) {
    // Evict the oldest entry (Map preserves insertion order) rather than
    // growing unbounded — a low-value, best-effort cache doesn't need LRU.
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(sessionId, { scoring, expiresAt: Date.now() + TTL_MS });
}

export function getCachedScoring(sessionId: string): CoreScoring | undefined {
  const entry = cache.get(sessionId);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(sessionId);
    return undefined;
  }
  return entry.scoring;
}

export function clearCachedScoring(sessionId: string): void {
  cache.delete(sessionId);
}

// Test-only escape hatch — mirrors no equivalent in lib/rate-limit.ts today,
// but debrief-cache.spec.ts needs to assert eviction/expiry deterministically
// without reaching into module-private state.
export function _debugCacheSize(): number {
  return cache.size;
}
