# Lumina Web — Phase 1A foundation

Next.js 14 (App Router, TypeScript strict, Tailwind) dashboard shell for Lumina,
the solo-agency client-acquisition system. UI language: "Aurora Glass" light
glassmorphism (finalized in Google Stitch) — violet `#7C6CFF`, cyan `#22D3EE`,
pink `#F472B6`, Space Grotesk headlines + Inter body, frosted-glass surfaces,
full rounding, non-pill sidebar.

## Quick start

```bash
cd web
npm install
cp .env.example .env.local   # then fill in your Supabase values
npm run dev                  # http://localhost:3000
```

Useful scripts: `npm run build`, `npm run typecheck` (`tsc --noEmit`).

## Architecture

- **Supabase = state.** All reads/writes go through Supabase Postgres (19 tables,
  RLS on). Browser code uses the **anon key** only (`lib/supabase-client.ts`);
  the **service-role key** lives server-side only (`lib/supabase-server.ts`,
  guarded by `server-only` + runtime checks — it throws if a key looks
  client-exposed or is missing).
- **Python worker = background jobs.** Sending, reply polling (15 min/account),
  and health rollups run in `../worker/` (FastAPI), not here. The dashboard
  approves and observes; workers execute. All worker input is validated with
  zod (`lib/validate.ts`) before it touches the database.
- **Brand is TBD.** The UI shows "Lumina" + "Your Agency" only. The agency name
  lives in the `brand_config` table — never hard-code one.

## Deploy notes

- **Web → Vercel.** Set `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public) and `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY` (server-only env vars) in the Vercel project.
- **Python worker does NOT run on Vercel** (no long-lived processes). Run it on
  Render / Railway / a small VM as a persistent service, triggered via its HTTP
  endpoints (`POST /workers/send/run`, `/workers/poll/run`, `/workers/health/run`).
  It reads the same Supabase project, so web + worker stay in sync through the DB.
- **Supabase** hosts Postgres + Auth + Realtime (free tier).

## Security checklist (enforced)

- `.env*` git-ignored (root + `web/.gitignore`); `.env.example` has placeholders only.
- Security headers in `next.config.js` (SAMEORIGIN, nosniff, strict referrer).
- No secrets in client components; `server-only` import in server lib.
- TypeScript `strict`, no `any` leaks; zod validation for route inputs.
