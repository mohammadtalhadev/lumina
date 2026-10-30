'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GhostButton, PrimaryButton } from '@/components/ui';
import type { ProposalRow } from '@/lib/model';

const ACTIONS: { from: ProposalRow['status']; to: ProposalRow['status']; label: string; danger?: boolean }[] = [
  { from: 'draft', to: 'sent', label: 'Mark sent' },
  { from: 'sent', to: 'accepted', label: 'Accept' },
  { from: 'sent', to: 'rejected', label: 'Reject', danger: true },
];

/**
 * Forward-only status buttons for a proposal. The server re-checks the
 * transition against the current row, so a stale UI can never skip steps.
 */
export default function ProposalActions({ proposal }: { proposal: ProposalRow }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const actions = ACTIONS.filter((a) => a.from === proposal.status);
  if (actions.length === 0) return null;

  async function advance(to: ProposalRow['status']) {
    setBusy(to);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${proposal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: to }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((a) =>
        a.danger ? (
          <GhostButton key={a.to} onClick={() => advance(a.to)} disabled={busy !== null}>
            {busy === a.to ? 'Saving…' : a.label}
          </GhostButton>
        ) : (
          <PrimaryButton key={a.to} onClick={() => advance(a.to)} disabled={busy !== null}>
            {busy === a.to ? 'Saving…' : a.label}
          </PrimaryButton>
        )
      )}
      {error && (
        <p role="alert" className="w-full text-xs text-red-700">{error}</p>
      )}
    </div>
  );
}
