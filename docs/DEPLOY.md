# Lumina — Deploy Guide

**Do NOT deploy from this VM without the account owner.** Every step below that
touches an account (GitHub, Vercel) is the user's action. This doc is the exact
click path.

Architecture recap: **one Vercel project, two services** (`vercel.json` at repo
root) — **web** (Next.js dashboard, public) + **worker** (FastAPI, internal
only, reached via the `WORKER_URL` service binding) · **Postgres/Auth → Supabase**
(already live). Dashboard and worker stay in sync through Supabase. A Vercel
Cron hits `/api/cron/poll` every 15 min — no external scheduler needed.

Why Vercel services (senior call, 2026-10-31): one platform instead of two,
no 15-min sleep like Render free, faster cold starts. Trade-off: Hobby
serverless timeout is 60s — `max_sends_per_run` is set to **10** so every run
finishes with margin (Launch mode needs ~5/day anyway; the rest drains on later
runs, idempotently). Render remains a documented fallback (section D).

---

## A. Push the repo to GitHub (user, ~5 min) — DONE 2026-10-30

Repo: `mohammadtalhadev/lumina`, branch `main`. Deploy key `lumina-deploy`
(write access) is attached. Pushes continue with `git push`.

## B. Import to Vercel (user, ~10 min)

1. vercel.com → **Add New → Project** → import `mohammadtalhadev/lumina`.
2. **Root Directory:** leave as repo root (`.`). Do NOT set `web` — `vercel.json`
   at the root declares both services.
3. Vercel auto-detects the services (`web` = Next.js, `worker` = FastAPI).
4. **Environment Variables** — set these as **shared** (all services):
   | Variable | Value | Used by |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | web |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page → `anon` `public` key | web |
   | `SUPABASE_SERVICE_ROLE_KEY` | Same page → `service_role` key (**secret** — server only) | web |
   | `SUPABASE_URL` | Same as `NEXT_PUBLIC_SUPABASE_URL` | worker |
   | `SUPABASE_SERVICE_KEY` | Same `service_role` key (**secret**) | worker |
   | `GRAPH_TOKEN_ACC1` | Outlook OAuth access token (Phase 0 checklist) | worker |
   | `ALERT_EMAIL` | Your own email for alerts | worker |
   | `CRON_SECRET` | Any long random string (e.g. `openssl rand -hex 32`) | web (cron auth) |
   
   ⚠️ Do NOT set `WORKER_URL` yourself — the service **binding** injects it into
   `web` automatically. Setting it manually would override the binding.
   
   Copy values from your own `.env` files — never from chat.
5. **Deploy.** First build takes ~2–3 min (builds both services).
6. Verify: open the URL → sidebar loads → Leads page shows honest empty states
   (not crashes) if the migration hasn't been run yet.

## C. Scheduler — reply polling every 15 min (automatic)

Already configured in `vercel.json`:
```json
"crons": [{ "path": "/api/cron/poll", "schedule": "*/15 * * * *" }]
```
Vercel Cron hits `GET /api/cron/poll`, which forwards to the worker's
`/workers/poll/run` through the internal binding. The route checks
`CRON_SECRET`, so random internet traffic can't trigger it. No cron-job.org
account needed. Check **Vercel → Project → Crons** to see it listed after deploy.

## D. Fallback: worker → Render (only if Vercel services misbehaves)

If the FastAPI service gives trouble on Vercel, the Render path still works:
Render → **New → Blueprint** → repo (uses `worker/render.yaml`), set the four
worker env vars, then set `WORKER_URL` manually in Vercel env to the Render URL
(this overrides the binding) and disable the Vercel cron in favor of
cron-job.org → `POST https://<render-url>/workers/poll/run` every 15 min.
Free-tier note: Render sleeps when idle (~15 min); first request after sleep
takes ~30–60s. Acceptable for a 15-minute loop.

## E. Phase 0 proof loop (user + assistant)

Follow `docs/PHASE_0_CHECKLIST.md`:
1. Run migration `0001_lumina_core.sql` in Supabase SQL Editor → verify counts **1, 5, 19**.
2. Azure app + OAuth token → Vercel env (`GRAPH_TOKEN_ACC1`), redeploy.
3. Dashboard: add 1 test lead (your second email) → assistant triggers send worker.
4. Reply to the test email → cron picks it up within 15 min → reply appears in
   `/replies` + alert email arrives.

**Pass criteria:** email delivered, reply detected, alert received. Then Phase 1
Launch mode (5 leads/day, first 100 emails human-approved) can begin.

---

## Rollback

- **Vercel:** Deployments tab → previous deployment → **Promote to Production**
  (rolls back both services together).
- **Database:** migration `0001` is idempotent and additive — no destructive
  rollback needed. (Future migrations must ship with their own down-scripts.)
