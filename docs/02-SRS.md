# Lumina — Software Requirements Specification (SRS)

**Document ID:** 02-SRS
**Version:** 1.0
**Date:** 2026-10-30
**Status:** Draft for build (Phase 0 gate pending)
**Authority:** `LUMINA_V2_FIXED_SYSTEM.md` (master blueprint), `LUMINA_MULTI_ACCOUNT_ROTATION.md`, `LUMINA_FREE_APPS.md`, `LUMINA_FLAWS_AND_OPEN_DECISIONS.md`, hybrid architecture (`docs/HYBRID_GUIDE.md`, worker scaffold)

> Note: Lumina is the **internal system name** (dashboard + sending + warmup). The agency brand is **TBD** and lives only in the `brand_config` table — it is never hard-coded. No brand name is invented in this document.

---

## 1. Introduction

### 1.1 Purpose

This document specifies the software requirements for **Lumina**, the internal client-acquisition system of a solo agency operated alongside a full-time job. It defines what the system shall do, the rules it shall enforce, and the tests each requirement shall pass, so that development can proceed without re-litigating design decisions.

### 1.2 Scope

**In scope (Phase 1):**

- A single-operator dashboard (Next.js + Vercel Hobby) covering: Home command center, Leads Kanban, Lead Detail, Accounts & Rotation, Send Queue, Replies Inbox, Sequences, Campaigns, Deliverability Health, Warmup Monitor, Proposals & Clients, Calls, Settings & Brand.
- A Python FastAPI worker service (stateless; all state in Supabase) with three workers: **send** (queue → spam check → rotation → Graph send → audit), **poll** (inbox poll → reply match → classify → stage → stop-on-reply), **health** (daily rollup → auto-pause/cooling → cap suggestion).
- Multi-account cold-email sending via **Microsoft Graph (Outlook)** with per-account rotation, per-account ramp caps, spam checking (3 layers), global suppression, reply detection by polling Graph every 15 minutes (staggered per account).
- Campaign-based niche flexibility: niche is data only (ICP, checklist, pains, grading, templates, offer, pricing, discovery questions, proposal/onboarding templates) — no niche is hard-coded.

**Out of scope (Phase 1):**

- Thread-first reply matching (scaffold uses sender-email match; thread-first is Phase 2).
- AI reply classification via Gemini/Groq (Phase 2; scaffold ships a deterministic classifier).
- Multiple simultaneous active campaigns (supported by data model; Launch mode restricts to one).
- Tracking pixel / open-rate analytics (removed; emails are plain text; open rate is not a KPI).
- Automated sending beyond caps; mass import without verification.

### 1.3 Definitions

| Term | Meaning |
|---|---|
| Launch mode | Default operating mode: 5 new leads/day, one active campaign, ~30–45 min/day operator time |
| Scale mode | Future mode: multiple accounts ready, higher volume, multiple campaigns possible |
| Warmup | 14-day period where a new account sends only warmup-network mail, never campaign mail |
| Gate | A measurable condition that must hold before an action is allowed (e.g. 85%+ placement before campaign sending) |
| Ready | Account status meaning warmup + placement gate passed, eligible for rotation |
| Idempotency key | Unique key per (lead, sequence step) send; re-running a worker never sends twice |
| Spam check | Pre-send checklist with BLOCK (stop, show reason) and WARN (operator decides) rules |
| Stop-on-reply | Rule: any detected reply halts all remaining sequence steps for that lead, on all accounts |
| Suppression | Global record (email and/or company) that blocks all future sending to that target |
| Health score | 0–100 per-account score derived from bounce rate, placement, complaints, replies |
| Circuit breaker | Automatic per-account pause on failure; the rest of the system keeps running |

### 1.4 System overview

The operator works in one dashboard. Supabase is the single source of truth (Postgres + Auth + RLS + Vault). Python workers do the background work on a schedule: send (every 10–15 min), poll (every 15 min per account, staggered), health (daily). Email goes out only through Microsoft Graph from Outlook accounts connected via Microsoft OAuth. AI (Gemini/Groq free tiers) drafts copy and assists classification, but **no email sends without human approval** during the first 100 emails, and every approved email still passes the spam check before it enters the queue.

### 1.5 Data model (high level)

Migration `0001` defines **19 tables** with RLS enabled. By area:

- **Configuration:** `brand_config`, `campaigns`, `campaign_templates`
- **Leads:** `leads`
- **Sending:** `sending_accounts`, `send_queue`, `spam_checks`, `suppressions`, `warmup_inboxes`
- **Pipeline:** `sequences`, `sequence_emails`, `replies`, `calls`, `proposals`, `clients`, `payments`, `activities`
- **Health:** `account_health_daily`
- **Operator:** `notifications` (dashboard alert inbox)

The audit principle: every sent email's exact text, approved-by, and timestamp is recorded immutably; a sent record is never edited or deleted.

---

## 2. Functional Requirements

Requirements are numbered FR-001 … and are each paired with a concrete acceptance test.

### 2.1 Leads

| ID | Requirement | Acceptance test |
|---|---|---|
| FR-001 | The system shall store leads with: company, contact name, email (globally unique for dedupe), grade (A/B/C), stage, campaign, pain signals, research notes, source. | Add two leads with the same email in two campaigns → only one lead record exists, linked to both campaigns. |
| FR-002 | The system shall grade leads using configurable per-campaign grading rules (the system executes rules; it does not invent them). | Set rule "2+ pain signals + verified email = A" → a lead meeting it is graded A; change the rule → re-grade reflects the change. |
| FR-003 | Lead stages shall be: New → Researched → Contacted → Replied → Call Booked → Proposal Sent → Negotiation → Won; with outcomes Lost, Disqualified, Suppressed. | Attempt every legal transition and one illegal backward jump → backward jump is rejected unless logged as a manual correction in `activities`. |
| FR-004 | The Kanban view shall group duplicate leads from the same company into a single visible card. | Import 3 contacts from one company → one card showing 3 contacts. |
| FR-005 | Only **verified** leads shall be eligible for the send queue. Unverified leads are blocked with a visible reason. | Approve an unverified lead → queue rejects it; dashboard shows "blocked: email not verified". |

### 2.2 Sending & Queue

| ID | Requirement | Acceptance test |
|---|---|---|
| FR-006 | **Human approval gate:** the first 100 campaign emails shall require explicit human approval (approve/edit/reject). No auto-send is permitted before 100 approved sends. | Attempt to enable auto-send at send #57 → system refuses; at send #101 the operator may opt in, logged. |
| FR-007 | Approved emails shall go into a queue, never send directly. The queue enforces per-account gap (10–15 min), daily cap, and the Mon–Fri US-morning send window. | Approve 10 emails at once → they schedule across accounts with ≥10 min per-account gaps, none outside the send window. |
| FR-008 | **Idempotency:** every queue item shall carry a unique `idempotency_key` per (lead, sequence step). Re-running the send worker shall never double-send. | Run the send worker twice on the same due items → each lead/step sends exactly once (sent_emails count = 1). |
| FR-009 | **Retry with backoff:** on Graph send failure, the worker shall retry at 5 min → 15 min → 45 min, then hand to human review. No infinite retries. | Simulate 4 consecutive Graph failures → item ends in `failed` with status `needs_review`, not retrying forever. |
| FR-010 | **Circuit breaker:** if an account fails repeatedly or trips a health threshold, that account pauses itself; the system continues with other accounts and does **not** shift the paused account's load onto them. | Force an account to trip pause mid-queue → its items stay pending (not reassigned); other accounts keep sending. |
| FR-011 | **Kill-switch:** one click on the Home screen shall halt all sending; pending queue items shall not send after the switch is flipped. | Flip kill-switch with 12 items pending → zero sends occur after the flip; audit log records the action and timestamp. |

### 2.3 Rotation & Accounts

| ID | Requirement | Acceptance test |
|---|---|---|
| FR-012 | The operator may add **unlimited** sending accounts via Microsoft OAuth only. Passwords shall never be accepted in any form, chat, or database field. | Add an account → the flow is OAuth consent; no password field exists anywhere in the UI or schema. |
| FR-013 | A newly connected account shall enter `warming` status (never `ready`) and shall pass a day-1 Graph test send to the operator's own seed inbox. | Connect an account → status is `warming`; seed test result is recorded on the account card. |
| FR-014 | **Rotation eligibility (all must hold):** status `ready`; warmup + 85%+ placement gate passed; daily cap not exhausted; 10–15 min since last send; not paused/cooling/disconnected; lead not suppressed; same company not emailed in this campaign within 14 days. | Place an item when the only `ready` account is at cap → item waits; dashboard states the exact blocking reason. |
| FR-015 | **Weighted pick:** among eligible accounts, the system shall pick the highest health score (tie-break: least sent today). Health = 100 baseline − bounce penalties − placement penalties + reply bonuses. | With two eligible accounts (scores 92 and 71) → the 92-score account is picked and recorded on the queue item. |
| FR-016 | **Ramp schedule per account:** days 1–14 warmup only (campaign cap 0); days 15–21 → 5/day (placement ≥85%); days 22–28 → 10/day; day 29+ → max 20/day personal Outlook (25–30/day Phase 2 domain inbox after full warmup). Caps move **down** as well as up. | Set an account to day 18 with placement 88% → cap is 5; drop placement to 70% → account enters `cooling`, cap decreases. |
| FR-017 | Token refresh failure shall mark the account `disconnected`, the queue shall skip it, and the operator shall receive a reconnect alert. No system crash. | Revoke OAuth access mid-day → account flips to `disconnected`, queue skips, alert appears; send worker completes its run. |
| FR-018 | The operator may manually Pause/Resume any account; manual pause overrides health logic until resumed. | Pause a `ready` account with items queued → its items wait; resume → rotation includes it again. |

### 2.4 Replies

| ID | Requirement | Acceptance test |
|---|---|---|
| FR-019 | Each account's inbox shall be polled every 15 minutes, staggered per account (e.g. :00, :03, :06) to avoid Graph throttling. | With 3 accounts connected, log poll timestamps → no two accounts poll in the same minute. |
| FR-020 | Replies shall be matched to leads by **conversation/thread ID first**, then sender email (thread-first = Phase 2; scaffold: sender-email match). | A reply arriving from a forwarded thread or teammate address → still matched to the correct lead via thread ID. |
| FR-021 | Detected replies shall be classified into: Positive / Busy / Price / Not Interested / Referral / Out-of-office / Bounce / Unsubscribe. Out-of-office shall **not** move the lead to Replied. | Feed 8 sample replies (one per class) → all classified correctly; out-of-office leaves stage unchanged. |
| FR-022 | **Stop-on-reply:** any non-auto reply halts all remaining sequence steps for that lead on **all** accounts. | Lead has steps 2 and 3 queued; reply detected → both steps cancelled, `activities` logs the stop. |
| FR-023 | **Reply continuity:** replies shall be answered from the original sending account (`reply_from_account_id`), auto-selected. Manual change shall show a warning. | Open a reply in the inbox → the compose draft defaults to the sending account; changing it triggers a warning banner. |
| FR-024 | Unsubscribe / spam complaint / Not-Interested shall globally suppress the email **and** company across all accounts, and stop the sequence immediately. | Complaint received → no further email to that company sends from any account; suppression record has timestamp and reason. |
| FR-025 | Positive replies shall be surfaced at the top of the Replies Inbox and trigger an alert (dashboard inbox + self-email). | Simulate a positive reply → it appears first in the inbox and an alert is generated within one poll cycle. |

### 2.5 Sequences

| ID | Requirement | Acceptance test |
|---|---|---|
| FR-026 | Sequences shall be per-campaign configurable: Day 0 / 3 / 7 / 12 emails, manual LinkedIn touch on Day 5 (never email-pasted, low volume), stop-on-reply, per-campaign checklist. | Create a campaign with Day gaps 0/4/9 → the lead's steps schedule at exactly those gaps. |
| FR-027 | AI drafts (Gemini/Groq) shall be 3-line style, shall use only research-verified numbers/claims, and shall require approve/edit/reject before queueing. | Draft contains an invented statistic → spam check BLOCKs it; approval screen shows the verification source per claim. |
| FR-028 | A spam-check-failed draft shall never enter the queue; the exact failing rule(s) shall be visible on the draft. | Draft with 2 links → blocked with message "BLOCK: more than 1 link". |

### 2.6 Health & Warmup

| ID | Requirement | Acceptance test |
|---|---|---|
| FR-029 | The Health Worker shall run daily and snapshot per-account: sent, bounces, replies, spam complaints, placement score, health score (→ `account_health_daily`). | Run health worker → each account gets exactly one row for today; weekly trend view renders from these rows. |
| FR-030 | **Auto-pause thresholds:** 7-day bounce rate >2% → warning; >5% → account auto-pauses and a system warning fires. Spam complaint rate >0.1% → warning; >0.3% → system stops sending. | Inject synthetic 6% bounce for an account → account status becomes `paused` with reason recorded; operator alerted. |
| FR-031 | **Placement gate:** a new account or new template must pass a seed-list placement test (operator's own Gmail/Outlook/Yahoo inboxes) ≥85% before campaign volume may increase. | Seed test lands 3/10 in spam → gate fails; account stays in `warming`, campaign cap stays 0. |
| FR-032 | Hard bounce → suppress the email immediately. Soft bounce 3× → suppress. Never re-send to a suppressed email. | Simulate 1 hard bounce → email suppressed same run; 3 soft bounces → suppressed on the third. |
| FR-033 | The Warmup Monitor shall show per-account: warmup day, daily warmup tasks, AutoMailer warmup score, seed test results — no manual weekly log. | Open Warmup Monitor for a day-6 account → tasks listed, score shown, campaign cap shown as 0. |

### 2.7 Campaigns

| ID | Requirement | Acceptance test |
|---|---|---|
| FR-034 | Campaigns shall encapsulate the full niche definition: ICP, research checklist, pain taxonomy, grading rules, enrichment config, templates + variables, sequence timing, offer + pricing, discovery questions, proposal template, onboarding checklist, extra spam rules. No niche name shall appear in code. | Grep the codebase for "dental"/"shopify"/"hvac" → zero matches outside seed data; all niche content loads from the `campaigns` row. |
| FR-035 | New niches shall be startable in ~15 minutes via template presets (dental / law / shopify / hvac / blank) or by cloning an existing campaign. | Clone the dental campaign, rename, edit checklist → new campaign operates independently; old campaign untouched. |
| FR-036 | **Launch-mode guardrail:** only one campaign may be active at a time. Activating a second shall show a warning (time doubles; pause the first or run both slow). | Activate Campaign B while Campaign A is active → dashboard warns; both can proceed only after explicit confirmation. |
| FR-037 | A dashboard campaign switcher shall filter Leads, Queue, Replies, and KPIs to the selected campaign, plus a comparison view of reply/meeting rates across campaigns. | Switch from Campaign A to B → all four modules show B's data; comparison view shows both rates side by side. |
| FR-038 | The campaign gate: **brand config + demo asset + Cal.com link complete** before the queue may start for a campaign (F16). | Attempt to start queue with missing Cal.com link → blocked: "campaign prerequisites incomplete". |

### 2.8 Proposals, Clients & Calls

| ID | Requirement | Acceptance test |
|---|---|---|
| FR-039 | Proposals: 1-page draft from the campaign's proposal template, with amount, status, sent timestamp. | Generate a proposal for a lead → header/brand pulls from `brand_config`, body from campaign template. |
| FR-040 | Contract module: SOW template (scope, 2 revisions, extra work $50/hour, ownership transfers only on full payment) + e-signature option. | Create a contract → all four clauses present and editable before sending. |
| FR-041 | Clients: onboarding checklist per campaign; payments module (Payoneer/Wise invoice, payment link/status, 50%/50% tracking, overdue reminder). `advance_paid` alone is not sufficient tracking. | Record a 50% advance → payment status shows "50% received"; overdue invoice triggers a reminder task. |
| FR-042 | Calls: Cal.com bookings imported per lead; call loop = reminder 24h + 1h before, no-show → reschedule task, call prep brief, ROI calculator (tickets/week × minutes × hourly cost). | Book a call → reminders scheduled; mark no-show → reschedule task appears in Home tasks. |

### 2.9 Settings & Brand

| ID | Requirement | Acceptance test |
|---|---|---|
| FR-043 | All brand values (agency name TBD, founder name, postal address placeholder, Cal.com link, LinkedIn headline, send window, caps) shall live in `brand_config`. A single change shall propagate to every template. | Change agency name in Settings → existing draft templates and footer show the new name; no template edited manually. |
| FR-044 | Email footer shall include an unsubscribe line and the postal address (from `brand_config`). Emails missing either shall be blocked by the spam check. | Draft without postal address → BLOCK: "missing postal address / unsubscribe". |

### 2.10 Alerts

| ID | Requirement | Acceptance test |
|---|---|---|
| FR-045 | Alerts shall go to the dashboard inbox and self-email via Graph (no Telegram required). ntfy.sh/Telegram are optional later. | Trigger a positive-reply alert → appears in dashboard inbox and arrives as self-email; no Telegram configured. |
| FR-046 | Alert privacy: alerts shall contain lead name + reply type + dashboard link only — never the full email body. | Inspect an alert payload → no message body present. |
| FR-047 | AI data minimization: only the minimum lead data required for a draft/classification shall be sent to Gemini/Groq. | Inspect an AI request → contains no full thread history or unrelated lead fields. |

---

## 3. User Roles & Permissions

| Role | Access | Notes |
|---|---|---|
| **Owner (single operator, now)** | Full access to everything | This is the only active role in Phase 1. ~30–45 min/day workflow. |
| **Viewer (anticipated)** | Read-only dashboard | Anticipated by the RLS policy shape; not built in Phase 1. |
| **Assistant (anticipated)** | Leads + replies, no settings/accounts/send approval | For a future helper; not built in Phase 1. |

The RLS policy `lumina_owner_all` enforces: only the authenticated owner may read/write any row. Service-role key is server-side only (never in the frontend). No role other than Owner is implemented in Phase 1.

---

## 4. Business Rules

| # | Rule |
|---|---|
| BR-1 | **Launch mode:** 5 new leads/day, one active campaign, ~30–45 min/day. 10/day is Scale mode only (3+ ready accounts + batched approvals). |
| BR-2 | **Human approval:** first 100 emails human-approved; no auto-send before that (FR-006). |
| BR-3 | **Warmup before sending:** no campaign send from any account before day 15 warmup + 85%+ placement gate. |
| BR-4 | **Caps:** per-account daily caps per ramp (0/5/10/20); Phase 2 domain inboxes max 25–30/day after full warmup. Caps can decrease. |
| BR-5 | **Gaps:** 10–15 min minimum between sends from the same account; enforced by queue, never by memory. |
| BR-6 | **Send window:** Mon–Fri, US morning (operator's PKT evening); Tue–Thu preferred; Monday AM and Friday PM volume reduced. Queue holds items outside the window. |
| BR-7 | **Deliverability gates:** bounce 7d >5% → account pause + system warning; spam complaints >0.3% → system stop; placement <85% on a new account/template → no volume increase. |
| BR-8 | **Company frequency:** a company is emailed at most once per 14 days within the same campaign; ≤1 link per email; plain text only; no attachments. |
| BR-9 | **Stop-on-reply:** universal, all accounts, immediate (FR-022). |
| BR-10 | **Suppression is global:** one account's suppress applies to all accounts, forever (until manually reviewed). |
| BR-11 | **Unsubscribe honour:** opt-out honoured within 10 days; sequence stops automatically. |
| BR-12 | **No fabricated data:** drafts may only use research-verified numbers/claims; AI invented metrics are blocked. |
| BR-13 | **One active campaign** in Launch mode (FR-036). |
| BR-14 | **Campaign prerequisites gate:** brand config + demo asset + Cal.com link complete before first queue start (FR-038). |
| BR-15 | **Open rate is not a KPI.** No tracking pixel. Reply rate is the primary metric. |

---

## 5. Data Requirements

### 5.1 Tables (migration `0001`, 19 tables, RLS on all)

| Table | Key fields | Purpose |
|---|---|---|
| `brand_config` | agency_name (TBD), founder_name, postal_address, cal_link, linkedin_headline, send_window_tz | Single source of brand truth |
| `campaigns` | name, niche, icp_json, offer_json, research_checklist_json, pain_taxonomy_json, grading_rules_json, enrichment_config_json, discovery_questions_json, proposal_template_json, onboarding_template_json, spam_rules_extra_json, is_active | Niche-as-data container |
| `campaign_templates` | name, niche, campaign_json | Preset library: dental / law / shopify / hvac / blank |
| `leads` | campaign_id, company, contact_name, email UNIQUE, grade, stage, pain_signals_json, research_notes, source | Lead records; email globally deduped |
| `sending_accounts` | label, email, provider, token_ref, status, warmup_day, placement_score, daily_cap, sent_today, last_sent_at, health_score, bounce_rate_7d, spam_complaints_7d, reply_rate_7d, paused_reason | Sending accounts |
| `send_queue` | lead_id, account_id, sequence_step, scheduled_at, status, idempotency_key UNIQUE, spam_check_result, sent_at, error | Send single source of truth |
| `spam_checks` | queue_id, result (block/warn/pass), blocked_reason, score | Pre-send audit trail |
| `suppressions` | email, company, reason (bounce/unsubscribe/complaint/not_interested), suppressed_at | Global suppression |
| `sequences` | campaign_id, step_day, template | Campaign sequence definition |
| `sequence_emails` | lead_id, step, sent_via_account_id, status | Per-lead send history |
| `replies` | lead_id, account_id, thread_id, classification, body_summary, received_at | Detected replies |
| `warmup_inboxes` | account_id, placement_score, checked_at | Warmup/placement snapshots |
| `account_health_daily` | account_id, date, sent, bounces, replies, spam_complaints, health_score | Daily health rollup |
| `calls` | lead_id, cal_booking_ref, notes_json, outcome | Call records |
| `proposals` | lead_id, amount, status, sent_at | Proposals |
| `clients` | lead_id, onboarding_checklist_json, advance_paid, advance_verified_at, go_live_at | Won clients |
| `payments` | client_id, invoice_ref, amount, status, due_at, paid_at | Payment tracking (50/50) |
| `activities` | lead_id, type, note, created_at | Immutable activity log |
| `notifications` | type, title, link, read_at | Dashboard alert inbox |

### 5.2 Audit immutability

- Every sent email's **exact text + approved-by + timestamp** shall be recorded and shall be immutable (append-only; no UPDATE/DELETE on sent records).
- AI draft version history shall be retained (draft → operator edits) to improve copy over time.
- Stage moves backward shall only occur as logged manual corrections in `activities`.

### 5.3 Retention & export

- Weekly lead export (backup) shall be supported even on Supabase Free tier.
- Suppressed emails shall be retained indefinitely (re-sending to them is a compliance violation).

---

## 6. Validations

| ID | Rule | Enforcement point |
|---|---|---|
| V-001 | Email format valid (RFC-style) | Lead create/import |
| V-002 | Email **verified** (MillionVerifier/Hunter) before queue eligibility | Queue admission (BLOCK) |
| V-003 | Unsubscribe line + postal address present in every email body | Spam check (BLOCK) |
| V-004 | ≤1 link, no URL shorteners, no attachments | Spam check (BLOCK) |
| V-005 | Subject: no ALL CAPS, no "FREE!!!"/"Guaranteed"/"100% profit"-style triggers | Spam check (BLOCK) |
| V-006 | Body ≤120 words, ≤1 CTA; personalization claims must be research-verified | Spam check (BLOCK) |
| V-007 | WARN (operator decides): mild trigger word, 100–120 words, Grade B/C lead | Spam check (WARN) |
| V-008 | Company not emailed in same campaign within 14 days | Queue admission (BLOCK) |
| V-009 | Lead not on global suppression list | Queue admission (BLOCK) |
| V-010 | Account eligible (FR-014) at send time, not just at schedule time | Send worker, immediately before Graph call |

---

## 7. Authentication & Authorization

1. **Dashboard:** Supabase Auth (single owner). All queries go through RLS (`lumina_owner_all` policy: only the authenticated owner reads/writes).
2. **Service key:** Supabase service-role key is **server-side only** (Python worker `.env` / later Vault). It shall never appear in frontend code, logs, or chat.
3. **Sending accounts:** Microsoft OAuth delegated permissions (`Mail.Send`, `Mail.Read`). Tokens stored server-side only — scaffold: env var name in `sending_accounts.token_ref`; production: Supabase Vault reference. Passwords never accepted, stored, or logged.
4. **Token hygiene:** tokens never logged; token refresh failure → `disconnected` + skip + reconnect alert (FR-017).
5. **AI providers:** Gemini/Groq free-tier API keys server-side only; minimal data per call (FR-047).

---

## 8. Error Handling

| Failure | Required behavior |
|---|---|
| Graph send fails (transient) | Retry 5 → 15 → 45 min, then human review (FR-009) |
| Graph rate limit (429/throttle) | Back off, stagger polls, do not hammer; item re-queues with delay |
| Token expired/revoked | Account → `disconnected`; queue skips; reconnect alert (FR-017) |
| Poll worker fails | Send worker unaffected (workers are independent); poll retries next cycle; alert if 3 consecutive poll failures per account |
| Health worker fails | No auto-pause decisions made that day; alert operator; previous day's scores remain |
| Supabase unreachable | Workers fail safe: no sends without queue/health state; alert on recovery |
| Duplicate worker run | Idempotency key prevents double-send (FR-008) |
| AI provider rate-limited | Draft falls back to operator manual draft; queue does not stall approved items |

---

## 9. Edge Cases

| # | Case | Required behavior |
|---|---|---|
| E-1 | Reply arrives mid-sequence | Remaining steps cancelled on all accounts; lead → Replied; alert (FR-022) |
| E-2 | Account paused mid-queue | Its pending items wait; **not** reassigned to other accounts (duplicate risk) (FR-010) |
| E-3 | Duplicate lead import | Global email dedupe merges into one record (FR-001) |
| E-4 | Bounced test lead (Phase 0) | Phase 0 gate fails; diagnose before proceeding; test lead suppressed |
| E-5 | Reply from a different address (forward/teammate) | Thread-ID match still links it to the lead (Phase 2; scaffold logs for review) |
| E-6 | Out-of-office auto-reply | Classified, logged, stage unchanged, sequence continues (FR-021) |
| E-7 | Operator approves 50 emails at once | Queue spreads them across accounts/gaps/window; none burst-sent |
| E-8 | Kill-switch during an active send batch | In-flight Graph call completes; everything still queued is held |
| E-9 | Two accounts eligible, identical health | Tie-break: least sent today (FR-015) |
| E-10 | Campaign cloned mid-flight | New campaign starts clean; old campaign's queue/replies unaffected |
| E-11 | Unsubscribe click | Footer link → confirmation page → reason captured → global suppression + sequence stop + data-delete request task |
| E-12 | Operator edits an approved draft after queueing | Edited version re-runs the full spam check before its send time |

---

## 10. Security Requirements

| ID | Requirement |
|---|---|
| S-001 | RLS enabled on all 19 tables; frontend never holds the service-role key. |
| S-002 | Graph tokens server-side only (env now, Supabase Vault in production); never in logs, chat, forms, or database plaintext. |
| S-003 | OAuth only for account connection; no password field exists anywhere. |
| S-004 | Alerts carry lead name + reply type + link only; full email bodies never leave the system in alerts. |
| S-005 | AI calls receive minimum necessary lead data; no invented metrics in drafts (enforced by spam check). |
| S-006 | Suppression list is global and enforced at queue admission for every account. |
| S-007 | CAN-SPAM basics: postal address + unsubscribe in every email; opt-out honoured ≤10 days; footer data from `brand_config` only. |
| S-008 | Weekly lead export for backup; Supabase free-tier limits monitored. |
| S-009 | `.env` never committed to git; `.env.example` is schema-only. |
| S-010 | Accounts used for sending shall be real, operator-owned accounts — never the job/main personal account, never purchased accounts. |

---

## 11. Performance Requirements

| ID | Requirement | Target |
|---|---|---|
| P-001 | Poll cadence | Every 15 min per account, staggered (no two accounts same minute) |
| P-002 | Send worker cadence | Every 10–15 min; picks up due items |
| P-003 | Health worker cadence | Once daily |
| P-004 | Queue throughput | Per-account gap 10–15 min respected; with 5 ready accounts ≈ 1 send per 2–3 min system-wide without breaking any per-account gap |
| P-005 | Dashboard responsiveness | Usable with 20 accounts connected (per-account indexes, staggered polling, no N+1 on health views) |
| P-006 | Alert latency | Positive reply → alert within one poll cycle (≤15 min) |
| P-007 | Supabase free-tier fit | Row/invocation usage monitored; polling designed to stay within free limits |
| P-008 | Daily operator time | Launch-mode routine fits 30–45 min: replies ~10 min, approvals ~10 min, research ~15 min, calls/onboarding 0–10 min |

---

## 12. Acceptance Criteria

### 12.1 Phase 0 gate (must pass before any further build)

Azure app + 1 Outlook account via OAuth + **1 test send + 1 test poll**, no campaign involved. Exit: a test lead completes the full loop (add → grade → draft → approve → spam check pass → queue → send → reply detected → stage move).

### 12.2 The 10 acceptance tests (must all pass before the first real campaign)

| # | Test | Expected result |
|---|---|---|
| AT-1 | Spam-check fail | No send; exact blocking reason visible on the draft |
| AT-2 | Suppressed lead | No send from any account |
| AT-3 | Paused account | Queue skips it; its load is not shifted to other accounts |
| AT-4 | Duplicate send | Idempotency key blocks the second send |
| AT-5 | Token expiry | Account → `disconnected` + reconnect alert; no system crash |
| AT-6 | Reply arrives | Sequence stops on all accounts; lead stage moves |
| AT-7 | Bounce spike | Auto-pause + system warning fire |
| AT-8 | Kill-switch | All pending sends halt immediately |
| AT-9 | Agency name change | Every template/footer updates from the single `brand_config` change |
| AT-10 | Campaign switch | Second campaign uses its own checklist/templates; no cross-campaign copy mixing |

### 12.3 Phase exit criteria (build order)

- **Phase 1 (Core dashboard):** 1 lead added → graded → research notes saved.
- **Phase 2 (Queue + Rotation + Spam):** rotation proven across 2 accounts; spam-fail email never queues; no duplicate send.
- **Phase 3 (Poll + Replies + Booking):** simulated reply moves stage, stops sequence, fires alert.
- **Phase 4 (Proposal + Client + Health):** 1 lead completes the full loop — add → approve → queue → send → reply → call → proposal → advance verified → onboarding — in one dashboard, no external tools.

### 12.4 Built-so-far statement (2026-10-30)

The Python worker **scaffold is built**: services (rotation, spamcheck, graph, health, notify) + 3 workers (send, poll, health), **18/18 tests passing** (8 rotation, 10 spamcheck). Supabase migration `0001` (19 tables, idempotent, RLS `lumina_owner_all`) is written but **not yet run** — it awaits the operator's own Supabase project. Scaffold limits are honest: tokens via env var names (Vault in production), poll matches by sender email (thread-first is Phase 2), AI classification is Phase 2. Phase 0 is the next step and requires the operator's Supabase project, Azure app, and Outlook OAuth (done by the operator himself; passwords never shared).

---

## 13. Open Decisions (explicitly unresolved — do not treat as decided)

| # | Decision | Status |
|---|---|---|
| OD-1 | Agency brand name | **OPEN — TBD** (placeholder in `brand_config`) |
| OD-2 | Campaign-1 niche final pick | **OPEN** (options: dental clinics first per earlier goal track; Shopify/HVAC supported by design) |
| OD-3 | Tier-1 pricing | **OPEN** (draft: $1,500 setup + $300–500/mo; final on sales calls) |
| OD-4 | Demo asset + Cal.com link | **OPEN** — gates first campaign (FR-038) |
| OD-5 | LinkedIn headline | **OPEN — TBD** |
| OD-6 | Paid verification budget | **OPEN** — after the 100 free MillionVerifier credits are exhausted |
| OD-7 | Scale-mode timing | **OPEN** — decided when 3+ accounts are ready and Launch metrics are stable |

---

*End of SRS v1.0 — Lumina*
