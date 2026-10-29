"""
main.py — FastAPI app: worker ka "remote control".

Simple me: workers background me chalte hain, lekin kabhi kabhi humein
unhein haath se chalana ya dekhna hota hai ("abhi queue chalao",
"queue me kya hai?"). Ye chhoti si API wahi kaam karti hai —
browser ya curl se endpoints hit karo.

Endpoints:
  GET  /health              → service zinda hai?
  GET  /queue               → queue me kya pending hai
  POST /workers/send/run    → send worker ka ek chakkar abhi chalao
  POST /workers/poll/run    → poll worker ka ek chakkar abhi chalao
  POST /workers/health/run  → health worker ka ek chakkar abhi chalao
  GET  /alerts              → alerts (dashboard inbox)

Chalana:  .venv/bin/uvicorn app.main:app --reload
Phir kholo: http://127.0.0.1:8000/docs  (automatic API docs!)

Seekhne ke liye: FastAPI me har function ke upar `@app.get(...)`
ek "decorator" hai — matlab "ye function is URL par chalega".
Yehi REST API ka bunyadi idea hai: URL + HTTP method = kaam.
"""
from fastapi import FastAPI, HTTPException

from .config import settings  # noqa: F401  (config load ho, missing env par foran error)
from .db import SupabaseDB
from .workers import health_worker, poll_worker, send_worker

app = FastAPI(title="Lumina Worker Service",
              description="Queue, rotation, spam-check, polling aur health — hybrid ka Python engine")


def _db() -> SupabaseDB:
    try:
        return SupabaseDB()
    except Exception as e:
        raise HTTPException(status_code=500,
                            detail=f"Supabase config missing/ghalat hai: {e}")


@app.get("/health")
def health():
    """Service zinda hai? (monitoring tools isi ko ping karte hain)"""
    return {"ok": True, "service": "lumina-worker"}


@app.get("/queue")
def queue_list(status: str = "queued", limit: int = 50):
    """Queue me kya pending hai?"""
    rows = (_db().table("send_queue").select("*").eq("status", status)
            .order("scheduled_at").limit(limit).all())
    return {"status": status, "count": len(rows), "items": rows}


@app.get("/alerts")
def alerts_list(limit: int = 50):
    """Alerts inbox (dashboard wala hissa)."""
    rows = (_db().table("alerts").select("*").order("created_at", desc=True)
            .limit(limit).all())
    return {"count": len(rows), "alerts": rows}


@app.post("/workers/send/run")
def run_send_worker():
    """Send worker ka ek chakkar abhi chalao."""
    return send_worker.run_once(_db())


@app.post("/workers/poll/run")
def run_poll_worker():
    """Poll worker ka ek chakkar abhi chalao (sab accounts)."""
    return poll_worker.run_once(_db())


@app.post("/workers/health/run")
def run_health_worker():
    """Health worker ka ek chakkar abhi chalao (roz wala checkup)."""
    return health_worker.run_once(_db())
