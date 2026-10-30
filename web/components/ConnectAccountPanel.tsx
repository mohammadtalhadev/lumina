'use client';

import { useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { GhostButton, GlassCard, PrimaryButton } from '@/components/ui';

/**
 * Honest "Connect Account" panel. There is no fake OAuth button here:
 * connecting happens through the operator's own secure flow (see the
 * Phase 0 checklist), because tokens must never pass through chat, a form,
 * or the database. This panel explains exactly that + the concrete steps.
 */
export default function ConnectAccountPanel() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <PrimaryButton onClick={() => setOpen(true)}>
        <ShieldCheck className="h-4 w-4" aria-hidden />
        Connect Account
      </PrimaryButton>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/20 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Connect a sending account"
        >
          <div className="glass w-full max-w-lg rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">Connect a sending account</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-full text-slate2 hover:bg-white"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-ink/80">
              Accounts connect through <strong>Microsoft OAuth</strong> — you sign in
              yourself, in your own browser. Lumina never asks for a password, and
              tokens are stored server-side only (never in chat, a form, or the database).
            </p>

            <ol className="mt-4 space-y-2.5 text-sm">
              {[
                'In the Azure portal, open your Lumina app registration and start the Authorization Code flow (scopes: Mail.Send, Mail.ReadWrite).',
                'Sign in with the Outlook account you want to send from and consent.',
                'Copy the access token into the worker’s .env as GRAPH_TOKEN_ACC< n >, and add the matching token_ref on the account row.',
                'The account starts in Warming — campaign volume unlocks only after the 85%+ placement gate.',
              ].map((step, i) => (
                <li key={i} className="flex gap-3 rounded-2xl bg-white/60 p-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary-dark">
                    {i + 1}
                  </span>
                  <span className="text-ink/80">{step}</span>
                </li>
              ))}
            </ol>

            <p className="mt-4 rounded-2xl border border-amber-200/70 bg-amber-50/70 p-3 text-xs leading-relaxed text-amber-900">
              Refresh tokens are wired in Phase 2 — until then, re-connect when a token
              expires and the account shows Disconnected.
            </p>

            <div className="mt-4 flex justify-end">
              <GhostButton onClick={() => setOpen(false)}>Got it</GhostButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
