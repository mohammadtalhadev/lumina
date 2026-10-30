'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Pause, Play } from 'lucide-react';
import { FadeIn, GhostButton, GlassCard, Pill } from '@/components/ui';
import CampaignWizard from '@/components/CampaignWizard';
import type { BrandConfig, Campaign, CampaignTemplate } from '@/lib/model';
import { cn } from '@/lib/cn';

export interface CampaignStats {
  leads: number;
  queued: number;
  sent: number;
  replies: number;
}

interface Props {
  campaigns: Campaign[];
  templates: CampaignTemplate[];
  stats: Record<string, CampaignStats>;
  brand: BrandConfig | null;
}

function isTBD(v: string | null | undefined): boolean {
  return !v || v.trim() === '' || v.trim().toUpperCase() === 'TBD';
}

export default function CampaignList({ campaigns, templates, stats, brand }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmActivate, setConfirmActivate] = useState<Campaign | null>(null);

  const activeCount = campaigns.filter((c) => c.is_active).length;
  const otherActive = (id: string) => campaigns.find((c) => c.is_active && c.id !== id) ?? null;

  async function setActive(c: Campaign, active: boolean) {
    // One-active-campaign guardrail: warn before a second activation.
    if (active && otherActive(c.id) && confirmActivate?.id !== c.id) {
      setConfirmActivate(c);
      return;
    }
    setBusyId(c.id);
    setError(null);
    let res: Response;
    try {
      res = await fetch(`/api/campaigns/${c.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ is_active: active }),
      });
    } catch {
      setBusyId(null);
      setError('Network error — is the dev server running?');
      return;
    }
    setBusyId(null);
    setConfirmActivate(null);
    if (!res.ok) {
      let msg = `Could not update the campaign (${res.status}).`;
      try {
        const data = await res.json();
        if (data?.error) msg = data.error;
      } catch {
        /* keep default */
      }
      setError(msg);
      return;
    }
    router.refresh();
  }

  const gateItems = [
    { label: 'Agency name set', done: brand ? !isTBD(brand.agency_name) : false },
    { label: 'Postal address set (CAN-SPAM footer)', done: brand ? !isTBD(brand.postal_address) : false },
    { label: 'Cal.com link set', done: brand ? !isTBD(brand.cal_link) : false },
  ];
  const gateOpen = gateItems.some((g) => !g.done);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-sm text-slate2">
          Niche lives here as data, never in code. One campaign active at a time in Launch mode.
        </p>
        <CampaignWizard templates={templates} campaigns={campaigns} onDone={() => router.refresh()} />
      </div>

      {gateOpen && (
        <div className="flex items-start gap-3 rounded-3xl border border-amber-200/70 bg-amber-50/70 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold text-amber-900">Pre-campaign gate — finish these in Settings &amp; Brand:</p>
            <ul className="mt-1.5 space-y-1">
              {gateItems.map((g) => (
                <li key={g.label} className={cn(g.done ? 'text-emerald-800' : 'text-amber-900')}>
                  {g.done ? '✓' : '○'} {g.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">{error}</p>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {campaigns.map((c, i) => {
          const s = stats[c.id] ?? { leads: 0, queued: 0, sent: 0, replies: 0 };
          const busy = busyId === c.id;
          const needsConfirm = confirmActivate?.id === c.id;
          return (
            <FadeIn key={c.id} delay={Math.min(i * 0.05, 0.3)}>
              <GlassCard className="h-full">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-lg font-bold">{c.name}</h2>
                      {c.is_active ? <Pill tone="green">Active</Pill> : <Pill tone="grey">Paused</Pill>}
                    </div>
                    <p className="mt-1 text-sm text-slate2">Niche: {c.niche}</p>
                  </div>
                  {c.is_active ? (
                    <GhostButton onClick={() => setActive(c, false)} disabled={busy}>
                      <Pause className="h-4 w-4" aria-hidden />
                      {busy ? '…' : 'Pause'}
                    </GhostButton>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActive(c, true)}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent-cyan px-4 py-2 text-sm font-semibold text-white shadow-card transition-transform hover:scale-[1.02] disabled:opacity-50"
                    >
                      <Play className="h-4 w-4" aria-hidden />
                      {busy ? '…' : 'Activate'}
                    </button>
                  )}
                </div>

                {needsConfirm && otherActive(c.id) && (
                  <div className="mt-3 rounded-2xl border border-amber-200/70 bg-amber-50/70 p-3 text-sm text-amber-900" role="alert">
                    <p>
                      <strong>“{otherActive(c.id)?.name}” is already active.</strong> Running two
                      campaigns doubles your daily workload — pause the first, or both run slow.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setActive(c, true)}
                        disabled={busy}
                        className="rounded-full bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Activate anyway
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmActivate(null)}
                        className="rounded-full border border-amber-300 px-4 py-1.5 text-xs font-medium text-amber-900"
                      >
                        Keep paused
                      </button>
                    </div>
                  </div>
                )}

                <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
                  {[
                    ['Leads', s.leads],
                    ['Queued', s.queued],
                    ['Sent', s.sent],
                    ['Replies', s.replies],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded-2xl bg-white/60 px-2 py-3">
                      <dd className="font-display text-xl font-bold tabular-nums">{value}</dd>
                      <dt className="mt-0.5 text-xs text-slate2">{label}</dt>
                    </div>
                  ))}
                </dl>
              </GlassCard>
            </FadeIn>
          );
        })}
      </div>
    </div>
  );
}
