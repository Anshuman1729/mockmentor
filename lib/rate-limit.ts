// In-memory, per-process fixed-window rate limiter. Good enough for a
// low-stakes, low-value public endpoint on a single Next.js instance — it
// resets on redeploy and doesn't share state across instances, which is a
// known, accepted limitation, not a bug. Move to a shared store (e.g. Upstash
// Redis) if this ever needs to hold under a real scaled/multi-instance abuse attempt.
const buckets = new Map<string, { count: number; windowStart: number }>();

// Periodically forget stale IPs so the map doesn't grow unbounded.
const MAX_TRACKED_KEYS = 5000;

export function checkRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    if (buckets.size > MAX_TRACKED_KEYS) {
      for (const [k, v] of buckets) {
        if (now - v.windowStart >= windowMs) buckets.delete(k);
      }
    }
    return { ok: true };
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfterMs: windowMs - (now - bucket.windowStart) };
  }

  bucket.count += 1;
  return { ok: true };
}

export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
