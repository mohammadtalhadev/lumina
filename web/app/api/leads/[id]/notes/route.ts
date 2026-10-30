import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { noteSchema, parseOrThrow, uuidSchema } from '@/lib/validate';

/** POST /api/leads/[id]/notes — append a research note to the timeline. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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
    input = parseOrThrow(noteSchema, body);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid input' }, { status: 400 });
  }

  let db;
  try {
    db = supabaseServer();
  } catch {
    return NextResponse.json({ error: 'Server is not configured (Supabase env missing).' }, { status: 503 });
  }

  const { data: lead, error: fetchError } = await db.from('leads').select('id').eq('id', id).single();
  if (fetchError || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  const { error } = await db.from('activities').insert({ lead_id: id, type: 'note', note: input.note });
  if (error) {
    return NextResponse.json({ error: 'Could not save the note. Try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
