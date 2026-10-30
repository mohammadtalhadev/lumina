import { NextResponse } from 'next/server';

/**
 * Tiny in-memory rate limiter for /api/* — 60 requests/minute per IP.
 *
 * History: this used to live in middleware.ts (one place, Edge runtime).
 * Vercel "services" mode does NOT support the Edge runtime, so the limiter
 * moved here and is called as the first line of every API route handler
 * instead: `const limited = rateLimitGuard(req); if (limited) return limited;`
 *
 * LIMITATION (documented, not hidden): the bucket map lives in this
 * instance's memory. On Vercel each serverless instance has its own buckets,
 * so a distributed flood isn't fully stopped. Proper fix later: a
 * Redis-backed limiter (e.g. Upstash) shared across instances. For a
 * single-operator dashboard this is the right cost/complexity trade-off.
 */
const WINDOW_MS = 60_000;
const MAX_REQ = 60;
const MAX_BUCKETS = 5000;

const buckets = new Map<string, { count: number; reset: number }>();

function isLimited(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now > b.reset) {
    buckets.set(ip, { count: 1, reset: now + WINDOW_MS });
    if (buckets.size > MAX_BUCKETS) {
      buckets.forEach((v, k) => {
        if (buckets.size > MAX_BUCKETS && now > v.reset) buckets.delete(k);
      });
    }
    return false;
  }
  b.count += 1;
  return b.count > MAX_REQ;
}

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return 'unknown';
}

/**
 * Returns a 429 JSON response when the caller's IP exceeded the limit,
 * or null when the request may proceed. Call FIRST in every /api/* handler.
 */
export function rateLimitGuard(req: Request): NextResponse | null {
  if (isLimited(clientIp(req))) {
    return NextResponse.json(
      { error: 'Too many requests. Slow down and try again in a minute.' },
      { status: 429 }
    );
  }
  return null;
}
