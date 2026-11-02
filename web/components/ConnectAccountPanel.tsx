'use client';

import { ShieldCheck } from 'lucide-react';
import { PrimaryButton } from '@/components/ui';

/**
 * "Connect with Microsoft" — starts the real OAuth flow.
 *
 * One click: the operator signs in with the Outlook account they want to
 * send from, consents once (Mail.Send, Mail.ReadWrite), and the dashboard
 * stores per-account tokens server-side. The worker auto-refreshes them —
 * no manual tokens, no curl, no expiry juggling, ever.
 */
export default function ConnectAccountPanel() {
  return (
    <div className="flex flex-col items-center gap-3">
      <PrimaryButton onClick={() => (window.location.href = '/api/auth/microsoft')}>
        <ShieldCheck className="h-4 w-4" aria-hidden />
        Connect with Microsoft
      </PrimaryButton>
      <p className="max-w-sm text-center text-xs leading-relaxed text-slate2">
        You sign in yourself, in your own browser — Lumina never asks for a password.
        Tokens stay server-side and refresh automatically. New accounts always start
        in Warming, never Ready.
      </p>
    </div>
  );
}
