'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { BadgeCheck, Plus, Upload, Users, X } from 'lucide-react';
import { KANBAN_STAGES, OUTCOME_STAGES, canAdvanceStage, type Campaign, type Lead } from '@/lib/model';
import { leadFormSchema } from '@/lib/validate';
import CsvImportModal from '@/components/CsvImportModal';
import { EmptyState, Field, GhostButton, Pill, PrimaryButton, gradeTone, inputCls } from '@/components/ui';
import { cn } from '@/lib/cn';

function daysInStage(updatedAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86400000));
}

function LeadCard({
  lead,
  draggable,
  onDragStart,
  onDragEnd,
}: {
  lead: Lead;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
}) {
  return (
    <Link
      href={`/leads/${lead.id}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="block cursor-grab rounded-2xl border border-white/70 bg-white/70 p-4 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-card active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-sm font-semibold leading-snug">{lead.company || 'Untitled company'}</p>
        <Pill tone={gradeTone(lead.grade)}>Grade {lead.grade}</Pill>
      </div>
      <p className="mt-1 flex items-center gap-1 text-xs text-slate2">
        {lead.contact_name}
        {lead.email_verified && (
          <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" aria-label="Email verified" />
        )}
      </p>
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate2/80">
        <span>{daysInStage(lead.updated_at)}d in stage</span>
        <span title={lead.email} className="max-w-[140px] truncate">
          {lead.email}
        </span>
      </div>
    </Link>
  );
}

const FORM_DEFAULTS = {
  company: '',
  contact_name: '',
  email: '',
  campaign_id: '',
  source: 'manual',
  research_notes: '',
};

export default function KanbanBoard({
  leads,
  campaigns,
}: {
  leads: Lead[];
  campaigns: Campaign[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [gradeFilter, setGradeFilter] = useState<'All' | 'A' | 'B' | 'C'>('All');
  const [nicheFilter, setNicheFilter] = useState<string>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(FORM_DEFAULTS);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [duplicateLeadId, setDuplicateLeadId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Drag-and-drop state (native HTML5 DnD — no extra library).
  // Touch devices don't do HTML5 DnD: the lead detail page's advance-stage
  // button remains the fallback there.
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropStage, setDropStage] = useState<string | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  // ?action=add (sidebar button) opens the modal on load.
  useEffect(() => {
    if (searchParams.get('action') === 'add') setModalOpen(true);
  }, [searchParams]);

  // Lock body scroll while the modal is open (works with Lenis).
  useEffect(() => {
    document.documentElement.classList.toggle('lenis-stopped', modalOpen);
    return () => document.documentElement.classList.remove('lenis-stopped');
  }, [modalOpen]);

  const niches = useMemo(
    () => Array.from(new Set(campaigns.map((c) => c.niche))).sort(),
    [campaigns]
  );
  const campaignNiche = useMemo(() => new Map(campaigns.map((c) => [c.id, c.niche])), [campaigns]);

  const filtered = useMemo(
    () =>
      leads.filter(
        (l) =>
          (gradeFilter === 'All' || l.grade === gradeFilter) &&
          (nicheFilter === 'All' || (l.campaign_id && campaignNiche.get(l.campaign_id) === nicheFilter))
      ),
    [leads, gradeFilter, nicheFilter, campaignNiche]
  );

  const byStage = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const s of [...KANBAN_STAGES, ...OUTCOME_STAGES]) map.set(s, []);
    for (const l of filtered) {
      const bucket = map.get(l.stage) ?? map.get('New')!;
      bucket.push(l);
    }
    return map;
  }, [filtered]);

  const outcomeLeads = OUTCOME_STAGES.flatMap((s) => byStage.get(s) ?? []);

  function set<K extends keyof typeof FORM_DEFAULTS>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((e) => ({ ...e, [key]: '' }));
    setSubmitError(null);
    setDuplicateLeadId(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = leadFormSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = String(issue.path[0] ?? '');
        if (k && !errs[k]) errs[k] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setSubmitError(json.error ?? 'This email is already a lead.');
        setDuplicateLeadId(json.leadId ?? null);
        return;
      }
      if (!res.ok) {
        setSubmitError(json.error ?? 'Could not save the lead. Try again.');
        return;
      }
      setModalOpen(false);
      setForm(FORM_DEFAULTS);
      router.refresh();
    } catch {
      setSubmitError('Network error. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  const dragLead = dragId ? leads.find((l) => l.id === dragId) ?? null : null;

  async function dropOnStage(stage: string) {
    if (!dragId || moving) return;
    const lead = leads.find((l) => l.id === dragId);
    setDragId(null);
    setDropStage(null);
    if (!lead || lead.stage === stage) return;
    // Client-side pre-check for instant feedback; the server re-enforces it.
    if (!canAdvanceStage(lead.stage, stage)) {
      setDropError(
        `Stages only move forward — can't move "${lead.company || 'this lead'}" from ${lead.stage} to ${stage}.`
      );
      return;
    }
    setMoving(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDropError(json.error ?? 'Could not move the lead. Try again.');
        return;
      }
      router.refresh();
    } catch {
      setDropError('Network error. Check your connection and try again.');
    } finally {
      setMoving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header + filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Leads Kanban</h1>
          <p className="mt-1 text-sm text-slate2">
            {filtered.length} of {leads.length} leads · stages move forward only
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GhostButton onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" aria-hidden />
            Import CSV
          </GhostButton>
          <PrimaryButton onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Add lead
          </PrimaryButton>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
        {(['All', 'A', 'B', 'C'] as const).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGradeFilter(g)}
            aria-pressed={gradeFilter === g}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              gradeFilter === g
                ? 'bg-primary text-white shadow-card'
                : 'border border-white/80 bg-white/60 text-ink/70 backdrop-blur-xl hover:bg-white/90'
            )}
          >
            {g === 'All' ? 'Grade: All' : `Grade ${g}`}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-ink/10" aria-hidden />
        {['All', ...niches].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setNicheFilter(n)}
            aria-pressed={nicheFilter === n}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              nicheFilter === n
                ? 'bg-primary text-white shadow-card'
                : 'border border-white/80 bg-white/60 text-ink/70 backdrop-blur-xl hover:bg-white/90'
            )}
          >
            {n === 'All' ? 'Niche: All' : n}
          </button>
        ))}
      </div>

      {/* Board: horizontal scroll, cards never sliced mid-card */}
      {leads.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" aria-hidden />}
          title="No leads yet"
          detail="Add your first lead to start the pipeline. Research done today feeds tomorrow's sends."
          action={
            <PrimaryButton onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Add lead
            </PrimaryButton>
          }
        />
      ) : (
        <div
          className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory"
          role="list"
          aria-label="Lead stages"
        >
          {KANBAN_STAGES.map((stage, i) => {
            const cards = byStage.get(stage) ?? [];
            // Highlight only legal drop targets while dragging (forward-only machine).
            const canDropHere = dragLead ? canAdvanceStage(dragLead.stage, stage) : false;
            const isOver = dropStage === stage && dragId !== null;
            return (
              <motion.section
                key={stage}
                role="listitem"
                aria-label={`${stage}: ${cards.length} leads`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.3), ease: 'easeOut' }}
                onDragOver={(e) => {
                  if (dragId) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = canDropHere ? 'move' : 'none';
                    setDropStage(stage);
                  }
                }}
                onDragLeave={() => setDropStage((s) => (s === stage ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  dropOnStage(stage);
                }}
                className={cn(
                  'w-[300px] shrink-0 snap-start rounded-3xl border p-3 backdrop-blur-xl transition-colors',
                  isOver && canDropHere
                    ? 'border-primary/60 bg-primary/10'
                    : isOver
                      ? 'border-red-300/70 bg-red-50/60'
                      : 'border-white/70 bg-white/40'
                )}
              >
                <header className="flex items-center justify-between px-2 pb-3 pt-1">
                  <h2 className="font-display text-sm font-semibold">{stage}</h2>
                  <Pill tone="violet">{cards.length}</Pill>
                </header>
                <div className="max-h-[60vh] space-y-2.5 overflow-y-auto pr-0.5">
                  {cards.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-ink/15 px-3 py-6 text-center text-xs text-slate2">
                      {isOver ? 'Drop here' : 'No leads here yet'}
                    </p>
                  ) : (
                    cards.map((l) => (
                      <LeadCard
                        key={l.id}
                        lead={l}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', l.id);
                          e.dataTransfer.effectAllowed = 'move';
                          setDragId(l.id);
                          setDropError(null);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setDropStage(null);
                        }}
                      />
                    ))
                  )}
                </div>
              </motion.section>
            );
          })}
        </div>
      )}

      {/* Outcomes tray */}
      {outcomeLeads.length > 0 && (
        <details className="glass rounded-3xl p-5">
          <summary className="cursor-pointer font-display text-sm font-semibold">
            Outcomes tray — {outcomeLeads.length} lead{outcomeLeads.length === 1 ? '' : 's'} (Won, Lost, Disqualified, Suppressed…)
          </summary>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {outcomeLeads.map((l) => (
              <LeadCard key={l.id} lead={l} />
            ))}
          </div>
        </details>
      )}

      {/* Add Lead modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-ink/30 p-4 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Add lead"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="glass-strong w-full max-w-lg rounded-3xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold">Add lead</h2>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  aria-label="Close"
                  className="grid h-9 w-9 place-items-center rounded-full text-slate2 hover:bg-ink/5"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Company" required error={fieldErrors.company}>
                    <input
                      className={inputCls}
                      value={form.company}
                      onChange={(e) => set('company', e.target.value)}
                      placeholder="Acme Dental"
                      autoComplete="organization"
                    />
                  </Field>
                  <Field label="Contact name" required error={fieldErrors.contact_name}>
                    <input
                      className={inputCls}
                      value={form.contact_name}
                      onChange={(e) => set('contact_name', e.target.value)}
                      placeholder="Dr. Sarah Ahmed"
                      autoComplete="name"
                    />
                  </Field>
                </div>
                <Field label="Work email" required error={fieldErrors.email}>
                  <input
                    className={inputCls}
                    type="email"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    placeholder="sarah@acmedental.com"
                    autoComplete="email"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Campaign" error={fieldErrors.campaign_id}>
                    <select
                      className={inputCls}
                      value={form.campaign_id}
                      onChange={(e) => set('campaign_id', e.target.value)}
                    >
                      <option value="">No campaign yet</option>
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.niche})
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Source" error={fieldErrors.source}>
                    <input
                      className={inputCls}
                      value={form.source}
                      onChange={(e) => set('source', e.target.value)}
                      placeholder="manual"
                    />
                  </Field>
                </div>
                <Field label="Research notes" error={fieldErrors.research_notes}>
                  <textarea
                    className={cn(inputCls, 'min-h-[80px] resize-y')}
                    value={form.research_notes}
                    onChange={(e) => set('research_notes', e.target.value)}
                    placeholder="Anything known about this lead…"
                  />
                </Field>

                {submitError && (
                  <p role="alert" className="rounded-2xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
                    {submitError}{' '}
                    {duplicateLeadId && (
                      <Link href={`/leads/${duplicateLeadId}`} className="underline">
                        View the existing lead
                      </Link>
                    )}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <GhostButton onClick={() => setModalOpen(false)}>Cancel</GhostButton>
                  <PrimaryButton type="submit" disabled={saving}>
                    {saving ? 'Saving…' : 'Save lead'}
                  </PrimaryButton>
                </div>
                <p className="text-xs text-slate2">
                  Duplicate emails are blocked globally. New leads start in <strong>New</strong> with grade C.
                </p>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CSV import modal */}
      <CsvImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={() => router.refresh()}
      />

      {/* Honest toast for rejected drops (e.g. backward stage moves) */}
      <AnimatePresence>
        {dropError && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
            role="alert"
          >
            <div className="flex max-w-md items-center gap-3 rounded-2xl border border-red-200 bg-white/95 px-4 py-3 shadow-card backdrop-blur-xl">
              <p className="text-sm font-medium text-red-700">{dropError}</p>
              <button
                type="button"
                onClick={() => setDropError(null)}
                aria-label="Dismiss"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate2 hover:bg-ink/5"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

