import Link from 'next/link';
import { MailOpen } from 'lucide-react';
import { safeQuery } from '@/lib/db';
import { timeAgo, CLASSIFICATION_LABELS, type Reply, type SendingAccount } from '@/lib/model';
import {
  EmptyState,
  FadeIn,
  GlassCard,
  LoadError,
  Pill,
  classificationTone,
} from '@/components/ui';
import ReplyComposer from '@/components/ReplyComposer';
import { cn } from '@/lib/cn';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Replies Inbox — Lumina' };

const TABS = [
  { key: 'all', label: 'All', classification: null as string | null },
  { key: 'positive', label: 'Positive', classification: 'positive' },
  { key: 'price', label: 'Price', classification: 'price' },
  { key: 'busy', label: 'Busy', classification: 'busy' },
  { key: 'not_interested', label: 'Not Interested', classification: 'not_interested' },
] as const;

export default async function RepliesPage({
  searchParams,
}: {
  searchParams: { tab?: string; thread?: string };
}) {
  const tab = TABS.find((t) => t.key === searchParams.tab) ?? TABS[0];

  const [repliesRes, accountsRes] = await Promise.all([
    safeQuery<Reply[]>((db) => {
      let q = db
        .from('replies')
        .select('*, leads(contact_name, company)')
        .order('received_at', { ascending: false })
        .limit(60);
      if (tab.classification) q = q.eq('classification', tab.classification);
      return q;
    }),
    safeQuery<Pick<SendingAccount, 'id' | 'label' | 'email'>[]>((db) =>
      db.from('sending_accounts').select('id, label, email')
    ),
  ]);

  if (repliesRes.error) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-3xl font-bold">Replies Inbox</h1>
        <LoadError message={repliesRes.error} retryHref="/replies" />
      </div>
    );
  }

  const replies = repliesRes.data ?? [];
  const accountById = new Map((accountsRes.data ?? []).map((a) => [a.id, a]));
  const selected = replies.find((r) => r.id === searchParams.thread) ?? replies[0] ?? null;

  const threadHref = (r: Reply) => `/replies?tab=${tab.key}&thread=${r.id}`;

  return (
    <div className="space-y-5">
      <FadeIn>
        <div>
          <h1 className="font-display text-3xl font-bold">Replies Inbox</h1>
          <p className="mt-1 text-sm text-slate2">
            Every reply, from every account, in one place. Positives first.
          </p>
        </div>
      </FadeIn>

      {/* Tabs — wrapped rows, never clipped text */}
      <nav aria-label="Reply filters" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/replies?tab=${t.key}`}
            aria-current={t.key === tab.key ? 'page' : undefined}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              t.key === tab.key
                ? 'bg-primary text-white shadow-card'
                : 'border border-white/80 bg-white/60 text-ink/70 backdrop-blur-xl hover:bg-white/90'
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {replies.length === 0 ? (
        <EmptyState
          icon={<MailOpen className="h-6 w-6" aria-hidden />}
          title={tab.key === 'all' ? 'No replies yet' : `No ${tab.label.toLowerCase()} replies`}
          detail="First replies land here once outreach starts. Polling runs every 15 minutes per account."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
          {/* Thread list */}
          <FadeIn delay={0.05}>
            <ul className="space-y-2.5" aria-label="Reply threads">
              {replies.map((r) => {
                const active = selected?.id === r.id;
                const leadName = r.leads?.contact_name ?? 'Unknown lead';
                return (
                  <li key={r.id}>
                    <Link
                      href={threadHref(r)}
                      aria-current={active ? 'true' : undefined}
                      className={cn(
                        'block rounded-3xl border p-4 backdrop-blur-xl transition-all',
                        active
                          ? 'border-primary/40 bg-white/85 shadow-card'
                          : 'border-white/70 bg-white/60 hover:bg-white/80'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{leadName}</p>
                        <span className="shrink-0 text-xs text-slate2">{timeAgo(r.received_at)}</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate2">{r.leads?.company ?? ''}</p>
                      <p className="mt-1.5 line-clamp-2 text-sm text-ink/80">{r.body_summary || 'No summary'}</p>
                      <div className="mt-2">
                        <Pill tone={classificationTone(r.classification)}>
                          {CLASSIFICATION_LABELS[r.classification] ?? r.classification}
                        </Pill>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </FadeIn>

          {/* Thread detail */}
          <FadeIn delay={0.1}>
            {selected ? (
              <GlassCard>
                <ThreadDetail reply={selected} accountById={accountById} />
                <ReplyComposer replyId={selected.id} leadName={selected.leads?.contact_name ?? 'them'} />
              </GlassCard>
            ) : (
              <GlassCard>
                <p className="text-sm text-slate2">Select a thread to read it.</p>
              </GlassCard>
            )}
          </FadeIn>
        </div>
      )}
    </div>
  );
}

function ThreadDetail({
  reply,
  accountById,
}: {
  reply: Reply;
  accountById: Map<string, Pick<SendingAccount, 'id' | 'label' | 'email'>>;
}) {
  const receiving = reply.account_id ? accountById.get(reply.account_id) : null;
  const replyFrom = reply.reply_from_account_id ? accountById.get(reply.reply_from_account_id) : null;
  const leadName = reply.leads?.contact_name ?? 'Unknown lead';

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">{leadName}</h2>
          {reply.leads?.company && <p className="text-sm text-slate2">{reply.leads.company}</p>}
        </div>
        <Pill tone={classificationTone(reply.classification)}>
          {CLASSIFICATION_LABELS[reply.classification] ?? reply.classification}
        </Pill>
      </div>

      <dl className="mt-3 space-y-1.5 rounded-2xl bg-white/60 p-4 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-slate2">Received</dt>
          <dd className="font-medium">{timeAgo(reply.received_at)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate2">On account</dt>
          <dd className="truncate font-medium">{receiving ? receiving.email : '—'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate2">Reply from</dt>
          <dd className="truncate font-medium" title="Replies go from the same account that sent the original email">
            {replyFrom ? replyFrom.email : '—'}
          </dd>
        </div>
        {reply.thread_id && (
          <div className="flex justify-between gap-3">
            <dt className="text-slate2">Thread</dt>
            <dd className="max-w-[220px] truncate font-mono text-xs">{reply.thread_id}</dd>
          </div>
        )}
      </dl>

      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate2">Summary</h3>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
          {reply.body_summary || 'No summary recorded for this reply.'}
        </p>
        <p className="mt-2 text-xs text-slate2">
          Summaries only — full email bodies never leave the dashboard.
        </p>
      </div>

      {reply.lead_id && (
        <Link
          href={`/leads/${reply.lead_id}`}
          className="mt-3 inline-block text-sm font-semibold text-primary-dark underline"
        >
          Open lead profile
        </Link>
      )}
    </div>
  );
}
