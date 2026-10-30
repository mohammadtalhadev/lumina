# Lumina — Security Audit (Phase 1E)

**Date:** 2026-10-30 · **Scope:** `web/` (Next.js dashboard) + deploy config.
**Method:** static review + pattern scans + dependency bump. Every finding below
was either fixed in this pass or recorded as an accepted risk with a reason.

---

## 1. Dependencies

| Check | Result |
|---|---|
| `npm audit` | **Could not run** — the VM's egress policy blocks the npm audit endpoint (`403 policy_denied`). Documented, not hidden. **Action for deploy machine:** run `npm audit` / `npm audit fix` on a network where it works before `vercel --prod`. |
| Manual review | `next` bumped **14.2.18 → 14.2.35** (latest 14.2.x patch line; picks up upstream security fixes). No middleware in the app, so the known middleware-auth-bypass class does not apply. Remaining deps pinned or caret-locked; `package-lock.json` committed. |
| `papaparse` (new, CSV import) | Added at 5.5.3 (exact). Pure parser, no network, no eval — parses locally in the browser. Raw file bytes are never uploaded; only parsed row objects go to `/api/leads/import`. |

## 2. Secret handling

| Check | Result |
|---|---|
| Source scan (`eyJ…`, `sk-…`, `ghp_…`, `AKIA…` across `app/`, `lib/`, `components/`, excluding `.env.example`) | **Clean** — zero hits. |
| Git history scan (`git log -p -- web/` for key patterns; `.env`/`.env.local` in history) | **Clean** — no secrets ever committed; no `.env` files in history. `.gitignore` covers `.env*` (verified with `git check-ignore`). |
| `supabase-server` (service_role) imported in any `'use client'` file | **None** — the module itself imports `server-only` and throws if `window` exists, so misuse fails loudly at build/runtime, not silently. |
| `WORKER_URL` exposure | **Server-only.** `app/api/worker/[...path]/route.ts` is the single egress point; it reads `process.env.WORKER_URL` and **refuses with 500 if `NEXT_PUBLIC_WORKER_URL` is set** (loud misconfiguration guard). Whitelisted paths + fixed methods only; path-traversal segments rejected; 60s upstream timeout. |
| Client Supabase usage | `lib/supabase-client.ts` (anon key) is currently **not imported by any component** — all reads/writes go through API routes → service_role server-side. Anon key is the public-safe key by design; it is never used for privileged writes. |

## 3. Input validation

- **All 15 API routes** (`app/api/*/route.ts`) parse input through zod (`parseOrThrow` / `schema.parse` / `safeParse`) and return 400 on failure. Verified by scan — zero unvalidated routes.
- New `/api/leads/import`: per-row `safeParse` (invalid rows reported, not fatal), 500-row cap enforced server-side, emails lowercased before dedupe.
- New kanban drag-drop: `PATCH /api/leads/[id]` re-enforces the forward-only stage machine server-side (`canAdvanceStage`); client pre-check is UX only, never trust.
- UUID params validated with `uuidSchema` before any DB call.

## 4. Database / RLS

- Migration `0001_lumina_core.sql` enables RLS on all 19 tables with policy `lumina_owner_all` (verified present in the migration file).
- The dashboard's server path uses the **service_role** key, which bypasses RLS **by design** — this is the documented admin path for a single-operator internal tool (same trust model as the Python worker). It is never exposed to the browser.
- Honest-degradation: every server query goes through `safeQuery`; missing tables/env degrade to error states, never fake data.

## 5. HTTP headers (`next.config.js`)

SAMEORIGIN framing, `nosniff`, strict `Referrer-Policy`, DNS-prefetch off,
restrictive `Permissions-Policy`, `poweredByHeader: false`, `reactStrictMode`.
**Added this pass:** `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
— safe because Vercel serves HTTPS only (comment in config says to remove it if
ever served over plain HTTP).

## 6. Rate limiting (`middleware.ts`, new)

- 60 req/min/IP across `/api/*`, 429 with a human message on exceed.
- In-memory buckets, capped at 5000 entries with opportunistic cleanup.
- **Accepted limitation:** per-instance memory — on Vercel each serverless
  instance has its own buckets, so a distributed flood is only partially
  mitigated. Proper fix (Upstash Redis) is a Phase-2 task; for a
  single-operator dashboard this is the right cost/complexity trade-off.

## 7. Accepted risks (not fixed, on purpose)

1. `npm audit` couldn't run from this VM — run it on the deploy machine / CI before production.
2. In-memory rate limiter (see §6) — fine for one operator; Redis later.
3. Worker tokens via env vars (`GRAPH_TOKEN_ACC1`) — Supabase Vault wiring is Phase 2 (see ARCHITECTURE.md).
4. No WAF / bot protection beyond rate limiting — acceptable for an internal tool behind no public signup; revisit if the dashboard ever gets a public surface.
5. HSTS `preload` is declared — only submit to hstspreload.org after confirming the domain serves HTTPS everywhere (Vercel default: yes).

---

**Verdict:** no secrets leaked, no unvalidated inputs, no client-side privilege
escalation paths found. The two tooling gaps (npm audit endpoint, Redis limiter)
are documented above with owners and next steps.
