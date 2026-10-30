'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FilePlus2, X } from 'lucide-react';
import { Field, GhostButton, PrimaryButton, inputCls } from '@/components/ui';

interface LeadOption {
  id: string;
  contact_name: string;
  company: string;
}

/**
 * "New proposal" modal. Amount + notes are validated client-side for fast
 * feedback; the API re-validates with zod. Notes land in the audit log
 * (the proposals table has no notes column by design).
 */
export default function ProposalForm({ leads }: { leads: LeadOption[] }) {
  const [open, setOpen] = useState(false);
  const [leadId, setLeadId] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  function reset() {
    setLeadId('');
    setAmount('');
    setNotes('');
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!leadId) return setError('Choose a lead.');
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0) return setError('Amount must be a number, 0 or more.');
    setBusy(true);
    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, amount: amt, notes }),
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
        <FilePlus2 className="h-4 w-4" aria-hidden />
        New proposal
      </PrimaryButton>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/20 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="New proposal"
        >
          <form
            onSubmit={submit}
            className="glass w-full max-w-md rounded-3xl p-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">New proposal</h3>
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

              <Field label="Amount (USD)" required>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="1500"
                  className={inputCls}
                  required
                />
              </Field>

              <Field label="Notes (saved to the audit log)">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Scope, timeline, anything the proposal should remember…"
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
                {busy ? 'Creating…' : 'Create draft'}
              </PrimaryButton>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
