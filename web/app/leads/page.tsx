import { Suspense } from 'react';
import { safeQuery, type Campaign, type Lead } from '@/lib/db';
import KanbanBoard from '@/components/KanbanBoard';
import { LoadError } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Leads Kanban — Lumina' };

export default async function LeadsPage() {
  const [leadsRes, campaignsRes] = await Promise.all([
    safeQuery<Lead[]>((db) => db.from('leads').select('*').order('updated_at', { ascending: false }).limit(500)),
    safeQuery<Campaign[]>((db) => db.from('campaigns').select('id, name, niche, is_active').order('name')),
  ]);

  if (leadsRes.error || campaignsRes.error) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-3xl font-bold">Leads Kanban</h1>
          <p className="mt-1 text-sm text-slate2">The CRM — one board, one source of truth.</p>
        </div>
        <LoadError
          message={
            leadsRes.error ?? campaignsRes.error ?? 'Could not load leads.'
          }
        />
        <p className="text-xs text-slate2">
          If the migration hasn&apos;t been run yet, run 0001_lumina_core.sql in the Supabase SQL Editor.
        </p>
      </div>
    );
  }

  return (
    <Suspense>
      <KanbanBoard leads={leadsRes.data ?? []} campaigns={campaignsRes.data ?? []} />
    </Suspense>
  );
}
