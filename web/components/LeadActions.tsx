'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ListPlus } from 'lucide-react';
import { nextStage } from '@/lib/model';
import { GhostButton, PrimaryButton } from '@/components/ui';

/**
 * Actions on a lead: advance stage (forward-only), change grade,
 * log a sequence assignment. All mutations go through the API routes
 * and refresh the page on success.
 */
export default function LeadActions({
  leadId,
  stage,
  grade,
}: {
  leadId: string;
  stage: string;
  grade: 'A' | 'B' | 'C';
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = nextStage(stage);

  async function patch(payload: Record<string, string>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? 'Update failed. Try again.');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function logSequence() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: 'Marked for sequence assignment (Sequences screen arrives in Phase 1C).' }),
      });
      if (!res.ok) setError('Could not log the action. Try again.');
      else router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {next && (
        <PrimaryButton onClick={() => patch({ stage: next })} disabled={busy}>
          Move to {next}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </PrimaryButton>
      )}
      <select
        aria-label="Change grade"
        value={grade}
        disabled={busy}
        onChange={(e) => patch({ grade: e.target.value })}
        className="rounded-full border border-white/80 bg-white/60 px-4 py-2.5 text-sm font-medium backdrop-blur-xl outline-none focus:border-primary"
      >
        <option value="A">Grade A</option>
        <option value="B">Grade B</option>
        <option value="C">Grade C</option>
      </select>
      <GhostButton onClick={logSequence} disabled={busy}>
        <ListPlus className="h-4 w-4" aria-hidden />
        Add to sequence
      </GhostButton>
      {error && (
        <p role="alert" className="w-full text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
