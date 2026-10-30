import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseServer } from './supabase-server';

export type { Lead, Reply, Alert, Activity, Campaign, SendingAccount } from './model';

/**
 * Safe Supabase access for Server Components / route handlers.
 *
 * Every query goes through safeQuery: missing env vars, unreachable
 * projects, or missing tables degrade to { data: null, error } instead of
 * crashing the render. Pages must render honest empty/error states from
 * the error — never fake data.
 */

export type DbResult<T> = { data: T | null; error: string | null };

type QueryFn<T> = (
  db: SupabaseClient
  // Supabase query builders are thenables, not native Promises — PromiseLike is the honest type.
) => PromiseLike<{ data: T | null; error: { message?: string } | null }>;

export async function safeQuery<T>(fn: QueryFn<T>): Promise<DbResult<T>> {
  try {
    const db = supabaseServer();
    const { data, error } = await fn(db);
    if (error) {
      return { data: null, error: error.message ?? 'Database query failed' };
    }
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Unknown database error' };
  }
}

/** Start of today (UTC) — for "sent today" style filters. */
export function startOfTodayISO(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}
