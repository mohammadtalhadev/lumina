'use client';

import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { GhostButton, PrimaryButton, inputCls } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * Reply composer. Drafts are saved to the browser's localStorage —
 * honest interim until real sending lands in Phase 1C. The Send button
 * stays disabled with the reason stated; nothing pretends to send.
 */

const QUICK_REPLIES = [
  'Thanks for getting back — would Thursday 10:30 AM EST or 3:00 PM EST work for a quick call?',
  'Sharing a short case study from a business like yours:',
  "Here's my booking link if you'd like to pick a time directly:",
];

export default function ReplyComposer({ replyId, leadName }: { replyId: string; leadName: string }) {
  const storageKey = `lumina-draft-${replyId}`;
  const [body, setBody] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    try {
      const draft = window.localStorage.getItem(storageKey);
      if (draft) setBody(draft);
    } catch {
      // private mode etc. — composer still works, just no persistence
    }
    setSavedAt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyId]);

  function saveDraft() {
    try {
      window.localStorage.setItem(storageKey, body);
      setSavedAt(new Date().toLocaleTimeString());
    } catch {
      setSavedAt(null);
    }
  }

  function insertChip(text: string) {
    setBody((b) => (b ? `${b}\n\n${text}` : text));
  }

  return (
    <div className="mt-5 border-t border-ink/5 pt-4">
      <h3 className="text-sm font-semibold">Reply to {leadName}</h3>

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

      <textarea
        aria-label="Reply draft"
        className={cn(inputCls, 'mt-3 min-h-[120px] resize-y')}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={`Hi — thanks for replying…`}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <GhostButton onClick={saveDraft} disabled={!body.trim()}>
          <Save className="h-4 w-4" aria-hidden />
          Save draft
        </GhostButton>
        <PrimaryButton disabled title="Real sending arrives in Phase 1C">
          Send reply
        </PrimaryButton>
        {savedAt ? (
          <span className="text-xs text-emerald-700">Draft saved in this browser · {savedAt}</span>
        ) : (
          <span className="text-xs text-slate2">Sending arrives in Phase 1C — drafts stay in your browser.</span>
        )}
      </div>
    </div>
  );
}
