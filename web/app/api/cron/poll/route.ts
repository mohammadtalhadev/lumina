import { NextResponse } from 'next/server';
import { rateLimitGuard } from '@/lib/rate-limit';

/**
 * Vercel Cron entrypoint — GET /api/cron/poll every 15 min.
 *
 * Why this exists: the Python worker is an INTERNAL service (no public
 * traffic), so external cron (cron-job.org) can't reach it. Vercel Cron
 * hits this web route, which forwards to the worker through the service
 * binding (WORKER_URL is injected by Vercel at runtime — never set it
 * manually in env vars).
 *
 * Security: if CRON_SECRET is set, the request must carry
 * `Authorization: Bearer <CRON_SECRET>` (Vercel sends this automatically
 * for cron invocations). Without it → 401.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const limited = rateLimitGuard(req);
  if (limited) return limited;

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
  }

  const base = (process.env.WORKER_URL || '').replace(/\/+$/, '');
  if (!base) {
    return NextResponse.json(
      { error: 'Worker not configured (WORKER_URL missing).' },
      { status: 503 }
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55_000);
  try {
    const upstream = await fetch(`${base}/workers/poll/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json({ ok: upstream.ok, poll: data }, { status: upstream.status });
  } catch (e) {
    const reason = e instanceof Error && e.name === 'AbortError' ? 'timed out' : 'unreachable';
    return NextResponse.json({ error: `Worker ${reason}.` }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
