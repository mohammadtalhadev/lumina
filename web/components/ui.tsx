'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, Inbox, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/* ---------- Entrance animation wrapper (respects reduced motion via CSS) ---------- */
export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ---------- Frosted glass card ---------- */
export function GlassCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('glass rounded-3xl p-6', className)}>{children}</div>;
}

/* ---------- Status pill ---------- */
const PILL_STYLES: Record<string, string> = {
  green: 'bg-emerald-100/80 text-emerald-800',
  amber: 'bg-amber-100/80 text-amber-800',
  red: 'bg-red-100/80 text-red-800',
  violet: 'bg-primary-soft text-primary-dark',
  cyan: 'bg-cyan-100/80 text-cyan-800',
  pink: 'bg-pink-100/80 text-pink-800',
  grey: 'bg-ink/5 text-slate2',
};

export function Pill({
  tone = 'grey',
  children,
  className,
}: {
  tone?: keyof typeof PILL_STYLES;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
        PILL_STYLES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function gradeTone(grade: string): 'green' | 'amber' | 'grey' {
  if (grade === 'A') return 'green';
  if (grade === 'B') return 'amber';
  return 'grey';
}

const CLASS_TONE: Record<string, 'green' | 'amber' | 'red' | 'violet' | 'cyan' | 'pink' | 'grey'> = {
  positive: 'green',
  price: 'amber',
  busy: 'cyan',
  not_interested: 'grey',
  referral: 'violet',
  out_of_office: 'cyan',
  bounce: 'red',
  unsubscribe: 'red',
  unclassified: 'amber',
};

export function classificationTone(c: string) {
  return CLASS_TONE[c] ?? 'grey';
}

/* ---------- Stat card ---------- */
export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  delay = 0,
}: {
  label: string;
  value: string | null;
  sub?: string;
  icon: LucideIcon;
  delay?: number;
}) {
  return (
    <FadeIn delay={delay}>
      <div className="glass rounded-3xl p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate2">{label}</p>
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-primary-soft text-primary-dark">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        </div>
        {value === null ? (
          <p className="mt-2 text-sm text-slate2/80">No data yet</p>
        ) : (
          <p className="mt-1 font-display text-3xl font-bold tabular-nums">{value}</p>
        )}
        {sub && <p className="mt-1 text-xs text-slate2">{sub}</p>}
      </div>
    </FadeIn>
  );
}

/* ---------- Honest empty state ---------- */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  detail,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="glass flex flex-col items-center rounded-3xl px-6 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary-dark">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
      {detail && <p className="mt-1 max-w-md text-sm text-slate2">{detail}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------- Load-failure notice (never a crash) ---------- */
export function LoadError({ message, retryHref }: { message: string; retryHref?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-3xl border border-amber-200/70 bg-amber-50/70 p-5">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
      <div>
        <p className="text-sm font-semibold text-amber-900">Couldn&apos;t load this section</p>
        <p className="mt-1 text-sm text-amber-800/90">{message}</p>
        {retryHref && (
          <a href={retryHref} className="mt-2 inline-block text-sm font-semibold text-primary-dark underline">
            Retry
          </a>
        )}
      </div>
    </div>
  );
}

/* ---------- Primary button (vector icon + plain words, never "+" text) ---------- */
export function PrimaryButton({
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent-cyan px-5 py-2.5 text-sm font-semibold text-white shadow-card transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------- Ghost button ---------- */
export function GhostButton({
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full border border-white/80 bg-white/60 px-4 py-2 text-sm font-medium text-ink/80 backdrop-blur-xl transition-colors hover:bg-white/90 disabled:opacity-50',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------- Form field ---------- */
export function Field({
  label,
  error,
  children,
  required,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink/80">
        {label} {required && <span className="text-red-600" aria-hidden>*</span>}
      </span>
      {children}
      {error && (
        <span role="alert" className="mt-1 block text-xs font-medium text-red-700">
          {error}
        </span>
      )}
    </label>
  );
}

export const inputCls =
  'w-full rounded-2xl border border-ink/10 bg-white/80 px-4 py-2.5 text-sm outline-none backdrop-blur-xl transition-colors placeholder:text-slate2/60 focus:border-primary focus:ring-2 focus:ring-primary/20';
