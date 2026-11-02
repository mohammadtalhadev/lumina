import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { rateLimitGuard } from '@/lib/rate-limit';

/**
 * GET /api/auth/microsoft — start the "Connect with Microsoft" OAuth flow.
 *
 * Redirects the browser to Microsoft's authorize endpoint. The user signs in
 * with the Outlook account they want to send from and consents once —
 * no manual tokens, no curl, no expiry juggling. Microsoft redirects back
 * to /api/auth/callback which completes the flow server-side.
 *
 * Needs (server-only env): AZURE_CLIENT_ID.
 * The redirect URI sent here must be registered in the Azure app:
 *   {dashboard-origin}/api/auth/callback
 */

const SCOPES = 'Mail.Send Mail.ReadWrite offline_access';

export async function GET(req: NextRequest) {
  const limited = rateLimitGuard(req);
  if (limited) return limited;

  const clientId = process.env.AZURE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: 'Microsoft connect is not configured (AZURE_CLIENT_ID missing).' },
      { status: 503 }
    );
  }

  const redirectUri = `${req.nextUrl.origin}/api/auth/callback`;
  const state = randomBytes(16).toString('hex');

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: SCOPES,
    state,
  });

  const res = NextResponse.redirect(
    `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`
  );
  // CSRF protection: state must match on callback. Short-lived, httpOnly.
  res.cookies.set('lumina_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/auth/callback',
    maxAge: 600,
  });
  return res;
}
