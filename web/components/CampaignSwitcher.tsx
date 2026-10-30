'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Megaphone } from 'lucide-react';
import { cn } from '@/lib/cn';
import { GhostButton, PrimaryButton } from '@/components/ui';
import type { Campaign } from '@/lib/model';

/**
 * Global campaign switcher (topbar). One-active guardrail: activating a
 * campaign pauses all others — the confirm step states this explicitly and
 * the switch is written to the audit log server-side.
 */
export default function CampaignSwitcher({ campaigns }: { campaigns: Campaign[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Campaign | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);

  const active = campaigns.find((c) => c.is_active) ?? null;

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  async function confirmSwitch() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/campaigns/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pending.id }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      setPending(null);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch active campaign"
        className="glass flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-ink/80 transition-colors hover:text-ink"
      >
        <Megaphone className="h-4 w-4 text-primary-dark" aria-hidden />
        <span className="max-w-40 truncate">{active ? active.name : 'No active campaign'}</span>
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Campaigns"
          className="glass-strong absolute right-0 z-50 mt-2 w-72 rounded-3xl p-2"
        >
          {campaigns.length === 0 && (
            <p className="px-3 py-4 text-sm text-slate2">
              No campaigns yet. Create one on the Campaigns page.
            </p>
          )}
          {campaigns.map((c) => (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={c.is_active}
              onClick={() => (c.is_active ? setOpen(false) : setPending(c))}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/80',
                c.is_active && 'bg-primary-soft/60'
              )}
            >
              <span>
                <span className="block font-medium text-ink">{c.name}</span>
                <span className="block text-xs text-slate2">{c.niche}</span>
              </span>
              {c.is_active && <Check className="h-4 w-4 text-primary-dark" aria-hidden />}
            </button>
          ))}

          {pending && (
            <div className="mt-2 rounded-2xl bg-amber-100/70 p-3 text-sm">
              <p className="font-medium text-amber-900">
                Activate “{pending.name}”?
              </p>
              <p className="mt-1 text-xs text-amber-800">
                One-active guardrail: every other campaign pauses. Time doubles if
                two run — pause the first or both run slow.
              </p>
              {error && (
                <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>
              )}
              <div className="mt-2 flex justify-end gap-2">
                <GhostButton onClick={() => { setPending(null); setError(null); }}>
                  Cancel
                </GhostButton>
                <PrimaryButton onClick={confirmSwitch} disabled={busy}>
                  {busy ? 'Switching…' : 'Activate'}
                </PrimaryButton>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
