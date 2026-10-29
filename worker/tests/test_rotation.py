"""
Tests — rotation.py ke liye.

Simple me: test ka matlab hai "code se sawal poochna aur jawab check karna".
Hum fake accounts banate hain, function chalate hain, aur assert karte hain
(daawa karte hain) ke jawab sahi hai. Ghalat ho to test FAIL — matlab bug hai.

Chalana:  .venv/bin/pytest -q
"""
from datetime import datetime, timedelta, timezone

from app.models import Account
from app.services import rotation

NOW = datetime(2026, 10, 29, 12, 0, tzinfo=timezone.utc)


def make_account(**kw):
    base = dict(id="a1", label="Test", email="t@x.com", status="ready",
                daily_cap=20, sent_today=0, health_score=90)
    base.update(kw)
    return Account(**base)


def test_ready_account_is_eligible():
    ok, _ = rotation.is_eligible(make_account(), NOW)
    assert ok is True


def test_warming_account_not_eligible():
    ok, reason = rotation.is_eligible(make_account(status="warming"), NOW)
    assert ok is False
    assert "warming" in reason


def test_cap_finished_not_eligible():
    ok, _ = rotation.is_eligible(make_account(sent_today=20, daily_cap=20), NOW)
    assert ok is False


def test_gap_not_complete_not_eligible():
    acc = make_account(last_sent_at=NOW - timedelta(minutes=5))
    ok, reason = rotation.is_eligible(acc, NOW)
    assert ok is False
    assert "gap" in reason


def test_gap_complete_is_eligible():
    acc = make_account(last_sent_at=NOW - timedelta(minutes=30))
    ok, _ = rotation.is_eligible(acc, NOW)
    assert ok is True


def test_pick_highest_health():
    a = make_account(id="a", health_score=70)
    b = make_account(id="b", health_score=95)
    picked = rotation.pick_account([a, b], NOW)
    assert picked.id == "b"


def test_pick_tie_goes_to_least_sent():
    a = make_account(id="a", health_score=90, sent_today=10)
    b = make_account(id="b", health_score=90, sent_today=2)
    picked = rotation.pick_account([a, b], NOW)
    assert picked.id == "b"  # load balance: jis ne kam bheja


def test_pick_none_when_nobody_eligible():
    a = make_account(status="paused")
    assert rotation.pick_account([a], NOW) is None  # zabardasti nahi bhejega
