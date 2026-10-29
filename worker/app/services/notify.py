"""
notify.py — alerts bhejna (user choice: self-email).

Simple me: jab koi zaroori event ho (positive reply, account pause,
system stop), to worker ye function bulata hai. Ye:
  1. alerts table me ek row daalta hai (dashboard inbox ke liye), aur
  2. self-email bhejta hai — Graph se, kisi ready account se,
     user ke apne personal email (ALERT_EMAIL) par.

Privacy rule: alert me sirf lead ka naam + event type + dashboard link.
Poora email body KABHI alert me nahi jayega.

Seekhne ke liye: notification ko "side effect" kehte hain — asal kaam
(lead stage update) alag, ittila dena alag. Dono ko alag function me
rakhna code saaf rakhta hai.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from ..config import settings
from .graph import GraphClient

if TYPE_CHECKING:
    from ..db import SupabaseDB

DASHBOARD_LINK = "https://lumina.local/dashboard"  # deploy par asal URL


def raise_alert(db: "SupabaseDB", type_: str, message: str,
                lead_id: str | None = None,
                account_id: str | None = None,
                graph: GraphClient | None = None) -> dict:
    """
    Alert record karo + self-email bhejo (agar graph client mila to).
    type_: info | positive_reply | warning | critical
    """
    row = db.table("alerts").insert({
        "type": type_,
        "message": message,
        "lead_id": lead_id,
        "account_id": account_id,
        "channel": "self_email" if graph else "dashboard",
    })
    if graph and settings.alert_email:
        subject = f"[Lumina] {type_.replace('_', ' ').title()}: {message[:80]}"
        body = (f"{message}\n\nDashboard: {DASHBOARD_LINK}\n\n"
                f"— Lumina worker (self-email alert)")
        graph.send_mail(settings.alert_email, subject, body)
    return row
