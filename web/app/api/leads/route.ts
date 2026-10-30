import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { leadFormSchema, parseOrThrow } from '@/lib/validate';

/**
 * POST /api/leads — create a lead.
 * Validates with zod, enforces the global email dedupe (409 on duplicate).
 * All errors are JSON; never leaks internals.
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
    input = parseOrThrow(leadFormSchema, body);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid input' }, { status: 400 });
  }

  let db;
  try {
    db = supabaseServer();
  } catch (e) {
    return NextResponse.json(
      { error: 'Server is not configured (Supabase env missing).' },
      { status: 503 }
    );
  }

  const email = input.email.toLowerCase();

  // Global email dedupe — hard block, per UI/UX spec.
  const { data: existing, error: lookupError } = await db
    .from('leads')
    .select('id, company')
    .eq('email', email)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: 'Could not check for duplicates. Try again.' }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json(
      { error: `This email is already a lead (${existing.company || 'unknown company'}).`, leadId: existing.id },
      { status: 409 }
    );
  }

  const { data, error } = await db
    .from('leads')
    .insert({
      company: input.company,
      contact_name: input.contact_name,
      email,
      campaign_id: input.campaign_id || null,
      source: input.source || 'manual',
      research_notes: input.research_notes || '',
      stage: 'New',
      grade: 'C',
    })
    .select('id')
    .single();

  if (error) {
    // Race-safe: unique constraint may still fire under concurrency.
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This email is already a lead.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Could not save the lead. Try again.' }, { status: 500 });
  }

  // Log the creation in the timeline.
  await db.from('activities').insert({
    lead_id: data.id,
    type: 'created',
    note: 'Lead added to the pipeline.',
  });

  return NextResponse.json({ id: data.id }, { status: 201 });
}
