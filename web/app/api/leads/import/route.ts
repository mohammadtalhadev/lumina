import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase-server';
import { leadImportRowSchema, parseOrThrow } from '@/lib/validate';

/**
 * POST /api/leads/import — bulk CSV import.
 *
 * Body: { rows: [{ company, contact_name, email, niche? }] } (max 500).
 * Every row is validated server-side (never trust the client's preview).
 * - Invalid rows are REPORTED, not fatal: { invalid: [{ index, email, errors }] }
 * - Duplicate emails (in DB or within the batch) are SKIPPED, not fatal.
 * - Response: { imported, skipped_duplicates, invalid }.
 */
const importBodySchema = z.object({
  rows: z.array(z.unknown()).min(1, 'No rows to import').max(500, 'Max 500 rows per import'),
});

type InvalidRow = { index: number; email: string; errors: string[] };

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 });
  }

  let rows: unknown[];
  try {
    rows = parseOrThrow(importBodySchema, body).rows;
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

  // 1. Validate each row individually; collect invalid ones.
  const valid: { index: number; company: string; contact_name: string; email: string; niche: string }[] = [];
  const invalid: InvalidRow[] = [];
  rows.forEach((raw, i) => {
    const parsed = leadImportRowSchema.safeParse(raw);
    if (!parsed.success) {
      const email =
        typeof raw === 'object' && raw !== null && 'email' in raw
          ? String((raw as Record<string, unknown>).email ?? '').slice(0, 120)
          : '';
      invalid.push({
        index: i,
        email,
        errors: parsed.error.issues.map((iss) => `${String(iss.path[0] ?? 'row')}: ${iss.message}`),
      });
      return;
    }
    valid.push({
      index: i,
      company: parsed.data.company,
      contact_name: parsed.data.contact_name,
      email: parsed.data.email.toLowerCase(),
      niche: parsed.data.niche ?? '',
    });
  });

  // 2. Dedupe within the batch (first occurrence wins).
  const seen = new Set<string>();
  const deduped: typeof valid = [];
  let skipped_duplicates = 0;
  for (const r of valid) {
    if (seen.has(r.email)) {
      skipped_duplicates += 1;
      continue;
    }
    seen.add(r.email);
    deduped.push(r);
  }

  // 3. Dedupe against the DB.
  if (deduped.length > 0) {
    const emails = deduped.map((r) => r.email);
    const { data: existing, error: lookupError } = await db
      .from('leads')
      .select('email')
      .in('email', emails);
    if (lookupError) {
      return NextResponse.json({ error: 'Could not check for duplicates. Try again.' }, { status: 500 });
    }
    const existingSet = new Set((existing ?? []).map((e) => String(e.email).toLowerCase()));
    const fresh = deduped.filter((r) => !existingSet.has(r.email));
    skipped_duplicates += deduped.length - fresh.length;
    deduped.length = 0;
    deduped.push(...fresh);
  }

  // 4. Bulk insert.
  let imported = 0;
  if (deduped.length > 0) {
    const { data, error } = await db
      .from('leads')
      .insert(
        deduped.map((r) => ({
          company: r.company,
          contact_name: r.contact_name,
          email: r.email,
          source: 'csv-import',
          research_notes: r.niche ? `Niche (from CSV): ${r.niche}` : '',
          stage: 'New',
          grade: 'C',
        }))
      )
      .select('id');

    if (error) {
      return NextResponse.json({ error: 'Could not save the leads. Try again.' }, { status: 500 });
    }
    imported = data?.length ?? 0;

    // Timeline entries, one bulk insert.
    if (data && data.length > 0) {
      await db.from('activities').insert(
        data.map((d) => ({ lead_id: d.id, type: 'created', note: 'Lead imported from CSV.' }))
      );
    }
  }

  return NextResponse.json({ imported, skipped_duplicates, invalid }, { status: 200 });
}
