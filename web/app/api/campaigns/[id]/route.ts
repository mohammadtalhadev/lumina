import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { campaignPatchSchema, uuidSchema, parseOrThrow } from '@/lib/validate';
import { rateLimitGuard } from '@/lib/rate-limit';

/**
 * PATCH /api/campaigns/[id] — activate or pause a campaign.
 * The one-active-campaign guardrail lives in the UI (warning + explicit
 * confirm); the API stays honest and simply flips the flag.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const limited = rateLimitGuard(req);
  if (limited) return limited;

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
    input = parseOrThrow(campaignPatchSchema, body);
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

  const { error } = await db.from('campaigns').update({ is_active: input.is_active }).eq('id', id);
  if (error) {
    return NextResponse.json({ error: 'Could not update the campaign. Try again.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, is_active: input.is_active });
}
