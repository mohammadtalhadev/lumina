import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  CircleDashed,
  HeartPulse,
  MailCheck,
  MailOpen,
  ThumbsUp,
  UserSearch,
} from 'lucide-react';
import { safeQuery, startOfTodayISO } from '@/lib/db';
import { timeAgo, type Alert } from '@/lib/model';
import { EmptyState, FadeIn, GlassCard, LoadError, Pill, StatCard } from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * Minimal count helper built on the raw client so pages stay readable.
 * Filters: { col: value } equality, { col_gte: value }, or arrays for IN.
 */

async function countWhere(
  table: string,
  filters: Record<string, string | string[] | boolean> = {}
): Promise<{ data: number | null; error: string | null }> {
  return safeQuery<number>(async (db) => {
    let q = db.from(table).select('id', { count: 'exact', head: true });
    for (const [key, value] of Object.entries(filters)) {
      if (key.endsWith('_gte')) q = q.gte(key.slice(0, -4), value as string);
      else if (Array.isArray(value)) q = q.in(key, value);
      else q = q.eq(key, value);
    }
    const { count, error } = await q;
    return { data: count, error };
  });
}

export default async function HomePage() {
  const today = startOfTodayISO();
  const [sent, replies, positives, accounts, unclassified, blocked, newLeads, badAccounts, activeCampaigns, alerts] =
    await Promise.all([
      countWhere('send_queue', { status: 'sent', sent_at_gte: today }),
      countWhere('replies'),
      countWhere('replies', { classification: 'positive' }),
      safeQuery<{ health_score: number }[]>((db) => db.from('sending_accounts').select('health_score')),
      countWhere('replies', { classification: 'unclassified' }),
      countWhere('send_queue', { status: 'blocked' }),
      countWhere('leads', { stage: 'New' }),
      countWhere('sending_accounts', { status: ['paused', 'disconnected'] }),
      countWhere('campaigns', { is_active: true }),
      safeQuery<Alert[]>((db) => db.from('alerts').select('*').order('created_at', { ascending: false }).limit(8)),
    ]);

  const anyError = [sent, replies, positives, accounts, unclassified, blocked, newLeads, badAccounts, activeCampaigns, alerts].some(
    (r) => r.error
  );
  const dbUnreachable = [sent, replies, positives, accounts, alerts].every((r) => r.error);

  const avgHealth =
    accounts.data && accounts.data.length > 0
      ? Math.round(accounts.data.reduce((s, a) => s + a.health_score, 0) / accounts.data.length)
      : null;

  const checklist = [
    {
      title: 'Review replies',
      detail:
        unclassified.data === null
          ? 'Could not load'
          : unclassified.data === 0
            ? 'Inbox triaged'
            : `${unclassified.data} waiting for review`,
      done: unclassified.data === 0,
      href: '/replies',
      icon: MailOpen,
    },
    {
      title: 'Research new leads',
      detail:
        newLeads.data === null ? 'Could not load' : newLeads.data === 0 ? 'None waiting' : `${newLeads.data} in New`,
      done: newLeads.data === 0,
      href: '/leads',
      icon: UserSearch,
    },
    {
      title: 'Clear blocked queue items',
      detail:
        blocked.data === null
          ? 'Could not load'
          : blocked.data === 0
            ? 'Nothing blocked'
            : `${blocked.data} blocked — see reason in Send Queue (Phase 1C)`,
      done: blocked.data === 0,
      href: null,
      icon: CircleDashed,
    },
    {
      title: 'Accounts need attention',
      detail:
        badAccounts.data === null
          ? 'Could not load'
          : badAccounts.data === 0
            ? 'All accounts healthy'
            : `${badAccounts.data} paused or disconnected (Accounts screen in Phase 1C)`,
      done: badAccounts.data === 0,
      href: null,
      icon: HeartPulse,
    },
    {
      title: 'Campaigns active',
      detail:
        activeCampaigns.data === null
          ? 'Could not load'
          : activeCampaigns.data === 0
            ? 'No active campaign yet (Campaigns screen in Phase 1C)'
            : `${activeCampaigns.data} active`,
      done: (activeCampaigns.data ?? 0) > 0,
      href: null,
      icon: CheckCircle2,
    },
  ];

  const alertTone = (t: Alert['type']) =>
    t === 'critical' ? 'red' : t === 'warning' ? 'amber' : t === 'positive_reply' ? 'green' : 'grey';

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold">Home Today</h1>
            <p className="mt-1 text-sm text-slate2">
              Your 30-second briefing — real numbers only. Blank means no data yet, not zero.
            </p>
          </div>
          <p className="text-sm text-slate2">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </FadeIn>

      {dbUnreachable && (
        <LoadError message="Supabase is unreachable or the migration hasn't been run yet. Run 0001_lumina_core.sql in the SQL Editor, then reload." />
      )}

      {/* KPI row */}
      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Emails sent today" value={sent.data === null ? null : String(sent.data)} icon={MailCheck} delay={0} />
        <StatCard label="Replies received" value={replies.data === null ? null : String(replies.data)} icon={MailOpen} delay={0.05} />
        <StatCard label="Positive replies" value={positives.data === null ? null : String(positives.data)} icon={ThumbsUp} delay={0.1} />
        <StatCard
          label="Avg account health"
          value={avgHealth === null ? null : `${avgHealth}`}
          sub={accounts.data ? `${accounts.data.length} account${accounts.data.length === 1 ? '' : 's'}` : undefined}
          icon={HeartPulse}
          delay={0.15}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Launch checklist */}
        <FadeIn delay={0.1}>
          <GlassCard className="h-full">
            <h2 className="font-display text-lg font-semibold">Today&apos;s launch checklist</h2>
            <ul className="mt-4 space-y-2">
              {checklist.map((item) => {
                const Icon = item.icon;
                const row = (
                  <li
                    className={`flex items-center gap-3 rounded-2xl border border-white/70 bg-white/50 px-4 py-3 ${
                      item.href ? 'transition-colors hover:bg-white/80' : ''
                    }`}
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
                        item.done ? 'bg-emerald-100/80 text-emerald-700' : 'bg-primary-soft text-primary-dark'
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{item.title}</span>
                      <span className="block truncate text-xs text-slate2">{item.detail}</span>
                    </span>
                    {item.done ? (
                      <Pill tone="green">Done</Pill>
                    ) : (
                      <Pill tone="amber">Pending</Pill>
                    )}
                    {item.href && <ArrowRight className="h-4 w-4 shrink-0 text-slate2" aria-hidden />}
                  </li>
                );
                return item.href ? (
                  <Link key={item.title} href={item.href} className="block">
                    {row}
                  </Link>
                ) : (
                  <div key={item.title}>{row}</div>
                );
              })}
            </ul>
          </GlassCard>
        </FadeIn>

        {/* Alerts feed */}
        <FadeIn delay={0.15}>
          <GlassCard className="h-full">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Alerts feed</h2>
              <Bell className="h-4 w-4 text-slate2" aria-hidden />
            </div>
            {alerts.error ? (
              <p className="mt-4 text-sm text-slate2">Alerts unavailable — {alerts.error}</p>
            ) : !alerts.data || alerts.data.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  icon={Bell}
                  title="No alerts yet"
                  detail="Replies, warnings, and health events will appear here once the system is running."
                />
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {alerts.data.map((a) => (
                  <li key={a.id} className="rounded-2xl border border-white/70 bg-white/50 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <Pill tone={alertTone(a.type)}>{a.type.replace('_', ' ')}</Pill>
                      <span className="text-xs text-slate2">{timeAgo(a.created_at)}</span>
                    </div>
                    <p className="mt-1.5 text-sm">{a.message}</p>
                    {a.lead_id && (
                      <Link href={`/leads/${a.lead_id}`} className="mt-1 inline-block text-xs font-semibold text-primary-dark underline">
                        View lead
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </FadeIn>
      </div>

      {anyError && !dbUnreachable && (
        <p className="text-xs text-slate2">Some sections couldn&apos;t load. Check that migration 0001 has been run.</p>
      )}
    </div>
  );
}
