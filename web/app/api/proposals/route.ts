import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { proposalSchema, parseOrThrow } from '@/lib/validate';

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
 * POST /api/proposals — create a draft proposal for a lead.
 * The proposals table has no notes column by design; free-text notes go to
 * the audit log (activities) so nothing the operator writes is lost.
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
    input = parseOrThrow(proposalSchema, body);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid input' }, { status: 400 });
  }

  const { db, error: dbError } = dbOr503();
  if (!db) return dbError;

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

  const { data: proposal, error: insertError } = await db
    .from('proposals')
    .insert({ lead_id: input.lead_id, amount: input.amount, status: 'draft' })
    .select('id')
    .single();
  if (insertError || !proposal) {
    return NextResponse.json({ error: 'Could not create the proposal. Try again.' }, { status: 500 });
  }

  await db.from('activities').insert({
    lead_id: input.lead_id,
    type: 'proposal',
    note: `Proposal ${proposal.id} created as draft — $${Number(input.amount).toLocaleString()} for ${lead.contact_name} (${lead.company}).${input.notes ? ` Notes: ${input.notes}` : ''}`,
  });

  return NextResponse.json({ ok: true, id: proposal.id }, { status: 201 });
}
