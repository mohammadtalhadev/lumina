# Lumina Worker Service (Python engine)

Hybrid ka Python hissa: queue, rotation, spam-check, polling, health.
Supabase = ghar (data/auth), ye = engine (kaam).

## Setup

```bash
cd worker
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env   # values bharo — .env kabhi git me nahi
```

## Run

```bash
# Tests (hamesha pehle)
.venv/bin/pytest -q

# API server
SUPABASE_URL=... SUPABASE_SERVICE_KEY=... .venv/bin/uvicorn app.main:app --reload
# docs: http://127.0.0.1:8000/docs
```

## Structure

```
app/
  config.py      → .env se settings (keys code me nahi)
  db.py          → Supabase REST layer (thin, service key sirf yahan)
  models.py      → Pydantic schemas (data ki shapes)
  main.py        → FastAPI endpoints (remote control)
  services/
    rotation.py  → eligible? best kaunsa? (pure, tested)
    spamcheck.py → pre-send checklist (pure, tested)
    graph.py     → Microsoft Graph client (send + inbox)
    health.py    → score + auto-pause + cap suggest (pure)
    notify.py    → alerts: dashboard row + self-email
  workers/
    send_worker.py   → queue → spam → rotation → send → audit
    poll_worker.py   → inbox poll → classify → stage → stop-on-reply
    health_worker.py → daily checkup → score → pause/cool → cap
tests/
  test_rotation.py (8) · test_spamcheck.py (10)
```

## Notes

- Tokens: scaffold me `sending_accounts.token_ref` ek ENV VAR ka naam hai;
  production me Supabase Vault ka reference hoga.
- Poll worker me thread-first matching Phase 2 me aayegi (scaffold: sender match).
- AI classification (Gemini/Groq) Phase 2 me `poll_worker.classify` ki jagah legi.
