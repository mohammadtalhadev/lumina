'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TriangleAlert, X } from 'lucide-react';
import { GhostButton, GlassCard } from '@/components/ui';

/**
 * Danger zone: the settings-page home of the global kill-switch.
 * Same POST /api/kill-switch as the topbar control — one implementation,
 * two doors. Typing PAUSE is required; the pause is audit-logged.
 */
export default function DangerZone({ anyActive }: { anyActive: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/kill-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause', confirm }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      setOpen(false);
      setConfirm('');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassCard className="border-red-200/70">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-red-100/80 text-red-700">
          <TriangleAlert className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="font-display text-xl font-bold">Danger zone</h2>
          <p className="text-sm text-slate2">Irreversible-feeling actions live here, behind confirmation.</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/60 p-4">
        <div>
          <p className="text-sm font-semibold">Pause all sending</p>
          <p className="text-xs text-slate2">
            {anyActive
              ? 'Pauses every active campaign. Pending queue items wait — nothing is deleted.'
              : 'Everything is already paused.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={!anyActive}
          className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-card transition-transform hover:scale-[1.02] hover:bg-red-700 active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100"
        >
          Pause everything
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/20 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm pause all sending"
        >
          <div className="glass w-full max-w-md rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">Pause all sending?</h3>
              <button
                type="button"
                onClick={() => { setOpen(false); setConfirm(''); setError(null); }}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-full text-slate2 hover:bg-white"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <p className="mt-3 text-sm text-ink/80">
              Every active campaign pauses and pending sends wait. The pause — and
              exactly which campaigns were paused — is written to the audit log.
            </p>
            <label className="mt-4 block">
              <span className="text-xs font-semibold text-slate2">Type PAUSE to confirm</span>
              <input
                type="text"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="PAUSE"
                autoComplete="off"
                className="mt-1 w-full rounded-2xl border border-ink/10 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-red-500"
              />
            </label>
            {error && (
              <p role="alert" className="mt-3 rounded-2xl bg-red-100/70 px-4 py-2.5 text-sm text-red-800">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <GhostButton onClick={() => { setOpen(false); setConfirm(''); setError(null); }}>
                Cancel
              </GhostButton>
              <button
                type="button"
                onClick={run}
                disabled={busy || confirm !== 'PAUSE'}
                className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-card transition-transform hover:scale-[1.02] hover:bg-red-700 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
              >
                {busy ? 'Pausing…' : 'Pause everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
