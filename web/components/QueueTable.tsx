'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Pause, Play, RotateCcw, X } from 'lucide-react';
import { FadeIn, GhostButton, Pill, PrimaryButton } from '@/components/ui';
import { queueTone } from '@/lib/model';
import type { QueueRow, SpamCheckRow } from '@/lib/model';
import { cn } from '@/lib/cn';

interface Props {
  items: QueueRow[];
  spamByQueue: Record<string, SpamCheckRow>;
}

interface WorkerSummary {
  sent?: number;
  blocked?: number;
  failed?: number;
  skipped?: number;
  error?: string;
  [k: string]: unknown;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

async function postJson(url: string, method: string, payload?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  let data: { error?: string; [k: string]: unknown } = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON */
  }
  return { status: res.status, data };
}

function SpamPill({ item, spam }: { item: QueueRow; spam?: SpamCheckRow }) {
  const result = spam?.result ?? item.spam_check_result?.result;
  const reason = spam?.blocked_reason || item.spam_check_result?.blocked_reason || item.spam_check_result?.reason || '';
  if (result === 'pass') return <Pill tone="green">Pass</Pill>;
  if (result === 'warn')
    return (
      <span className="inline-flex flex-col items-start gap-1">
        <Pill tone="amber">Warn</Pill>
        {reason && <span className="max-w-[160px] truncate text-xs text-amber-800" title={reason}>{reason}</span>}
      </span>
    );
  if (result === 'block')
    return (
      <span className="inline-flex flex-col items-start gap-1">
        <Pill tone="red">Blocked</Pill>
        {reason && <span className="max-w-[160px] truncate text-xs text-red-800" title={reason}>{reason}</span>}
      </span>
    );
  return <span className="text-xs text-slate2">Not checked yet</span>;
}

export default function QueueTable({ items, spamByQueue }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [draft, setDraft] = useState<QueueRow | null>(null);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<WorkerSummary | null>(null);

  async function act(id: string, action: 'pause' | 'retry') {
    setBusyId(id);
    setRowError(null);
    const { status, data } = await postJson(`/api/queue/${id}`, 'PATCH', { action });
    setBusyId(null);
    if (status !== 200) {
      setRowError(typeof data.error === 'string' ? data.error : `Could not ${action} the item.`);
      return;
    }
    router.refresh();
  }

  async function runWorker() {
    setRunning(true);
    setSummary(null);
    const { status, data } = await postJson('/api/worker/workers/send/run', 'POST');
    setRunning(false);
    if (status === 503) {
      setSummary({ error: 'Worker is not configured (WORKER_URL missing). Start the Python worker first.' });
      return;
    }
    if (status === 502) {
      setSummary({ error: typeof data.error === 'string' ? data.error : 'Worker unreachable.' });
      return;
    }
    if (status !== 200) {
      setSummary({ error: typeof data.error === 'string' ? data.error : `Worker returned ${status}.` });
      return;
    }
    setSummary(data as WorkerSummary);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <FadeIn>
        <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-3xl p-4">
          <p className="text-sm text-slate2">
            Nothing sends without your tap. The worker processes due items when you run it.
          </p>
          <PrimaryButton onClick={runWorker} disabled={running}>
            <Play className="h-4 w-4" aria-hidden />
            {running ? 'Running…' : 'Approve Next 25'}
          </PrimaryButton>
        </div>
      </FadeIn>

      {summary && (
        <div
          role={summary.error ? 'alert' : 'status'}
          className={cn(
            'rounded-3xl border p-4 text-sm',
            summary.error
              ? 'border-red-200/70 bg-red-50/70 text-red-900'
              : 'border-emerald-200/70 bg-emerald-50/70 text-emerald-900'
          )}
        >
          {summary.error ? (
            <p><strong>Worker run failed:</strong> {summary.error}</p>
          ) : (
            <p>
              <strong>Worker run finished:</strong>
              {typeof summary.sent === 'number' && ` ${summary.sent} sent`}
              {typeof summary.blocked === 'number' && ` · ${summary.blocked} blocked`}
              {typeof summary.failed === 'number' && ` · ${summary.failed} failed`}
              {typeof summary.skipped === 'number' && ` · ${summary.skipped} skipped`}
              {typeof summary.sent !== 'number' && ' done'}
            </p>
          )}
        </div>
      )}

      {rowError && (
        <p role="alert" className="text-sm font-medium text-red-700">{rowError}</p>
      )}

      <FadeIn delay={0.05}>
        <div className="glass overflow-hidden rounded-3xl">
          <div className="overflow-x-auto">
            {/* Strict fixed layout: generous widths, ellipsis — columns never collide. */}
            <table className="w-full min-w-[960px] table-fixed">
              <colgroup>
                <col style={{ width: '32%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '17%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '15%' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-ink/10 text-left text-xs font-semibold uppercase tracking-wide text-slate2">
                  <th scope="col" className="px-5 py-3.5">Recipient &amp; subject</th>
                  <th scope="col" className="px-4 py-3.5">Sender account</th>
                  <th scope="col" className="px-4 py-3.5">Dispatch schedule</th>
                  <th scope="col" className="px-4 py-3.5">Safety &amp; spam check</th>
                  <th scope="col" className="px-4 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((q) => {
                  const busy = busyId === q.id;
                  const canPause = ['queued', 'sending', 'blocked', 'failed'].includes(q.status);
                  const canRetry = ['failed', 'blocked'].includes(q.status);
                  return (
                    <tr key={q.id} className="border-b border-ink/5 align-top last:border-0">
                      <td className="px-5 py-4">
                        <p className="truncate text-sm font-semibold" title={q.leads?.contact_name ?? ''}>
                          {q.leads?.contact_name ?? 'Unknown lead'}
                          {q.leads?.company && <span className="font-normal text-slate2"> · {q.leads.company}</span>}
                        </p>
                        <p className="mt-0.5 truncate text-sm text-ink/75" title={q.subject || 'No subject'}>
                          {q.subject || <span className="text-slate2">No subject</span>}
                        </p>
                        {q.sequence_step > 0 && (
                          <p className="mt-0.5 text-xs text-slate2">Sequence step {q.sequence_step}</p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <p className="truncate text-sm" title={q.sending_accounts?.email ?? ''}>
                          {q.sending_accounts?.email ?? <span className="text-slate2">Auto (rotation)</span>}
                        </p>
                        {q.sending_accounts?.label && (
                          <p className="truncate text-xs text-slate2">{q.sending_accounts.label}</p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm tabular-nums">{fmtDateTime(q.scheduled_at)}</p>
                        <div className="mt-1"><Pill tone={queueTone(q.status)}>{q.status}</Pill></div>
                        {q.attempts > 0 && (
                          <p className="mt-0.5 text-xs text-slate2">Attempt {q.attempts}</p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <SpamPill item={q} spam={spamByQueue[q.id]} />
                        {q.error && (
                          <p className="mt-1 line-clamp-2 text-xs text-red-800" title={q.error}>{q.error}</p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDraft(q)}
                            aria-label="View draft"
                            title="View draft"
                            className="grid h-8 w-8 place-items-center rounded-full text-slate2 transition-colors hover:bg-white hover:text-ink"
                          >
                            <Eye className="h-4 w-4" aria-hidden />
                          </button>
                          {canPause && (
                            <button
                              type="button"
                              onClick={() => act(q.id, 'pause')}
                              disabled={busy}
                              aria-label="Pause this item"
                              title="Pause"
                              className="grid h-8 w-8 place-items-center rounded-full text-slate2 transition-colors hover:bg-amber-50 hover:text-amber-800 disabled:opacity-50"
                            >
                              <Pause className="h-4 w-4" aria-hidden />
                            </button>
                          )}
                          {canRetry && (
                            <button
                              type="button"
                              onClick={() => act(q.id, 'retry')}
                              disabled={busy}
                              aria-label="Retry this item"
                              title="Retry now"
                              className="grid h-8 w-8 place-items-center rounded-full text-slate2 transition-colors hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-50"
                            >
                              <RotateCcw className="h-4 w-4" aria-hidden />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </FadeIn>

      {/* View draft modal */}
      {draft && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/20 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Draft email">
          <div className="glass max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-lg font-bold">Draft</h3>
              <button type="button" onClick={() => setDraft(null)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-slate2 hover:bg-white">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex gap-3">
                <dt className="w-20 shrink-0 text-slate2">To</dt>
                <dd className="font-medium">{draft.leads?.contact_name ?? 'Unknown'}{draft.leads?.company ? ` · ${draft.leads.company}` : ''}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-20 shrink-0 text-slate2">Subject</dt>
                <dd className="font-medium">{draft.subject || 'No subject'}</dd>
              </div>
            </dl>
            <div className="mt-4 rounded-2xl bg-white/70 p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{draft.body || 'Empty body.'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
