import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { queueActionSchema, uuidSchema, parseOrThrow } from '@/lib/validate';

/**
 * PATCH /api/queue/[id] — pause (→ cancelled) or retry (→ queued, attempts reset).
 * Direct DB update: the Python worker exposes no per-item endpoints, so the
 * dashboard owns these transitions. The worker only ever consumes 'queued'.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  let id: string;
  try {
    id = parseOrThrow(uuidSchema, params.id);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 });
  }

  let input;
  try {
    input = parseOrThrow(queueActionSchema, body);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid input' }, { status: 400 });
  }

  let db;
  try {
    db = supabaseServer();
  } catch {
    return NextResponse.json(
      { error: 'Server is not configured (Supabase env missing).' },
      { status: 503 }
    );
  }

  const { data: row, error: fetchError } = await db
    .from('send_queue')
    .select('id, status')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: 'Could not load the queue item. Try again.' }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: 'Queue item not found.' }, { status: 404 });
  }

  if (input.action === 'pause') {
    if (!['queued', 'sending', 'blocked', 'failed'].includes(row.status)) {
      return NextResponse.json(
        { error: `Only queued, sending, blocked or failed items can be paused (this one is ${row.status}).` },
        { status: 400 }
      );
    }
    const { error } = await db.from('send_queue').update({ status: 'cancelled' }).eq('id', id);
    if (error) return NextResponse.json({ error: 'Could not pause the item. Try again.' }, { status: 500 });
    return NextResponse.json({ ok: true, status: 'cancelled' });
  }

  // retry
  if (!['failed', 'blocked'].includes(row.status)) {
    return NextResponse.json(
      { error: `Only failed or blocked items can be retried (this one is ${row.status}).` },
      { status: 400 }
    );
  }
  const { error } = await db
    .from('send_queue')
    .update({ status: 'queued', attempts: 0, next_attempt_at: null, error: '' })
    .eq('id', id);
  if (error) return NextResponse.json({ error: 'Could not retry the item. Try again.' }, { status: 500 });
  return NextResponse.json({ ok: true, status: 'queued' });
}
