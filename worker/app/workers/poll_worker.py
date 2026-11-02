"""
poll_worker.py — inbox check karne wala mazdoor (reply detection).

Simple me: har account ka inbox thori thori dair baad check hota hai
(staggered — sab ek sath nahi, taake Graph throttle na kare).
Naya message mile to:
  1. Pehle conversation/thread ID se lead dhoondo, phir sender email se
  2. Reply classify karo (positive / busy / price / not_interested / ...)
  3. replies table me daalo (reply_from_account_id = wohi account jis
     ne bheja tha — thread continuity ke liye)
  4. Lead ka stage "Replied" karo, uski baqi queue CANCEL karo (stop-on-reply)
  5. Positive reply ho to self-email alert bhejo (user choice)

Out-of-office ko "Replied" NAHI mana jayega — ye purana flaw tha.

Seekhne ke liye: "polling" ka matlab hai baar baar poochna "kuch naya?"
(jaise mailbox roz check karna). Webhook iska ulta hota hai — server
khud batata hai. AutoMailer free me webhook nahi deta, isi liye polling.
"""
from __future__ import annotations

from datetime import datetime, timezone

from ..db import SupabaseDB
from ..services.graph import GraphClient, GraphError
from ..services.notify import raise_alert
from ..services.tokens import get_account_token

# Simple keyword classifier (scaffold). Baad me Gemini/Groq se behtar hoga.
POSITIVE_WORDS = ["interested", "call", "pricing", "quote", "demo",
                  "let's talk", "send proposal", "meeting"]
NOT_INTERESTED_WORDS = ["not interested", "remove me", "unsubscribe",
                        "stop emailing", "no thanks"]
BUSY_WORDS = ["busy", "next quarter", "later", "follow up in"]
PRICE_WORDS = ["price", "cost", "how much", "pricing", "budget"]
OOO_WORDS = ["out of office", "on leave", "vacation", "auto-reply"]


def classify(text: str) -> str:
    """Reply ko category do. Simple keyword matching (scaffold version)."""
    t = text.lower()
    if any(w in t for w in OOO_WORDS):
        return "out_of_office"
    if any(w in t for w in NOT_INTERESTED_WORDS):
        return "not_interested"
    if any(w in t for w in PRICE_WORDS):
        return "price"
    if any(w in t for w in BUSY_WORDS):
        return "busy"
    if any(w in t for w in POSITIVE_WORDS):
        return "positive"
    return "unclassified"


def _find_lead(db: SupabaseDB, msg: dict) -> dict | None:
    """
    Pehle thread ID se, phir sender email se lead dhoondo.
    Thread pehle — kyunki reply doosri email se bhi aa sakta hai.
    """
    conv = msg.get("conversationId") or ""
    # NOTE (Phase 2 improvement): thread ID se match ke liye sent_emails me
    # conversation map chahiye hogi. Scaffold me sender email se match hai —
    # v2 blueprint ke mutabiq thread-first matching Phase 2 me aayegi.
    _ = conv  # abhi unused, Phase 2 me istemal hoga
    sender = (((msg.get("from") or {}).get("emailAddress") or {}).get("address") or "").lower()
    if sender:
        return db.table("leads").select("*").eq("email", sender).one()
    return None


def poll_account(db: SupabaseDB, account: dict,
                 now: datetime | None = None) -> dict:
    """Ek account ka inbox check karo. Returns {"checked": n, "replies": n}."""
    now = now or datetime.now(timezone.utc)
    token = get_account_token(db, account)
    if not token:
        return {"checked": 0, "replies": 0, "error": "token missing"}

    try:
        client = GraphClient(token)
        # delta_link account ke record me save hoga (scaffold: har dafa fresh)
        data = client.list_messages(top=25)
    except GraphError as e:
        db.table("sending_accounts").eq("id", account["id"]).update(
            {"status": "disconnected", "paused_reason": f"poll fail: {e}"[:200]})
        raise_alert(db, "warning",
                    f"{account.get('label')}: inbox poll fail, disconnected mark kiya",
                    account_id=account["id"])
        return {"checked": 0, "replies": 0, "error": str(e)}

    summary = {"checked": 0, "replies": 0}
    seen_ids = set()  # (scaffold) asal me DB me processed message IDs honge
    for msg in data["messages"]:
        summary["checked"] += 1
        if msg.get("id") in seen_ids:
            continue
        text = f"{msg.get('subject', '')} {(msg.get('bodyPreview') or '')}"
        cls = classify(text)
        if cls == "out_of_office":
            continue  # stage mat badlo, ye asal reply nahi

        lead = _find_lead(db, msg)
        reply_row = db.table("replies").insert({
            "lead_id": lead["id"] if lead else None,
            "account_id": account["id"],
            "thread_id": msg.get("conversationId") or "",
            # Thread continuity: jawab usi account se jayega jis ne bheja tha
            "reply_from_account_id": account["id"],
            "classification": cls,
            "body_summary": text[:300],
        })
        summary["replies"] += 1

        if lead:
            if cls in ("unsubscribe",):
                db.table("suppressions").upsert(
                    {"email": lead["email"], "reason": "unsubscribe"}, "email")
                db.table("leads").eq("id", lead["id"]).update({"stage": "Suppressed"})
            elif cls == "not_interested":
                db.table("leads").eq("id", lead["id"]).update({"stage": "Lost"})
            else:
                db.table("leads").eq("id", lead["id"]).update({"stage": "Replied"})
            # stop-on-reply: is lead ki baqi queued emails cancel
            for q in db.table("send_queue").select("id").eq(
                    "lead_id", lead["id"]).eq("status", "queued").all():
                db.table("send_queue").eq("id", q["id"]).update({"status": "cancelled"})

        if cls == "positive":
            # User choice: self-email alert (Graph se, isi account se)
            raise_alert(
                db, "positive_reply",
                f"Positive reply: {lead['contact_name'] if lead else 'unknown'} "
                f"<{lead['email'] if lead else '?'}> — {text[:100]}",
                lead_id=lead["id"] if lead else None,
                account_id=account["id"],
                graph=client)

    return summary


def run_once(db: SupabaseDB) -> dict:
    """
    Sab ready/warming accounts ka inbox check karo.
    Staggered: har account ka apna waqt — ye function ek scheduler
    (cron) se har 15 min chalega; accounts ke darmiyan gap worker ke
    bahar scheduler me hoga (Phase 2).
    """
    total = {"checked": 0, "replies": 0}
    accounts = db.table("sending_accounts").select("*").all()
    for acc in accounts:
        if acc.get("status") in ("paused", "disconnected", "banned_risk"):
            continue
        try:
            s = poll_account(db, acc)
            total["checked"] += s.get("checked", 0)
            total["replies"] += s.get("replies", 0)
        except Exception as e:  # ek account fail to baqi rukenge nahi
            raise_alert(db, "warning",
                        f"{acc.get('label')}: poll me unexpected error: {e}"[:200],
                        account_id=acc["id"])
    return total
