'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Bell,
  CalendarClock,
  FileText,
  Flame,
  HeartPulse,
  Home,
  KanbanSquare,
  MailOpen,
  Megaphone,
  Plus,
  Send,
  Settings,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/cn';

const NAV = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/replies', label: 'Replies', icon: MailOpen },
  { href: '/sequences', label: 'Sequences', icon: Send },
  { href: '/accounts', label: 'Accounts', icon: BarChart3 },
  { href: '/queue', label: 'Queue', icon: KanbanSquare },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/health', label: 'Health', icon: HeartPulse },
  { href: '/warmup', label: 'Warmup', icon: Flame },
  { href: '/proposals', label: 'Proposals', icon: FileText },
  { href: '/calls', label: 'Calls', icon: CalendarClock },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

/**
 * App sidebar — locked Stitch decision: NON-pill, full-height frosted glass
 * panel with 16–24px corners. Never pill-shaped.
 */
export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed top-0 left-0 bottom-0 z-40 w-72 my-3 ml-3 flex flex-col p-4 bg-white/60 backdrop-blur-xl border border-white/80 rounded-[20px] shadow-glass select-none">
      {/* Brand */}
      <div className="flex items-center gap-3 px-3 py-2 mb-4">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-primary via-accent-cyan to-accent-pink text-white shadow-card">
          <Bell className="h-5 w-5" aria-hidden />
        </span>
        <span>
          <span className="block font-display text-xl font-bold leading-none">Lumina</span>
          <span className="block text-xs text-slate2 mt-1">Your Agency</span>
        </span>
      </div>

      {/* Primary action: vector plus icon + plain-word label (no "+" character) */}
      <Link
        href="/leads?action=add"
        className="mb-5 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent-cyan px-5 py-3 text-sm font-semibold text-white shadow-card transition-transform hover:scale-[1.02] active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Add lead
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto space-y-1 pr-1 -mr-1" aria-label="Primary">
        {NAV.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary-dark'
                  : 'text-ink/70 hover:bg-white/70 hover:text-ink'
              )}
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden />
              {item.label}
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />}
            </Link>
          );
        })}
      </nav>

      {/* User card */}
      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/70 border border-white/80 px-3 py-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary-dark">
          MT
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">Mohammad Talha</span>
          <span className="block truncate text-xs text-slate2">Operator</span>
        </span>
      </div>
    </aside>
  );
}
