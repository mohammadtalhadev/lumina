"""
tokens.py — per-account OAuth tokens with auto-refresh.

Simple me: har sending account ka apna access token hota hai (dashboard ke
"Connect with Microsoft" flow se). Access token ~1 ghante me expire hota hai —
ye module har use se pehle expiry check karta hai aur zaroorat par refresh
token se naya access token le aata hai. Operator ko dobara kuch nahi karna
parta: na manual token, na curl, na expiry juggling.

Priority:
  1. DB OAuth tokens (oauth_access_token + oauth_expires_at).
     Expired (5 min buffer) → refresh_token se renew → DB row update.
     Refresh fail (revoked) → account 'disconnected' + critical alert.
  2. Fallback: legacy token_ref env var (Phase 0 manual flow) — unchanged.

Secrets kabhi log nahi hote — sirf success/failure.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import httpx

from ..db import SupabaseDB
from .notify import raise_alert

TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
# Expiry se 5 min pehle refresh — taake beech me token na mare.
REFRESH_BUFFER = timedelta(minutes=5)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_expiry(value: object) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        try:
            dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _refresh(db: SupabaseDB, account: dict) -> str | None:
    """
    Refresh token se naya access token lao; DB row update karo.
    Returns naya access token, ya None (to account disconnected mark hota hai).
    """
    refresh_token = account.get("oauth_refresh_token") or ""
    client_id = os.environ.get("AZURE_CLIENT_ID", "")
    client_secret = os.environ.get("AZURE_CLIENT_SECRET", "")
    if not (refresh_token and client_id and client_secret):
        return None

    try:
        resp = httpx.post(
            TOKEN_URL,
            data={
                "client_id": client_id,
                "scope": "Mail.Send Mail.ReadWrite offline_access",
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
                "client_secret": client_secret,
            },
            timeout=20,
        )
        data = resp.json()
    except Exception:
        return None

    new_access = data.get("access_token") or ""
    if not new_access:
        # Refresh token marr gaya (revoked/expired) — account dobara connect hoga.
        db.table("sending_accounts").eq("id", account["id"]).update({
            "status": "disconnected",
            "paused_reason": "Microsoft token expired — dashboard se dobara connect karo",
            "oauth_access_token": "",
            "oauth_refresh_token": "",
            "oauth_expires_at": None,
        })
        raise_alert(db, "critical",
                    f"Account {account.get('email', '?')}: Microsoft token expire — "
                    f"dobara connect karo",
                    account_id=account["id"])
        return None

    # Microsoft refresh token bhi rotate karta hai — naya wala save karo.
    new_refresh = data.get("refresh_token") or refresh_token
    expires_at = (_now() + timedelta(seconds=int(data.get("expires_in", 3600)))).isoformat()
    db.table("sending_accounts").eq("id", account["id"]).update({
        "oauth_access_token": new_access,
        "oauth_refresh_token": new_refresh,
        "oauth_expires_at": expires_at,
        "oauth_scope": data.get("scope", ""),
    })
    return new_access


def get_account_token(db: SupabaseDB, account: dict) -> str | None:
    """
    Account ke liye usable access token lao (auto-refresh samet).
    Returns None jab koi valid token na ho (caller skip/fail karega).
    """
    access = account.get("oauth_access_token") or ""
    expires_at = _parse_expiry(account.get("oauth_expires_at"))

    if access and expires_at:
        if expires_at - _now() > REFRESH_BUFFER:
            return access  # abhi fresh hai
        return _refresh(db, account)  # expired ya expiring — renew karo

    if access:
        return access  # expiry info nahi — jaisa hai waisa use karo

    # Legacy fallback: Phase 0 manual flow (token_ref = env var ka naam).
    ref = account.get("token_ref") or ""
    return os.environ.get(ref) if ref else None
