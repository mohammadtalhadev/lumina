import { safeQuery } from '@/lib/db';
import { EmptyState, FadeIn, GlassCard, LoadError, Pill } from '@/components/ui';
import SettingsForm from '@/components/SettingsForm';
import AlertPrefs from '@/components/AlertPrefs';
import DangerZone from '@/components/DangerZone';
import { brandGateStatus } from '@/lib/model';
import type { BrandConfigFull, Campaign } from '@/lib/model';
import { CheckCircle2, Settings2, XCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings & Brand — Lumina' };

export default async function SettingsPage() {
  const [brandRes, campaignsRes] = await Promise.all([
    safeQuery<BrandConfigFull[]>((db) =>
      db.from('brand_config').select('id, agency_name, founder_name, postal_address, cal_link, linkedin_headline, alert_email, send_window_tz').eq('id', 1).limit(1)
    ),
    safeQuery<Campaign[]>((db) => db.from('campaigns').select('id, name, niche, is_active')),
  ]);

  if (brandRes.error) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-3xl font-bold">Settings & Brand</h1>
        <LoadError message={brandRes.error} retryHref="/settings" />
      </div>
    );
  }

  const brand = brandRes.data?.[0] ?? null;
  const gate = brandGateStatus(brand);
  const anyActive = (campaignsRes.data ?? []).some((c) => c.is_active);

  return (
    <div className="space-y-5">
      <FadeIn>
        <div>
          <h1 className="font-display text-3xl font-bold">Settings & Brand</h1>
          <p className="mt-1 text-sm text-slate2">
            One place where everything configurable lives. One change here updates every template.
          </p>
        </div>
      </FadeIn>

      {/* Pre-campaign gate — read-only indicator */}
      <FadeIn delay={0.05}>
        <GlassCard className={gate.ok ? '' : 'border-amber-200/70'}>
          <div className="flex items-center gap-3">
            <span className={`grid h-10 w-10 place-items-center rounded-2xl ${gate.ok ? 'bg-emerald-100/80 text-emerald-700' : 'bg-amber-100/80 text-amber-800'}`}>
              {gate.ok ? <CheckCircle2 className="h-5 w-5" aria-hidden /> : <Settings2 className="h-5 w-5" aria-hidden />}
            </span>
            <div>
              <h2 className="font-display text-xl font-bold">Pre-campaign gate</h2>
              <p className="text-sm text-slate2">
                {gate.ok
                  ? 'Complete — campaigns are allowed to send.'
                  : 'Sending is blocked until every item below is a real value (not TBD).'}
              </p>
            </div>
          </div>
          {!gate.ok && (
            <ul className="mt-4 space-y-2">
              {gate.missing.map((m) => (
                <li key={m} className="flex items-center gap-2 text-sm text-amber-900">
                  <XCircle className="h-4 w-4" aria-hidden />
                  {m} — still TBD
                </li>
              ))}
            </ul>
          )}
          {gate.ok && (
            <p className="mt-3">
              <Pill tone="green">Gate passed</Pill>
            </p>
          )}
        </GlassCard>
      </FadeIn>

      <div className="grid gap-5 lg:grid-cols-2">
        <FadeIn delay={0.08}>
          <GlassCard>
            <h2 className="font-display text-xl font-bold">Brand configuration</h2>
            <p className="mt-1 text-sm text-slate2">
              The agency name stays <strong>TBD</strong> until you set it — it is never invented.
            </p>
            <div className="mt-5">
              <SettingsForm brand={brand} />
            </div>
          </GlassCard>
        </FadeIn>

        <div className="space-y-5">
          <FadeIn delay={0.12}>
            <AlertPrefs alertEmail={brand?.alert_email ?? ''} />
          </FadeIn>
          <FadeIn delay={0.16}>
            <DangerZone anyActive={anyActive} />
          </FadeIn>
        </div>
      </div>

      {!brand && (
        <EmptyState
          icon={<Settings2 className="h-6 w-6" aria-hidden />}
          title="Brand settings not found"
          detail="The brand_config row is missing — run migration 0001, which seeds it."
        />
      )}
    </div>
  );
}
