import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import {
  sequenceStepSchema,
  sequenceStepPutSchema,
  uuidSchema,
  parseOrThrow,
} from '@/lib/validate';
import { joinTemplate } from '@/lib/model';

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

async function readJson(req: NextRequest): Promise<{ ok: true; value: unknown } | { ok: false; res: NextResponse }> {
  try {
    return { ok: true, value: await req.json() };
  } catch {
    return { ok: false, res: NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 }) };
  }
}

/**
 * POST /api/sequences — add a step to a campaign's sequence.
 * One step per (campaign, step_day): the UNIQUE constraint guards it (409).
 */
export async function POST(req: NextRequest) {
  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.res;

  let input;
  try {
    input = parseOrThrow(sequenceStepSchema, parsed.value);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid input' }, { status: 400 });
  }

  const { db, error: dbError } = dbOr503();
  if (!db) return dbError;

  const { data, error } = await db
    .from('sequences')
    .insert({
      campaign_id: input.campaign_id,
      step_day: input.step_day,
      template: joinTemplate(input.subject ?? '', input.body),
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: `Day ${input.step_day} already has a step in this campaign. Edit it instead.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Could not save the step. Try again.' }, { status: 500 });
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}

/**
 * PUT /api/sequences — replace a step (client always sends the full step).
 */
export async function PUT(req: NextRequest) {
  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.res;

  let input;
  try {
    input = parseOrThrow(sequenceStepPutSchema, parsed.value);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid input' }, { status: 400 });
  }

  const { db, error: dbError } = dbOr503();
  if (!db) return dbError;

  const { error } = await db
    .from('sequences')
    .update({
      step_day: input.step_day,
      template: joinTemplate(input.subject ?? '', input.body),
    })
    .eq('id', input.id);

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: `Day ${input.step_day} already has a step in this campaign.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Could not update the step. Try again.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/sequences?id=<uuid> — remove a step (confirm in the UI first).
 */
export async function DELETE(req: NextRequest) {
  let id: string;
  try {
    id = parseOrThrow(uuidSchema, req.nextUrl.searchParams.get('id'));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid id' }, { status: 400 });
  }

  const { db, error: dbError } = dbOr503();
  if (!db) return dbError;

  const { error } = await db.from('sequences').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: 'Could not delete the step. Try again.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
