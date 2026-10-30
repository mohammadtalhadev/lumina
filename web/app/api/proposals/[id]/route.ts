import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { proposalStatusSchema, uuidSchema, parseOrThrow } from '@/lib/validate';
import { canAdvanceProposal } from '@/lib/model';
import type { ProposalRow } from '@/lib/model';

/**
 * PATCH /api/proposals/[id] — advance a proposal forward only.
 * draft → sent → accepted | rejected. Terminal states never move.
 * The transition is checked against the CURRENT row server-side, so a
 * stale client can never skip draft → accepted.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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
    input = parseOrThrow(proposalStatusSchema, body);
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

  const { data: row, error: readError } = await db
    .from('proposals')
    .select('id, lead_id, status')
    .eq('id', id)
    .maybeSingle();
  if (readError) {
    return NextResponse.json({ error: 'Could not read the proposal. Try again.' }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: 'Proposal not found.' }, { status: 404 });
  }

  const current = row.status as ProposalRow['status'];
  if (!canAdvanceProposal(current, input.status)) {
    return NextResponse.json(
      { error: `Cannot move a proposal from ${current} to ${input.status} — proposals only move forward.` },
      { status: 409 }
    );
  }

  const patch: { status: string; sent_at?: string } = { status: input.status };
  if (input.status === 'sent') patch.sent_at = new Date().toISOString();

  const { error: updateError } = await db.from('proposals').update(patch).eq('id', id);
  if (updateError) {
    return NextResponse.json({ error: 'Could not update the proposal. Try again.' }, { status: 500 });
  }

  await db.from('activities').insert({
    lead_id: row.lead_id,
    type: 'proposal',
    note: `Proposal ${id} moved ${current} → ${input.status}.`,
  });

  return NextResponse.json({ ok: true, status: input.status });
}
