// Simple in-memory fixed-window rate limiter.
// Note: state is per-process — on serverless (Vercel) each instance has its own
// counter and cold starts reset it. Good enough to slow brute force; for strict
// limits use Upstash/Redis in production.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  opts: { windowMs: number; max: number },
): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= opts.max;
}
