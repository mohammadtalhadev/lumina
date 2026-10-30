'use client';

import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Inbox } from 'lucide-react';

/**
 * Home Today — Phase 1A placeholder.
 * Honest empty states only: no fake KPIs, no demo badges, no live tickers.
 * Real screens (Kanban, Replies, Queue…) arrive in Phase 1B.
 */
const TASKS: { title: string; detail: string }[] = [];

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Home Today</h1>
        <p className="mt-1 text-sm text-slate2">
          Your 30-second briefing. Tasks appear here once leads and campaigns exist.
        </p>
      </div>

      <section aria-label="Today's tasks" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {TASKS.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="glass rounded-3xl p-8 md:col-span-2 xl:col-span-3"
          >
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary-dark">
                <Inbox className="h-6 w-6" aria-hidden />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold">All clear. No tasks waiting.</h2>
                <p className="mt-1 max-w-xl text-sm text-slate2">
                  Add your first lead to start the launch checklist. The first 100
                  outreach emails always need your approval — nothing sends itself.
                </p>
                <a
                  href="/leads?action=add"
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  Add your first lead
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
              </div>
            </div>
          </motion.div>
        ) : (
          TASKS.map((t) => (
            <article key={t.title} className="glass rounded-3xl p-6">
              <h2 className="font-display text-base font-semibold">{t.title}</h2>
              <p className="mt-1 text-sm text-slate2">{t.detail}</p>
            </article>
          ))
        )}
      </section>

      <section aria-label="System status" className="glass rounded-3xl p-6">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
          <h2 className="font-display text-base font-semibold">Foundation ready</h2>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-slate2">
          Phase 1A shell is live: navigation, design tokens, smooth scrolling, and
          Supabase wiring. Screens connect to real data in Phase 1B — until then,
          every metric stays blank rather than showing invented numbers.
        </p>
      </section>
    </div>
  );
}
