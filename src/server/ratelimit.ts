import "server-only";
import { AppError } from "./util";
import { requestMeta } from "./log";

type Bucket = { hits: number[] };
const g = globalThis as unknown as { __rl?: Map<string, Bucket> };
const store = (): Map<string, Bucket> => (g.__rl ??= new Map<string, Bucket>());

/**
 * Sliding-window limiter. In-memory (per process); for multi-instance deployments swap the store for Redis
 * behind this same function signature.
 */
export function rateLimitKey(key: string, limit: number, windowSec: number): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const s = store();
  const b = s.get(key) ?? { hits: [] };
  b.hits = b.hits.filter((t) => now - t < windowSec * 1000);
  if (b.hits.length >= limit) {
    s.set(key, b);
    return { allowed: false, retryAfter: Math.ceil((windowSec * 1000 - (now - b.hits[0]!)) / 1000) };
  }
  b.hits.push(now);
  s.set(key, b);
  if (s.size > 20000) for (const [k, v] of s) if (!v.hits.length || now - v.hits[v.hits.length - 1]! > 3600_000) s.delete(k);
  return { allowed: true, retryAfter: 0 };
}

/** Throws AppError(429) when exceeded. Key is scoped by client IP and the supplied scope. */
export async function enforceRateLimit(scope: string, limit: number, windowSec: number, subject?: string) {
  const { ip } = await requestMeta();
  const r = rateLimitKey(`${scope}:${subject ?? ip}`, limit, windowSec);
  if (!r.allowed) throw new AppError(429, `Too many requests. Try again in ${r.retryAfter}s.`, "rate_limited");
}
