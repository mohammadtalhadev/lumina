import { safeQuery } from '@/lib/db';
import { EmptyState, FadeIn, LoadError } from '@/components/ui';
import SequenceBuilder from '@/components/SequenceBuilder';
import type { Campaign, SequenceRow } from '@/lib/model';
import { Workflow } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sequences — Lumina' };

interface SendCountRow {
  id: string;
  leads: { campaign_id: string | null } | null;
}

export default async function SequencesPage() {
  const [campaignsRes, sequencesRes, sendsRes] = await Promise.all([
    safeQuery<Campaign[]>((db) => db.from('campaigns').select('id, name, niche, is_active').order('created_at')),
    safeQuery<SequenceRow[]>((db) => db.from('sequences').select('*').order('step_day')),
    safeQuery<SendCountRow[]>((db) => db.from('sequence_emails').select('id, leads!inner(campaign_id)')),
  ]);

  const firstError = campaignsRes.error ?? sequencesRes.error ?? sendsRes.error;
  if (firstError) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-3xl font-bold">Sequences</h1>
        <LoadError message={firstError} retryHref="/sequences" />
      </div>
    );
  }

  const campaigns = campaignsRes.data ?? [];
  const sequences = sequencesRes.data ?? [];
  const sendsByCampaign: Record<string, number> = {};
  for (const r of sendsRes.data ?? []) {
    const cid = r.leads?.campaign_id;
    if (cid) sendsByCampaign[cid] = (sendsByCampaign[cid] ?? 0) + 1;
  }

  return (
    <div className="space-y-5">
      <FadeIn>
        <div>
          <h1 className="font-display text-3xl font-bold">Sequences</h1>
          <p className="mt-1 text-sm text-slate2">
            Per-campaign outreach plan. Stop-on-reply applies across all accounts.
          </p>
        </div>
      </FadeIn>

      {campaigns.length === 0 ? (
        <EmptyState
          icon={<Workflow className="h-6 w-6" aria-hidden />}
          title="No campaigns yet"
          detail="Create a campaign first — each campaign gets its own Day 0 / 3 / 7 / 12 email sequence."
        />
      ) : (
        <SequenceBuilder campaigns={campaigns} sequences={sequences} sendsByCampaign={sendsByCampaign} />
      )}
    </div>
  );
}
