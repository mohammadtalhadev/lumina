'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Plus, X } from 'lucide-react';
import { Field, GhostButton, PrimaryButton, inputCls } from '@/components/ui';
import type { Campaign, CampaignTemplate } from '@/lib/model';
import { cn } from '@/lib/cn';

interface Props {
  templates: CampaignTemplate[];
  campaigns: Campaign[];
  onDone: () => void;
}

/**
 * New Campaign wizard: name + niche → start from a niche preset
 * (data, never code) or clone an existing campaign. New campaigns
 * always start paused — activation is a separate, deliberate step.
 */
export default function CampaignWizard({ templates, campaigns, onDone }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [niche, setNiche] = useState('');
  const [mode, setMode] = useState<'preset' | 'clone'>('preset');
  const [presetNiche, setPresetNiche] = useState('');
  const [cloneFrom, setCloneFrom] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setName('');
    setNiche('');
    setMode('preset');
    setPresetNiche('');
    setCloneFrom('');
    setError(null);
  }

  async function create() {
    if (!name.trim()) {
      setError('Campaign name is required.');
      return;
    }
    if (!niche.trim()) {
      setError('Niche is required.');
      return;
    }
    setSaving(true);
    setError(null);
    let res: Response;
    try {
      res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          niche: niche.trim().toLowerCase(),
          preset_niche: mode === 'preset' ? presetNiche : '',
          clone_from: mode === 'clone' ? cloneFrom : '',
        }),
      });
    } catch {
      setSaving(false);
      setError('Network error — is the dev server running?');
      return;
    }
    setSaving(false);
    if (!res.ok) {
      let msg = `Could not create the campaign (${res.status}).`;
      try {
        const data = await res.json();
        if (data?.error) msg = data.error;
      } catch {
        /* keep default */
      }
      setError(msg);
      return;
    }
    setOpen(false);
    reset();
    onDone();
    router.refresh();
  }

  return (
    <>
      <PrimaryButton onClick={() => { reset(); setOpen(true); }}>
        <Plus className="h-4 w-4" aria-hidden />
        New campaign
      </PrimaryButton>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/20 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="New campaign">
          <div className="glass max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">New campaign</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-slate2 hover:bg-white">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <Field label="Campaign name" required>
                <input className={inputCls} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} placeholder="Dental — US West" />
              </Field>
              <Field label="Niche" required>
                <input className={inputCls} value={niche} maxLength={60} onChange={(e) => setNiche(e.target.value)} placeholder="dental" />
              </Field>

              <div>
                <span className="mb-1.5 block text-sm font-medium text-ink/80">Start from</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('preset')}
                    className={cn(
                      'rounded-2xl border px-4 py-2.5 text-sm font-medium transition-colors',
                      mode === 'preset'
                        ? 'border-primary/50 bg-primary-soft text-primary-dark'
                        : 'border-white/80 bg-white/60 text-ink/70 hover:bg-white/90'
                    )}
                  >
                    Niche preset
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('clone')}
                    disabled={campaigns.length === 0}
                    className={cn(
                      'inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50',
                      mode === 'clone'
                        ? 'border-primary/50 bg-primary-soft text-primary-dark'
                        : 'border-white/80 bg-white/60 text-ink/70 hover:bg-white/90'
                    )}
                  >
                    <Copy className="h-4 w-4" aria-hidden />
                    Clone existing
                  </button>
                </div>
              </div>

              {mode === 'preset' ? (
                <Field label="Preset">
                  <select className={inputCls} value={presetNiche} onChange={(e) => setPresetNiche(e.target.value)}>
                    <option value="">Blank (no preset)</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.niche}>
                        {t.name} ({t.niche})
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Field label="Clone from">
                  <select className={inputCls} value={cloneFrom} onChange={(e) => setCloneFrom(e.target.value)}>
                    <option value="">Select a campaign…</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.niche})
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              <p className="rounded-2xl bg-white/60 p-3 text-xs leading-relaxed text-slate2">
                New campaigns start <strong>paused</strong>. You will activate it deliberately
                after the pre-campaign gate (brand details complete) passes.
              </p>

              {error && (
                <p role="alert" className="text-sm font-medium text-red-700">{error}</p>
              )}

              <div className="flex justify-end gap-2">
                <GhostButton onClick={() => setOpen(false)}>Cancel</GhostButton>
                <PrimaryButton onClick={create} disabled={saving}>
                  {saving ? 'Creating…' : 'Create campaign'}
                </PrimaryButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
