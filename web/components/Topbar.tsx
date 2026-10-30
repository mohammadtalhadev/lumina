import { Bell, CircleHelp, Search } from 'lucide-react';
import { safeQuery } from '@/lib/db';
import type { Campaign } from '@/lib/model';
import KillSwitch from '@/components/KillSwitch';
import CampaignSwitcher from '@/components/CampaignSwitcher';

/**
 * Global top bar: campaign switcher, kill-switch, search, notifications,
 * help, operator avatar. The switcher and kill-switch render only when the
 * database answers — no fake controls on a dead connection.
 */
export default async function Topbar() {
  const campaignsRes = await safeQuery<Campaign[]>((db) =>
    db.from('campaigns').select('id, name, niche, is_active').order('created_at')
  );
  const campaigns = campaignsRes.data ?? [];
  const anyActive = campaigns.some((c) => c.is_active);

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 px-6 py-4">
      <div className="glass flex flex-1 items-center gap-2 rounded-full px-4 py-2.5">
        <Search className="h-4 w-4 text-slate2" aria-hidden />
        <input
          type="search"
          placeholder="Search leads, campaigns, or threads…"
          aria-label="Global search"
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate2/70"
        />
        <kbd className="hidden rounded-md bg-ink/5 px-1.5 py-0.5 text-[11px] text-slate2 sm:block">
          /
        </kbd>
      </div>

      {campaignsRes.error === null && (
        <>
          <CampaignSwitcher campaigns={campaigns} />
          <KillSwitch anyActive={anyActive} />
        </>
      )}

      <button
        type="button"
        aria-label="Notifications"
        className="glass grid h-10 w-10 place-items-center rounded-full text-ink/70 transition-colors hover:text-ink"
      >
        <Bell className="h-[18px] w-[18px]" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Help"
        className="glass grid h-10 w-10 place-items-center rounded-full text-ink/70 transition-colors hover:text-ink"
      >
        <CircleHelp className="h-[18px] w-[18px]" aria-hidden />
      </button>
      <span
        className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-primary to-accent-pink text-sm font-bold text-white"
        aria-label="Operator account"
        role="img"
      >
        MT
      </span>
    </header>
  );
}
