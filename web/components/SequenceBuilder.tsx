'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { FadeIn, Field, GhostButton, GlassCard, Pill, PrimaryButton, inputCls } from '@/components/ui';
import { splitTemplate, type Campaign, type SequenceRow } from '@/lib/model';
import { cn } from '@/lib/cn';

interface Props {
  campaigns: Campaign[];
  sequences: SequenceRow[];
  sendsByCampaign: Record<string, number>;
}

interface Editing {
  mode: 'add' | 'edit';
  campaignId: string;
  id?: string;
  stepDay: number;
  subject: string;
  body: string;
}

async function apiCall(url: string, method: string, payload?: unknown): Promise<{ ok: boolean; error?: string }> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
  } catch {
    return { ok: false, error: 'Network error — is the dev server running?' };
  }
  if (res.ok) return { ok: true };
  let msg = `Request failed (${res.status})`;
  try {
    const data = await res.json();
    if (data?.error) msg = data.error;
  } catch {
    /* keep default */
  }
  return { ok: false, error: msg };
}

export default function SequenceBuilder({ campaigns, sequences, sendsByCampaign }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SequenceRow | null>(null);

  const stepsByCampaign = new Map<string, SequenceRow[]>();
  for (const s of sequences) {
    const list = stepsByCampaign.get(s.campaign_id) ?? [];
    list.push(s);
    stepsByCampaign.set(s.campaign_id, list);
  }
  for (const list of Array.from(stepsByCampaign.values())) {
    list.sort((a: SequenceRow, b: SequenceRow) => a.step_day - b.step_day);
  }

  function openAdd(campaignId: string) {
    setFormError(null);
    setEditing({ mode: 'add', campaignId, stepDay: 0, subject: '', body: '' });
  }

  function openEdit(step: SequenceRow) {
    const { subject, body } = splitTemplate(step.template);
    setFormError(null);
    setEditing({ mode: 'edit', campaignId: step.campaign_id, id: step.id, stepDay: step.step_day, subject, body });
  }

  async function save() {
    if (!editing) return;
    if (!editing.body.trim()) {
      setFormError('Email body is required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const payload =
      editing.mode === 'add'
        ? {
            campaign_id: editing.campaignId,
            step_day: editing.stepDay,
            subject: editing.subject,
            body: editing.body,
          }
        : {
            id: editing.id,
            step_day: editing.stepDay,
            subject: editing.subject,
            body: editing.body,
          };
    const res = await apiCall('/api/sequences', editing.mode === 'add' ? 'POST' : 'PUT', payload);
    setSaving(false);
    if (!res.ok) {
      setFormError(res.error ?? 'Could not save the step.');
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function remove() {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    const res = await apiCall(`/api/sequences?id=${confirmDelete.id}`, 'DELETE');
    setDeletingId(null);
    setConfirmDelete(null);
    if (!res.ok) {
      setFormError(res.error ?? 'Could not delete the step.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {campaigns.map((c, i) => {
        const steps = stepsByCampaign.get(c.id) ?? [];
        const sends = sendsByCampaign[c.id] ?? 0;
        return (
          <FadeIn key={c.id} delay={Math.min(i * 0.05, 0.3)}>
            <GlassCard>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="font-display text-xl font-bold">{c.name}</h2>
                  <Pill tone="cyan">{c.niche}</Pill>
                  {c.is_active && <Pill tone="green">Active</Pill>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate2">
                    {sends === 0 ? 'No sends logged yet' : `${sends} send${sends === 1 ? '' : 's'} logged`}
                  </span>
                  <GhostButton onClick={() => openAdd(c.id)}>
                    <Plus className="h-4 w-4" aria-hidden />
                    Add step
                  </GhostButton>
                </div>
              </div>

              {steps.length === 0 ? (
                <p className="mt-4 rounded-2xl bg-white/60 p-4 text-sm text-slate2">
                  No steps yet — add the Day 0 email to start this sequence.
                </p>
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {steps.map((s) => {
                    const { subject, body } = splitTemplate(s.template);
                    return (
                      <li
                        key={s.id}
                        className="flex items-start justify-between gap-3 rounded-2xl border border-white/70 bg-white/60 p-4"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Pill tone="violet">Day {s.step_day}</Pill>
                            {subject && <span className="truncate text-sm font-semibold">{subject}</span>}
                          </div>
                          <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-sm text-ink/75">{body}</p>
                          <p className="mt-1 text-xs text-slate2">
                            Variables like {'{{first_name}}'} and {'{{company}}'} fill in per lead.
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(s)}
                            aria-label={`Edit Day ${s.step_day} step`}
                            className="grid h-8 w-8 place-items-center rounded-full text-slate2 transition-colors hover:bg-white hover:text-ink"
                          >
                            <Pencil className="h-4 w-4" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(s)}
                            aria-label={`Delete Day ${s.step_day} step`}
                            className="grid h-8 w-8 place-items-center rounded-full text-slate2 transition-colors hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </GlassCard>
          </FadeIn>
        );
      })}

      {/* Add / edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/20 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={editing.mode === 'add' ? 'Add sequence step' : 'Edit sequence step'}>
          <div className="glass w-full max-w-lg rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">
                {editing.mode === 'add' ? 'Add step' : 'Edit step'}
              </h3>
              <button type="button" onClick={() => setEditing(null)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-slate2 hover:bg-white">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <Field label="Send on day" required error={undefined}>
                <input
                  type="number"
                  min={0}
                  max={60}
                  className={inputCls}
                  value={editing.stepDay}
                  onChange={(e) => setEditing({ ...editing, stepDay: Number(e.target.value) })}
                />
              </Field>
              <Field label="Subject (optional)">
                <input
                  className={inputCls}
                  value={editing.subject}
                  maxLength={200}
                  onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
                  placeholder="Quick question about {{company}}"
                />
              </Field>
              <Field label="Email body" required>
                <textarea
                  className={cn(inputCls, 'min-h-[160px] resize-y')}
                  value={editing.body}
                  onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                  placeholder={'Hi {{first_name}},\n\n…'}
                />
              </Field>
              {formError && (
                <p role="alert" className="text-sm font-medium text-red-700">{formError}</p>
              )}
              <div className="flex justify-end gap-2">
                <GhostButton onClick={() => setEditing(null)}>Cancel</GhostButton>
                <PrimaryButton onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : editing.mode === 'add' ? 'Add step' : 'Save changes'}
                </PrimaryButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/20 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-label="Delete step">
          <div className="glass w-full max-w-sm rounded-3xl p-6">
            <h3 className="font-display text-lg font-bold">Delete this step?</h3>
            <p className="mt-2 text-sm text-slate2">
              Day {confirmDelete.step_day} will be removed from this sequence. Leads already emailed are not affected.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <GhostButton onClick={() => setConfirmDelete(null)}>Keep it</GhostButton>
              <button
                type="button"
                onClick={remove}
                disabled={deletingId === confirmDelete.id}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
              >
                {deletingId === confirmDelete.id ? 'Deleting…' : 'Delete step'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
