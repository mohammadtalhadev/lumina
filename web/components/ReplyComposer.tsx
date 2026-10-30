'use client';

import { useEffect, useState } from 'react';
import { Save, Send } from 'lucide-react';
import { Field, GhostButton, PrimaryButton, inputCls } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * Reply composer. Drafts persist to localStorage; Send queues the reply
 * into `send_queue` (status 'queued' — the migration allows no 'draft').
 * Tapping Send IS the human approval; the Python worker picks it up
 * on its next run (or via "Approve Next 25" on the Queue page).
 */

const QUICK_REPLIES = [
  'Thanks for getting back — would Thursday 10:30 AM EST or 3:00 PM EST work for a quick call?',
  'Sharing a short case study from a business like yours:',
  "Here's my booking link if you'd like to pick a time directly:",
];

interface Props {
  replyId: string;
  leadName: string;
  leadId: string | null;
  /** reply_from_account_id — reply continuity: same account that sent the original. */
  accountId: string | null;
  defaultSubject?: string;
}

export default function ReplyComposer({ replyId, leadName, leadId, accountId, defaultSubject = '' }: Props) {
  const storageKey = `lumina-draft-${replyId}`;
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    try {
      const draft = window.localStorage.getItem(storageKey);
      if (draft) {
        let handled = false;
        try {
          const parsed = JSON.parse(draft) as { subject?: string; body?: string } | null;
          if (parsed && typeof parsed === 'object') {
            setSubject(parsed.subject ?? defaultSubject);
            setBody(parsed.body ?? '');
            handled = true;
          }
        } catch {
          /* not JSON — maybe a legacy plain-text draft */
        }
        if (!handled && !draft.startsWith('{')) {
          setBody(draft);
        }
      } else {
        setSubject(defaultSubject);
        setBody('');
      }
    } catch {
      // private mode etc. — composer still works, just no persistence
    }
    setSavedAt(null);
    setNotice(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyId]);

  function saveDraft() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ subject, body }));
      setSavedAt(new Date().toLocaleTimeString());
    } catch {
      setSavedAt(null);
    }
  }

  function insertChip(text: string) {
    setBody((b) => (b ? `${b}\n\n${text}` : text));
  }

  async function send() {
    if (!leadId || !body.trim() || sending) return;
    setSending(true);
    setNotice(null);
    let res: Response;
    try {
      res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lead_id: leadId,
          account_id: accountId,
          subject,
          body,
        }),
      });
    } catch {
      setSending(false);
      setNotice({ kind: 'err', text: 'Network error — is the dev server running?' });
      return;
    }
    setSending(false);
    if (!res.ok) {
      let msg = `Could not queue the reply (${res.status}).`;
      try {
        const data = await res.json();
        if (data?.error) msg = data.error;
      } catch {
        /* keep default */
      }
      setNotice({ kind: 'err', text: msg });
      return;
    }
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    setBody('');
    setSavedAt(null);
    setNotice({
      kind: 'ok',
      text: 'Queued — the worker will process it on the next run. Track it on the Send Queue page.',
    });
  }

  const canSend = !!leadId && body.trim().length > 0 && !sending;

  return (
    <div className="mt-5 border-t border-ink/5 pt-4">
      <h3 className="text-sm font-semibold">Reply to {leadName}</h3>
      {!leadId && (
        <p className="mt-2 rounded-2xl border border-amber-200/70 bg-amber-50/70 p-3 text-xs text-amber-900">
          This reply isn&apos;t linked to a lead, so it can&apos;t be queued.
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-2" aria-label="Quick replies">
        <span className="w-full text-xs font-medium text-slate2">Quick replies:</span>
        {QUICK_REPLIES.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => insertChip(q)}
            className="rounded-full border border-primary/25 bg-primary-soft/60 px-3 py-1.5 text-left text-xs font-medium text-primary-dark transition-colors hover:bg-primary-soft"
          >
            {q.length > 42 ? `${q.slice(0, 42)}…` : q}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-3">
        <Field label="Subject">
          <input
            className={inputCls}
            value={subject}
            maxLength={200}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Re: your reply"
            aria-label="Reply subject"
          />
        </Field>
        <div>
          <textarea
            aria-label="Reply draft"
            className={cn(inputCls, 'min-h-[120px] resize-y')}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Hi — thanks for replying…"
          />
        </div>
      </div>

      {notice && (
        <p
          role={notice.kind === 'err' ? 'alert' : 'status'}
          className={cn(
            'mt-3 rounded-2xl p-3 text-sm',
            notice.kind === 'err'
              ? 'border border-red-200/70 bg-red-50/70 text-red-900'
              : 'border border-emerald-200/70 bg-emerald-50/70 text-emerald-900'
          )}
        >
          {notice.text}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <GhostButton onClick={saveDraft} disabled={!body.trim() && !subject.trim()}>
          <Save className="h-4 w-4" aria-hidden />
          Save draft
        </GhostButton>
        <PrimaryButton
          onClick={send}
          disabled={!canSend}
          title={!leadId ? 'No lead linked to this reply' : 'Queue this reply for sending'}
        >
          <Send className="h-4 w-4" aria-hidden />
          {sending ? 'Queueing…' : 'Send reply'}
        </PrimaryButton>
        {savedAt ? (
          <span className="text-xs text-emerald-700">Draft saved in this browser · {savedAt}</span>
        ) : (
          <span className="text-xs text-slate2">
            Send queues the reply — the worker sends it on its next run.
          </span>
        )}
      </div>
    </div>
  );
}
