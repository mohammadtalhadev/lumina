import { safeQuery } from '@/lib/db';
import { EmptyState, FadeIn, GlassCard, LoadError, Pill } from '@/components/ui';
import HealthRing from '@/components/HealthRing';
import CountUp from '@/components/CountUp';
import ConnectAccountPanel from '@/components/ConnectAccountPanel';
import { accountTone, ACCOUNT_LABELS, timeAgo } from '@/lib/model';
import type { WarmupInbox } from '@/lib/model';
import { Flame, GraduationCap } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Warmup Monitor — Lumina' };

interface RawWarmup extends Omit<WarmupInbox, 'sending_accounts'> {
  sending_accounts: Array<{ email: string; label: string }> | null;
}

const RAMP = [
  { days: 'Day 1–7', what: 'Warmup only — daily warmup emails to known contacts + AutoMailer network. Campaign volume: 0.' },
  { days: 'Day 8–14', what: 'Placement testing — AutoMailer score + seed list + bounce watch. Still 0 campaign volume.' },
  { days: 'Day 15–21', what: 'Gate check: 85%+ placement, <2% bounce, zero complaints → Ready at 5/day.' },
  { days: 'Day 22–28', what: 'Proven accounts climb to 10/day.' },
  { days: 'Day 29+', what: 'Max 20/day (personal Outlook). Caps move down on bad health, never up on hope.' },
];

export default async function WarmupPage() {
  const [warmupRes, accountsRes] = await Promise.all([
    safeQuery<RawWarmup[]>((db) =>
      db
        .from('warmup_inboxes')
        .select('id, account_id, placement_score, checked_at, sending_accounts(email, label)')
        .order('checked_at', { ascending: false })
        .limit(200)
    ),
    safeQuery<Array<{ id: string; label: string; email: string; status: string; warmup_day: number; placement_score: number }>>(
      (db) =>
        db.from('sending_accounts').select('id, label, email, status, warmup_day, placement_score').order('warmup_day', { ascending: false })
    ),
  ]);

  if (accountsRes.error) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-3xl font-bold">Warmup Monitor</h1>
        <LoadError message={accountsRes.error} retryHref="/warmup" />
      </div>
    );
  }

  const accounts = accountsRes.data ?? [];
  const checks = (warmupRes.data ?? []).map((w) => ({ ...w, sending_accounts: w.sending_accounts?.[0] ?? null }));
  const latestByAccount: Record<string, (typeof checks)[number]> = {};
  for (const c of checks) {
    if (!latestByAccount[c.account_id]) latestByAccount[c.account_id] = c;
  }

  const warming = accounts.filter((a) => a.status === 'warming');
  const ready = accounts.filter((a) => a.status === 'ready');

  return (
    <div className="space-y-5">
      <FadeIn>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold">Warmup Monitor</h1>
            <p className="mt-1 text-sm text-slate2">
              Watch every account climb the ramp — no volume before readiness.
            </p>
          </div>
          <ConnectAccountPanel />
        </div>
      </FadeIn>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Warming now', value: warming.length },
          { label: 'Ready for volume', value: ready.length },
          { label: 'Total accounts', value: accounts.length },
        ].map((s, i) => (
          <FadeIn key={s.label} delay={0.06 * i}>
            <div className="glass rounded-3xl p-5 transition-transform duration-200 hover:-translate-y-0.5">
              <p className="text-sm font-medium text-slate2">{s.label}</p>
              <p className="mt-1 font-display text-3xl font-bold tabular-nums">
                <CountUp value={s.value} />
              </p>
            </div>
          </FadeIn>
        ))}
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={<Flame className="h-6 w-6" aria-hidden />}
          title="No accounts warming"
          detail="Connect your first sending account and it starts here on Day 0 — campaign volume unlocks only after the 85%+ placement gate."
        />
      ) : (
        <div className="space-y-3">
          {accounts.map((a, i) => {
            const latest = latestByAccount[a.id];
            return (
              <FadeIn key={a.id} delay={0.05 * i}>
                <GlassCard className="transition-transform duration-200 hover:-translate-y-0.5">
                  <div className="flex flex-wrap items-center gap-4">
                    <HealthRing score={a.placement_score} size={56} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{a.label}</p>
                        <Pill tone={accountTone(a.status)}>{ACCOUNT_LABELS[a.status] ?? a.status}</Pill>
                        <Pill tone="cyan">Day {a.warmup_day}/30</Pill>
                      </div>
                      <p className="mt-1 truncate text-sm text-slate2">{a.email}</p>
                      <p className="mt-1 text-xs text-slate2">
                        {latest
                          ? `Last placement check ${timeAgo(latest.checked_at)} — score ${latest.placement_score}%`
                          : 'No placement check recorded yet'}
                      </p>
                    </div>
                    <div className="w-full sm:w-56">
                      <div className="flex justify-between text-xs text-slate2">
                        <span>Ramp progress</span>
                        <span className="tabular-nums">{Math.min(100, Math.round((a.warmup_day / 30) * 100))}%</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-accent-cyan"
                          style={{ width: `${Math.min(100, (a.warmup_day / 30) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </FadeIn>
            );
          })}
        </div>
      )}

      <FadeIn delay={0.1}>
        <GlassCard>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary-soft text-primary-dark">
              <GraduationCap className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="font-display text-xl font-bold">Graduation rules</h2>
          </div>
          <ol className="mt-4 space-y-3">
            {RAMP.map((r, i) => (
              <li key={r.days} className="flex gap-3 text-sm">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary-dark">
                  {i + 1}
                </span>
                <p className="text-ink/80">
                  <strong>{r.days}:</strong> {r.what}
                </p>
              </li>
            ))}
          </ol>
          <p className="mt-4 rounded-2xl bg-amber-100/70 px-4 py-2.5 text-sm text-amber-900">
            The 85%+ placement gate is measured, not logged by hand: AutoMailer warmup
            score + seed placement test + bounce rate + complaints, snapshotted daily.
          </p>
        </GlassCard>
      </FadeIn>
    </div>
  );
}
