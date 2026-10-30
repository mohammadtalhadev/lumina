import { safeQuery } from '@/lib/db';
import { EmptyState, FadeIn, LoadError } from '@/components/ui';
import CampaignList, { type CampaignStats } from '@/components/CampaignList';
import type { BrandConfig, Campaign, CampaignTemplate } from '@/lib/model';
import { Megaphone } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Campaigns — Lumina' };

interface QueueCountRow {
  campaign_id: string | null;
  status: string;
}
interface LeadCountRow {
  campaign_id: string | null;
}
interface ReplyCountRow {
  leads: { campaign_id: string | null } | null;
}

export default async function CampaignsPage() {
  const [campaignsRes, templatesRes, leadsRes, queueRes, repliesRes, brandRes] = await Promise.all([
    safeQuery<Campaign[]>((db) => db.from('campaigns').select('id, name, niche, is_active').order('created_at')),
    safeQuery<CampaignTemplate[]>((db) => db.from('campaign_templates').select('id, name, niche, campaign_json').order('niche')),
    safeQuery<LeadCountRow[]>((db) => db.from('leads').select('campaign_id')),
    safeQuery<QueueCountRow[]>((db) => db.from('send_queue').select('campaign_id, status')),
    safeQuery<ReplyCountRow[]>((db) => db.from('replies').select('leads!inner(campaign_id)')),
    safeQuery<BrandConfig[]>((db) => db.from('brand_config').select('*').limit(1)),
  ]);

  const firstError =
    campaignsRes.error ?? templatesRes.error ?? leadsRes.error ?? queueRes.error ?? repliesRes.error;
  if (firstError) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-3xl font-bold">Campaigns</h1>
        <LoadError message={firstError} retryHref="/campaigns" />
      </div>
    );
  }

  const campaigns = campaignsRes.data ?? [];
  const stats: Record<string, CampaignStats> = {};
  const bump = (cid: string | null, key: keyof CampaignStats) => {
    if (!cid) return;
    stats[cid] = stats[cid] ?? { leads: 0, queued: 0, sent: 0, replies: 0 };
    stats[cid][key] += 1;
  };
  for (const l of leadsRes.data ?? []) bump(l.campaign_id, 'leads');
  for (const q of queueRes.data ?? []) {
    if (q.status === 'sent') bump(q.campaign_id, 'sent');
    else if (['queued', 'sending', 'blocked', 'failed'].includes(q.status)) bump(q.campaign_id, 'queued');
  }
  for (const r of repliesRes.data ?? []) bump(r.leads?.campaign_id ?? null, 'replies');

  const brand = (brandRes.data ?? [])[0] ?? null;

  return (
    <div className="space-y-5">
      <FadeIn>
        <div>
          <h1 className="font-display text-3xl font-bold">Campaigns</h1>
          <p className="mt-1 text-sm text-slate2">
            Niche-flexible containers — everything about the niche lives here as data.
          </p>
        </div>
      </FadeIn>

      {campaigns.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-6 w-6" aria-hidden />}
          title="No campaigns yet"
          detail="Start from a niche preset (dental, law, shopify, hvac, blank) or clone an existing campaign."
        />
      ) : (
        <CampaignList
          campaigns={campaigns}
          templates={templatesRes.data ?? []}
          stats={stats}
          brand={brand}
        />
      )}
    </div>
  );
}
