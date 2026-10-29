"""
send_worker.py — queue se email bhejne wala mazdoor.

Simple me: ye ek "worker" hai — background me chalne wala kaam jo
insaan ke click ka wait nahi karta. Iska ek chakkar (run_once):
  1. Queue me se "bhejne ke liye tayyar" items uthao
     (status=queued, scheduled_at guzar chuka, attempts baqi)
  2. Har item ke liye, is tarteeb me:
     a. Idempotency check — ye email pehle to nahi bheja gaya?
     b. Lead suppressed to nahi? (suppression list)
     c. Spam check — fail to BLOCK, user ko wajah dikhegi
     d. Rotation se account chuno (eligible + sab se healthy)
     e. Graph se bhejo
     f. Audit log (sent_emails) + queue status=sent + account counters
  3. Fail ho to: attempts+1, backoff ke sath next_attempt_at set karo.
     3 fail ke baad status=failed + critical alert.

Koi bhi shak ho to RUKO, bhejo mat — yehi fail-safe usool hai.

Seekhne ke liye: ye "transactional outbox / queue consumer" pattern hai —
web request foran jawab de deta hai ("queue me daal diya"), aur bhari
kaam worker background me karta hai.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from ..config import settings
from ..db import SupabaseDB
from ..models import Account, Lead, QueueItem
from ..services import rotation, spamcheck
from ..services.graph import GraphClient, GraphError
from ..services.notify import raise_alert


def _account_token(account: dict) -> str | None:
    """
    Account ka Graph token lao.
    Scaffold me: token_ref ek ENV VAR ka naam hai.
    Production me: ye Supabase Vault ka reference hoga.
    """
    ref = account.get("token_ref") or ""
    return os.environ.get(ref) if ref else None


def _due_items(db: SupabaseDB, now: datetime, limit: int) -> list[dict]:
    rows = (
        db.table("send_queue")
        .select("*")
        .eq("status", "queued")
        .lte("scheduled_at", now.isoformat())
        .order("scheduled_at")
        .limit(limit)
        .all()
    )
    # attempts baqi hon ya next_attempt_at guzar chuka ho
    return [r for r in rows
            if r.get("attempts", 0) < settings.max_attempts
            and (not r.get("next_attempt_at") or r["next_attempt_at"] <= now.isoformat())]


def _fail(db: SupabaseDB, item: dict, error: str, now: datetime) -> None:
    attempts = item.get("attempts", 0) + 1
    if attempts >= settings.max_attempts:
        db.table("send_queue").eq("id", item["id"]).update({
            "status": "failed", "attempts": attempts, "error": error[:500]})
        raise_alert(db, "critical",
                    f"Queue item {item['id'][:8]} 3 dafa fail: {error[:120]}")
    else:
        backoff = settings.retry_backoff_minutes[min(
            attempts - 1, len(settings.retry_backoff_minutes) - 1)]
        db.table("send_queue").eq("id", item["id"]).update({
            "attempts": attempts, "error": error[:500],
            "next_attempt_at": (now + timedelta(minutes=backoff)).isoformat()})


def run_once(db: SupabaseDB, now: datetime | None = None) -> dict:
    """
    Ek chakkar chalao. Returns summary: {"sent": n, "blocked": n, "failed": n, "skipped": n}.
    """
    now = now or datetime.now(timezone.utc)
    summary = {"sent": 0, "blocked": 0, "failed": 0, "skipped": 0}

    items = _due_items(db, now, settings.max_sends_per_run)
    if not items:
        return summary

    accounts = [Account(**a) for a in db.table("sending_accounts").select("*").all()]
    suppressed = {s["email"].lower()
                  for s in db.table("suppressions").select("email").all()}

    for raw in items:
        item = QueueItem(**raw)

        # (a) Idempotency: ye idempotency_key pehle bheja gaya?
        already = db.table("sent_emails").select("id").eq(
            "queue_id", item.id).one()
        if already:
            db.table("send_queue").eq("id", item.id).update({"status": "sent"})
            summary["skipped"] += 1
            continue

        lead_row = db.table("leads").select("*").eq("id", item.lead_id).one()
        if not lead_row:
            _fail(db, raw, "lead nahi mila", now)
            summary["failed"] += 1
            continue
        lead = Lead(**lead_row)

        # (b) Suppression: globally mana kiya hua?
        if lead.email.lower() in suppressed:
            db.table("send_queue").eq("id", item.id).update({"status": "blocked"})
            db.table("spam_checks").insert({
                "queue_id": item.id, "result": "block",
                "blocked_reason": "suppression list me hai", "score": 100})
            summary["blocked"] += 1
            continue

        # (c) Spam check
        result = spamcheck.check_email(item.subject, item.body, lead, suppressed)
        db.table("spam_checks").insert({
            "queue_id": item.id, "result": result.result,
            "blocked_reason": "; ".join(result.reasons), "score": result.score})
        if result.result == "block":
            db.table("send_queue").eq("id", item.id).update({"status": "blocked"})
            summary["blocked"] += 1
            continue

        # (d) Rotation: best eligible account
        account = rotation.pick_account(accounts, now)
        if account is None:
            # koi account eligible nahi — item rehne do, agli dafa try hoga
            summary["skipped"] += 1
            continue

        # (e) Graph se bhejo
        token = _account_token(account.model_dump())
        try:
            if not token:
                raise GraphError("token missing — account dobara connect karo")
            GraphClient(token).send_mail(lead.email, item.subject, item.body)
        except GraphError as e:
            _fail(db, raw, str(e), now)
            summary["failed"] += 1
            continue

        # (f) Audit + counters
        db.table("sent_emails").insert({
            "queue_id": item.id, "lead_id": lead.id,
            "account_id": account.id, "to_email": lead.email,
            "subject": item.subject, "body": item.body,
            "approved_by": "owner"})
        db.table("send_queue").eq("id", item.id).update({
            "status": "sent", "sent_at": now.isoformat(),
            "account_id": account.id})
        db.table("sending_accounts").eq("id", account.id).update({
            "sent_today": account.sent_today + 1,
            "last_sent_at": now.isoformat()})
        # lead stage aage barhao (Contacted) — sirf pehle step par
        if item.sequence_step == 0:
            db.table("leads").eq("id", lead.id).update({"stage": "Contacted"})
        summary["sent"] += 1

    return summary
