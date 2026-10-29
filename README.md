# Lumina — Hybrid (Supabase + Python)

Solo agency ka client-acquisition system. Ek dashboard, $0 Phase 1,
job ke sath 30-45 min/day.

**Hybrid ka matlab:** Supabase = ghar (database, auth, security, live updates),
Python = engine (queue, rotation, spam-check, polling, health workers).

## Repo structure

```
lumina/
  docs/HYBRID_GUIDE.md      → seekhne wali guide (pehle ye parho!)
  supabase/migrations/      → database schema (0001, idempotent)
  worker/                   → Python FastAPI + workers service
    app/config.py           → settings (.env se)
    app/db.py               → Supabase layer
    app/models.py           → data shapes
    app/main.py             → API endpoints
    app/services/           → rotation, spamcheck, graph, health, notify
    app/workers/            → send, poll, health workers
    tests/                  → 18 tests, sab passing
```

## Status (2026-10-29)

- [x] v2 blueprint + flaws + rotation + free-apps docs (`~/workspace/your_files/lumina/`)
- [x] Supabase migration 0001 (19 tables, RLS, seed) — chalana baqi hai (tumhara project)
- [x] Python worker scaffold — rotation + spamcheck + health implemented + tested (18/18 pass)
- [x] FastAPI remote control (`/docs` par automatic docs)
- [ ] Phase 0: tumhara Supabase project + Azure app + Outlook OAuth (tum khud, password kabhi nahi)
- [ ] Phase 1: Next.js dashboard UI (Stitch designs ban rahe hain)

## Quickstart

```bash
cd worker
.venv/bin/pytest -q                       # tests
cp .env.example .env                      # values bharo
SUPABASE_URL=... SUPABASE_SERVICE_KEY=... .venv/bin/uvicorn app.main:app --reload
```

Poori guide: `docs/HYBRID_GUIDE.md`
