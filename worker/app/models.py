"""
models.py — data ki shapes (schemas).

Simple me: database se jo dict aata hai uska "shape" yahan likha hai,
taake code me `account["heathl_score"]` jaisi typo galtiyan pakri jayein
aur har function ko pata ho ke usko kya mil raha hai.

Seekhne ke liye: Pydantic ek "validator" hai — ghalat type aaye to
foran error deta hai, database me ghalat data jane se pehle.
"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class Account(BaseModel):
    id: str
    label: str = ""
    email: str = ""
    provider: str = "outlook_personal"
    token_ref: str = ""
    status: str = "warming"
    warmup_day: int = 0
    placement_score: int = 0
    daily_cap: int = 0
    sent_today: int = 0
    last_sent_at: datetime | None = None
    health_score: int = 100
    paused_reason: str = ""


class QueueItem(BaseModel):
    id: str
    lead_id: str
    account_id: str | None = None
    campaign_id: str | None = None
    sequence_step: int = 0
    subject: str = ""
    body: str = ""
    status: str = "queued"
    idempotency_key: str
    attempts: int = 0


class Lead(BaseModel):
    id: str
    email: str
    contact_name: str = ""
    company: str = ""
    grade: str = "C"
    stage: str = "New"
    email_verified: bool = False


class SpamResult(BaseModel):
    """Spam check ka natija: pass / warn / block + wajah."""
    result: str = Field(pattern="^(pass|warn|block)$")
    reasons: list[str] = []
    score: int = 0
