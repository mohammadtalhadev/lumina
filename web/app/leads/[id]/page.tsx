import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BadgeCheck, Building2, Mail, User } from 'lucide-react';
import { safeQuery } from '@/lib/db';
import { timeAgo, CLASSIFICATION_LABELS, type Activity, type Lead, type Reply } from '@/lib/model';
import { uuidSchema } from '@/lib/validate';
import { EmptyState, FadeIn, GlassCard, LoadError, Pill, classificationTone, gradeTone } from '@/components/ui';
import LeadActions from '@/components/LeadActions';
import NoteForm from '@/components/NoteForm';

export const dynamic = 'force-dynamic';

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  let id: string;
  try {
    id = uuidSchema.parse(params.id);
  } catch {
    notFound();
  }

  const [leadRes, activitiesRes, repliesRes] = await Promise.all([
    safeQuery<Lead[]>((db) => db.from('leads').select('*').eq('id', id).limit(1)),
    safeQuery<Activity[]>((db) =>
      db.from('activities').select('*').eq('lead_id', id).order('created_at', { ascending: false }).limit(50)
    ),
    safeQuery<Reply[]>((db) =>
      db.from('replies').select('*').eq('lead_id', id).order('received_at', { ascending: false }).limit(20)
    ),
  ]);

  if (leadRes.error) {
    return (
      <div className="space-y-5">
        <BackLink />
        <LoadError message={leadRes.error} retryHref={`/leads/${id}`} />
      </div>
    );
  }

  const lead = leadRes.data?.[0];
  if (!lead) notFound();

  return (
    <div className="space-y-6">
      <BackLink />

      {/* Profile header */}
      <FadeIn>
        <GlassCard>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent-cyan text-xl font-bold text-white">
                {(lead.company || lead.contact_name || '?').slice(0, 1).toUpperCase()}
              </span>
              <div>
                <h1 className="font-display text-2xl font-bold">{lead.company || 'Untitled company'}</h1>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate2">
                  <User className="h-3.5 w-3.5" aria-hidden />
                  {lead.contact_name}
                  {lead.email_verified && (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                      <span className="text-xs font-medium">verified</span>
                    </span>
                  )}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Pill tone={gradeTone(lead.grade)}>Grade {lead.grade}</Pill>
                  <Pill tone="violet">{lead.stage}</Pill>
                  {!lead.email_verified && <Pill tone="amber">Unverified email — blocked from queue</Pill>}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-5 border-t border-ink/5 pt-4">
            <LeadActions leadId={lead.id} stage={lead.stage} grade={lead.grade} />
          </div>
        </GlassCard>
      </FadeIn>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Contact info */}
        <FadeIn delay={0.05}>
          <GlassCard className="h-full">
            <h2 className="font-display text-lg font-semibold">Contact</h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-slate2" aria-hidden />
                <dt className="sr-only">Email</dt>
                <dd className="truncate font-medium">{lead.email}</dd>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 shrink-0 text-slate2" aria-hidden />
                <dt className="sr-only">Source</dt>
                <dd className="text-slate2">Source: {lead.source || 'manual'}</dd>
              </div>
            </dl>
            {lead.research_notes && (
              <div className="mt-4 rounded-2xl bg-white/60 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate2">Research notes</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm">{lead.research_notes}</p>
              </div>
            )}
            <div className="mt-4 border-t border-ink/5 pt-4">
              <NoteForm leadId={lead.id} />
            </div>
          </GlassCard>
        </FadeIn>

        {/* Timeline */}
        <FadeIn delay={0.1}>
          <GlassCard className="h-full">
            <h2 className="font-display text-lg font-semibold">Timeline</h2>
            {activitiesRes.error ? (
              <p className="mt-3 text-sm text-slate2">Timeline unavailable — {activitiesRes.error}</p>
            ) : !activitiesRes.data || activitiesRes.data.length === 0 ? (
              <p className="mt-3 text-sm text-slate2">No activity yet. Notes and stage changes appear here.</p>
            ) : (
              <ol className="mt-3 space-y-3">
                {activitiesRes.data.map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-sm">{a.note || a.type}</p>
                      <p className="text-xs text-slate2">{timeAgo(a.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </GlassCard>
        </FadeIn>
      </div>

      {/* Related replies */}
      <FadeIn delay={0.15}>
        <GlassCard>
          <h2 className="font-display text-lg font-semibold">Replies</h2>
          {repliesRes.error ? (
            <p className="mt-3 text-sm text-slate2">Replies unavailable — {repliesRes.error}</p>
          ) : !repliesRes.data || repliesRes.data.length === 0 ? (
            <div className="mt-3">
              <EmptyState title="No replies yet" detail="Replies from this lead will appear here once outreach starts." />
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {repliesRes.data.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/replies?thread=${r.id}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/50 px-4 py-3 transition-colors hover:bg-white/80"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm">{r.body_summary || 'No summary'}</span>
                    <Pill tone={classificationTone(r.classification)}>
                      {CLASSIFICATION_LABELS[r.classification] ?? r.classification}
                    </Pill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </FadeIn>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/leads" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate2 hover:text-ink">
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Back to Kanban
    </Link>
  );
}
