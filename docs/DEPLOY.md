# Lumina — Deploy Guide

**Do NOT deploy from this VM without the account owner.** Every step below that
touches an account (GitHub, Vercel, Render, cron-job.org) is the user's action.
This doc is the exact click path.

Architecture recap: **Next.js dashboard → Vercel** · **Python worker → Render**
(Vercel cannot run long-lived Python processes) · **Postgres/Auth → Supabase**
(already live). Dashboard and worker stay in sync through Supabase.

---

## A. Push the repo to GitHub (user, ~5 min)

1. On github.com, create an **empty** repo named `lumina` (no README, no license).
2. Tell the assistant "repo ready" — it will attach a deploy key and push:
   ```bash
   git remote add origin git@github.com:mohammadtalhadev/lumina.git
   git push -u origin main   # or master, matching local branch
   ```
3. After every phase, pushes continue the same way (`git push`).

## B. Dashboard → Vercel (user, ~10 min)

1. vercel.com → **Add New → Project** → import `mohammadtalhadev/lumina`.
2. **Root Directory:** `web` (the repo root is NOT the app — set this!).
3. **Framework Preset:** Next.js (auto-detected).
4. **Environment Variables** (all four; copy from your own `.env.local` — never from chat):
   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page → `anon` `public` key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Same page → `service_role` key (**secret** — server only) |
   | `WORKER_URL` | Render worker URL from step C (e.g. `https://lumina-worker.onrender.com`). Leave empty until then — the dashboard shows honest "worker not configured" states. |
5. **Deploy.** First build takes ~2 min.
6. Verify: open the URL → sidebar loads → Leads page shows honest empty states
   (not crashes) if the migration hasn't been run yet.

## C. Worker → Render (user, ~10 min)

Option 1 — Blueprint (fastest): Render → **New → Blueprint** → point at the repo.
`worker/render.yaml` in this repo defines the service (root `worker/`,
`pip install -r requirements.txt`, `uvicorn app.main:app --host 0.0.0.0 --port $PORT`).

Option 2 — Manual: Render → **New → Web Service** → repo `lumina`:
- **Root Directory:** `worker`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Plan:** Free

**Environment variables** (Render dashboard → Environment):
| Variable | Value |
|---|---|
| `SUPABASE_URL` | Same Supabase project URL as above |
| `SUPABASE_SERVICE_KEY` | `service_role` key (**secret**) |
| `GRAPH_TOKEN_ACC1` | Outlook OAuth access token (Phase 0 checklist) |
| `ALERT_EMAIL` | Your own email for alerts |

Free-tier note: Render sleeps the service when idle (~15 min). The cron below
wakes it; first request after sleep takes ~30–60s (cold start). Acceptable for
a 15-minute poll loop.

## D. Scheduler — reply polling every 15 min (user, ~5 min)

The worker does not run on a timer by itself. Use **cron-job.org** (free):

1. Create account → **Create cronjob**.
2. **URL:** `https://<your-render-url>/workers/poll/run`
3. **Method:** POST · **Schedule:** every 15 minutes.
4. Save. The poll worker checks inboxes, classifies replies, and raises alerts.

(Alternative: Vercel Cron hitting the same worker URL — same effect, one less
account. cron-job.org is documented because it's free with no card.)

## E. Phase 0 proof loop (user + assistant)

Follow `docs/PHASE_0_CHECKLIST.md`:
1. Run migration `0001_lumina_core.sql` in Supabase SQL Editor → verify counts **1, 5, 19**.
2. Azure app + OAuth token → Render env (`GRAPH_TOKEN_ACC1`).
3. Dashboard: add 1 test lead (your second email) → assistant triggers send worker.
4. Reply to the test email → cron picks it up within 15 min → reply appears in
   `/replies` + alert email arrives.

**Pass criteria:** email delivered, reply detected, alert received. Then Phase 1
Launch mode (5 leads/day, first 100 emails human-approved) can begin.

---

## Rollback

- **Vercel:** Deployments tab → previous deployment → **Promote to Production**.
- **Render:** manual deploy of any prior commit from the dashboard.
- **Database:** migration `0001` is idempotent and additive — no destructive
  rollback needed. (Future migrations must ship with their own down-scripts.)
