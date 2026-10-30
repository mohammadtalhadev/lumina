'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, PrimaryButton, inputCls } from '@/components/ui';
import type { BrandConfigFull } from '@/lib/model';

const FIELDS: { key: keyof BrandConfigFull; label: string; placeholder: string; hint?: string }[] = [
  { key: 'agency_name', label: 'Agency name', placeholder: 'TBD', hint: 'Renaming updates signatures, templates, and proposals — the change is audit-logged.' },
  { key: 'founder_name', label: 'Founder name', placeholder: 'TBD' },
  { key: 'postal_address', label: 'Postal address', placeholder: 'TBD', hint: 'Required for the CAN-SPAM footer on every send.' },
  { key: 'cal_link', label: 'Booking link (Cal.com)', placeholder: 'TBD', hint: 'Required before any campaign can start sending.' },
  { key: 'linkedin_headline', label: 'LinkedIn headline', placeholder: 'TBD' },
  { key: 'alert_email', label: 'Alert email (self-email)', placeholder: 'you@example.com', hint: 'Critical alerts arrive here via Graph, plus the dashboard inbox.' },
  { key: 'send_window_tz', label: 'Send window timezone', placeholder: 'Asia/Karachi' },
];

/**
 * Brand settings form. Saves via PATCH /api/settings; only changed fields
 * are sent. TBD is an honest value — the pre-campaign gate panel (on the
 * page, server-rendered) shows what is still missing.
 */
export default function SettingsForm({ brand }: { brand: BrandConfigFull | null }) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, brand ? String(brand[f.key] ?? '') : '']))
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const patch: Record<string, string> = {};
    for (const f of FIELDS) {
      const v = (values[f.key] ?? '').trim();
      const current = brand ? String(brand[f.key] ?? '').trim() : '';
      if (v !== current) patch[f.key] = v;
    }
    if (Object.keys(patch).length === 0) {
      setError('Nothing changed.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {FIELDS.map((f) => (
        <Field key={f.key} label={f.label}>
          <input
            type="text"
            value={values[f.key] ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            placeholder={f.placeholder}
            maxLength={500}
            className={inputCls}
          />
          {f.hint && <p className="mt-1 text-xs text-slate2">{f.hint}</p>}
        </Field>
      ))}

      {error && (
        <p role="alert" className="rounded-2xl bg-red-100/70 px-4 py-2.5 text-sm text-red-800">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="rounded-2xl bg-emerald-100/70 px-4 py-2.5 text-sm text-emerald-800">
          Saved. The change is in the audit log.
        </p>
      )}

      <div className="flex justify-end">
        <PrimaryButton disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</PrimaryButton>
      </div>
    </form>
  );
}
