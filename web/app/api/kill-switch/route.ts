import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { killSwitchSchema, parseOrThrow } from '@/lib/validate';

/**
 * POST /api/kill-switch — the global emergency brake.
 *
 * pause:   flips every active campaign off (pending queue items wait, nothing
 *          is deleted) and writes an audit row recording WHICH campaigns were
 *          paused, so resume can restore exactly those.
 * resume:  re-activates only the campaigns the kill-switch paused (read back
 *          from the audit log). Campaigns the operator paused by hand stay
 *          paused. If no kill-switch pause is on record, resume is a no-op
 *          with an honest message.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 });
  }

  let input;
  try {
    input = parseOrThrow(killSwitchSchema, body);
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

  const at = new Date().toISOString();

  if (input.action === 'pause') {
    const { data: active, error: readError } = await db
      .from('campaigns')
      .select('id, name')
      .eq('is_active', true);
    if (readError) {
      return NextResponse.json({ error: 'Could not read campaigns. Try again.' }, { status: 500 });
    }
    const ids = (active ?? []).map((c) => c.id);

    const { error: pauseError } = await db
      .from('campaigns')
      .update({ is_active: false })
      .eq('is_active', true);
    if (pauseError) {
      return NextResponse.json({ error: 'Could not pause campaigns. Try again.' }, { status: 500 });
    }

    await db.from('activities').insert({
      lead_id: null,
      type: 'kill_switch',
      note: JSON.stringify({ event: 'kill_switch_pause', paused_campaign_ids: ids, at }),
    });

    return NextResponse.json({ ok: true, action: 'pause', paused: ids.length });
  }

  // resume: restore exactly what the kill-switch paused
  const { data: last, error: logError } = await db
    .from('activities')
    .select('note')
    .eq('type', 'kill_switch')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (logError) {
    return NextResponse.json({ error: 'Could not read the audit log. Try again.' }, { status: 500 });
  }

  let ids: string[] = [];
  try {
    const parsed = last?.note ? (JSON.parse(last.note) as { event?: string; paused_campaign_ids?: unknown }) : null;
    if (parsed?.event === 'kill_switch_pause' && Array.isArray(parsed.paused_campaign_ids)) {
      ids = parsed.paused_campaign_ids.filter((x): x is string => typeof x === 'string');
    }
  } catch {
    ids = [];
  }

  if (ids.length > 0) {
    const { error: resumeError } = await db
      .from('campaigns')
      .update({ is_active: true })
      .in('id', ids);
    if (resumeError) {
      return NextResponse.json({ error: 'Could not resume campaigns. Try again.' }, { status: 500 });
    }
  }

  await db.from('activities').insert({
    lead_id: null,
    type: 'kill_switch',
    note: JSON.stringify({ event: 'kill_switch_resume', resumed_campaign_ids: ids, at }),
  });

  return NextResponse.json({
    ok: true,
    action: 'resume',
    resumed: ids.length,
    note: ids.length === 0 ? 'No kill-switch pause on record — nothing was resumed.' : undefined,
  });
}
