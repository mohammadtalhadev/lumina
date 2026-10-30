import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabaseServer } from '@/lib/supabase-server';
import { queueInsertSchema, parseOrThrow } from '@/lib/validate';
import { rateLimitGuard } from '@/lib/rate-limit';

/**
 * POST /api/queue — enqueue one email (used by the Replies composer "Send").
 *
 * The migration's CHECK constraint allows exactly these statuses:
 *   queued | sending | sent | failed | blocked | cancelled
 * A human tapping Send IS the approval, so the row goes straight to
 * 'queued' — there is no 'draft' status, and none is invented here.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimitGuard(req);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 });
  }

  let input;
  try {
    input = parseOrThrow(queueInsertSchema, body);
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

  // The lead must exist — also gives us its campaign for the queue row.
  const { data: lead, error: leadError } = await db
    .from('leads')
    .select('id, campaign_id')
    .eq('id', input.lead_id)
    .maybeSingle();

  if (leadError) {
    return NextResponse.json({ error: 'Could not verify the lead. Try again.' }, { status: 500 });
  }
  if (!lead) {
    return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
  }

  const subject = (input.subject ?? '').trim();

  const { data, error } = await db
    .from('send_queue')
    .insert({
      lead_id: input.lead_id,
      account_id: input.account_id ?? null,
      campaign_id: lead.campaign_id,
      sequence_step: 0,
      subject,
      body: input.body.trim(),
      status: 'queued',
      idempotency_key: randomUUID(),
      scheduled_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Could not queue the reply. Try again.' }, { status: 500 });
  }

  // Timeline entry on the lead — the audit trail starts here.
  await db.from('activities').insert({
    lead_id: input.lead_id,
    type: 'reply_queued',
    note: subject ? `Reply queued: ${subject.slice(0, 120)}` : 'Reply queued.',
  });

  return NextResponse.json({ id: data.id }, { status: 201 });
}
