import { safeQuery } from '@/lib/db';
import {
  accountTone,
  ACCOUNT_LABELS,
  rotationWeight,
  type AccountFull,
} from '@/lib/model';
import {
  EmptyState,
  FadeIn,
  GlassCard,
  LoadError,
  Pill,
} from '@/components/ui';
import ConnectAccountPanel from '@/components/ConnectAccountPanel';
import { cn } from '@/lib/cn';
import { ShieldAlert, UserPlus } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Accounts & Rotation — Lumina' };

/** token_ref is deliberately NOT selected — it names a server-side secret location. */
const ACCOUNT_COLS =
  'id, label, email, provider, status, warmup_day, placement_score, daily_cap, sent_today, health_score, paused_reason';

function HealthRing({ score }: { score: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));
  const color = clamped >= 85 ? '#059669' : clamped >= 60 ? '#d97706' : '#dc2626';
  return (
    <div className="relative h-16 w-16" role="img" aria-label={`Health score ${clamped} of 100`}>
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" className="stroke-ink/10" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * clamped) / 100}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-sm font-bold tabular-nums">
        {clamped}
      </span>
    </div>
  );
}

export default async function AccountsPage({
  searchParams,
}: {
  searchParams?: { connected?: string; error?: string };
}) {
  const res = await safeQuery<AccountFull[]>((db) =>
    db.from('sending_accounts').select(ACCOUNT_COLS).order('created_at')
  );

  if (res.error) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-3xl font-bold">Accounts &amp; Rotation</h1>
        <LoadError message={res.error} retryHref="/accounts" />
      </div>
    );
  }

  const accounts = res.data ?? [];
  const paused = accounts.filter((a) => a.status === 'paused');

  return (
    <div className="space-y-5">
      {searchParams?.connected && (
        <div className="rounded-3xl border border-emerald-200/70 bg-emerald-50/70 p-4 text-sm text-emerald-900">
          <strong>Account connected.</strong> It starts in Warming — campaign volume
          unlocks after the 85%+ placement gate. Tokens refresh automatically.
        </div>
      )}
      {searchParams?.error && (
        <div className="rounded-3xl border border-red-200/70 bg-red-50/70 p-4 text-sm text-red-900">
          <strong>Connection failed:</strong> {searchParams.error}
        </div>
      )}
      <FadeIn>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold">Accounts &amp; Rotation</h1>
            <p className="mt-1 text-sm text-slate2">
              Every sending account&apos;s health at a glance. Rotation picks the healthiest eligible account per send.
            </p>
          </div>
          <ConnectAccountPanel />
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="flex items-start gap-3 rounded-3xl border border-cyan-200/70 bg-cyan-50/60 p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" aria-hidden />
          <p className="text-sm text-cyan-900">
            <strong>Auto-pause protects deliverability:</strong> bounce rate over 5% or spam
            complaints over 0.3% pauses an account automatically — its queued items wait,
            they are never redistributed to other accounts.
          </p>
        </div>
      </FadeIn>

      {accounts.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="h-6 w-6" aria-hidden />}
          title="No sending accounts yet"
          detail="Connect your first Outlook account to start warming. New accounts always start in Warming — never Ready."
          action={<ConnectAccountPanel />}
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a, i) => {
            const capPct = a.daily_cap > 0 ? Math.min(100, Math.round((a.sent_today / a.daily_cap) * 100)) : 0;
            return (
              <FadeIn key={a.id} delay={Math.min(i * 0.05, 0.3)}>
                <GlassCard className="h-full">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-display text-lg font-bold">{a.label}</h2>
                      <p className="truncate text-sm text-slate2" title={a.email}>{a.email}</p>
                      <p className="mt-1 text-xs text-slate2">
                        {a.provider === 'm365_sending_domain' ? 'Microsoft 365 sending domain' : 'Outlook personal'}
                      </p>
                    </div>
                    <HealthRing score={a.health_score} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Pill tone={accountTone(a.status)}>{ACCOUNT_LABELS[a.status] ?? a.status}</Pill>
                    <span className="text-xs text-slate2" title="Derived from the health score — the worker picks the highest-health eligible account">
                      Rotation weight {rotationWeight(a.health_score)}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate2">Daily cap</span>
                      <span className="font-semibold tabular-nums">
                        {a.daily_cap > 0 ? `${a.sent_today}/${a.daily_cap}` : 'cap not set'}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuenow={capPct} aria-valuemin={0} aria-valuemax={100} aria-label="Daily cap progress">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent-cyan" style={{ width: `${capPct}%` }} />
                    </div>
                  </div>

                  <dl className="mt-4 space-y-1.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate2">Warmup</dt>
                      <dd className="font-medium tabular-nums">Day {a.warmup_day}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate2">Placement</dt>
                      <dd className="font-medium tabular-nums">{a.placement_score}%</dd>
                    </div>
                  </dl>

                  {a.status === 'paused' && a.paused_reason && (
                    <p className="mt-3 rounded-2xl border border-red-200/70 bg-red-50/70 p-3 text-xs leading-relaxed text-red-900">
                      <strong>Paused:</strong> {a.paused_reason}
                    </p>
                  )}
                  {a.status === 'disconnected' && (
                    <p className="mt-3 rounded-2xl border border-amber-200/70 bg-amber-50/70 p-3 text-xs text-amber-900">
                      Token expired or revoked — reconnect to resume sending from this account.
                    </p>
                  )}
                </GlassCard>
              </FadeIn>
            );
          })}
        </div>
      )}

      {paused.length > 0 && (
        <p className={cn('text-xs text-slate2')}>
          {paused.length} account{paused.length === 1 ? ' is' : 's are'} paused. Queued items on
          paused accounts wait in place — they are not moved to other accounts.
        </p>
      )}
    </div>
  );
}
