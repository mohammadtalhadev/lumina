import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { campaignCreateSchema, parseOrThrow } from '@/lib/validate';

function dbOr503() {
  try {
    return { db: supabaseServer(), error: null as null };
  } catch {
    return {
      db: null,
      error: NextResponse.json(
        { error: 'Server is not configured (Supabase env missing).' },
        { status: 503 }
      ),
    };
  }
}

/**
 * POST /api/campaigns — create a campaign from a niche preset or by cloning.
 * New campaigns always start paused (is_active=false); activation is a
 * deliberate second step with the one-active-campaign guardrail warning.
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
    input = parseOrThrow(campaignCreateSchema, body);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid input' }, { status: 400 });
  }

  const { db, error: dbError } = dbOr503();
  if (!db) return dbError;

  // Clone path: copy an existing campaign's modules verbatim.
  if (input.clone_from) {
    const { data: src, error: srcError } = await db
      .from('campaigns')
      .select('*')
      .eq('id', input.clone_from)
      .maybeSingle();

    if (srcError) {
      return NextResponse.json({ error: 'Could not load the source campaign.' }, { status: 500 });
    }
    if (!src) {
      return NextResponse.json({ error: 'Source campaign not found.' }, { status: 404 });
    }

    const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = src;
    const { data, error } = await db
      .from('campaigns')
      .insert({ ...rest, name: input.name, is_active: false })
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Could not clone the campaign. Try again.' }, { status: 500 });
    }
    return NextResponse.json({ id: data.id }, { status: 201 });
  }

  // Preset path: start from a campaign_templates row (niche is data, not code).
  let sequenceGaps: unknown = [0, 3, 7, 12];
  const presetNiche = (input.preset_niche || '').trim();
  if (presetNiche) {
    const { data: tpl, error: tplError } = await db
      .from('campaign_templates')
      .select('campaign_json')
      .eq('niche', presetNiche)
      .maybeSingle();
    if (tplError) {
      return NextResponse.json({ error: 'Could not load the preset. Try again.' }, { status: 500 });
    }
    if (!tpl) {
      return NextResponse.json({ error: `No preset found for niche "${presetNiche}".` }, { status: 404 });
    }
    const gaps = (tpl.campaign_json as { sequence_gaps?: unknown } | null)?.sequence_gaps;
    if (Array.isArray(gaps) && gaps.every((g) => typeof g === 'number')) {
      sequenceGaps = gaps;
    }
  }

  const { data, error } = await db
    .from('campaigns')
    .insert({
      name: input.name,
      niche: input.niche,
      sequence_gaps_json: sequenceGaps,
      is_active: false,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Could not create the campaign. Try again.' }, { status: 500 });
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}
