// Rate limiting. Uses Upstash Redis when UPSTASH_REDIS_REST_URL is set (shared
// across serverless instances); falls back to an in-memory window when not configured.
//
// In-memory is per-process — fine for local dev and a single-instance deploy, but
// on Vercel serverless each instance has its own counter. Set UPSTASH_REDIS_REST_URL
// (free tier) for production.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let redis: Redis | null = null;
const limiters = new Map<string, Ratelimit>();

function getRedis(): Redis | null {
  if (redis) return redis;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  try {
    redis = Redis.fromEnv();
    return redis;
  } catch {
    return null;
  }
}

function getLimiter(key: string, perMinute: number): Ratelimit | null {
  const cacheKey = `${key}:${perMinute}`;
  const cached = limiters.get(cacheKey);
  if (cached) return cached;
  const r = getRedis();
  if (!r) return null;
  const limiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(perMinute, "1 m"),
    prefix: key,
    analytics: false,
  });
  limiters.set(cacheKey, limiter);
  return limiter;
}

// In-memory fallback (per-process).
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function inMemoryLimit(key: string, opts: { windowMs: number; max: number }): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= opts.max;
}

/**
 * Rate limit a key. Returns true if allowed, false if over the limit.
 * Async because the Upstash path is async (callers must await).
 */
export async function rateLimit(
  key: string,
  opts: { windowMs: number; max: number },
): Promise<boolean> {
  // Caller's opts are per opts.windowMs; Upstash limiter is per 1m window — scale.
  const perMinute = Math.max(1, Math.round((opts.max * 60_000) / opts.windowMs));
  const limiter = getLimiter(key, perMinute);
  if (limiter) {
    try {
      return (await limiter.limit(key)) !== null;
    } catch {
      return inMemoryLimit(key, opts);
    }
  }
  return inMemoryLimit(key, opts);
}
