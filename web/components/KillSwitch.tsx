'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OctagonX, Play, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { GhostButton, PrimaryButton } from '@/components/ui';

/**
 * Global kill-switch in the topbar. State is derived honestly:
 * anyActive === at least one campaign is_active. Pausing flips every active
 * campaign off and writes an audit row; resuming restores only the campaigns
 * the kill-switch itself paused (tracked in the audit log).
 */
export default function KillSwitch({ anyActive }: { anyActive: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const paused = !anyActive;

  async function run(action: 'pause' | 'resume') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/kill-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'pause' ? { action, confirm } : { action }),
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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={paused ? 'Sending is paused — resume' : 'Pause all sending'}
        title={paused ? 'Sending is paused — resume' : 'Pause all sending'}
        className={cn(
          'grid h-10 w-10 place-items-center rounded-full transition-colors',
          paused
            ? 'bg-red-100/80 text-red-700 hover:bg-red-200/80'
            : 'glass text-ink/70 hover:text-red-700'
        )}
      >
        {paused ? <Play className="h-[18px] w-[18px]" aria-hidden /> : <OctagonX className="h-[18px] w-[18px]" aria-hidden />}
      </button>
      <span className="sr-only" role="status">
        {paused ? 'All sending is paused' : 'All systems go'}
      </span>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/20 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={paused ? 'Resume sending' : 'Pause all sending'}
        >
          <div className="glass w-full max-w-md rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">
                {paused ? 'Resume sending' : 'Pause all sending'}
              </h3>
              <button
                type="button"
                onClick={() => { setOpen(false); setConfirm(''); setError(null); }}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-full text-slate2 hover:bg-white"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-ink/80">
              {paused ? (
                <>
                  This re-activates the campaigns the kill-switch paused. Campaigns you
                  paused yourself stay paused. The resume is written to the audit log.
                </>
              ) : (
                <>
                  This immediately stops <strong>all</strong> sending: every active
                  campaign is paused and pending queue items wait. Nothing is deleted.
                  The pause is written to the audit log with the campaign list.
                </>
              )}
            </p>

            {!paused && (
              <label className="mt-4 block">
                <span className="text-xs font-semibold text-slate2">
                  Type PAUSE to confirm
                </span>
                <input
                  type="text"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="PAUSE"
                  autoComplete="off"
                  className="mt-1 w-full rounded-2xl border border-ink/10 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-primary"
                />
              </label>
            )}

            {error && (
              <p role="alert" className="mt-3 rounded-2xl bg-red-100/70 px-4 py-2.5 text-sm text-red-800">
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <GhostButton onClick={() => { setOpen(false); setConfirm(''); setError(null); }}>
                Cancel
              </GhostButton>
              {paused ? (
                <PrimaryButton
                  onClick={() => run('resume')}
                  disabled={busy}
                >
                  {busy ? 'Working…' : 'Resume sending'}
                </PrimaryButton>
              ) : (
                <button
                  type="button"
                  onClick={() => run('pause')}
                  disabled={busy || confirm !== 'PAUSE'}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-card transition-transform hover:scale-[1.02] hover:bg-red-700 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                >
                  {busy ? 'Working…' : 'Pause everything'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
