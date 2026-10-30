import { safeQuery } from '@/lib/db';
import { EmptyState, FadeIn, GlassCard, LoadError, Pill } from '@/components/ui';
import CountUp from '@/components/CountUp';
import CallForm from '@/components/CallForm';
import { callOutcomeTone, callScheduledAt, callNotes } from '@/lib/model';
import type { CallRow } from '@/lib/model';
import { PhoneCall } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Calls — Lumina' };

interface RawCall extends Omit<CallRow, 'leads'> {
  leads: Array<{ contact_name: string; company: string }> | null;
}

const OUTCOME_LABELS: Record<CallRow['outcome'], string> = {
  scheduled: 'Scheduled',
  done: 'Done',
  no_show: 'No-show',
  cancelled: 'Cancelled',
};

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export default async function CallsPage() {
  const [callsRes, leadsRes] = await Promise.all([
    safeQuery<RawCall[]>((db) =>
      db.from('calls').select('id, lead_id, cal_booking_ref, notes_json, outcome, created_at, leads(contact_name, company)').order('created_at', { ascending: false }).limit(100)
    ),
    safeQuery<Array<{ id: string; contact_name: string; company: string }>>((db) =>
      db.from('leads').select('id, contact_name, company').order('contact_name').limit(200)
    ),
  ]);

  if (callsRes.error) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-3xl font-bold">Calls</h1>
        <LoadError message={callsRes.error} retryHref="/calls" />
      </div>
    );
  }

  const calls: CallRow[] = (callsRes.data ?? []).map((c) => ({ ...c, leads: c.leads?.[0] ?? null }));
  const leads = leadsRes.data ?? [];

  const upcoming = calls
    .filter((c) => c.outcome === 'scheduled')
    .sort((a, b) => {
      const ta = callScheduledAt(a.notes_json);
      const tb = callScheduledAt(b.notes_json);
      return (ta ?? '').localeCompare(tb ?? '');
    });
  const past = calls.filter((c) => c.outcome !== 'scheduled');

  const card = (c: CallRow, i: number) => {
    const when = callScheduledAt(c.notes_json);
    const notes = callNotes(c.notes_json);
    return (
      <FadeIn key={c.id} delay={0.05 * i}>
        <GlassCard className="transition-transform duration-200 hover:-translate-y-0.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">
                  {c.leads ? `${c.leads.contact_name} — ${c.leads.company}` : 'Unknown lead'}
                </p>
                <Pill tone={callOutcomeTone(c.outcome)}>{OUTCOME_LABELS[c.outcome]}</Pill>
              </div>
              <p className="mt-1 text-sm text-slate2">{fmtDateTime(when)}</p>
              {notes && <p className="mt-1 text-sm text-ink/75">{notes}</p>}
              {c.cal_booking_ref && (
                <p className="mt-1 text-xs text-slate2">Booking ref: {c.cal_booking_ref}</p>
              )}
            </div>
          </div>
        </GlassCard>
      </FadeIn>
    );
  };

  return (
    <div className="space-y-8">
      <FadeIn>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold">Calls</h1>
            <p className="mt-1 text-sm text-slate2">The full call loop: schedule, prep, record the outcome.</p>
          </div>
          <CallForm leads={leads} />
        </div>
      </FadeIn>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Upcoming', value: upcoming.length },
          { label: 'Completed', value: calls.filter((c) => c.outcome === 'done').length },
          { label: 'No-shows', value: calls.filter((c) => c.outcome === 'no_show').length },
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

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">Upcoming</h2>
        {upcoming.length === 0 ? (
          <EmptyState
            icon={<PhoneCall className="h-6 w-6" aria-hidden />}
            title="Nothing scheduled"
            detail="Booked calls land here with their prep context. Schedule one with the Log call button."
          />
        ) : (
          upcoming.map(card)
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">Past</h2>
        {past.length === 0 ? (
          <EmptyState
            icon={<PhoneCall className="h-6 w-6" aria-hidden />}
            title="No call history yet"
            detail="Outcomes you record appear here — won, lost, no-show, cancelled, with notes."
          />
        ) : (
          past.map(card)
        )}
      </section>
    </div>
  );
}
