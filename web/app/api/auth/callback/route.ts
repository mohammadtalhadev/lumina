import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { rateLimitGuard } from '@/lib/rate-limit';

/**
 * GET /api/auth/callback — Microsoft redirects here after consent.
 *
 * Completes the OAuth flow entirely server-side:
 *   1. Verify `state` matches the cookie (CSRF).
 *   2. Exchange `code` for tokens (access + refresh — offline_access scope).
 *   3. Call Graph /me to learn the mailbox address.
 *   4. Upsert sending_accounts (new accounts start in `warming`, never `ready`).
 *   5. Redirect to /accounts.
 *
 * Needs (server-only env): AZURE_CLIENT_ID, AZURE_CLIENT_SECRET.
 * Tokens are stored per account; the worker auto-refreshes them.
 */

export const dynamic = 'force-dynamic';

const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

export async function GET(req: NextRequest) {
  const limited = rateLimitGuard(req);
  if (limited) return limited;

  const appUrl = req.nextUrl.origin;
  const fail = (reason: string) =>
    NextResponse.redirect(`${appUrl}/accounts?error=${encodeURIComponent(reason)}`);

  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'Microsoft connect is not configured (AZURE_CLIENT_ID/SECRET missing).' },
      { status: 503 }
    );
  }

  const q = req.nextUrl.searchParams;
  if (q.get('error')) return fail(q.get('error_description') || 'consent denied');
  const code = q.get('code');
  const state = q.get('state');
  const cookieState = req.cookies.get('lumina_oauth_state')?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    return fail('invalid state — please try connecting again');
  }

  const redirectUri = `${appUrl}/api/auth/callback`;

  // 2. Code -> tokens
  let tok: { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error_description?: string };
  try {
    const resp = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        scope: 'Mail.Send Mail.ReadWrite offline_access',
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        client_secret: clientSecret,
      }),
    });
    tok = await resp.json();
  } catch {
    return fail('token exchange failed — try again');
  }
  if (!tok.access_token || !tok.refresh_token) {
    return fail(tok.error_description || 'Microsoft did not return tokens');
  }

  // 3. Who is this mailbox?
  let email = '';
  try {
    const me = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', {
      headers: { authorization: `Bearer ${tok.access_token}` },
    });
    const meJson = await me.json();
    email = (meJson.mail || meJson.userPrincipalName || '').toLowerCase();
  } catch {
    /* fall through to error below */
  }
  if (!email) return fail('could not read mailbox address');

  // 4. Save account — new ones always start warming; reconnects keep
  // their existing status/label and only refresh tokens.
  const expiresAt = new Date(Date.now() + (tok.expires_in || 3600) * 1000).toISOString();
  const tokenCols = {
    oauth_access_token: tok.access_token,
    oauth_refresh_token: tok.refresh_token,
    oauth_expires_at: expiresAt,
    oauth_scope: tok.scope || '',
  };
  try {
    const db = supabaseServer();
    const { data: existing } = await db
      .from('sending_accounts')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (existing) {
      const { error } = await db
        .from('sending_accounts')
        .update(tokenCols)
        .eq('email', email);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from('sending_accounts').insert({
        email,
        label: email.split('@')[0],
        provider: 'outlook_personal',
        status: 'warming',
        ...tokenCols,
      });
      if (error) throw new Error(error.message);
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'database save failed');
  }

  // 5. Done — clear state cookie, land on accounts
  const res = NextResponse.redirect(`${appUrl}/accounts?connected=1`);
  res.cookies.delete('lumina_oauth_state');
  return res;
}
