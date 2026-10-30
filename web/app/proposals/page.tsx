import { safeQuery } from '@/lib/db';
import { EmptyState, FadeIn, GlassCard, LoadError, Pill } from '@/components/ui';
import CountUp from '@/components/CountUp';
import ProposalForm from '@/components/ProposalForm';
import ProposalActions from '@/components/ProposalActions';
import { proposalTone, timeAgo } from '@/lib/model';
import type { ProposalRow, ClientRow } from '@/lib/model';
import { FileText, Handshake } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Proposals & Clients — Lumina' };

interface RawProposal extends Omit<ProposalRow, 'leads'> {
  leads: Array<{ contact_name: string; company: string }> | null;
}
interface RawClient extends Omit<ClientRow, 'leads'> {
  leads: Array<{ contact_name: string; company: string }> | null;
}

function money(v: string): string {
  const n = Number(v);
  return Number.isFinite(n) ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—';
}

export default async function ProposalsPage() {
  const [proposalsRes, clientsRes, leadsRes] = await Promise.all([
    safeQuery<RawProposal[]>((db) =>
      db.from('proposals').select('id, lead_id, amount, status, sent_at, created_at, leads(contact_name, company)').order('created_at', { ascending: false }).limit(100)
    ),
    safeQuery<RawClient[]>((db) =>
      db.from('clients').select('id, lead_id, advance_paid, advance_verified_at, advance_amount, remaining_amount, payment_method, invoice_ref, go_live_at, leads(contact_name, company)').order('created_at', { ascending: false }).limit(100)
    ),
    safeQuery<Array<{ id: string; contact_name: string; company: string }>>((db) =>
      db.from('leads').select('id, contact_name, company').order('contact_name').limit(200)
    ),
  ]);

  if (proposalsRes.error) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-3xl font-bold">Proposals & Clients</h1>
        <LoadError message={proposalsRes.error} retryHref="/proposals" />
      </div>
    );
  }

  const proposals: ProposalRow[] = (proposalsRes.data ?? []).map((p) => ({ ...p, leads: p.leads?.[0] ?? null }));
  const clients: ClientRow[] = (clientsRes.data ?? []).map((c) => ({ ...c, leads: c.leads?.[0] ?? null }));
  const leads = leadsRes.data ?? [];

  const activeProposals = proposals.filter((p) => p.status === 'draft' || p.status === 'sent');
  const pipelineValue = proposals
    .filter((p) => p.status === 'sent')
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  return (
    <div className="space-y-8">
      <FadeIn>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold">Proposals & Clients</h1>
            <p className="mt-1 text-sm text-slate2">Everything after “yes” — proposals, contracts, payments, onboarding.</p>
          </div>
          <ProposalForm leads={leads} />
        </div>
      </FadeIn>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Active proposals', value: activeProposals.length },
          { label: 'Sent pipeline value', value: pipelineValue, money: true },
          { label: 'Clients onboarded', value: clients.length },
        ].map((s, i) => (
          <FadeIn key={s.label} delay={0.06 * i}>
            <div className="glass rounded-3xl p-5 transition-transform duration-200 hover:-translate-y-0.5">
              <p className="text-sm font-medium text-slate2">{s.label}</p>
              <p className="mt-1 font-display text-3xl font-bold tabular-nums">
                <CountUp value={s.value} prefix={s.money ? '$' : ''} />
              </p>
            </div>
          </FadeIn>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <FileText className="h-5 w-5 text-primary-dark" aria-hidden />
          Proposals
        </h2>
        {proposals.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" aria-hidden />}
            title="No proposals yet"
            detail="When a call goes well, draft the 1-page proposal here. Drafts move forward only: draft → sent → accepted / rejected."
          />
        ) : (
          proposals.map((p, i) => (
            <FadeIn key={p.id} delay={0.05 * i}>
              <GlassCard className="transition-transform duration-200 hover:-translate-y-0.5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">
                        {p.leads ? `${p.leads.contact_name} — ${p.leads.company}` : 'Unknown lead'}
                      </p>
                      <Pill tone={proposalTone(p.status)}>{p.status}</Pill>
                    </div>
                    <p className="mt-1 text-sm text-slate2">
                      Created {timeAgo(p.created_at)}
                      {p.sent_at ? ` · Sent ${timeAgo(p.sent_at)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-display text-2xl font-bold tabular-nums">{money(p.amount)}</p>
                    <ProposalActions proposal={p} />
                  </div>
                </div>
              </GlassCard>
            </FadeIn>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <Handshake className="h-5 w-5 text-primary-dark" aria-hidden />
          Clients
        </h2>
        {clients.length === 0 ? (
          <EmptyState
            icon={<Handshake className="h-6 w-6" aria-hidden />}
            title="No clients yet"
            detail="Accepted proposals become clients here, with 50/50 payment tracking and the onboarding checklist. No client is marked won before the advance is verified."
          />
        ) : (
          clients.map((c, i) => (
            <FadeIn key={c.id} delay={0.05 * i}>
              <GlassCard className="transition-transform duration-200 hover:-translate-y-0.5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">
                        {c.leads ? `${c.leads.contact_name} — ${c.leads.company}` : 'Unknown lead'}
                      </p>
                      {c.advance_paid ? (
                        <Pill tone="green">Advance verified</Pill>
                      ) : (
                        <Pill tone="amber">Advance pending</Pill>
                      )}
                      {c.go_live_at && <Pill tone="cyan">Live</Pill>}
                    </div>
                    <p className="mt-1 text-sm text-slate2">
                      Advance {money(c.advance_amount)} · Remaining {money(c.remaining_amount)}
                      {c.payment_method ? ` · via ${c.payment_method}` : ''}
                      {c.invoice_ref ? ` · ${c.invoice_ref}` : ''}
                    </p>
                  </div>
                  <p className="text-xs text-slate2">
                    {c.go_live_at ? `Went live ${timeAgo(c.go_live_at)}` : 'Not live yet'}
                  </p>
                </div>
              </GlassCard>
            </FadeIn>
          ))
        )}
      </section>
    </div>
  );
}
