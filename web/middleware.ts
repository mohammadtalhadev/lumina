import { NextRequest, NextResponse } from 'next/server';

/**
 * Tiny in-memory rate limiter for /api/* — 60 requests/minute per IP.
 *
 * Why here: one place covering every API route (including the worker proxy),
 * no per-route boilerplate, no new dependencies.
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

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  // req.ip is only populated on some runtimes; fall back gracefully.
  return (req as unknown as { ip?: string }).ip || 'unknown';
}

export function middleware(req: NextRequest) {
  if (isLimited(clientIp(req))) {
    return NextResponse.json(
      { error: 'Too many requests. Slow down and try again in a minute.' },
      { status: 429 }
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
