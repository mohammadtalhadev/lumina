import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser-side Supabase client.
 *
 * SECURITY: only the ANON (publishable) key may ever appear here. It is safe
 * for browsers because Row Level Security (`lumina_owner_all`) is enforced
 * database-side. The SERVICE ROLE key must NEVER be imported into any file
 * that can reach the client bundle — use `lib/supabase-server.ts` instead.
 */
function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[supabase-client] Missing required env var ${name}. ` +
        'Copy web/.env.example to web/.env.local and fill it in.'
    );
  }
  return value;
}

let client: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  if (client) return client;
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!/^https:\/\/.+\.supabase\.co$/.test(url)) {
    throw new Error('[supabase-client] NEXT_PUBLIC_SUPABASE_URL looks invalid.');
  }
  client = createClient(url, anonKey);
  return client;
}
