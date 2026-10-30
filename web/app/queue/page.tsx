import { safeQuery } from '@/lib/db';
import { EmptyState, FadeIn, LoadError } from '@/components/ui';
import QueueTable from '@/components/QueueTable';
import type { QueueRow, SpamCheckRow, SpamResultJson } from '@/lib/model';
import { ListChecks } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Send Queue — Lumina' };

const QUEUE_COLS =
  'id, lead_id, account_id, campaign_id, sequence_step, subject, body, scheduled_at, status, attempts, next_attempt_at, error, spam_check_result, leads(contact_name, company), sending_accounts(email, label)';

/** Raw shape from supabase-js: to-one joins arrive as arrays. Normalized below. */
interface RawQueueRow extends Omit<QueueRow, 'leads' | 'sending_accounts' | 'spam_check_result'> {
  spam_check_result: unknown;
  leads: Array<{ contact_name: string; company: string }> | null;
  sending_accounts: Array<{ email: string; label: string }> | null;
}

function normalize(row: RawQueueRow): QueueRow {
  const spam =
    row.spam_check_result && typeof row.spam_check_result === 'object'
      ? (row.spam_check_result as SpamResultJson)
      : null;
  return {
    ...row,
    spam_check_result: spam,
    leads: row.leads?.[0] ?? null,
    sending_accounts: row.sending_accounts?.[0] ?? null,
  };
}

export default async function QueuePage() {
  const [queueRes, spamRes] = await Promise.all([
    safeQuery<RawQueueRow[]>((db) =>
      db.from('send_queue').select(QUEUE_COLS).order('scheduled_at').limit(100)
    ),
    safeQuery<SpamCheckRow[]>((db) => db.from('spam_checks').select('id, queue_id, result, blocked_reason')),
  ]);

  if (queueRes.error) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-3xl font-bold">Send Queue</h1>
        <LoadError message={queueRes.error} retryHref="/queue" />
      </div>
    );
  }

  const items: QueueRow[] = (queueRes.data ?? []).map(normalize);
  const spamByQueue: Record<string, SpamCheckRow> = {};
  for (const s of spamRes.data ?? []) spamByQueue[s.queue_id] = s;

  return (
    <div className="space-y-5">
      <FadeIn>
        <div>
          <h1 className="font-display text-3xl font-bold">Send Queue</h1>
          <p className="mt-1 text-sm text-slate2">
            The single source of truth for what is sending, scheduled, or stopped.
          </p>
        </div>
      </FadeIn>

      {items.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="h-6 w-6" aria-hidden />}
          title="Queue is empty"
          detail="Approved emails appear here. The first 100 sends need your explicit tap — nothing goes out on its own."
        />
      ) : (
        <QueueTable items={items} spamByQueue={spamByQueue} />
      )}
    </div>
  );
}
