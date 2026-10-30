import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client with the SERVICE ROLE key.
 *
 * Defense in depth:
 * 1. `import 'server-only'` — build fails if this module is ever pulled into
 *    a client component.
 * 2. Extra runtime guard against `window` (belt and braces).
 * 3. Refuses to start when env is missing.
 * 4. Refuses when the "service" key looks like the anon key or is otherwise
 *    suspicious (e.g. someone pasted NEXT_PUBLIC values into server vars) —
 *    a client-exposed key must never be treated as privileged.
 */
function getServerEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[supabase-server] Missing required env var ${name}. ` +
        'Set it in web/.env.local (server-only, never NEXT_PUBLIC_*).'
    );
  }
  return value;
}

let admin: SupabaseClient | null = null;

export function supabaseServer(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('[supabase-server] Must never run in the browser.');
  }
  if (admin) return admin;

  const url = getServerEnv('SUPABASE_URL');
  const serviceKey = getServerEnv('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

  if (anonKey && serviceKey === anonKey) {
    throw new Error(
      '[supabase-server] SUPABASE_SERVICE_ROLE_KEY matches the anon key — ' +
        'refusing to run with a client-exposed key as privileged.'
    );
  }
  // Heuristic: a pasted placeholder or truncated key is a misconfiguration.
  if (serviceKey.length < 40 || /placeholder|example|changeme/i.test(serviceKey)) {
    throw new Error('[supabase-server] SUPABASE_SERVICE_ROLE_KEY looks like a placeholder.');
  }

  admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return admin;
}
