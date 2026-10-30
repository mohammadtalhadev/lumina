/**
 * Pure domain model: types, stage machine, labels, formatters.
 * No server imports — safe for Client Components.
 */

/* ---------- Row types (mirror 0001_lumina_core.sql) ---------- */

export interface Lead {
  id: string;
  campaign_id: string | null;
  company: string;
  contact_name: string;
  email: string;
  grade: 'A' | 'B' | 'C';
  stage: string;
  pain_signals_json: unknown;
  research_notes: string;
  source: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Reply {
  id: string;
  lead_id: string | null;
  account_id: string | null;
  thread_id: string;
  reply_from_account_id: string | null;
  classification: string;
  body_summary: string;
  received_at: string;
  leads?: { contact_name: string; company: string } | null;
}

export interface Alert {
  id: string;
  type: 'info' | 'positive_reply' | 'warning' | 'critical';
  lead_id: string | null;
  account_id: string | null;
  message: string;
  channel: string;
  is_read: boolean;
  created_at: string;
}

export interface Activity {
  id: string;
  lead_id: string;
  type: string;
  note: string;
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  niche: string;
  is_active: boolean;
}

export interface SendingAccount {
  id: string;
  label: string;
  email: string;
  status: string;
  health_score: number;
  daily_cap: number;
  sent_today: number;
}

/* ---------- Kanban stage model ---------- */

export const KANBAN_STAGES = [
  'New',
  'Researched',
  'Graded',
  'Contacted',
  'Replied',
  'Call Booked',
  'Client',
] as const;

/** Stages that exist in the DB but live in the Outcomes tray, not columns. */
export const OUTCOME_STAGES = [
  'Proposal Sent',
  'Negotiation',
  'Won',
  'Lost',
  'Disqualified',
  'Suppressed',
] as const;

/** Forward-only order for stage advances (terminal outcomes allowed from anywhere). */
export const STAGE_ORDER = [...KANBAN_STAGES, 'Proposal Sent', 'Negotiation', 'Won'] as const;
export const TERMINAL_STAGES = ['Lost', 'Disqualified', 'Suppressed'] as const;

export function canAdvanceStage(from: string, to: string): boolean {
  if (from === to) return false;
  if ((TERMINAL_STAGES as readonly string[]).includes(to)) return true;
  const order = STAGE_ORDER as readonly string[];
  return order.indexOf(to) === order.indexOf(from) + 1;
}

export function nextStage(from: string): string | null {
  const order = STAGE_ORDER as readonly string[];
  const i = order.indexOf(from);
  return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
}

export const CLASSIFICATION_LABELS: Record<string, string> = {
  unclassified: 'Needs review',
  positive: 'Positive',
  busy: 'Busy',
  price: 'Price',
  not_interested: 'Not interested',
  referral: 'Referral',
  out_of_office: 'Out of office',
  bounce: 'Bounce',
  unsubscribe: 'Unsubscribe',
};

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
