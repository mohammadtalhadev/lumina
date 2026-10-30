# Lumina — Development Plan & Roadmap

**Document:** 05-DEVELOPMENT-PLAN.md
**Date:** 2026-10-30
**Status:** Living plan — updated as phases complete. Open decisions stay OPEN until the operator decides them.
**Authority:** This plan is derived from `LUMINA_V2_FIXED_SYSTEM.md` (master blueprint, v2 + §14 + §15), `LUMINA_MULTI_ACCOUNT_ROTATION.md` (rotation, ramp, health rules), `LUMINA_FREE_APPS.md` (free stack), `LUMINA_FLAWS_AND_OPEN_DECISIONS.md` (flaw traceability + open decisions), the hybrid build docs (`~/workspace/lumina/docs/HYBRID_GUIDE.md`, `~/workspace/lumina/README.md`, `~/workspace/lumina/worker/README.md`), and the 13 finalized Stitch screens ("Aurora Glass").

**Non-negotiable names:**
- **Lumina** = the internal system name (dashboard + sending + warmup stack). Locked.
- **Agency brand** = TBD. Lives only in the `brand_config` table, never hard-coded, never invented anywhere in code or docs.
- **Design tokens:** Space Grotesk + Inter; violet `#7C6CFF` / cyan `#22D3EE` / pink `#F472B6`.

---

## 0. Context in one paragraph

Lumina is a solo-operated client-acquisition system for Mohammad Talha, run alongside a full-time job at **30–45 minutes per day**. It is fully niche-flexible: the niche is data, not code (per-campaign ICP, templates, pricing; presets dental/law/shopify/hvac/blank + cloning; one active campaign at a time in Launch mode). First niche: US dental clinics, then law firms — Campaign 1 pick is still OPEN. The engine sends via **Microsoft Graph from Outlook**, detects replies by **polling Graph every 15 minutes (staggered)**, and rotates across **unlimited user-added personal accounts** (Microsoft OAuth only, never passwords; ramp 0 → 5 → 10 → max 20/day/account; weighted rotation by health; auto-pause on bounce > 5% or spam complaints > 0.3%; 85%+ placement gate before any campaign sending; global suppression list; same-account reply continuity). Phase 1 runs on a **$0 cash stack**: Next.js + Vercel Hobby, Supabase Free, Python FastAPI workers (stateless; all state in Supabase), Cal.com free, Apollo/Hunter free tiers, MillionVerifier 100 one-time free credits, AutoMailer free (warmup network only), Gemini/Groq free. Alerts = dashboard inbox + self-email via Graph (NO Telegram). First 100 emails are human-approved — no auto-send. Realistic first client close: 12–16 weeks. Payments, contracts, and thread-first reply matching are Phase 2 items, not MVP.

---

## 1. Where we are TODAY (2026-10-30)

An honest snapshot. A box is checked only when a result says it finished, not when it was started.

### ✅ DONE

| Item | Evidence |
|---|---|
| Master blueprint v2 (fixed system) | `LUMINA_V2_FIXED_SYSTEM.md` — single dashboard, queue-based sending, rotation, spam checks, suppression, circuit breaker, idempotency, niche-flexible campaign design (§15), missing-P0 additions (§14), 10 acceptance tests, Phase 0–4 plan |
| Multi-account rotation spec | `LUMINA_MULTI_ACCOUNT_ROTATION.md` — unlimited accounts, per-account ramp, weighted pick, staggered polling, 3-layer spam checking |
| Free-stack selection | `LUMINA_FREE_APPS.md` — $0 Phase 1 stack documented, paid/trial traps excluded |
| Flaw traceability + open decisions | `LUMINA_FLAWS_AND_OPEN_DECISIONS.md` — F1–F18 fixes mapped, open decisions listed as OPEN |
| Hybrid repo scaffold | `~/workspace/lumina/` — git repo under his identity |
| Supabase migration 0001 | `supabase/migrations/0001_lumina_core.sql` — 19 tables, RLS on (policy `lumina_owner_all`), idempotent, seeds `brand_config` + 5 campaign templates |
| Python worker service | `worker/` — FastAPI remote control; services (rotation, spamcheck, graph, health, notify); 3 workers (send, poll, health) |
| Worker tests | **18/18 passing** — `tests/test_rotation.py` (8) + `tests/test_spamcheck.py` (10) |
| Hybrid teaching guide | `docs/HYBRID_GUIDE.md` — every concept explained with real-life analogies |
| 13 dashboard screens designed | Google Stitch project `15198005074107615464` ("Aurora Glass" light glassmorphism; sidebar non-pill full-height frosted; Space Grotesk + Inter; no AI traces): Home Today, Leads Kanban, Lead Detail, Replies Inbox, Sequences, Accounts & Rotation, Send Queue, Campaigns, Deliverability Health, Warmup Monitor, Proposals & Clients, Calls, Settings & Brand — v4 QA passed |
| Daily workflow fit | Launch mode = 5 leads/day, ~35–45 min/day routine defined (replies 10 min + approvals 10 min + research 15 min) |
| Honest numbers | Funnel 500 emails → ~20–25 replies → ~6–8 calls → ~3–4 proposals → 1 close; proposal-to-close 25% (not 50–100%); no invented metrics |
| Deliverability policy | Plain-text emails, 1 link max, pixel removed, open rate NOT a KPI (reply rate is the real metric) |

### ❌ NOT DONE

| Item | Owner | Why it matters |
|---|---|---|
| Supabase migration run on the LIVE project | Operator (user-side) | No database exists yet; everything below depends on it |
| Azure app registration + Outlook OAuth tokens | Operator (user-side, secure route, never in chat) | Graph send/poll cannot work without this; password never used |
| Worker `.env` filled | Operator (user-side) | Workers need `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, token var names |
| Phase 0 proof (1 test lead → send → reply detected → alert) | Operator + assistant | The gate that authorizes all dashboard work |
| Next.js dashboard (M1–M6) | Assistant (build) | The main remaining development phase |
| AI draft + classification (Gemini/Groq) | Phase 2 | Scaffold notes it as Phase 2 (`poll_worker.classify` placeholder) |
| Thread-first reply matching | Phase 2 | Scaffold matches by sender email today (per worker README) |
| Supabase Vault token storage | Phase 2 | Scaffold uses env var names; Vault wiring is later |
| Payments module, contract module, audit log, mobile approvals, call reminders, unsubscribe page, automated research signals | Phase 2 (§14 P0 additions) | Blueprint-locked, not MVP |
| Open decisions resolved | Operator | Brand name, Campaign-1 niche, pricing ($1,500 setup + $300–500/mo draft), demo asset + Cal.com link — all OPEN |

---

## 2. Phase 0 — Proof gate (user-side, ~1 day)

**Purpose:** Prove the riskiest link first — Microsoft Graph on a personal account — before a single line of dashboard code is written. If Graph fails here, the plan changes before effort is wasted. This phase is deliberately small: ~1 day, operator-led, assistant-supported.

### Steps

1. **Create Supabase project** (operator, own account) → run `0001_lumina_core.sql` in the SQL Editor → run the verification queries. Expected counts: **1** brand_config row (placeholder), **5** campaign template rows, **19** tables.
2. **Azure app registration** (operator, own Microsoft account): delegated permissions `Mail.Send` + `Mail.Read`; user consent in the live browser.
3. **OAuth connect** one Outlook account → token lands in the worker `.env` as `GRAPH_TOKEN_ACC1` (env var name per scaffold; Vault comes in Phase 2). No password is ever typed into a form, chat, or database.
4. **Insert 1 test lead** (a lead the operator controls) → run one send cycle: `POST /workers/send/run` → verify the email arrives in the test inbox.
5. **Reply to the test email** → wait one 15-minute poll cycle (or run the poll worker once) → verify the reply is detected, classified, and an alert (dashboard inbox row + self-email) is received.

### Dependencies

- Nothing else. Phase 0 has no code dependencies — it consumes only the already-built worker scaffold and migration.

### Definition of Done — Phase 0

- [ ] Verification queries return 1, 5, 19 exactly.
- [ ] Test email DELIVERED to the operator's inbox.
- [ ] Reply DETECTED and classified by the poll worker.
- [ ] Alert RECEIVED (dashboard inbox row AND self-email).

**No "almost done."** If the reply is sent but not detected, or the alert never arrives, Phase 0 is FAIL and Phase 1 does not start. Phase 0 is the plan's circuit breaker.

---

## 3. Phase 1 — Dashboard build (the main development phase)

Target: the 13 Aurora Glass screens as a working Next.js app on the $0 stack, integrated with the worker scaffold, ending in Launch mode with the 10 acceptance tests green. Milestones are sequential — M2 needs M1's auth/tokens, M3 needs M2's reads, and so on. Each milestone carries its own Definition of Done.

**Cross-milestone rules (apply everywhere):**
- Data flows: dashboard reads/writes Supabase through RLS only; the service-role key never touches the frontend; Graph tokens never touch the frontend.
- Every write is an append or a forward stage move; stage moves backward only via logged manual correction (state-machine rule, v2 §5).
- No invented brand name — `brand_config.agency_name` renders the TBD placeholder until the operator sets it.
- No fabricated data anywhere: health scores, placement, reply rates render only real stored values.

### M1 — Project setup

**Scope:** Next.js (TypeScript) project scaffold; Supabase client wiring; Auth (single owner login); design tokens from Stitch (Space Grotesk + Inter, violet `#7C6CFF` / cyan `#22D3EE` / pink `#F472B6`); layout shell matching the Aurora Glass sidebar (non-pill, full-height, frosted); campaign switcher dropdown in the top bar (drives all campaign-scoped views).

**Dependencies:** Phase 0 PASS (live Supabase project must exist). Vercel Hobby project linked for previews.

**DoD — M1:**
- [ ] Owner can log in; unauthenticated users see nothing.
- [ ] Design tokens compile and match the Stitch palette exactly.
- [ ] Sidebar + campaign switcher render; switcher changes the campaign context used by data queries.
- [ ] Deployed to Vercel Hobby preview with zero console errors.

### M2 — Read screens

**Scope:** Home Today (command center: today's 5 tasks, KPIs, kill-switch button, system health green/amber/red), Leads Kanban (9 columns: 8 stages + Won/Lost/Disqualified outcomes; campaign + grade filters; company-level duplicate merging), Lead Detail (research notes, timeline, send/reply history), Deliverability Health (per-account + system bounce/reply/placement/spam trends, next-week cap suggestion), Warmup Monitor (per-account warmup day, placement test results, daily snapshot). All reads go through Supabase; Realtime subscriptions on `send_queue`, `replies`, and `account_health_daily` so screens update without refresh.

**Dependencies:** M1 (auth + tokens + layout).

**DoD — M2:**
- [ ] Each of the 5 screens renders real rows from Supabase; empty states show when tables are empty (no fake demo data).
- [ ] Kanban drag-and-drop moves a lead's stage forward and writes an `activities` row; backward moves require the manual-correction flow.
- [ ] Realtime update works: inserting a test `replies` row updates Home Today within seconds.
- [ ] Kill-switch button sets the global send halt and the Queue screen (M3) reflects it.

### M3 — Action screens

**Scope:** Send Queue (today's scheduled sends: which account, which gap, blocked reasons spelled out; approve/edit/reject), Replies Inbox (all accounts' replies in one place; classifications Positive/Busy/Price/Not Interested/Referral/Out-of-office/Bounce/Unsubscribe; positives sorted first; composer for replying from the ORIGINAL sending account — same-account reply continuity, manual change shows a warning), Sequences builder (per-campaign Day 0/3/7/12 templates, LinkedIn touch Day 5, stop-on-reply rule, per-campaign research checklist editor), Accounts & Rotation (per-account cards: status, health, today's cap like 7/20, warmup day, placement test, Pause/Resume, Add Account via OAuth).

**Dependencies:** M2 (reads + Realtime); worker service reachable (at least one send/poll cycle proven in Phase 0).

**DoD — M3:**
- [ ] Approving a draft creates a `send_queue` row with a unique idempotency key — never a direct send.
- [ ] Rejecting a draft records the reason in `activities`; spam-check-BLOCKED drafts stay out of the queue with the exact reason visible ("2 links — is liye ruka" style).
- [ ] Replying from the composer uses the original sending account by default; switching accounts shows the continuity warning.
- [ ] "Add Account" completes the Microsoft OAuth flow end-to-end; the new account appears as `warming` with cap 0.
- [ ] Pausing an account makes the queue skip it and shows the reason; its pending items are NOT reassigned to other accounts.

### M4 — Campaigns + Proposals/Clients/Calls + Settings/Brand

**Scope:** Campaigns (create from preset or clone an existing campaign; edit ICP, research checklist, pain taxonomy, grading rules, offer/pricing, templates, discovery questions, proposal + onboarding templates — all per-campaign data, zero code changes; campaign comparison view: reply rate/meeting rate per campaign), Proposals & Clients (1-page proposal draft, onboarding checklist, `advance_paid` verification flag, payment status per v2 §14), Calls (Cal.com bookings, discovery notes, outcomes), Settings & Brand (`brand_config` editor: agency name TBD, founder name, postal address placeholder, Cal.com link, LinkedIn headline, send window, caps — one change propagates to every template).

**Dependencies:** M3.

**DoD — M4:**
- [ ] A new campaign can be created from the `blank` preset and fully configured in under ~15 minutes with no code changes.
- [ ] Switching campaigns changes leads, queue, replies, and KPIs everywhere — no copy leaking from another campaign.
- [ ] Changing the agency name in Settings updates all email template previews automatically (no hard-coded name found in a repo-wide search).
- [ ] A proposal can be drafted, sent, and marked with advance-paid verification; the onboarding checklist unlocks only after verification.

### M5 — Worker ↔ dashboard integration

**Scope:** Dashboard triggers and surfaces worker state: run send/poll/health cycles on demand (remote-control endpoints), live worker status on Home, blocked-queue reasons rendered from `spam_checks`/`send_queue.status`, health auto-pause events surfaced as dashboard alerts + self-email, campaign Launch/Scale mode toggle, global send window (Mon–Fri US morning, PKT evening; Tue–Thu preferred) enforced by the queue.

**Dependencies:** M4; worker scaffold deployed somewhere it can run on schedule (cron or equivalent on the $0 stack).

**DoD — M5:**
- [ ] Triggering a send cycle from the dashboard produces the same result as the CLI path (parity, not a second implementation).
- [ ] A queue item blocked by spam-check shows the exact blocking rule on the Queue screen.
- [ ] An auto-paused account (simulated bounce spike) appears as paused with the reason, and the system warning alert is delivered.
- [ ] Emails approved outside the send window stay queued until the window opens.

### M6 — Launch mode (5/day, first-100 gate, acceptance tests)

**Scope:** Launch mode guardrails: one active campaign at a time (activating a second shows the bandwidth warning); daily target 5 new leads; **first 100 emails require human approval — no auto-send, no exceptions**; automated research signals feed research notes (PageSpeed/tech/reviews/ads) with the operator only verifying; then run the 10 acceptance tests.

**Dependencies:** M5. All open trust assets for Campaign 1 resolved by the operator (brand name, demo asset, Cal.com link — see §8 OPEN decisions).

**The 10 acceptance tests (all must pass, on real data):**
1. Spam-check fail = no send; the exact reason is visible on the Queue screen.
2. Suppressed lead = no send from ANY account.
3. Paused account = queue skips it; its load is NOT pushed onto others.
4. Duplicate send = idempotency key blocks it.
5. Token expiry = account goes `disconnected` + alert; the system does not crash.
6. Incoming reply = sequence stops on ALL accounts for that lead.
7. Bounce spike (simulated >5%/7d) = auto-pause + system warning.
8. Kill-switch = pending sends halt; none fire after the click.
9. Agency name change = all templates update with no manual edits.
10. Campaign switch = the second campaign's checklist/templates apply; no copy mixes with the first.

**DoD — M6 (and therefore MVP):**
- [ ] Launch mode guardrails enforced: second-campaign warning, 5/day target visible, first-100 approval gate blocks auto-send up to email #100.
- [ ] All 10 acceptance tests green, each with its evidence recorded (which test, which data, when).
- [ ] One end-to-end loop on a real lead: add → grade → research notes → draft → approve → spam-check pass → queue → send → reply detected → stage moved → sequence stopped → alert received — all inside one dashboard.

---

## 4. Phase 2 — Hardening (after first campaign is live)

Phase 2 starts only after MVP. These items are blueprint-locked but deliberately out of MVP scope.

| Item | What changes |
|---|---|
| Thread-first reply matching | Poll worker matches replies by conversation/thread ID first, sender email second; forwarded/team replies no longer missed; out-of-office never counts as Replied |
| AI classification (Gemini/Groq free) | Replaces the scaffold's placeholder classifier in `poll_worker.classify`; human approval still required before any send; negative/unsubscribe/bounce go to human review |
| Supabase Vault token storage | Token var names in `.env` become Vault references (`token_ref`); tokens never touch logs or the frontend |
| Refresh-token wiring | Token refresh failures move accounts to `disconnected` + reconnect alert (already specced, needs wiring) |
| Payments module | Payoneer/Wise invoice + payment link/status + 50%/50% tracking + overdue reminders (§14 P0.1) |
| Contract module | SOW template (scope, 2 revisions, extra $50/hour, ownership after full payment) + e-signature option (§14 P0.5) |
| Call loop completion | Reminders (24h + 1h), no-show reschedule task, call prep brief, ROI calculator (§14 P0.6) |
| Unsubscribe page + data deletion | Footer confirmation page, reason capture, suppression timestamp, data-delete request task (§14 P0.3) |
| Audit log | Immutable record of every sent email: exact text + approved-by + timestamp (§14 P0.7) |
| Mobile approvals | Approvals and positive-reply responses workable from a phone; alert links land on the approval directly (§14 P0.8) |
| Multi-campaign Scale mode | Multiple active campaigns each with own queue + cap, once accounts are ready and bandwidth allows (§15.4) |

---

## 5. MVP scope statement — what "shippable" means

**Lumina MVP = Phase 0 PASS + dashboard M1–M6 + 10 acceptance tests green.**

Concretely, MVP is shippable when:
- The operator can run the entire client-acquisition loop — lead in, research, draft, approve, queue, send, reply, call, proposal, advance-paid verification — inside one dashboard, in 30–45 min/day, without opening any other tool except the meeting itself (Cal.com).
- Sending is queue-based with rotation across the operator's OAuth-connected accounts, spam-checked before send, suppression-respecting, idempotent, stop-on-reply, and kill-switchable.
- The niche is fully data-driven: Campaign 1 (OPEN: dental or law) runs on its own ICP/checklist/templates/offer, and a second niche could be cloned without code changes.
- The first 100 emails are all human-approved; nothing auto-sends.
- No passwords anywhere; tokens server-side only; RLS on all tables; footer carries unsubscribe line + postal address placeholder; opt-out honored within 10 days.

**What MVP is NOT:** it is not payments/contract infrastructure, not AI classification, not thread-first matching, not mobile-optimized, not multi-campaign scale. Those are Phase 2 — explicitly deferred, not forgotten.

---

## 6. Dependencies & critical path

**Critical path (the sequence that gates everything):**
1. Operator: Supabase project + migration 0001 (verification: 1, 5, 19) → **Phase 0**
2. Operator: Azure app + Outlook OAuth → **Phase 0**
3. Phase 0 proof (send → reply → alert) → **authorizes M1**
4. M1 → M2 → M3 → M4 → M5 → M6 (each milestone's DoD gates the next)
5. Operator: resolves trust assets (brand name, demo asset, Cal.com link) → **authorizes first real campaign**

**Hard external dependencies (all free-tier, all operator-side):**
- Supabase Free project (operator's account) — database, Auth, RLS, Realtime.
- Azure app registration (operator's Microsoft account) — Graph delegated permissions.
- Vercel Hobby (operator's account) — dashboard hosting.
- Cal.com free booking page (operator's account) — linked in brand_config.

**Dependency risks to watch:**
- Graph delegated consent on personal Microsoft accounts is the single riskiest unknown — Phase 0 exists to surface it on day one.
- Supabase free-tier limits (rows, invocations, Realtime connections) bound polling frequency and table growth — the staggered 15-min poll and weekly lead export are the mitigations.
- Apollo/Hunter free credits and MillionVerifier's 100 one-time credits cap lead sourcing/verification — Grade A leads first, paid verification budgeted only after free credits are gone.

---

## 7. Risks & mitigations

| Risk | Likelihood / Impact | Mitigation (already in the blueprint) |
|---|---|---|
| **Supabase free-tier limits** (rows, function invocations, Realtime) | Medium / Medium | Staggered polling (no thundering herd); lean daily snapshots instead of raw event tables; weekly lead export as backup; stay under free quotas and monitor |
| **Microsoft Graph throttling / account locks** | Medium / High | Staggered per-account polling; per-account gap 10–15 min and daily caps; ramp table enforced (warming accounts cap 0); multi-account rotation so one lock never stops the system; kill-switch; NEVER the job or main personal account |
| **Warmup patience** (sending before ready kills deliverability) | High / High | Placement gate (85%+ before campaign sending); new accounts start `warming` with cap 0; cap moves DOWN on bad health, not just up; first-100 human approval gate |
| **Single-operator bandwidth** (30–45 min/day, full-time job) | High / Medium | Launch mode 5 leads/day; one active campaign guardrail; research batched a day ahead; AI drafts reduce writing time (Phase 2: classification); alerts carry only name + type + link so triage is fast |
| **Free-credit exhaustion** (Apollo/Hunter/MillionVerifier 100/Gemini rate limits) | Medium / Low | Grade A first; verification budget planned for after free credits; Gemini/Groq as mutual backups; no paid tool enters the plan before free credits are gone |
| **Unverified list poisoning deliverability** | Medium / High | Only verified leads enter the queue (Layer 1 spam check BLOCKs unverified); bounce >2% warns, >5% stops the system; suppression is global |
| **Scope creep into Phase 2** (payments, AI, mobile) | Medium / Medium | MVP definition is frozen in §5; Phase 2 list is explicit; new ideas go to Phase 2, not into M1–M6 |
| **Brand/name TBD blocking launch** | Low / Medium | Brand lives in one table; dashboard ships with the placeholder; the Campaign-1 trust gate (M6) is the only hard blocker, not the build |

---

## 8. Definition of Done — strict, per phase

The standing rule: **a phase is done only when every box in its DoD is checked with evidence. "Almost done" is not done.** Evidence means: the count returned (1/5/19), the email seen in the inbox, the reply row in the database, the alert on the phone, the test log, the screenshot of the green run.

| Phase | DoD summary | Evidence required |
|---|---|---|
| Phase 0 | Email delivered AND reply detected AND alert received | Inbox screenshot + `replies` row + alert in dashboard inbox and email |
| M1 | Auth + tokens + layout + deploy, zero console errors | Preview URL + login test + token audit |
| M2 | 5 read screens on real data + Realtime + kill-switch wired | Screen walkthrough on live Supabase rows |
| M3 | Approve→queue (idempotent), spam-BLOCKED stays out, OAuth add-account, pause semantics | Queue row + idempotency key + blocked-reason screenshot + pause test |
| M4 | Campaign clone/configure in ~15 min, no cross-campaign leaks, brand change propagates, proposal→advance flow | New test campaign + brand rename test |
| M5 | Worker parity via dashboard, blocked reasons surfaced, auto-pause surfaced, send window enforced | Triggered cycle log + off-window queue hold |
| M6 / MVP | Launch guardrails on, first-100 gate on, 10/10 acceptance tests green, full end-to-end loop on a real lead | Test evidence log (10 rows: test, data, timestamp) + end-to-end lead walkthrough |
| Phase 2 (each item) | Spec behavior live on real data with its own mini-DoD | Per-item acceptance note |

---

## 9. What is explicitly NOT in the plan (out of scope)

1. **No paid tools in Phase 1.** Instantly, Smartlead, Lemlist, Warmbox, Lemwarm, GlockApps, ZeroBounce, Apollo/Hunter paid tiers — none of these enter the build until free credits are exhausted AND the operator approves spend. Phase 2 paid items (domains, M365 inboxes) come from client revenue, not the operator's pocket.
2. **No Telegram.** Alerts are dashboard inbox + self-email via Graph. Telegram Bot API and ntfy.sh stay optional extras.
3. **No invented brand name.** The agency brand is TBD and lives only in `brand_config`. Nothing in code, templates, docs, or demos invents one.
4. **No fake data.** No demo leads, no invented metrics, no fabricated health scores or placement numbers. Empty states say empty.
5. **No auto-send before the first 100.** Human approval is the gate; the queue never bypasses it.
6. **No password-based auth anywhere.** Microsoft OAuth only; passwords never in chat, forms, databases, or logs.
7. **No Phase 2 features smuggled into MVP.** Payments, contracts, AI classification, thread-first matching, Vault, mobile approvals, multi-campaign scale — Phase 2, explicitly.
8. **No pixel tracking.** Emails are plain text; open rate is not a KPI. Reply rate is.
9. **No bulk sends to purchased/scraped lists.** Only verified leads enter the queue; `info@`/`support@` bulk sends are out.
10. **No second active campaign in Launch mode.** The one-campaign guardrail protects the operator's 30–45 min/day budget.

---

## 10. OPEN decisions (listed, NOT resolved)

Per the standing rule, these are the operator's calls. The plan does not decide them; it only records where each one gates the build.

1. **Agency brand name — OPEN.** Gates: M6 trust gate (first real campaign). Lives in `brand_config` when decided.
2. **Campaign-1 niche final pick — OPEN** (candidates: US dental clinics first, law firms second; system supports any). Gates: M6 (checklist/offer/templates lock for the first campaign).
3. **Pricing — OPEN** (draft on record: $1,500 setup + $300–500/mo). Gates: proposal template content (M4), not the build itself.
4. **Demo asset + Cal.com link + LinkedIn headline — OPEN.** Gates: M6 trust gate — no campaign queue starts without them (v2 F16).

---

## 11. Milestone map (at a glance)

```
TODAY            Phase 0 (user-side, ~1 day)         Phase 1 (dashboard)
─────────────    ────────────────────────────        ─────────────────────────────
18/18 tests      [ ] Supabase 0001 (1/5/19)          M1 setup: Next.js+Auth+tokens
13 screens       [ ] Azure app + OAuth               M2 read screens + Realtime
blueprint v2     [ ] .env filled                     M3 actions: queue/replies/
rotation spec    [ ] send → reply → alert            sequences/accounts
$0 stack                                           M4 campaigns/proposals/
NOT DONE:                                          calls/settings-brand
 live DB          ── gate ──                        M5 worker integration
 OAuth tokens                                       M6 launch mode + 10 tests
 dashboard                                          ── gate ──
 Phase 0 proof                                      MVP: shippable
                                                    Phase 2: hardening (later)
```

**Operating targets (unchanged from blueprint):** 5 leads/day Launch mode · 30–45 min/day · first close 12–16 weeks · reply rate >5% strong · bounce <2% aim / >5% stop · spam complaints <0.1% aim / >0.3% stop · placement 85%+ gate.

---

*End of 05-DEVELOPMENT-PLAN.md. Companion docs: 01 (blueprint v2), 02 (rotation), 03 (free apps), 04 (flaws + open decisions), HYBRID_GUIDE.md. Lumina is the internal system name; the agency brand stays TBD in `brand_config`.*
