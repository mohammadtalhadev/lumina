"""
rotation.py — kaunsa account, kab email bhejega.

Simple me: bohat se accounts hain, har ek ka apna daily cap aur
gap hai. Ye module do sawalon ka jawab deta hai:
  1. Kaunse accounts abhi bhej SAKTE hain?  (eligibility — hard rules)
  2. Un me se BEST kaunsa hai?              (scoring — sab se healthy)

Dono functions PURE hain: inko database nahi chahiye, sirf data do
aur jawab lo. Isi liye inke tests likhna asaan hai (tests/ me dekho).

Seekhne ke liye: business logic ko I/O (database/API) se alag rakhna
"separation of concerns" kehlata hai — yehi professional code ki
pehli nishani hai.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from ..models import Account

# Har account ke do emails ke darmiyan kam az kam itna gap (minutes)
MIN_GAP_MINUTES = 12


def is_eligible(account: Account, now: datetime) -> tuple[bool, str]:
    """
    Kya ye account abhi bhej sakta hai?
    Returns: (eligible?, wajah)
    Hard rules — ek bhi fail to account bahar.
    """
    if account.status != "ready":
        return False, f"status={account.status} (sirf 'ready' bhej sakta hai)"
    if account.daily_cap <= 0:
        return False, "daily_cap=0 (warmup poora nahi ya cap khatam)"
    if account.sent_today >= account.daily_cap:
        return False, f"cap khatam ({account.sent_today}/{account.daily_cap})"
    if account.last_sent_at is not None:
        gap = now - account.last_sent_at.replace(tzinfo=timezone.utc) \
            if account.last_sent_at.tzinfo is None else now - account.last_sent_at
        if gap < timedelta(minutes=MIN_GAP_MINUTES):
            left = MIN_GAP_MINUTES - gap.total_seconds() / 60
            return False, f"gap poora nahi ({left:.0f} min baqi)"
    return True, "ok"


def eligible_accounts(accounts: list[Account], now: datetime) -> list[Account]:
    """Sab accounts me se sirf eligible wale chhanto."""
    return [a for a in accounts if is_eligible(a, now)[0]]


def pick_account(accounts: list[Account], now: datetime) -> Account | None:
    """
    Eligible accounts me se BEST chuno:
      1. sab se zyada health_score
      2. tie ho to jis ne aaj sab se KAM bheja ho (load balance)
    Koi eligible na ho to None — worker zabardasti NAHI bhejega.
    """
    eligible = eligible_accounts(accounts, now)
    if not eligible:
        return None
    # sort: health zyada pehle, phir sent_today kam pehle
    eligible.sort(key=lambda a: (-a.health_score, a.sent_today))
    return eligible[0]


def next_eligible_at(account: Account, now: datetime) -> datetime:
    """Ye account kab dobara eligible hoga? (queue scheduling ke liye)"""
    if account.last_sent_at is None:
        return now
    last = account.last_sent_at
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    return max(now, last + timedelta(minutes=MIN_GAP_MINUTES))
