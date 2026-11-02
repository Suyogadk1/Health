// Minimal in-memory sliding-window rate limiter, keyed by user id. This is
// fine for a single Node process; for a real multi-instance deployment swap
// this for a shared store such as Upstash Redis, keeping the same signature.
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 15;

const buckets = new Map<string, number[]>();

export function checkRateLimit(key: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const timestamps = (buckets.get(key) || []).filter((t) => now - t < WINDOW_MS);

  if (timestamps.length >= MAX_REQUESTS) {
    const retryAfterMs = WINDOW_MS - (now - timestamps[0]);
    return { allowed: false, retryAfterMs };
  }

  timestamps.push(now);
  buckets.set(key, timestamps);
  return { allowed: true };
}
