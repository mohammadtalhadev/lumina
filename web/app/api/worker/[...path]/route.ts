import { NextRequest, NextResponse } from 'next/server';
import { workerPathSchema, WORKER_METHODS, parseOrThrow } from '@/lib/validate';
import { rateLimitGuard } from '@/lib/rate-limit';

/**
 * Worker proxy — the ONLY way the browser reaches the Python worker.
 *
 * Why a proxy: the worker's URL (and any future auth) must never ship to the
 * browser. WORKER_URL is server-only (no NEXT_PUBLIC_ prefix — the name is
 * rejected loudly if someone adds one). Only the whitelisted paths below are
 * forwarded, each with its fixed HTTP method; anything else is a 404.
 *
 * When the worker isn't configured yet (Phase 0 not done), every call fails
 * with an honest 503 — never a hang, never a fake success.
 */

const TIMEOUT_MS = 60_000;

function notConfigured() {
  return NextResponse.json(
    {
      error:
        'Worker is not configured (WORKER_URL is missing). Start the Python worker and set WORKER_URL, then try again.',
    },
    { status: 503 }
  );
}

async function forward(req: NextRequest, segments: string[], method: 'GET' | 'POST') {
  // Defense: no traversal, no empty segments, no encoded slashes.
  if (
    segments.length === 0 ||
    segments.some((s) => !s || s === '.' || s === '..' || s.includes('/') || s.includes('\\'))
  ) {
    return NextResponse.json({ error: 'Unknown worker endpoint.' }, { status: 404 });
  }

  let path;
  try {
    path = parseOrThrow(workerPathSchema, segments.join('/'));
  } catch {
    return NextResponse.json({ error: 'Unknown worker endpoint.' }, { status: 404 });
  }

  if (WORKER_METHODS[path] !== method) {
    return NextResponse.json({ error: `This endpoint only accepts ${WORKER_METHODS[path]}.` }, { status: 405 });
  }

  // Server-only by construction: route handlers never run in the browser,
  // and a NEXT_PUBLIC_ name would be a leak — refuse it outright.
  const raw = process.env.WORKER_URL;
  if (!raw) return notConfigured();
  if (process.env.NEXT_PUBLIC_WORKER_URL) {
    return NextResponse.json(
      { error: 'Server misconfigured: worker URL must not be public.' },
      { status: 500 }
    );
  }
  const base = raw.replace(/\/+$/, '');
  const target = `${base}/${path}${req.nextUrl.search}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let forwardBody: string | undefined;
    if (method === 'POST') {
      try {
        forwardBody = await req.text();
      } catch {
        forwardBody = undefined;
      }
    }
    const upstream = await fetch(target, {
      method,
      headers: { 'content-type': 'application/json' },
      body: forwardBody || undefined,
      signal: controller.signal,
    });
    const text = await upstream.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text.slice(0, 2000) };
    }
    return NextResponse.json(data, { status: upstream.status });
  } catch (e) {
    const reason = e instanceof Error && e.name === 'AbortError' ? 'timed out' : 'unreachable';
    return NextResponse.json(
      { error: `Worker ${reason} at the configured URL. Is the Python worker running?` },
      { status: 502 }
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const limited = rateLimitGuard(req);
  if (limited) return limited;

  return forward(req, params.path ?? [], 'GET');
}

export async function POST(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const limited = rateLimitGuard(req);
  if (limited) return limited;

  return forward(req, params.path ?? [], 'POST');
}
