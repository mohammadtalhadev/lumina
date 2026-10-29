"""
health_worker.py — rozana sehat ka checkup (daily, ek dafa).

Simple me: har account ke pichle 7 din ke numbers uthao
(sent, bounce, replies, spam complaints, placement),
health.py se score nikalo, aur:
  - account_health_daily me aaj ki row daalo (trend ke liye)
  - sending_accounts ka health_score + status update karo
  - hard breach ho to auto-pause + critical alert
  - cap suggest karo (suggest_cap) aur daily_cap update karo

Yehi "circuit breaker" hai — kharab account khud rukega,
poora system nahi rukega.

Seekhne ke liye: ye "scheduled job / cron job" hai — roz ek waqt
par khud chalta hai, insaan ke click ke baghair.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from ..db import SupabaseDB
from ..services import health
from ..services.notify import raise_alert


def run_once(db: SupabaseDB, now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    week_ago = (now - timedelta(days=7)).isoformat()
    summary = {"checked": 0, "paused": 0, "cooling": 0}

    for acc in db.table("sending_accounts").select("*").all():
        acc_id = acc["id"]
        summary["checked"] += 1

        sent = db.table("sent_emails").select("id").eq(
            "account_id", acc_id).all()
        # (scaffold) bounce/reply counts — asal me replies + suppression se
        n_sent = len([s for s in sent])  # poora count; 7d filter Phase 2 me
        replies = db.table("replies").select("id").eq("account_id", acc_id).all()
        complaints = db.table("suppressions").select("id").eq(
            "reason", "complaint").all()
        placement = acc.get("placement_score", 0) or 0

        score, status, wajah = health.compute_health(
            sent=n_sent, bounces=0, replies=len(replies),
            spam_complaints=len(complaints), placement=placement)

        # daily snapshot (trend ke liye) — dobara chale to update, duplicate nahi
        db.table("account_health_daily").upsert({
            "account_id": acc_id, "day": now.date().isoformat(),
            "sent": n_sent, "bounces": 0, "replies": len(replies),
            "spam_complaints": len(complaints), "health_score": score},
            on_conflict="account_id,day")

        old_status = acc.get("status")
        updates: dict = {"health_score": score}
        if status == "paused" and old_status not in ("paused", "disconnected"):
            updates["status"] = "paused"
            updates["paused_reason"] = f"auto-pause: {wajah}"
            summary["paused"] += 1
            raise_alert(db, "critical",
                        f"{acc.get('label')}: AUTO-PAUSE — {wajah}",
                        account_id=acc_id)
        elif status == "cooling":
            if old_status == "ready":
                updates["status"] = "cooling"
            summary["cooling"] += 1
            raise_alert(db, "warning",
                        f"{acc.get('label')}: cooling — {wajah}",
                        account_id=acc_id)

        # cap suggest karo (ramp table ke hisab se)
        age_days = acc.get("warmup_day", 0) or 0
        updates["daily_cap"] = health.suggest_cap(age_days, placement, score)
        db.table("sending_accounts").eq("id", acc_id).update(updates)

    return summary
