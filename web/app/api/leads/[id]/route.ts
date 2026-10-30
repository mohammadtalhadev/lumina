import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { canAdvanceStage, STAGE_ORDER, TERMINAL_STAGES } from '@/lib/model';
import { leadPatchSchema, parseOrThrow, uuidSchema } from '@/lib/validate';
import { rateLimitGuard } from '@/lib/rate-limit';

const KNOWN_STAGES = new Set<string>([...STAGE_ORDER, ...TERMINAL_STAGES]);

/**
 * PATCH /api/leads/[id] — update stage (forward-only) and/or grade.
 * Stage moves: next stage only, or any terminal outcome (Lost/Disqualified/
 * Suppressed) from anywhere. Backward moves are rejected with 400.
 * Every change is logged to activities.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const limited = rateLimitGuard(req);
  if (limited) return limited;

  let id: string;
  try {
    id = uuidSchema.parse(params.id);
  } catch {
    return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 });
  }

  let input;
  try {
    input = parseOrThrow(leadPatchSchema, body);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid input' }, { status: 400 });
  }

  let db;
  try {
    db = supabaseServer();
  } catch {
    return NextResponse.json({ error: 'Server is not configured (Supabase env missing).' }, { status: 503 });
  }

  const { data: lead, error: fetchError } = await db
    .from('leads')
    .select('id, stage, grade')
    .eq('id', id)
    .single();

  if (fetchError || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  const updates: Record<string, string> = {};
  const notes: string[] = [];

  if (input.grade && input.grade !== lead.grade) {
    updates.grade = input.grade;
    notes.push(`Grade changed: ${lead.grade} → ${input.grade}.`);
  }

  if (input.stage && input.stage !== lead.stage) {
    if (!KNOWN_STAGES.has(input.stage)) {
      return NextResponse.json({ error: `Unknown stage "${input.stage}".` }, { status: 400 });
    }
    if (!canAdvanceStage(lead.stage, input.stage)) {
      return NextResponse.json(
        { error: `Stages only move forward — cannot go from "${lead.stage}" back to "${input.stage}". Log a manual correction instead.` },
        { status: 400 }
      );
    }
    updates.stage = input.stage;
    notes.push(`Stage moved: ${lead.stage} → ${input.stage}.`);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  const { error: updateError } = await db.from('leads').update(updates).eq('id', id);
  if (updateError) {
    return NextResponse.json({ error: 'Could not update the lead. Try again.' }, { status: 500 });
  }

  for (const note of notes) {
    await db.from('activities').insert({ lead_id: id, type: 'update', note });
  }

  return NextResponse.json({ ok: true });
}
