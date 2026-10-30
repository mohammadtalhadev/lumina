# Lumina — UI/UX Document

**Doc:** `04-UI-UX.md` · **Version:** 1.0 · **Date:** 2026-10-30
**System:** Lumina (INTERNAL name — dashboard + sending + warmup). Agency brand is **TBD**, lives only in the `brand_config` table, never hard-coded. No brand name is invented anywhere in this document.
**Authority:** `LUMINA_V2_FIXED_SYSTEM.md` (v2 blueprint), `LUMINA_MULTI_ACCOUNT_ROTATION.md`, `LUMINA_FREE_APPS.md`, `LUMINA_FLAWS_AND_OPEN_DECISIONS.md`, `HYBRID_GUIDE.md`, `worker/README.md`, `README.md`.
**Build status (honest):** Python worker scaffold is BUILT and tested (18/18 tests pass); Supabase migration 0001 is written, not yet run; Next.js dashboard UI is NOT built yet — this document is the build spec for it, and must be read alongside the 13 finalized Stitch screens ("Aurora Glass" light glassmorphism).

---

## 1. Design principles

1. **Operator-first.** The user is Mohammad Talha, a solo operator running this alongside a full-time job, with ~30–45 min/day. Every screen must answer one question in under 30 seconds: *"What needs me right now, and what is the one action?"* If a screen cannot answer that, it is wrong.
2. **Trust through transparency.** The system never hides why something happened. Every blocked email, paused account, and skipped queue item shows its exact reason in plain words ("2 links hain, is liye ruka") — never a black-box score.
3. **No fake data, ever.** Zero AI traces/filler: no demo badges, no fake live tickers, no invented KPIs. Empty states show "no data yet" rather than sample charts. Reply-rate percentages appear only after real sends exist; until then the number is blank with an honest label.
4. **Fail-safe by default.** Doubt blocks sending: unverified, suppressed, paused account, spam-check fail → the email stops and waits. The UI makes "stopped" as visible as "sent".
5. **Human gates first.** The FIRST 100 emails are human-approved — no auto-send. The UI must make the approval queue impossible to ignore and approvals possible from a phone.
6. **Config, not code.** Agency name, niche, offer, prices, templates, caps — all editable data. The UI never hard-codes a niche name ("dental", "law", "shopify", "hvac") or a brand name; all labels read from the active campaign / `brand_config`.

---

## 2. User journey — the solo operator's day (Launch mode, ~35–45 min)

Evening PKT (US morning) session, Monday–Friday:

1. **Morning checklist (Home, 2 min).** Open Home Today: 5 tasks only — replies, approvals, research batch, calls, onboarding. System health dot (green/amber/red). If anything is red, the reason is one tap away.
2. **Approve (10 min).** Approval queue: 5 AI drafts. Each shows lead context + spam-check result. Approve / Edit / Reject. Spam-fail drafts never leave this list — they never reach the queue.
3. **Research (15 min).** Kanban: pull 5 New leads, run the campaign's research checklist (~3 min each). Research done TODAY feeds TOMORROW's sends — halves daily load.
4. **Monitor (2 min).** Send Queue shows what the background is doing (gap, cap, rotation). No action needed unless something is blocked — then the reason is shown.
5. **Reply (10 min).** Replies Inbox: positives pinned on top. Reply from the SAME account that sent (reply continuity). One tap marks Busy / Price / Not Interested / Referral / Out-of-office; positive → Book Call (Cal.com).
6. **Calls/proposals (0–10 min, only on call days).** Calls screen: reminder, prep brief, ROI calculator. Proposals: 1-page draft → contract (scope, 2 revisions, extra $50/hour, ownership after full payment) → payment tracking (50% advance verified before work starts).

Everything else (gap enforcement, rotation, staggered 15-min polling, health scoring, alerts) runs in the background. Alerts arrive in two places only: the dashboard inbox and a self-email via Graph — NO Telegram.

---

## 3. Navigation

**Sidebar (locked Stitch decision):** NON-pill, full-height frosted glass panel, 16–24px corners, on an airy light canvas. 13 destinations, top-to-bottom in workflow order:

| # | Destination | Badge |
|---|---|---|
| 1 | Home Today | Health dot (green/amber/red) |
| 2 | Leads Kanban | Count of New leads |
| 3 | Lead Detail | — (opens from card; not in sidebar as a destination) |
| 4 | Replies Inbox | Count of unread positives (pulsing only if >0) |
| 5 | Sequences | — |
| 6 | Accounts & Rotation | Worst account status dot |
| 7 | Send Queue | Count of blocked items (amber if >0) |
| 8 | Campaigns | Campaign switcher lives here AND as a global top-bar dropdown |
| 9 | Deliverability Health | Amber/red if any threshold warning |
| 10 | Warmup Monitor | Count of accounts in warmup |
| 11 | Proposals & Clients | Count of active proposals |
| 12 | Calls | Count of upcoming calls |
| 13 | Settings & Brand | Warning if brand_config incomplete (gate) |

**Global top bar:** campaign switcher dropdown (filters Leads, Queue, Replies, KPIs to the active campaign), Launch/Scale mode indicator, and the **Kill-switch** (one tap stops ALL sending; pending queue items are cancelled, reason logged). Search is global (`/` focuses it): leads, accounts, emails.

**Badges rule:** a badge shows only a real number from the database. A zero is not shown; a missing signal shows nothing — never "0%" dressed up as a metric.

---

## 4. Screens

All 13 screens below are finalized in Stitch ("Aurora Glass" light glassmorphism). Each entry is the functional spec the Stitch visuals must support.

### 4.1 Home Today (Command Center)

- **Purpose:** the 30-second morning briefing. Exactly 5 tasks, no more.
- **Key elements:** 5 task cards (replies awaiting, approvals pending, today's research batch, upcoming calls, onboarding items); KPI row (leads, sent, reply rate, calls, proposals, won) — reply rate shown only when sends exist, blank + label before that; system health dot with the single worst issue named; kill-switch button (red, confirmed on tap); alerts feed (dashboard inbox).
- **Primary actions:** Approve, Reply, Research batch, Book call, Kill-switch.

### 4.2 Leads Kanban

- **Purpose:** the CRM. One board, one source of truth.
- **Key elements:** columns for the 8 active stages (New → Researched → Contacted → Replied → Call Booked → Proposal Sent → Negotiation → Won); Lost / Disqualified / Suppressed as a separate "Outcomes" tray (not columns); lead cards showing company, contact, grade pill (A/B/C), campaign tag, days in stage; campaign filter; "Grade A first" toggle; duplicate detection (same company across leads collapses into one card with a count); company-level 14-day frequency cap indicator.
- **Primary actions:** Add lead, import CSV, drag card to next stage (forward-only; backward moves require a logged manual correction), open Lead Detail.

### 4.3 Lead Detail

- **Purpose:** everything about one lead in one page.
- **Key elements:** research notes + pain signals (auto-filled signals from PageSpeed/tech/reviews/ads — user only verifies); campaign research checklist with checkboxes; timeline (every activity logged); AI draft with Approve / Edit / Reject buttons; spam-check result panel (pass/block/warn with the exact rule names); send history; reply history; grade selector (A/B/C per campaign grading rules); stage header with forward-only control.
- **Primary actions:** Approve draft, Edit draft, Reject draft, Add research note, Mark call outcome.

### 4.4 Replies Inbox

- **Purpose:** every reply, from every account, in one place. Positives on top.
- **Key elements:** list grouped by classification: Positive / Busy / Price / Not Interested / Referral / Out-of-office / Bounce / Unsubscribe. Positive replies pinned first with unread highlight. Each item shows lead name, classification, receiving account, time, and a link to the full thread — alerts carry only the lead name + reply type + link, NEVER the full body. Reply thread matching: thread/conversation ID first, sender email second (per the rotation spec fix). Out-of-office is never staged as "Replied".
- **Primary actions:** Reply (auto-selects the original sending account — `reply_from_account_id`; manual change shows a warning), Book Call, classification override (human review for negative/unsubscribe).

### 4.5 Sequences

- **Purpose:** per-campaign outreach plan, visible and editable.
- **Key elements:** per-campaign template set: Day 0 / 3 / 7 / 12 emails, Day 5 LinkedIn touch (manual, low-volume, no email pasting); stop-on-reply rule toggle (applies across ALL accounts); per-campaign checklist; template variables shown as `{{placeholders}}` (e.g. `{{pain_point}}`, `{{observation}}`); A/B test slot limited to ONE variable at a time.
- **Primary actions:** Edit template, Add step, Toggle sequence active, Run seed placement test on a new template.

### 4.6 Accounts & Rotation

- **Purpose:** every sending account's health at a glance; nothing hidden.
- **Key elements:** card per account: label (e.g. "Outlook 1 — Talha"), status pill (`warming` / `ready` / `cooling` / `paused` / `disconnected` / `banned_risk`), health score ring (0–100), today's cap progress (e.g. 7/20), warmup day counter, last placement test result, bounce/spam/reply 7-day rates, `paused_reason` in plain words when paused, Pause/Resume buttons, Add Account (OAuth) button.
- **Primary actions:** Add Account (Microsoft OAuth — passwords never in chat, form, or DB; token stored server-side only — env var via `token_ref` in the scaffold, Supabase Vault in Phase 2), Pause/Resume, Reconnect (on `disconnected`), View health trend.
- **Rules surfaced in UI:** unlimited user-added accounts; new accounts start `warming`, never `ready`; ramp 0 → 5 → 10 → max 20/day (personal Outlook) behind the 85%+ placement gate; caps can move DOWN on bad health (user manual cap-raise shows a warning); a disconnected account is skipped by the queue — its pending items are NOT redistributed (duplicate risk).

### 4.7 Send Queue

- **Purpose:** the single source of truth for what is sending, scheduled, or stopped.
- **Key elements:** today's scheduled sends in time order; each row shows lead, account picked by rotation, gap countdown, sequence step; BLOCKED items with the exact reason ("spam-check fail: 2 links", "account paused", "outside send window"); FAILED items with retry state (exponential backoff: 5 → 15 → 45 min → human review, never infinite); audit trail per send: exact text + approved-by + timestamp (immutable, per §14 P0).
- **Primary actions:** Cancel a queued item, Retry a failed item (within backoff), Kill-switch (global, in top bar).
- **Rules:** queue runs Mon–Fri US morning only (Tue–Thu preferred; DST difference shown in UI); approved emails are queued, never sent instantly.

### 4.8 Campaigns

- **Purpose:** niche-flexible container. The system never knows the niche name in code — this screen is where the niche lives as data.
- **Key elements:** campaign list; global campaign switcher; **New Campaign wizard** (name + niche → start from preset: dental / law / shopify / hvac / blank → or clone an existing campaign); comparison view (reply rate / meeting rate per campaign side by side — data-driven niche choice); per-campaign editors: ICP (with negative filters, e.g. no chains/DSOs), research checklist builder, pain taxonomy with weights, grading rules ("2+ pain signals + verified email = A"), enrichment toggles (reviews, speed, tech, booking, ads), templates, sequence timing, offer + pricing, discovery questions, proposal + onboarding templates, extra spam rules.
- **Primary actions:** New Campaign, Clone, Activate/Pause (Launch mode guardrail: activating a second campaign shows the warning "time doubles — pause the first or both run slow"), Edit any module, Run a test lead loop before activation.
- **Pre-campaign gate (locked):** `brand_config` complete + demo asset + Cal.com link — Queue does not start without them.

### 4.9 Deliverability Health

- **Purpose:** the numbers that decide whether sending continues.
- **Key elements:** per-account and system-level cards: bounce rate, reply rate, placement score, spam complaints; weekly trend sparkline from `account_health_daily`; next-week cap suggestion; threshold banners (bounce >2% warning / >5% auto-pause + system warning; spam complaint >0.1% warning / >0.3% system stop — per the rotation spec); audit of auto-pauses with reasons.
- **Primary actions:** Acknowledge a warning, drill into an account's daily snapshots, adjust cap (with the manual-raise warning).

### 4.10 Warmup Monitor

- **Purpose:** watch every account climb the ramp — no volume before readiness.
- **Key elements:** per-account warmup timeline (Day 1–7 warmup only, 8–14 placement test, 15–21 campaign at 5/day if 85%+ placement, 22–28 10/day, 29+ max 20/day); daily snapshot combining AutoMailer warmup score + seed placement test + bounce rate + complaints (the honest, measured gate — not a manual log); tasks for today (e.g. warmup sends to known contacts); placement gate status per account (pass/fail + next check).
- **Primary actions:** Log a manual warmup action, run a seed placement test, view score history.

### 4.11 Proposals & Clients

- **Purpose:** everything after "yes".
- **Key elements:** 1-page proposal drafts (from the campaign's proposal template); contract module: SOW with scope, 2 revisions, extra work $50/hour, ownership transfers only after full payment; e-signature option; **Payments module** (§14 P0): Payoneer/Wise invoice + payment link/status + 50%/50% tracking + overdue reminders — an `advance_paid` tick alone is not enough; clients table with onboarding checklist, `advance_verified_at`, `go_live_at`.
- **Primary actions:** Send proposal, Generate contract, Record payment, Start onboarding checklist.

### 4.12 Calls

- **Purpose:** the full call loop, closed.
- **Key elements:** Cal.com bookings list; discovery questions from the active campaign (clinics: patient booking, law: case intake); call prep brief auto-compiled from Lead Detail; reminders (24h + 1h); no-show → reschedule task; ROI calculator (tickets/week × minutes × hourly cost); outcome recording (won / lost / disqualified + note).
- **Primary actions:** Book call, Open prep brief, Record outcome, Reschedule no-show.

### 4.13 Settings & Brand

- **Purpose:** one place where everything configurable lives. One change = every template changes.
- **Key elements:** `brand_config`: agency name (TBD placeholder), founder name, postal address placeholder (CAN-SPAM footer), Cal.com link, LinkedIn headline, send window + timezone (US window with PKT/DST note); sending caps policy; suppression list manager (global — one suppression applies to all accounts); alert preferences (dashboard inbox + self-email; Telegram/ntfy optional); data export (weekly leads backup); audit log viewer.
- **Primary actions:** Save settings (renaming the agency updates all templates — acceptance test 9), Export leads, View audit log.
- **Validation:** agency name empty → warning banner on Home and a block on campaign activation; postal address empty → campaign send block (footer compliance).

---

## 5. User flows

### (a) Add lead → grade → approve email → send → reply detected → book call

1. Operator adds a lead (form or CSV import) → lead lands in Kanban column **New**; global email dedupe blocks duplicates.
2. Operator opens Lead Detail, runs the campaign's research checklist; auto-signals (PageSpeed, tech, reviews, ads) are pre-filled — operator only **verifies** them.
3. Operator sets grade (A/B/C) per the campaign's grading rules; Grade A leads queue first.
4. Operator clicks "Request draft" → AI (Gemini/Groq) writes a 3-line draft (minimum lead data sent; no invented numbers). Draft sits in the approval queue.
5. Spam-check runs automatically (Layer 1): BLOCK rules (unverified, suppressed, >1 link, shortener, attachment, ALL-CAPS/misleading subject, spam-trigger wording, >120 words, >1 CTA, missing unsubscribe/postal) or WARN (mild trigger word, near-length, Grade B/C).
6. If BLOCK → draft stays in approvals with the exact reason; operator edits and re-runs. If pass → draft moves to Send Queue, scheduled in the Mon–Fri US-morning window with per-account 10–15 min gap.
7. Send worker: eligibility filter (ready, cap left, gap ok, not suppressed, 14-day company cap) → weighted pick by health score → Graph send → audit row (exact text + approved-by + timestamp, immutable).
8. Poll worker (staggered, 15 min/account): reply matched by thread ID first, then sender → classification (Positive/Busy/Price/Not Interested/Referral/Out-of-office/Bounce/Unsubscribe; AI classification is Phase 2 — scaffold matches by sender first) → lead moves to **Replied**, sequence STOPS on all accounts.
9. Positive reply → alert (dashboard inbox + self-email: lead name + type + link only) → Replies Inbox top → operator replies from the SAME account (reply continuity; manual change warns) → books the call (Cal.com) → lead moves to **Call Booked**.

### (b) Connect sending account → warmup → placement gate → rotation

1. Accounts screen → Add Account → Microsoft OAuth (operator logs in themselves; password never in chat/form/DB; token stored server-side only — env var in scaffold, Vault in Phase 2).
2. On connect, system sends a test email to the operator's own seed inbox — Graph send proof on day one.
3. Account starts `warming`: warmup tasks appear in Warmup Monitor (daily warmup emails to known contacts + AutoMailer network). Campaign cap = 0 for days 1–14.
4. Placement tests run (AutoMailer score + seed list + Mail-Tester + bounce watch); daily snapshots land in Warmup Monitor.
5. Gate check (day 15+): 85%+ placement, <2% bounce, zero complaints → account becomes `ready`, cap 5/day → 10/day (day 22) → max 20/day (day 29, personal Outlook).
6. `ready` accounts enter the rotation pool; queue picks the highest health score eligible account per send.
7. Bad health moves the cap DOWN and can push the account to `cooling` — the UI shows why.

### (c) Account auto-pause → cooling → recovery

1. Health worker detects a breach: bounce >5% or spam complaints >0.3% (7-day window) → account auto-pauses immediately; queue skips it; dashboard banner + alert with the exact reason.
2. Paused account's pending queue items wait — they are NOT redistributed to other accounts.
3. Operator opens the account card: sees the breach data, the affected sends, and the recovery checklist (fix list/copy, re-run seed placement test).
4. After fixes, operator resumes → account enters `cooling` at a reduced cap → placement re-tests → on pass, climbs back to `ready` and normal caps.
5. Every step is logged in the audit log (who paused, who resumed, why).

### (d) Positive reply → proposal → client

1. Positive reply in Replies Inbox → operator replies within the session (reply speed matters) → books the call.
2. Calls screen: prep brief (from Lead Detail), discovery questions (campaign-specific), reminders 24h + 1h.
3. After the call: record outcome. Won-fit → proposal (1-page draft from campaign template) → send.
4. Accepted → contract module: SOW (scope, 2 revisions, $50/hour extra, ownership after full payment) + e-signature option.
5. Payments module: Payoneer/Wise invoice, payment link/status, 50%/50% tracking, overdue reminders. 50% advance VERIFIED before any work starts → client onboarding checklist → `go_live_at`.

### (e) First-100 human approval gate

1. Until 100 emails have been human-approved and sent, EVERY outbound email requires an explicit Approve tap — there is no auto-send path in the UI.
2. Home shows a persistent progress indicator ("Approved 34/100") until the gate clears.
3. After 100, auto-send remains OFF by default; it can only be enabled per campaign with a deliberate toggle + confirmation — and spam-fail / suppressed / out-of-window rules still block regardless.
4. The audit log records the approver on every send, forever.

---

## 6. Components

All components render in the "Aurora Glass" language: frosted-glass surfaces, full rounding, Space Grotesk headlines, Inter body. Zero AI traces/filler anywhere.

| Component | Use | States |
|---|---|---|
| **Lead card** | Kanban | grade pill A/B/C, campaign tag, days-in-stage, duplicate count badge; dragging |
| **Pills/badges** | Statuses everywhere | `warming` (amber), `ready` (green), `cooling` (amber pulse), `paused` (red), `disconnected` (grey), `banned_risk` (dark red); stage pills; classification pills; spam result pills (pass/block/warn) |
| **Kanban board** | Leads | columns per stage; outcome tray; empty column = "No leads here yet" (never sample cards) |
| **Tables** | Queue, accounts, health, suppressions | sortable; row actions; blocked rows carry a reason column, never just a red dot |
| **Health rings** | Accounts & Rotation, Health | 0–100 ring, color from score; shows the 7-day bounce/reply/complaint trio on hover/tap |
| **Toggles** | Stop-on-reply, auto-send, enrichment signals | confirm dialog on high-risk toggles (auto-send, kill-switch) |
| **Checklists** | Research, onboarding, recovery, pre-campaign gate | checkbox with owner + timestamp; gate checklists block their action until complete |
| **Alerts feed** | Home, top bar bell | dashboard inbox: replies, approvals, health warnings, payment reminders; read/unread; deep-links to the exact item |
| **Countdown chips** | Send Queue | "next send in 8 min (Outlook 2)" — honest, from real schedule |
| **Progress bar** | First-100 gate, warmup | real numerator/denominator, never animated filler |

---

## 7. Interactions

- **Hover:** cards lift slightly and reveal secondary actions (open, edit, pause); destructive actions never hover-only — always also reachable by tap/click.
- **Kanban drag:** drag a card to the next column → optimistic update → server confirms via Realtime; on conflict (stage moved elsewhere) the card snaps back with an inline notice. Backward moves are blocked with an explanatory tooltip ("stages only move forward — log a manual correction instead"), which opens the correction dialog.
- **Optimistic updates via Realtime:** queue counts, reply arrivals, health changes push live; every optimistic change shows a subtle "syncing" state and rolls back visibly on failure.
- **Confirmations for destructive actions:** kill-switch, account removal, suppression, proposal send, campaign activation — all require an explicit confirm dialog stating what will happen ("12 queued emails will be cancelled").
- **Approvals are one-tap but deliberate:** Approve / Edit / Reject are large targets; Approve on mobile is a full-width button at the bottom of the draft sheet.
- **Toasts:** success/warning/error toasts with a link to the affected item; never auto-dismiss errors before the user can read them (errors persist until dismissed).
- **Deep links:** every alert, badge, and toast links to the exact record (approval → draft sheet; positive reply → thread; blocked queue item → reason).

---

## 8. Forms & validation

### Add Lead
Fields: company*, contact name*, email*, campaign* (defaults to active), source, research notes. Validation: email format; global duplicate email → hard block ("already a lead in Campaign X — view it"); unverified email → allowed but flagged WARN and blocked from queue until verified.

### Import CSV
Template download; per-row preview with errors highlighted; duplicates skipped with a count; only verified rows become queue-eligible.

### Connect Account (Add Account)
No form fields for credentials — a single "Connect with Microsoft" OAuth button. Label field optional after connect. Validation: token refresh fail → `disconnected` status + reconnect prompt; never a password field anywhere.

### Campaign Builder (New Campaign wizard)
Steps: 1) name + niche → 2) preset or clone → 3) ICP (with negative filters) → 4) checklist builder → 5) pain taxonomy + weights → 6) grading rules → 7) templates (Day 0/3/7/12) → 8) offer + pricing → 9) discovery questions → 10) proposal/onboarding templates → 11) test-lead loop. Validation: cannot activate with empty templates, missing offer, or incomplete `brand_config`; test-lead loop must pass (add → grade → approve → spam pass → send → simulated reply → stage move) before activation.

### Settings & Brand
Fields: agency name (TBD allowed, warns), founder name, postal address*, Cal.com link*, LinkedIn headline, send window + timezone, caps policy. Validation: postal address or Cal.com missing → campaign activation blocked with the exact missing item named; agency name change → confirm dialog listing affected surfaces (signatures, templates, booking page, proposals, alerts).

---

## 9. Loading / error / empty states

| Area | Loading | Error | Empty |
|---|---|---|---|
| Home | Skeleton of 5 task cards | "Couldn't load tasks — retry" | "All clear. No tasks waiting." |
| Kanban | Column skeletons | Board error with retry | "No leads here yet" per column; zero sample cards |
| Replies | List skeleton | Poll failed banner + last-successful time | "No replies yet — first replies land here" |
| Send Queue | Rows skeleton | Worker error with the failing step named | "Queue is empty — approved emails appear here" |
| Accounts | Card skeletons | Graph disconnect shown as `disconnected` with Reconnect | "No sending accounts — add your first" |
| Warmup | Timeline skeleton | Test failed → reason + rerun | "No accounts warming" |
| Health | Card skeletons | Snapshot missing → "last good snapshot: <time>" | Blank metrics with "no sends yet" labels — never 0% dressed as data |
| KPIs | — | — | Percentages blank until real sends exist |

**Global:** a connection-loss banner (Supabase Realtime drop) with auto-retry; token/auth errors route to a clean re-login, never a dead screen.

---

## 10. Responsive behavior

Desktop-first (the operator works evenings on a laptop), but **mobile approvals are a P0 requirement** (v2 §14): approvals and positive replies must work from a phone, and alert links must open straight onto the approval — no login maze.

- **≤1024px:** sidebar collapses to an icon rail with badges preserved; kanban columns become a horizontal swipe strip; tables become stacked cards; health rings keep size, text shrinks.
- **≤640px:** icon rail becomes a bottom bar with 5 destinations (Home, Replies, Approvals, Queue, Accounts); approval drafts open as a full-screen bottom sheet with a sticky Approve/Edit/Reject bar; the campaign switcher moves into the top bar; kill-switch stays reachable (top bar, behind one confirm).
- **What never collapses away:** badge counts, the kill-switch, the first-100 progress, blocked-item reasons, and the reply-continuity account selector.
- **Touch:** all primary actions ≥44px targets; drag on kanban falls back to a "Move to…" picker on touch.

---

## 11. Accessibility

- **Contrast:** body text on frosted surfaces meets WCAG AA (dark slate on light glass; status pills pair color with text labels, never color alone).
- **Focus:** visible focus rings on every interactive element; logical tab order matching visual order; skip-link to main content.
- **Keyboard:** `/` focuses global search; `g h` Home, `g r` Replies, `g q` Queue; `j/k` move through lists; `Enter` opens; `a` approve / `e` edit / `x` reject inside the approval sheet; `Esc` closes sheets/dialogs; a `?` shortcut overlay lists them.
- **Screen readers:** live region announces Realtime arrivals ("New positive reply from …"), queue status changes, and health warnings; icon-only buttons carry labels; kanban columns expose stage names and counts.
- **Reduced motion:** `prefers-reduced-motion` disables glass animations, card lifts, pulsing badges, and optimistic transitions — state changes appear instantly with no animation.
- **Motion honesty:** no decorative animation that implies activity (no fake spinners on instant actions, no animated "live" indicators on static numbers).

---

## 12. Typography / color / spacing tokens

Locked from the Stitch "Aurora Glass" direction (final):

| Token | Value | Use |
|---|---|---|
| Headlines | **Space Grotesk**, 600/700 | Page titles, card titles, numbers that matter |
| Body | **Inter**, 400/500/600 | Everything else; tabular numerals for counts |
| Primary | `#7C6CFF` (violet) | Primary actions, active states, links |
| Accent 2 | `#22D3EE` (cyan) | Info, secondary highlights, Realtime "live" marks |
| Accent 3 | `#F472B6` (pink) | Tertiary highlights, warm emphasis |
| Canvas | Airy light (near-white with a cool tint) | Page background |
| Surface | Frosted glass (white, ~60–70% blur) | Cards, sidebar, sheets |
| Success | Green (AA on light) | `ready`, pass, positive |
| Warning | Amber (AA on light) | `warming`, `cooling`, warn |
| Danger | Red (AA on light) | `paused`, block, kill-switch |
| Neutral | Slate greys | Secondary text, disabled, `disconnected` |
| Radius | Full rounding (cards/chips), **16–24px sidebar corners** | Per locked Stitch spec |
| Spacing | 4px base scale (4/8/12/16/24/32) | Gaps, padding, stack rhythm |
| Type scale | 12 / 14 / 16 / 20 / 24 / 32 | Caption / body / title / headline |

**Rules:** brand appears only as "TBD" / "Your Agency" until set in `brand_config`; niche names appear only as data labels from the active campaign; no lorem ipsum anywhere — every placeholder is an actionable empty state.

---

## 13. Content rules

1. **Honest numbers only.** A metric shows only from real data. No sends → blank + "no sends yet", not 0%. No invented reply rates, placements, or client results in drafts (AI drafts are checked for unverified claims).
2. **TBD, never invented.** Agency name, founder, address, Cal.com link, demo asset: shown as TBD with a completion warning — never a made-up name.
3. **Exact reasons, plain words.** Every block, pause, skip, and fail names its rule in operator language, visible in the list — never behind a tooltip or a code.
4. **Privacy in alerts.** Alerts carry lead name + reply type + dashboard link only; full email bodies never leave the dashboard (CAN-SPAM footer with unsubscribe line + postal address on every send; opt-out honored within 10 days; suppression is global across all accounts).
5. **One active campaign (Launch mode).** The UI enforces the guardrail: activating a second campaign warns "time doubles — pause the first or both run slow."
6. **Audit everything.** Every send (exact text + approver + timestamp), every stage correction, every pause/resume, every setting change — immutable and viewable.

## Open decisions (NOT decided here — listed as OPEN)

From `LUMINA_FLAWS_AND_OPEN_DECISIONS.md` and v2 §12, surfaced in the UI as TBD where relevant:

1. **Agency brand name: OPEN (TBD).** Lives in `brand_config` only; UI shows TBD / Your Agency.
2. **Campaign-1 niche final pick: OPEN.** System supports dental / law / shopify / hvac / blank presets + cloning; the pick happens at build start.
3. **Pricing: OPEN.** Draft is $1,500 setup + $300–500/mo; final call pending; proposal/offer editors hold the draft.
4. **Demo asset + Cal.com link: OPEN.** Both are pre-campaign gates — Queue cannot start until they exist.

## Traceability to the 10 acceptance tests (v2 §11)

| # | Test | UI surface |
|---|---|---|
| 1 | Spam-check fail = no send, reason visible | Send Queue blocked row + Lead Detail spam panel |
| 2 | Suppressed lead = no send, any account | Suppression manager + blocked queue row |
| 3 | Paused account skipped, load not redistributed | Accounts card + Queue shows waiting items |
| 4 | Duplicate send blocked by idempotency | Queue dedupe + audit log |
| 5 | Token expire = disconnected + alert | Account card `disconnected` + Reconnect |
| 6 | Reply = sequence stop, all accounts | Replies Inbox + sequence status |
| 7 | Bounce spike = auto-pause + warning | Health banners + account card |
| 8 | Kill-switch stops pending sends | Top-bar kill-switch + confirm dialog |
| 9 | Agency rename updates templates | Settings confirm dialog + template preview |
| 10 | Campaign switch uses the right modules | Campaign switcher + comparison view |
