import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { settingsSchema, parseOrThrow } from '@/lib/validate';
import { rateLimitGuard } from '@/lib/rate-limit';

/**
 * PATCH /api/settings — update the single brand_config row (id = 1).
 * Only whitelisted columns may change; everything else is ignored.
 * Renaming the agency is audit-logged (acceptance test 9: the operator must
 * be able to see that a rename happened, since templates read from here).
 */
const ALLOWED = [
  'agency_name',
  'founder_name',
  'postal_address',
  'cal_link',
  'linkedin_headline',
  'alert_email',
  'send_window_tz',
] as const;

export async function PATCH(req: NextRequest) {
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
    input = parseOrThrow(settingsSchema, body);
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

  const patch: Record<string, string> = {};
  for (const key of ALLOWED) {
    const v = (input as Record<string, string | undefined>)[key];
    if (v !== undefined) patch[key] = v;
  }

  const { data: before } = await db
    .from('brand_config')
    .select('agency_name')
    .eq('id', 1)
    .maybeSingle();

  const { error: updateError } = await db.from('brand_config').update(patch).eq('id', 1);
  if (updateError) {
    return NextResponse.json({ error: 'Could not save settings. Try again.' }, { status: 500 });
  }

  const changed = Object.keys(patch).join(', ');
  const renamed =
    patch.agency_name !== undefined && before && patch.agency_name !== before.agency_name
      ? ` Agency renamed "${before.agency_name}" → "${patch.agency_name}" — signatures, templates, and proposals now read the new name.`
      : '';
  await db.from('activities').insert({
    lead_id: null,
    type: 'settings',
    note: `Brand settings updated (${changed}).${renamed}`,
  });

  return NextResponse.json({ ok: true });
}
