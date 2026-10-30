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

/* ---------- Phase 1C row types (mirror 0001_lumina_core.sql) ---------- */

export interface SequenceRow {
  id: string;
  campaign_id: string;
  step_day: number;
  /** Convention: "Subject: <subject>\n\n<body>" when a subject exists, else raw body. */
  template: string;
  created_at: string;
}

export interface AccountFull {
  id: string;
  label: string;
  email: string;
  provider: string;
  status: string;
  warmup_day: number;
  placement_score: number;
  daily_cap: number;
  sent_today: number;
  health_score: number;
  paused_reason: string;
  /* NOTE: token_ref is deliberately never selected — it names a server-side
     secret location and must not reach the browser. */
}

export interface QueueRow {
  id: string;
  lead_id: string;
  account_id: string | null;
  campaign_id: string | null;
  sequence_step: number;
  subject: string;
  body: string;
  scheduled_at: string;
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'blocked' | 'cancelled';
  attempts: number;
  next_attempt_at: string | null;
  error: string;
  spam_check_result: SpamResultJson | null;
  leads?: { contact_name: string; company: string } | null;
  sending_accounts?: { email: string; label: string } | null;
}

export interface SpamCheckRow {
  id: string;
  queue_id: string;
  result: 'pass' | 'warn' | 'block';
  blocked_reason: string;
}

/** Raw jsonb fallback when no spam_checks row exists yet. */
export interface SpamResultJson {
  result?: string;
  reason?: string;
  blocked_reason?: string;
}

export interface CampaignTemplate {
  id: string;
  name: string;
  niche: string;
  campaign_json: { sequence_gaps?: number[]; [k: string]: unknown };
}

export interface CampaignFull extends Campaign {
  icp_json: unknown;
  offer_json: unknown;
  sequence_gaps_json: unknown;
  created_at: string;
}

export interface BrandConfig {
  id: number;
  agency_name: string;
  founder_name: string;
  postal_address: string;
  cal_link: string;
}

/* ---------- Sequence template subject/body convention ---------- */

/**
 * `sequences.template` is a single text column. The builder stores
 * "Subject: <subject>\n\n<body>" when a subject exists, otherwise the raw body.
 * These helpers keep the convention in exactly one place.
 */
export function splitTemplate(template: string): { subject: string; body: string } {
  const m = template.match(/^Subject:[ \t]*(.*)\r?\n\r?\n([\s\S]*)$/);
  if (m) return { subject: m[1].trim(), body: m[2] };
  return { subject: '', body: template };
}

export function joinTemplate(subject: string, body: string): string {
  const s = subject.trim();
  return s ? `Subject: ${s}\n\n${body}` : body;
}

/* ---------- Display helpers ---------- */

const ACCOUNT_TONE: Record<string, 'green' | 'amber' | 'red' | 'grey'> = {
  ready: 'green',
  warming: 'amber',
  cooling: 'amber',
  paused: 'red',
  disconnected: 'grey',
  banned_risk: 'red',
};

export function accountTone(status: string): 'green' | 'amber' | 'red' | 'grey' {
  return ACCOUNT_TONE[status] ?? 'grey';
}

export const ACCOUNT_LABELS: Record<string, string> = {
  ready: 'Ready',
  warming: 'Warming',
  cooling: 'Cooling',
  paused: 'Paused',
  disconnected: 'Disconnected',
  banned_risk: 'Ban risk',
};

const QUEUE_TONE: Record<string, 'green' | 'amber' | 'red' | 'violet' | 'cyan' | 'grey'> = {
  queued: 'violet',
  sending: 'cyan',
  sent: 'green',
  failed: 'red',
  blocked: 'red',
  cancelled: 'grey',
};

export function queueTone(status: string) {
  return QUEUE_TONE[status] ?? 'grey';
}

/** Rotation weight is derived from the health score (the worker picks the
 *  highest-health eligible account). Displayed, never stored. */
export function rotationWeight(healthScore: number): string {
  return `${Math.max(0, Math.min(100, healthScore) / 100).toFixed(1)}x`;
}

/* ---------- Phase 1D row types (mirror 0001_lumina_core.sql) ---------- */

export interface HealthDaily {
  account_id: string;
  day: string;
  sent: number;
  bounces: number;
  replies: number;
  spam_complaints: number;
  health_score: number;
}

export interface WarmupInbox {
  id: string;
  account_id: string;
  placement_score: number;
  checked_at: string;
  sending_accounts?: { email: string; label: string } | null;
}

export interface ProposalRow {
  id: string;
  lead_id: string;
  amount: string; // numeric arrives as string from supabase-js
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  sent_at: string | null;
  created_at: string;
  leads?: { contact_name: string; company: string } | null;
}

export interface ClientRow {
  id: string;
  lead_id: string;
  advance_paid: boolean;
  advance_verified_at: string | null;
  advance_amount: string;
  remaining_amount: string;
  payment_method: string;
  invoice_ref: string;
  go_live_at: string | null;
  leads?: { contact_name: string; company: string } | null;
}

export interface CallRow {
  id: string;
  lead_id: string;
  cal_booking_ref: string;
  /** Convention: { scheduled_at?: string, notes?: string }. Parsed defensively. */
  notes_json: unknown;
  outcome: 'scheduled' | 'done' | 'no_show' | 'cancelled';
  created_at: string;
  leads?: { contact_name: string; company: string } | null;
}

export interface BrandConfigFull extends BrandConfig {
  linkedin_headline: string;
  alert_email: string;
  send_window_tz: string;
}

/** Forward-only proposal transitions, server-enforced. */
const PROPOSAL_NEXT: Record<ProposalRow['status'], ProposalRow['status'][]> = {
  draft: ['sent'],
  sent: ['accepted', 'rejected'],
  accepted: [],
  rejected: [],
};

export function canAdvanceProposal(from: ProposalRow['status'], to: ProposalRow['status']): boolean {
  return PROPOSAL_NEXT[from]?.includes(to) ?? false;
}

export function proposalTone(status: ProposalRow['status']): 'green' | 'amber' | 'red' | 'cyan' | 'grey' {
  switch (status) {
    case 'accepted': return 'green';
    case 'sent': return 'cyan';
    case 'rejected': return 'red';
    default: return 'grey';
  }
}

export function callOutcomeTone(outcome: CallRow['outcome']): 'green' | 'amber' | 'violet' | 'grey' {
  switch (outcome) {
    case 'done': return 'green';
    case 'no_show': return 'amber';
    case 'scheduled': return 'violet';
    default: return 'grey';
  }
}

/** Defensive read of the scheduled time stored in calls.notes_json. */
export function callScheduledAt(notes: unknown): string | null {
  if (notes && typeof notes === 'object' && !Array.isArray(notes)) {
    const v = (notes as Record<string, unknown>).scheduled_at;
    return typeof v === 'string' && v ? v : null;
  }
  return null;
}

export function callNotes(notes: unknown): string {
  if (notes && typeof notes === 'object' && !Array.isArray(notes)) {
    const v = (notes as Record<string, unknown>).notes;
    return typeof v === 'string' ? v : '';
  }
  return '';
}

/** Pre-campaign gate: sending stays blocked until these are real values. */
export function brandGateStatus(brand: BrandConfigFull | null): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!brand) return { ok: false, missing: ['brand settings'] };
  const real = (v: string) => v.trim() !== '' && v.trim().toUpperCase() !== 'TBD';
  if (!real(brand.agency_name)) missing.push('Agency name');
  if (!real(brand.postal_address)) missing.push('Postal address');
  if (!real(brand.cal_link)) missing.push('Booking link');
  return { ok: missing.length === 0, missing };
}
