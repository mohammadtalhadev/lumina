import { safeQuery } from '@/lib/db';
import { EmptyState, FadeIn, GlassCard, LoadError, Pill } from '@/components/ui';
import HealthRing from '@/components/HealthRing';
import CountUp from '@/components/CountUp';
import { accountTone, ACCOUNT_LABELS } from '@/lib/model';
import type { AccountFull, HealthDaily } from '@/lib/model';
import { Activity, ShieldAlert } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Deliverability Health — Lumina' };

/**
 * Auto-pause thresholds (rotation spec): bounce >5% or spam complaints >0.3%
 * over the trailing 7 days pauses the account immediately. Warnings fire
 * earlier: bounce >2%, complaints >0.1%.
 */
function flagFor(bouncePct: number | null, spamPct: number | null): { tone: 'red' | 'amber' | null; label: string } {
  if (bouncePct !== null && bouncePct > 5) return { tone: 'red', label: `Bounce ${bouncePct.toFixed(1)}% — over the 5% auto-pause line` };
  if (spamPct !== null && spamPct > 0.3) return { tone: 'red', label: `Spam complaints ${spamPct.toFixed(2)}% — over the 0.3% auto-pause line` };
  if (bouncePct !== null && bouncePct > 2) return { tone: 'amber', label: `Bounce ${bouncePct.toFixed(1)}% — warning (auto-pause at 5%)` };
  if (spamPct !== null && spamPct > 0.1) return { tone: 'amber', label: `Spam complaints ${spamPct.toFixed(2)}% — warning (auto-pause at 0.3%)` };
  return { tone: null, label: '' };
}

export default async function HealthPage() {
  const [accountsRes, dailyRes] = await Promise.all([
    safeQuery<AccountFull[]>((db) =>
      db.from('sending_accounts').select('id, label, email, provider, status, warmup_day, placement_score, daily_cap, sent_today, health_score, paused_reason').order('health_score')
    ),
    safeQuery<HealthDaily[]>((db) =>
      db.from('account_health_daily').select('account_id, day, sent, bounces, replies, spam_complaints, health_score').order('day', { ascending: false }).limit(500)
    ),
  ]);

  if (accountsRes.error) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-3xl font-bold">Deliverability Health</h1>
        <LoadError message={accountsRes.error} retryHref="/health" />
      </div>
    );
  }

  const accounts = accountsRes.data ?? [];
  const daily = dailyRes.data ?? [];

  if (accounts.length === 0) {
    return (
      <div className="space-y-5">
        <FadeIn>
          <div>
            <h1 className="font-display text-3xl font-bold">Deliverability Health</h1>
            <p className="mt-1 text-sm text-slate2">The numbers that decide whether sending continues.</p>
          </div>
        </FadeIn>
        <EmptyState
          icon={<Activity className="h-6 w-6" aria-hidden />}
          title="No sending accounts yet"
          detail="Health metrics appear once accounts exist and the daily health worker has run. Add your first account on the Accounts page."
        />
      </div>
    );
  }

  const byAccount: Record<string, HealthDaily[]> = {};
  for (const d of daily) (byAccount[d.account_id] ??= []).push(d);

  const sent7 = daily.reduce((s, d) => s + d.sent, 0);
  const bounces7 = daily.reduce((s, d) => s + d.bounces, 0);
  const spam7 = daily.reduce((s, d) => s + d.spam_complaints, 0);
  const avgHealth = accounts.reduce((s, a) => s + a.health_score, 0) / accounts.length;
  const avgPlacement = accounts.reduce((s, a) => s + a.placement_score, 0) / accounts.length;
  const bouncePct = sent7 > 0 ? (bounces7 / sent7) * 100 : null;
  const spamPct = sent7 > 0 ? (spam7 / sent7) * 100 : null;

  const rows = accounts.map((a, i) => {
    const rows7 = (byAccount[a.id] ?? []).slice(0, 7);
    const s = rows7.reduce((x, d) => x + d.sent, 0);
    const b = rows7.reduce((x, d) => x + d.bounces, 0);
    const sp = rows7.reduce((x, d) => x + d.spam_complaints, 0);
    const bpct = s > 0 ? (b / s) * 100 : null;
    const spct = s > 0 ? (sp / s) * 100 : null;
    return { account: a, flag: flagFor(bpct, spct), index: i };
  });

  return (
    <div className="space-y-5">
      <FadeIn>
        <div>
          <h1 className="font-display text-3xl font-bold">Deliverability Health</h1>
          <p className="mt-1 text-sm text-slate2">
            The numbers that decide whether sending continues. Trailing 7 days{daily.length === 0 && ' — no snapshots yet, showing account scores only'}.
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <GlassCard className="flex items-start gap-3 border-amber-200/70">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
          <p className="text-sm leading-relaxed text-ink/80">
            <strong>Auto-pause rules:</strong> bounce rate over <strong>5%</strong> or spam
            complaints over <strong>0.3%</strong> pauses an account immediately — the queue
            skips it and you get an alert with the exact reason. Warnings fire earlier
            (bounce &gt; 2%, complaints &gt; 0.1%). Paused accounts wait; their pending
            sends are never redistributed.
          </p>
        </GlassCard>
      </FadeIn>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Avg health score',
            node: (
              <p className="mt-1 font-display text-3xl font-bold tabular-nums">
                <CountUp value={avgHealth} decimals={1} />
              </p>
            ),
            sub: `${accounts.length} account${accounts.length === 1 ? '' : 's'} in the pool`,
          },
          {
            label: 'Bounce rate (7d)',
            node:
              bouncePct === null ? (
                <p className="mt-2 text-sm text-slate2/80">No sends yet</p>
              ) : (
                <p className="mt-1 font-display text-3xl font-bold tabular-nums">
                  <CountUp value={bouncePct} decimals={1} suffix="%" />
                </p>
              ),
            sub: bouncePct === null ? undefined : `${bounces7.toLocaleString()} bounces / ${sent7.toLocaleString()} sent`,
          },
          {
            label: 'Spam complaints (7d)',
            node:
              spamPct === null ? (
                <p className="mt-2 text-sm text-slate2/80">No sends yet</p>
              ) : (
                <p className="mt-1 font-display text-3xl font-bold tabular-nums">
                  <CountUp value={spamPct} decimals={2} suffix="%" />
                </p>
              ),
            sub: spamPct === null ? undefined : `${spam7} complaints / ${sent7.toLocaleString()} sent`,
          },
          {
            label: 'Avg placement',
            node: (
              <p className="mt-1 font-display text-3xl font-bold tabular-nums">
                <CountUp value={avgPlacement} decimals={0} suffix="%" />
              </p>
            ),
            sub: 'Seed + AutoMailer placement score',
          },
        ].map((c, i) => (
          <FadeIn key={c.label} delay={0.06 * i}>
            <div className="glass rounded-3xl p-5 transition-transform duration-200 hover:-translate-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate2">{c.label}</p>
                <span className="grid h-9 w-9 place-items-center rounded-2xl bg-primary-soft text-primary-dark">
                  <Activity className="h-4 w-4" aria-hidden />
                </span>
              </div>
              {c.node}
              {c.sub && <p className="mt-1 text-xs text-slate2">{c.sub}</p>}
            </div>
          </FadeIn>
        ))}
      </div>

      {/* Pool health ring strip */}
      <FadeIn delay={0.24}>
        <GlassCard className="flex flex-wrap items-center gap-x-10 gap-y-4">
          <div className="flex items-center gap-4">
            <HealthRing score={avgHealth} />
            <div>
              <p className="text-sm font-medium text-slate2">Pool health</p>
              <p className="text-xs text-slate2">Mean of account scores</p>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-slate2">Sent (7d)</p>
            <p className="font-display text-2xl font-bold tabular-nums">
              <CountUp value={sent7} />
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate2">Accounts auto-paused</p>
            <p className="font-display text-2xl font-bold tabular-nums">
              <CountUp value={accounts.filter((a) => a.status === 'paused').length} />
            </p>
          </div>
        </GlassCard>
      </FadeIn>

      <div className="space-y-3">
        {rows.map(({ account: a, flag }, i) => (
          <FadeIn key={a.id} delay={0.05 * i}>
            <GlassCard className="transition-transform duration-200 hover:-translate-y-0.5">
              <div className="flex flex-wrap items-center gap-4">
                <HealthRing score={a.health_score} size={56} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{a.label}</p>
                    <Pill tone={accountTone(a.status)}>{ACCOUNT_LABELS[a.status] ?? a.status}</Pill>
                    {a.status === 'paused' && a.paused_reason && (
                      <Pill tone="red">Auto-paused</Pill>
                    )}
                    {flag.tone && <Pill tone={flag.tone}>{flag.label}</Pill>}
                  </div>
                  <p className="mt-1 truncate text-sm text-slate2">{a.email}</p>
                  {a.status === 'paused' && a.paused_reason && (
                    <p className="mt-1 text-sm text-red-700">Reason: {a.paused_reason}</p>
                  )}
                </div>
                <div className="text-right text-sm">
                  <p className="text-slate2">
                    Cap <span className="font-semibold text-ink tabular-nums">{a.sent_today}/{a.daily_cap}</span> today
                  </p>
                  <p className="text-slate2">
                    Placement <span className="font-semibold text-ink tabular-nums">{a.placement_score}%</span>
                  </p>
                </div>
              </div>
            </GlassCard>
          </FadeIn>
        ))}
      </div>

      <p className="text-xs text-slate2">
        {daily.length > 0
          ? `Latest snapshot day: ${daily[0].day} — the daily health worker writes one row per account per day.`
          : 'No snapshots yet — the daily health worker writes one row per account per day.'}
      </p>
    </div>
  );
}
