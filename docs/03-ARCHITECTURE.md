# Lumina — System Architecture Document

**Document:** 03-ARCHITECTURE
**Date:** 2026-10-30
**Status:** Design locked at v2.1 (master blueprint: `LUMINA_V2_FIXED_SYSTEM.md`); implementation in progress
**Audience:** The builder/operator (Mohammad Talha, solo operator) and any future collaborator

---

## Naming rule (read first)

- **Lumina** = the internal system name: the dashboard + sending engine + warmup stack. Locked.
- **Agency brand name = TBD.** It is never hard-coded anywhere. It lives only in the `brand_config` table
  (`agency_name` column), and templates/signatures/footers render it from there. This document invents no brand name.
- All system surfaces that address prospects must be niche-agnostic in code: niche is **data**, held in
  `campaigns` / `campaign_templates` records, never in source code.

---

## 1. Architecture overview

Lumina is a **hybrid three-tier system**: a managed database/Auth foundation, stateless Python workers that do all
automated work, and a thin Next.js dashboard that is the operator's single surface.

```
                    ┌─────────────────────────────┐
                    │  OPERATOR (browser, phone)   │
                    │  ~30–45 min/day, Launch     │
                    └──────────────┬──────────────┘
                                   │  HTTPS, authenticated
        ┌──────────────────────────┼──────────────────────────┐
        │                          ▼                          │
        │              ┌──────────────────────┐                │
        │              │ Next.js dashboard    │                │
        │              │ (Vercel Hobby)       │                │
        │              │ — reads/writes only  │                │
        │              │   via Supabase client│                │
        │              │ — NO sending logic,  │                │
        │              │   NO tokens here     │                │
        │              └──────────┬───────────┘                │
        │                         │                           │
        │                         ▼                           │
        │              ┌──────────────────────┐      ┌──────────────────────┐
        │              │  Supabase Postgres   │◄────►│ Python FastAPI       │
        │              │  — single source of  │      │ worker service       │
        │              │    truth (19 tables) │      │ — stateless          │
        │              │  — Auth (operator)   │      │ — 3 workers: send /  │
        │              │  — RLS on every table│      │   poll / health      │
        │              │  — Realtime events   │      │ — all state read     │
        │              │  — Vault (planned)   │      │   from + written to  │
        │              └──────────┬───────────┘      │   Supabase only      │
        │                         │                └──────────┬───────────┘
        │                         │                           │
        └─────────────────────────┼───────────────────────────┘
                                  ▼                           ▼
                    External world: Microsoft Graph (Outlook send + inbox poll),
                    Cal.com, Apollo/Hunter, MillionVerifier, Gemini/Groq,
                    AutoMailer (warmup network only)
```

### Why this split

| Decision | Rationale |
|---|---|
| Supabase as the foundation, not a custom backend | Managed Postgres + Auth + RLS + Realtime for $0. One source of truth for leads, accounts, queue, replies — no divergent records in sheets/inboxes. |
| Python workers instead of Supabase Edge Functions (hybrid choice) | The operator runs the workers where he already works (his VM/local machine, `.env`-configured). Stateless workers + Postgres give queue semantics, idempotency keys, exponential-backoff retries, and staggered polling without serverless cold-start and invocation-limit concerns on the free tier. |
| Dashboard does not send email | Separation of duties: the dashboard approves and observes; the workers execute with eligibility checks. This is what makes the 10–15 min per-account gap and caps enforceable instead of aspirational. |
| Queue in the database | The queue is the single place that owns gap, cap, rotation, retry, and blocked-reason state. Nothing is sent "by hand" around it, so deliverability rules can't be bypassed by accident. |

---

## 2. Tech stack (Phase 1 — $0 cash)

| Component | Choice | Why |
|---|---|---|
| Dashboard UI | Next.js (open source) | Operator already knows the stack; server components fit a read-mostly dashboard |
| Dashboard hosting | Vercel Hobby (free) | Free tier, adequate for a single-operator dashboard |
| Database / Auth / RLS / Realtime | Supabase Free | Managed Postgres, Auth, row-level security, Realtime subscriptions — one service, $0 |
| Sending + inbox reading | Microsoft Graph API + personal Outlook accounts | Graph calls are $0; OAuth only, never passwords. Multiple personal accounts rotate (see §4, §9) |
| Reply polling schedule | Poll worker, 15-min cadence, staggered per account | Avoids simultaneous Graph throttling; one poll loop per account |
| Background execution | Python FastAPI worker service (stateless) | `worker/app/`: services (rotation, spamcheck, graph, health, notify) + 3 workers (send, poll, health); 18/18 tests passing |
| Booking | Cal.com Free | Free booking page; referenced from email signature and proposals |
| Lead sourcing | Apollo Free + Hunter Free (tiers are limited) | Grade A leads first; credits are finite — the funnel plan assumes this |
| Email verification | MillionVerifier — 100 one-time free credits + Hunter free tier | One-time 100, not monthly. Only verified emails enter the queue |
| Warmup | AutoMailer Free | **Warmup network only — never a campaign sender** |
| Spam score checks | Mail-Tester (free) | Pre-flight check for new templates |
| AI drafts | Gemini API free tier, Groq free tier as backup | On-demand draft + (Phase 2) reply classification; human approval always precedes sending |
| Research signals | Google PageSpeed Insights (free), Google Maps/Reviews (free), Wappalyzer (free) | Automated signal collection feeds research notes; operator verifies |
| Alerts | Dashboard inbox + self-email via Graph | Chosen default. No Telegram. Alert payload = lead name + reply type + dashboard link, never the full email body |
| Payments (when clients land) | Payoneer / Wise (accounts free) | Invoice + payment link/status tracked in Lumina's payments module |

What is deliberately **not** in Phase 1: no tracking pixel (plain-text emails; open rate is not a KPI), no paid
sender tools (Instantly/Smartlead/Lemlist are paid — excluded), no Stripe for Pakistan directly.

---

## 3. Frontend — Next.js dashboard on Vercel Hobby

### Role boundary

The dashboard is the operator's **command center and approval surface**. It **reads and writes application state
in Supabase** and it **observes** worker activity. It never:

- sends email directly,
- holds Microsoft Graph tokens or the Supabase service-role key,
- runs queue/rotation/spam logic (that lives in the worker service and is unit-tested there).

### The 13 screens (finalized in Google Stitch — "Aurora Glass" light glassmorphism)

1. **Home Today** — the day's 5 tasks (replies, approvals, research batch, calls, onboarding), KPIs
   (leads / sent / reply rate / calls / proposals / won), system health (green/amber/red), and the global **kill-switch**.
2. **Leads Kanban** — stages: New → Researched → Contacted → Replied → Call Booked → Proposal Sent → Negotiation → Won,
   with Lost / Disqualified / Suppressed as terminal outcomes. Filter by campaign; Grade A first.
3. **Lead Detail** — research notes, pain signals, timeline, AI draft + approve/edit/reject, spam-check result,
   send history, reply history.
4. **Replies Inbox** — all accounts' replies in one place, classification
   (Positive / Busy / Price / Not Interested / Referral / Out-of-office / Bounce / Unsubscribe), positives on top.
5. **Sequences** — per-campaign templates Day 0 / 3 / 7 / 12, LinkedIn touch Day 5, stop-on-reply rule, per-campaign checklist.
6. **Accounts & Rotation** — per-account card: status, warmup day, health score, today's cap (e.g. 7/20), placement test,
   Pause/Resume, Add Account (OAuth).
7. **Send Queue** — today's scheduled sends: which account, what gap, and *why blocked* in plain language for blocked items.
8. **Campaigns** — campaign switcher, presets, clone, comparison view (reply rate / meeting rate per campaign).
9. **Deliverability Health** — per-account and system-level bounce / reply / placement / spam complaints, weekly trend,
   next week's cap suggestion.
10. **Warmup Monitor** — warmup day counters, placement scores, daily snapshots, gate status.
11. **Proposals & Clients** — Cal.com bookings, 1-page proposal draft, contract/SOW module, onboarding checklist,
    payment tracking (invoice + link/status + 50/50 split + overdue reminders).
12. **Calls** — call tasks, reminders (24h + 1h), no-show reschedule, call prep brief, ROI calculator.
13. **Settings & Brand** — agency name (TBD), founder name, postal address placeholder, Cal.com link, LinkedIn headline,
    send window, caps. One change here propagates to every template.

### Data access

- Browser talks to Supabase via the **anon key + Supabase Auth session**; every table enforces the
  `lumina_owner_all` RLS policy (operator-only read/write). The service-role key never ships to the client.
- **Realtime subscriptions** keep the Kanban, Replies Inbox, Queue, and Health screens live without refresh —
  the operator sees worker-produced state changes (send completed, reply arrived, account auto-paused) as they happen.
- Approvals are state transitions in Supabase (`send_queue.status`: `approved → queued`): the operator never triggers
  a send directly; the send worker picks up queued items on its cadence.

### Mobile surface (§14 v2.1 P0)

Approvals and positive-reply handling must work from the phone: alerts link directly to the approval screen.
This is a hard requirement of the mobile dashboard scope, not a nice-to-have — the operator's daily window is small.

---

## 4. Backend — Python FastAPI worker service

Built scaffold: `~/workspace/lumina/worker/` — implementation + tests exist (18/18 passing). Status: **scaffold
complete; live wiring (Supabase project, Azure OAuth tokens) is Phase 0 work done by the operator**.

### App layout

```
worker/
  app/
    main.py        → FastAPI app + routes (remote control: GET /health, GET /queue,
                    POST /workers/send/run, …; auto docs at /docs)
    config.py      → settings from .env only (no keys in code)
    db.py          → thin Supabase PostgREST layer (service key used ONLY here)
    models.py      → Pydantic schemas (shapes of leads, queue items, accounts, …)
    services/
      rotation.py  → eligibility filter + weighted pick (pure, 8 tests)
      spamcheck.py → pre-send checklist, block/warn (pure, 10 tests)
      graph.py     → Microsoft Graph client: Mail.Send + Mail.Read (delta)
      health.py    → 0–100 score + auto-pause + cap suggestion (pure)
      notify.py    → alerts: dashboard inbox row + self-email via Graph
    workers/
      send_worker.py   → queue → idempotency → suppression → spam check →
                         rotation pick → Graph send → audit log
      poll_worker.py   → per-account staggered inbox poll → match reply →
                         classify → stage move → stop-on-reply → alert
      health_worker.py → daily rollup → auto-pause / cooling / cap adjust
  tests/             → 18 tests (rotation 8, spamcheck 10), all passing
  .env.example       → variable names only; .env is git-ignored
```

### Statelessness rule (non-negotiable)

Workers hold **no durable state in memory or on disk**. All state — queue position, `sent_today`, `last_sent_at`,
health scores, reply matches, alerts — is read from and written to Supabase on every cycle. Consequences:

- A worker crash loses nothing; the next run resumes from the database.
- Multiple runs of the same worker are safe because every send is guarded by a unique `idempotency_key`.
- Retries use exponential backoff (fail → 5 min → 15 min → 45 min → human review). No infinite retry.
- The send worker and poll worker are independent: one failing never blocks the other.

### The three workers

| Worker | Cadence | Core loop |
|---|---|---|
| **send** | Every 10–15 min (or `POST /workers/send/run`) | Take due `queued` items → re-check eligibility (account ready, cap left, gap satisfied, not suppressed, spam check pass, send window open) → rotation pick → Graph send → write audit (`sent_emails`) → update `sent_today` / `last_sent_at`. Anything suspicious → `blocked` with a human-readable reason, never sent. |
| **poll** | Every 15 min **per account, staggered** (e.g. account 1 at :00, account 2 at :03, …) | Graph delta read → match message to lead → classify → on real reply: move stage to Replied, stop the whole sequence on **all** accounts, write `replies` row, raise alert (dashboard inbox + self-email). Out-of-office/auto-reply never counts as Replied. |
| **health** | Daily | Roll up sent/bounces/replies/complaints/placement per account → recompute health score → auto-pause on hard breach (bounce >5%, spam complaint >0.3%) or cooling on soft breach → suggest next week's cap. Writes `account_health_daily`. |

### Current scaffold limits (stated honestly)

- `sending_accounts.token_ref` currently names an **environment variable**; the production path is a Supabase Vault
  reference (Phase 2 wiring).
- `poll_worker` matches replies by **sender email** today; **thread/conversation-ID-first matching is Phase 2**.
- `poll_worker.classify` is rule-based today; **Gemini/Groq AI classification replaces it in Phase 2** (human review
  remains for negative/unsubscribe/bounce).

---

## 5. Database — Supabase Postgres

### Grouping of the 19 tables

| Domain | Tables |
|---|---|
| Brand & campaign config | `brand_config`, `campaigns`, `campaign_templates` |
| Pipeline | `leads`, `sequences`, `sequence_emails`, `calls`, `proposals`, `clients`, `activities` |
| Sending engine | `sending_accounts`, `send_queue`, `spam_checks`, `sent_emails` (immutable audit log) |
| Deliverability guardrails | `suppressions` (global), `warmup_inboxes`, `account_health_daily` |
| Replies & alerts | `replies`, `alerts` |
| Commercial (v2.1 P0) | payments tracked under `clients` + invoices; contract terms under `proposals` |

Full DDL is the authority: `supabase/migrations/0001_lumina_core.sql` (idempotent — safe to re-run; uses
`IF NOT EXISTS`-style guards so no duplicates are created).

### Key design decisions

- **Lead stages (locked):** New → Researched → Contacted → Replied → Call Booked → Proposal Sent → Negotiation → Won.
  Outcomes are separate: Lost, Disqualified, Suppressed. Stage moves forward or to an outcome only; backward moves
  require a human correction and are logged in `activities`.
- **Dedupe:** `leads.email` is globally unique — one company/contact exists once across campaigns; the campaign link
  decides which sequence they receive.
- **Company-level frequency cap:** the same company is not emailed twice in the same campaign within 14 days.
- **Global suppression:** a bounce, unsubscribe, complaint, or explicit "not interested" on *any* account suppresses
  the lead/company on *all* accounts.
- **Immutable audit log:** `sent_emails` records the exact sent text + approved-by + timestamp and is append-only.
  This is both the idempotency anchor and the compliance record.
- **RLS:** every table has Row Level Security on, under the single owner policy `lumina_owner_all` (the logged-in
  operator can read/write everything; anonymous gets nothing).

### Seed data

Migration 0001 seeds `brand_config` (agency name placeholder = TBD, send window, postal address placeholder) and
`campaign_templates` with **5 presets**: dental, law, shopify, hvac, blank. New campaigns start from a preset or by
cloning an existing campaign — never from hard-coded niche logic.

---

## 6. External APIs & integrations

| Integration | Used for | Notes / limits |
|---|---|---|
| Microsoft Graph (`Mail.Send`, `Mail.Read`) | Sending + reply polling from personal Outlook accounts | Azure app registration + delegated permissions + user OAuth consent. Tokens per account; refresh failure → account `disconnected`, queue skips it, operator gets a reconnect alert. Tokens never in logs. Personal-account sending limits and lock risk are designed around, not wished away (multi-account + cooling + kill-switch). |
| Cal.com | Booking link in signature, templates, proposals | Free plan. Booking ref stored on `calls`. |
| Apollo Free / Hunter Free | Lead sourcing, email finding/verification backup | Limited free credits — sourcing strategy assumes this; Grade A leads first. |
| MillionVerifier | Email verification | 100 one-time free credits, not monthly. Only verified emails may enter the queue. Paid verification budget is a separate line item, not assumed. |
| Gemini API free / Groq free | AI draft generation (on-demand, operator-approved); reply classification in Phase 2 | Rate limits exist; Groq is the fallback. Minimum lead data sent to AI; no invented numbers/claims in drafts. |
| AutoMailer Free | **Warmup network only** | Never a campaign sender. Placement score is one signal among several (bounce rate, complaints), not proof of inbox placement. |
| Mail-Tester | Spam-score pre-flight for new templates | Free tier has daily limits. |
| Google PageSpeed / Maps / Wappalyzer | Automated research signals → pre-filled research notes | Operator verifies; signals are per-niche configurable in the campaign record. |
| Payoneer / Wise | Receiving client payments (accounts free) | Payment status tracked in Lumina; 50% advance verified before work starts. |

**Not used / excluded:** Telegram (alerts are dashboard + self-email), tracking pixels, paid senders (Instantly,
Smartlead, Lemlist), Warmbox/Lemwarm (paid warmup), GlockApps (paid placement), ZeroBounce (paid verification).

---

## 7. Authentication & authorization

| Surface | Mechanism |
|---|---|
| Operator → dashboard → Supabase | Supabase Auth (single operator account) + RLS (`lumina_owner_all`). The browser uses the anon key; the service-role key never leaves the server. |
| Sending accounts → Microsoft Graph | **Microsoft OAuth only.** The operator connects each account himself via the live OAuth flow. **Passwords are never in chat, forms, or the database** — this rule is absolute and appears in every spec. |
| Worker → Supabase | Service-role key via environment (`SUPABASE_SERVICE_KEY` in `.env`, git-ignored). Used only inside `app/db.py`. |
| Token storage (current) | `sending_accounts.token_ref` names the env var holding the account's OAuth token (scaffold state). |
| Token storage (planned, Phase 2) | Supabase Vault reference in `token_ref`; refresh-token wiring with `disconnected`-on-failure handling. |

---

## 8. System components & responsibilities

| Component | Owns | Does NOT own |
|---|---|---|
| Next.js dashboard (Vercel) | Approvals, Kanban/CRM views, campaign config, health visibility, kill-switch, alerts inbox UI | Sending, polling, token handling, queue math |
| Supabase Postgres | All durable state: leads, accounts, queue, replies, health history, audit log, brand/campaign config | Business logic execution |
| Supabase Auth + RLS | Operator identity, row-level access control | Sending-account OAuth (that's Microsoft's) |
| Supabase Realtime | Live updates to dashboard screens | — |
| Python worker service | send / poll / health execution: eligibility, rotation pick, spam check, Graph calls, classification, auto-pause, alerts | Long-term state (that's the DB's), secrets at rest (env now, Vault planned) |
| `send_queue` table | Scheduling truth: what goes when, from which account, at what gap, blocked why | — |
| `suppressions` table | Global do-not-contact list (bounce / unsubscribe / complaint / not interested) | — |
| `sent_emails` table | Immutable send audit (exact text + approver + timestamp) | — |
| Microsoft Graph | Transport: send mail, read inbox | Strategy (that's Lumina's) |
| Cal.com | Booking pages + booking refs | Follow-up (that's Lumina's Calls module) |
| Apollo/Hunter/MillionVerifier | Sourcing + verification inputs | Any sending decision (unverified ⇒ never queued) |

---

## 9. Data flow

### 9a. Send path — queue → idempotency → suppression → spam check → rotation → Graph → audit

```
Operator approves draft (dashboard)
        │
        ▼
send_queue row: status = queued, scheduled_at set, idempotency_key = unique
        │
        ▼  (send worker tick, every 10–15 min)
For each due item:
        │
        ├─ 1. Idempotency: idempotency_key already sent? → skip (no duplicate)
        │
        ├─ 2. Suppression: lead/company in suppressions? → blocked ("suppressed: <reason>")
        │
        ├─ 3. Spam check (spamcheck.py): BLOCK rules (unverified, >1 link, shortener,
        │     attachment, spam wording, >120 words, >1 CTA, missing unsubscribe/postal,
        │     unverified claims) → blocked with exact reason, visible in Queue screen.
        │     WARN rules → operator decision, stays out of queue until resolved.
        │
        ├─ 4. Rotation pick (rotation.py):
        │     Hard filter: status=ready AND warmup+placement gate passed AND cap left
        │       AND 10–15 min gap since last_sent_at AND send window open (Mon–Fri US
        │       morning) AND company not contacted in last 14 days (this campaign)
        │     Score: health_score desc, then least sent_today (load balancing)
        │     No eligible account → item stays queued, Queue screen shows why
        │       ("all accounts at cap", "all warming", …) — never force-sends
        │
        ├─ 5. Graph Mail.Send via picked account's token
        │     Fail → exponential backoff retry (5m → 15m → 45m → human review)
        │     Token refresh fail → account disconnected + reconnect alert; item re-queued
        │
        └─ 6. Audit: sent_emails row (exact text + approved-by + timestamp, immutable);
               sent_today+1, last_sent_at updated; lead stage → Contacted
```

### 9b. Reply path — 15-min staggered poll → match → classify → stop-on-reply → alert

```
poll worker tick (per account, staggered: acct1 :00, acct2 :03, acct3 :06, …)
        │
        ▼
Graph delta read of account inbox (last poll → now)
        │
        ▼
For each new message:
        │
        ├─ Match to lead: (Phase 2: conversation/thread ID first) → today: sender email
        │   No match → logged, ignored (never mis-attributed)
        │
        ├─ Classify: Positive / Busy / Price / Not Interested / Referral /
        │   Out-of-office / Bounce / Unsubscribe
        │   (today: rules; Phase 2: Gemini/Groq with human review on negative/unsub/bounce)
        │
        ├─ Out-of-office / auto-reply → logged only, NOT counted as Replied
        │
        ├─ Real reply (incl. negative):
        │     • lead stage → Replied
        │     • STOP the entire sequence for this lead on ALL accounts (stop-on-reply)
        │     • Bounce → suppress lead; 3rd soft bounce → suppress
        │     • Unsubscribe / complaint / Not Interested → GLOBAL suppression
        │     • replies row written (thread_id, classification, body_summary — full body
        │       stays in the mailbox, not in alerts)
        │
        └─ Alert (notify.py): dashboard inbox row + self-email via Graph
              payload = lead name + reply type + dashboard link only
              Positive replies surface at the top of Replies Inbox
```

### 9c. Health path — daily rollup → auto-pause / cooling → rotation weights

```
health worker tick (daily)
        │
        ▼
Per account: sent, bounces, replies, spam_complaints, placement_score (warmup+seed)
        │
        ▼
Recompute health_score (start 100):
  bounce 7d >2% → −20 + warning
  placement test lands in spam → −30 + status=cooling
  positive replies → small plus
        │
        ▼
Hard breaches (no scoring debate):
  bounce 7d >5%            → account auto-pause (+ system warning)
  spam complaints >0.3%    → account auto-pause (+ system warning)
        │
        ▼
Write account_health_daily (trend history for Health screen)
        │
        ▼
Rotation weights update automatically (next send tick uses new scores);
Health screen shows weekly trend + next week's cap suggestion.
Cap moves BOTH ways: good health ramps up per the ramp table (0 → 5 → 10 → 20/day),
bad health ramps down or cools — even if the operator wants more volume.
```

### Rotation & ramp reference (used by 9a/9c)

- **Ramp per account:** Days 1–14 warmup only (cap 0) → Days 15–21: 5/day (placement 85%+ gate) →
  Days 22–28: 10/day → Day 29+: max 20/day (personal Outlook). Phase 2 domain inboxes: max 25–30/day after full warmup.
- **Placement gate:** new account may not send campaigns until warmup complete + placement signal ≥85% +
  no spam complaints. Adding an account ≠ sending from it.
- **Throughput math:** 5 ready accounts × 12-min per-account gap ≈ one send every ~2–3 min system-wide —
  the queue interleaves accounts so no single account's gap is ever violated.

---

## 10. Storage — what lives where

| What | Where | Notes |
|---|---|---|
| All application state (leads → clients, queue, replies, health, config) | Supabase Postgres (19 tables) | Single source of truth; RLS on |
| Operator session | Supabase Auth | Browser holds only the session, never keys |
| Microsoft OAuth tokens | Today: `.env` vars referenced by `token_ref` (git-ignored, operator's machine) → Planned: Supabase Vault | Never in the DB as plaintext, never in logs, never in the frontend |
| Supabase URL + service-role key | `.env` on the operator's machine (worker only) | Git-ignored; `.env.example` documents names only |
| Brand/agency config | `brand_config` table | Agency name TBD lives here, nowhere else |
| Campaign/niche config | `campaigns` + `campaign_templates` tables | Presets: dental / law / shopify / hvac / blank; clone supported |
| Send audit | `sent_emails` (append-only) | Immutable: exact text + approver + timestamp |
| Alert payloads | `alerts` table + transient self-email | Lead name + type + link only; no full bodies |
| Dashboard code | Next.js repo → Vercel Hobby | — |
| Worker code | `~/workspace/lumina/worker/` | Stateless; safe to redeploy/restart anytime |
| Lead backup | Weekly export (operator routine; Supabase free tier has no point-in-time guarantee) | Open item in the security checklist |

---

## 11. Security

1. **No passwords, ever.** Microsoft OAuth is the only path for sending accounts — not in chat, not in forms,
   not in the database. This rule is repeated in every spec because it is the one that matters most.
2. **No secrets in the client.** The browser bundle never contains the service-role key or any Graph token.
   The dashboard uses the anon key + RLS.
3. **RLS everywhere.** `lumina_owner_all` on all 19 tables; anonymous access gets nothing.
4. **Least privilege by layer.** Worker service key lives in one file (`app/db.py`) and one environment;
   tokens are per-account and never logged.
5. **Fail-safe sending.** Unverified lead, suppressed address, paused account, failed spam check, closed send
   window, or any doubt → the email is *not* sent. "Send on doubt" is the most expensive decision in
   deliverability, so the system is built to refuse it.
6. **Circuit breaker, not shared fate.** A bad account pauses itself; the queue skips it and does **not**
   redistribute its load (which would risk duplicate sends). The system keeps running on the healthy accounts.
7. **Kill-switch.** One click on Home stops all sending; pending queue items are not sent.
8. **Privacy in alerts and AI.** Alerts carry name + type + link, never full email bodies. AI drafts receive
   minimum lead data; no invented numbers, clients, or results.
9. **Compliance (US CAN-SPAM baseline).** Global suppression honored; unsubscribe honored within 10 days with
   automatic sequence stop; every email footer carries an unsubscribe line + postal address from `brand_config`;
   unsubscribe confirmation page + data-deletion request task (v2.1 P0).
10. **Auditability.** Every send is immutably logged with approver and exact text; stage regressions require human
    correction and are logged in `activities`.

---

## 12. Deployment

| Piece | Where it runs | How it's deployed |
|---|---|---|
| Dashboard (Next.js) | Vercel Hobby | Git push → automatic build/deploy. $0. |
| Database + Auth | Supabase (managed) | Migration `0001_lumina_core.sql` applied once via the Supabase SQL Editor by the operator; idempotent, safe to re-run. Verification queries confirm the 19 tables + RLS + seed rows. |
| Python worker service | Operator's machine (VM/local) with `.env` | `uvicorn app.main:app` for the API + scheduled `run_once()` invocations for the three workers (cron/systemd/apscheduler — operator's choice; the workers are idempotent so the scheduler is interchangeable). `.env` never committed. |

**No other infrastructure is required for Phase 1.** There is no separate queue broker, no Redis, no Edge
Functions: Postgres *is* the queue, the workers *are* the compute.

### Phase 0 gate (must pass before anything real)

Azure app + 1 Outlook account via OAuth + 1 test send + 1 test poll — a full loop on a test lead with no
campaign involved. Tracked in `docs/PHASE_0_CHECKLIST.md`. No build phase starts until this passes.

### The 10 acceptance tests (must pass before the first real campaign)

1. Spam-check fail ⇒ no send, reason visible in Queue.
2. Suppressed lead ⇒ no send from any account.
3. Paused account ⇒ queue skips it; its load is not redistributed.
4. Duplicate send attempt ⇒ idempotency key blocks it.
5. Token expiry ⇒ account `disconnected` + alert; system does not crash.
6. Reply arrives ⇒ sequence stops on all accounts.
7. Bounce spike ⇒ auto-pause + system warning.
8. Kill-switch ⇒ pending sends halt.
9. Agency name change ⇒ templates update themselves from `brand_config`.
10. Campaign switch ⇒ the other campaign's checklist/templates apply; no cross-campaign copy mixing.

---

## 13. Monitoring & observability

- **Health screen (dashboard):** per-account and system-level bounce / reply / placement / spam-complaint rates,
  weekly trends, next-week cap suggestions, warmup gate status.
- **Warmup Monitor:** per-account warmup day, placement scores, daily snapshots — the automated replacement for a
  manual warmup log.
- **Queue screen:** live view of scheduled sends with per-account gap accounting and plain-language blocked reasons.
- **Replies Inbox:** live via Realtime; positives pinned to the top for fast human response (reply speed is a
  meeting-rate lever).
- **Alerts table + self-email:** every significant event (positive reply, auto-pause, token disconnect, bounce spike,
  kill-switch activation) writes an `alerts` row and, for urgent ones, sends a self-email via Graph to the operator's
  personal address. No Telegram, no third-party push dependency.
- **Audit log (`sent_emails`):** the ground truth for "what exactly went out, approved by whom, when."
- **Weekly health review (operator routine, ~10 min):** one page per week — per-account health, bounce, reply,
  placement, next week's cap. This is the standing replacement for ad-hoc placement logging.

### Known observability limit

Inbox placement on personal Outlook accounts cannot be *proven* — only signaled (warmup score + seed tests +
bounce/complaint rates). The dashboard presents the gate as a signal (≥85%), never as a guarantee.

---

## 14. Scalability — what breaks first, and the honest upgrade path

The system is queue-based and async by design, so scaling is a matter of accounts and cadence, not re-architecture.
But the free tiers have real ceilings:

| Ceiling | What happens | Honest upgrade path |
|---|---|---|
| Supabase Free (rows, API calls, Realtime) | Poll cadence + queue writes grow with accounts × leads | Stay inside free limits in Phase 1 (low volume by design); paid Supabase tier only when client revenue exists |
| Vercel Hobby | Single-operator dashboard is far below limits | No action needed in Phase 1 |
| Microsoft Graph throttling | Staggered polling + per-account gaps are the mitigation | More accounts (rotation spreads load); never burst |
| Apollo/Hunter free credits | Sourcing throttles when credits run out | Grade A first; paid verification/sourcing budget comes from client revenue, not upfront |
| MillionVerifier 100 one-time credits | Verification runs out after 100 leads | Paid verification budget is a separate line item; never claim "verified list" beyond actual credits |
| Gemini/Groq free rate limits | Draft generation pauses under heavy use | Groq as fallback; drafts are batched to the daily 5-lead Launch cadence anyway |
| Operator time (30–45 min/day) | The binding constraint: Launch mode = 5 leads/day, one active campaign | Scale mode (10/day, multiple campaigns) only when 3+ accounts are ready and approvals batch cleanly |

**Backpressure design:** exponential-backoff retries, per-account circuit breakers, the kill-switch, and caps that
move down as well as up. The system degrades by *sending less*, never by sending recklessly.

---

## 15. Known limits & Phase 2

Stated plainly — these are scaffold realities, not roadmap promises:

1. **Reply matching is sender-email-based today.** Thread/conversation-ID-first matching (which also catches
   forwarded and team replies) is Phase 2.
2. **Reply classification is rule-based today.** Gemini/Groq AI classification replaces it in Phase 2, with human
   review retained for negative / unsubscribe / bounce.
3. **Token storage is env-var-based today** (`token_ref` → env var name). Supabase Vault references + refresh-token
   wiring are Phase 2.
4. **LinkedIn Day-5 touch is manual.** No automation is planned for it (LinkedIn limits/spam risk); it stays
   low-volume and human.
5. **Open rate is not measured** (no tracking pixel; plain-text emails). Reply rate is the real metric.
6. **Placement ≥85% is a signal, not proof** (see §13).

**Phase 2 (funded by client revenue, not upfront):** sending domains + M365 inboxes, thread-first matching, AI
classification, Vault token storage, paid verification budget, multi-campaign Scale mode, AutoMailer paid tier only
if its API/webhook proves necessary.

---

## Appendix A — Open decisions (listed, not resolved)

These are explicitly OPEN per the source specs. This document does not decide them:

1. **Agency brand name — TBD.** Lives in `brand_config` when chosen; propagates to templates automatically
   (acceptance test 9 covers this).
2. **Campaign 1 niche — final pick pending.** System supports dental / law / shopify / hvac / blank presets and
   cloning; Launch mode runs one active campaign at a time.
3. **Pricing — draft $1,500 setup + $300–500/month**, final call reserved.
4. **Demo asset + Cal.com link + LinkedIn headline — TBD.** First-campaign gate: none of these may be missing when
   the queue starts (brand config + demo + Cal.com link complete ⇒ queue may start).

## Appendix B — Source map

| This document's section | Authority |
|---|---|
| §§1–3, 5–9, 11–12, 14–15 | `LUMINA_V2_FIXED_SYSTEM.md` (v2.1 blueprint) |
| §4 (rotation/spam/health details), §9 flows | `LUMINA_MULTI_ACCOUNT_ROTATION.md` |
| §2 free stack, §6 integrations | `LUMINA_FREE_APPS.md` |
| Appendix A | `LUMINA_FLAWS_AND_OPEN_DECISIONS.md` (open decisions) |
| §4 scaffold layout, limits | `worker/README.md`, `docs/HYBRID_GUIDE.md`, repo README |

*End of document.*
