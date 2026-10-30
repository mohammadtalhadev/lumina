import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { callSchema, parseOrThrow } from '@/lib/validate';
import { rateLimitGuard } from '@/lib/rate-limit';

/**
 * POST /api/calls — log a call outcome or schedule a future call.
 * The calls table has no scheduled_at column; the scheduled time and
 * free-text notes ride in notes_json ({ scheduled_at, notes }), which the
 * UI parses defensively.
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
    input = parseOrThrow(callSchema, body);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid input' }, { status: 400 });
  }

  const scheduled = new Date(input.scheduled_at);
  if (Number.isNaN(scheduled.getTime())) {
    return NextResponse.json({ error: 'scheduled_at is not a valid date/time.' }, { status: 400 });
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

  const { data: lead, error: leadError } = await db
    .from('leads')
    .select('id, contact_name, company')
    .eq('id', input.lead_id)
    .maybeSingle();
  if (leadError) {
    return NextResponse.json({ error: 'Could not read leads. Try again.' }, { status: 500 });
  }
  if (!lead) {
    return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
  }

  const { data: call, error: insertError } = await db
    .from('calls')
    .insert({
      lead_id: input.lead_id,
      outcome: input.outcome,
      notes_json: { scheduled_at: scheduled.toISOString(), notes: input.notes ?? '' },
    })
    .select('id')
    .single();
  if (insertError || !call) {
    return NextResponse.json({ error: 'Could not save the call. Try again.' }, { status: 500 });
  }

  await db.from('activities').insert({
    lead_id: input.lead_id,
    type: 'call',
    note: `Call ${input.outcome === 'scheduled' ? 'scheduled' : `logged (${input.outcome})`} for ${scheduled.toLocaleString()} — ${lead.contact_name} (${lead.company}).${input.notes ? ` Notes: ${input.notes}` : ''}`,
  });

  return NextResponse.json({ ok: true, id: call.id }, { status: 201 });
}
