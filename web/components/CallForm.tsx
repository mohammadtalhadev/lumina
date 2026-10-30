'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PhoneCall, X } from 'lucide-react';
import { Field, GhostButton, PrimaryButton, inputCls } from '@/components/ui';

interface LeadOption {
  id: string;
  contact_name: string;
  company: string;
}

const OUTCOMES = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'done', label: 'Done' },
  { value: 'no_show', label: 'No-show' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

/**
 * "Log call" modal: records an outcome or schedules a future call.
 * The scheduled time is stored in calls.notes_json (the table has no
 * scheduled_at column) and parsed back defensively on the Calls page.
 */
export default function CallForm({ leads }: { leads: LeadOption[] }) {
  const [open, setOpen] = useState(false);
  const [leadId, setLeadId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [outcome, setOutcome] = useState<string>('scheduled');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  function reset() {
    setLeadId('');
    setScheduledAt('');
    setOutcome('scheduled');
    setNotes('');
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!leadId) return setError('Choose a lead.');
    if (!scheduledAt) return setError('Pick a date and time.');
    setBusy(true);
    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, scheduled_at: scheduledAt, outcome, notes }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PrimaryButton onClick={() => setOpen(true)}>
        <PhoneCall className="h-4 w-4" aria-hidden />
        Log call
      </PrimaryButton>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/20 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Log a call"
        >
          <form onSubmit={submit} className="glass w-full max-w-md rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">Log call</h3>
              <button
                type="button"
                onClick={() => { setOpen(false); reset(); }}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-full text-slate2 hover:bg-white"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <Field label="Lead" required>
                <select
                  value={leadId}
                  onChange={(e) => setLeadId(e.target.value)}
                  className={inputCls}
                  required
                >
                  <option value="">Select a lead…</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.contact_name} — {l.company}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Date and time" required>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className={inputCls}
                  required
                />
              </Field>

              <Field label="Outcome" required>
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  className={inputCls}
                >
                  {OUTCOMES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Notes">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="What was discussed, next steps…"
                  className={inputCls}
                />
              </Field>
            </div>

            {error && (
              <p role="alert" className="mt-3 rounded-2xl bg-red-100/70 px-4 py-2.5 text-sm text-red-800">
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <GhostButton onClick={() => { setOpen(false); reset(); }}>
                Cancel
              </GhostButton>
              <PrimaryButton disabled={busy}>
                {busy ? 'Saving…' : 'Save call'}
              </PrimaryButton>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
