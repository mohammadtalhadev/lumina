'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GhostButton, inputCls } from '@/components/ui';
import { cn } from '@/lib/cn';

/** Append a research note to the lead timeline. */
export default function NoteForm({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = note.trim();
    if (!trimmed) {
      setError('Write something first.');
      return;
    }
    if (trimmed.length > 5000) {
      setError('Notes are limited to 5000 characters.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? 'Could not save the note. Try again.');
        return;
      }
      setNote('');
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2" noValidate>
      <label htmlFor="lead-note" className="text-sm font-medium text-ink/80">
        Add research note
      </label>
      <textarea
        id="lead-note"
        className={cn(inputCls, 'min-h-[72px] resize-y')}
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setError(null);
        }}
        placeholder="Pain signals, tech stack, decision-maker hints…"
        maxLength={5000}
      />
      {error && (
        <p role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
      <GhostButton type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save note'}
      </GhostButton>
    </form>
  );
}
