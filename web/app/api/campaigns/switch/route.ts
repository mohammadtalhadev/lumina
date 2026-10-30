import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { campaignSwitchSchema, parseOrThrow } from '@/lib/validate';

/**
 * POST /api/campaigns/switch — activate one campaign, pause all others.
 * The one-active-campaign guardrail is enforced here (not just the UI):
 * activation is exclusive by construction. The switch is audit-logged.
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
    input = parseOrThrow(campaignSwitchSchema, body);
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

  const { data: target, error: readError } = await db
    .from('campaigns')
    .select('id, name')
    .eq('id', input.id)
    .maybeSingle();
  if (readError) {
    return NextResponse.json({ error: 'Could not read campaigns. Try again.' }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
  }

  const { error: offError } = await db
    .from('campaigns')
    .update({ is_active: false })
    .eq('is_active', true);
  if (offError) {
    return NextResponse.json({ error: 'Could not pause other campaigns. Try again.' }, { status: 500 });
  }

  const { error: onError } = await db
    .from('campaigns')
    .update({ is_active: true })
    .eq('id', input.id);
  if (onError) {
    return NextResponse.json({ error: 'Could not activate the campaign. Try again.' }, { status: 500 });
  }

  await db.from('activities').insert({
    lead_id: null,
    type: 'campaign_switch',
    note: `Activated campaign "${target.name}" (${target.id}); all other campaigns paused (one-active guardrail).`,
  });

  return NextResponse.json({ ok: true, active_id: input.id });
}
