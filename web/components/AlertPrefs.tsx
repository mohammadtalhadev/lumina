'use client';

import { useEffect, useState } from 'react';
import { BellRing, Mail } from 'lucide-react';
import { GlassCard } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * Alert preferences. There is no server column for these toggles yet, so
 * they persist in this browser (localStorage) and say so honestly.
 * Defaults match the operator's locked choice: dashboard inbox + self-email.
 */
const DASHBOARD_KEY = 'lumina.alerts.dashboard';
const EMAIL_KEY = 'lumina.alerts.selfEmail';

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-7 w-12 shrink-0 rounded-full transition-colors',
        on ? 'bg-primary' : 'bg-ink/15'
      )}
    >
      <span
        className={cn(
          'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all',
          on ? 'left-6' : 'left-1'
        )}
      />
    </button>
  );
}

export default function AlertPrefs({ alertEmail }: { alertEmail: string }) {
  const [dashboard, setDashboard] = useState(true);
  const [selfEmail, setSelfEmail] = useState(true);

  useEffect(() => {
    try {
      const d = localStorage.getItem(DASHBOARD_KEY);
      const e = localStorage.getItem(EMAIL_KEY);
      if (d !== null) setDashboard(d === '1');
      if (e !== null) setSelfEmail(e === '1');
    } catch {
      /* storage unavailable — defaults stand */
    }
  }, []);

  function persist(key: string, v: boolean) {
    try {
      localStorage.setItem(key, v ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  return (
    <GlassCard>
      <h2 className="font-display text-xl font-bold">Alert preferences</h2>
      <p className="mt-1 text-sm text-slate2">
        Critical alerts go to the dashboard inbox and your own email — never Telegram.
      </p>

      <div className="mt-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary-soft text-primary-dark">
              <BellRing className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold">Dashboard inbox</p>
              <p className="text-xs text-slate2">Alerts feed on the Home screen</p>
            </div>
          </div>
          <Toggle
            on={dashboard}
            onChange={(v) => { setDashboard(v); persist(DASHBOARD_KEY, v); }}
            label="Dashboard inbox alerts"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-100/80 text-cyan-800">
              <Mail className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold">Self-email via Graph</p>
              <p className="text-xs text-slate2">
                To: {alertEmail && alertEmail.toUpperCase() !== 'TBD' ? alertEmail : 'not set yet — add it above'}
              </p>
            </div>
          </div>
          <Toggle
            on={selfEmail}
            onChange={(v) => { setSelfEmail(v); persist(EMAIL_KEY, v); }}
            label="Self-email alerts"
          />
        </div>
      </div>

      <p className="mt-4 text-xs text-slate2">
        These two switches are stored in this browser only. Alert delivery itself
        runs in the Python worker.
      </p>
    </GlassCard>
  );
}
