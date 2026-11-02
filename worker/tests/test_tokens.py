"""
Tests — tokens.py (per-account OAuth + auto-refresh).

Fake DB + mocked HTTP: koi real network ya database nahi chahiye.
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from app.services import tokens

NOW = datetime(2026, 11, 2, 12, 0, tzinfo=timezone.utc)


class FakeTable:
    def __init__(self, db, name):
        self.db = db
        self.name = name
        self._eq = {}

    def eq(self, col, val):
        self._eq[col] = val
        return self

    def update(self, row):
        self.db.updates.append((self.name, dict(self._eq), row))
        return {"ok": True}

    def insert(self, row):
        self.db.inserts.append((self.name, row))
        return {"ok": True}


class FakeDB:
    def __init__(self):
        self.updates = []
        self.inserts = []

    def table(self, name):
        return FakeTable(self, name)


def make_account(**kw):
    base = dict(id="a1", email="m@x.com", oauth_access_token="",
                oauth_refresh_token="", oauth_expires_at=None,
                oauth_scope="", token_ref="")
    base.update(kw)
    return base


def test_fresh_token_returned_as_is():
    db = FakeDB()
    acc = make_account(oauth_access_token="fresh123",
                       oauth_expires_at=(NOW + timedelta(hours=1)).isoformat(),
                       oauth_refresh_token="r1")
    with patch.object(tokens, "_now", return_value=NOW):
        with patch("app.services.tokens.httpx.post") as post:
            assert tokens.get_account_token(db, acc) == "fresh123"
            post.assert_not_called()  # refresh ki zaroorat nahi pari
    assert db.updates == []


def test_expired_token_refreshes_and_updates_db():
    db = FakeDB()
    acc = make_account(id="a9", oauth_access_token="old",
                       oauth_expires_at=(NOW - timedelta(minutes=1)).isoformat(),
                       oauth_refresh_token="refresh_abc")

    class Resp:
        def json(self):
            return {"access_token": "new_access", "refresh_token": "new_refresh",
                    "expires_in": 3600, "scope": "Mail.Send"}

    with patch.object(tokens, "_now", return_value=NOW):
        with patch("app.services.tokens.httpx.post", return_value=Resp()):
            with patch.dict("os.environ", {"AZURE_CLIENT_ID": "cid",
                                           "AZURE_CLIENT_SECRET": "csec"}):
                got = tokens.get_account_token(db, acc)
    assert got == "new_access"
    # DB row update hui: naye tokens + nayi expiry
    assert len(db.updates) == 1
    name, eq, row = db.updates[0]
    assert name == "sending_accounts" and eq == {"id": "a9"}
    assert row["oauth_access_token"] == "new_access"
    assert row["oauth_refresh_token"] == "new_refresh"  # rotation
    assert "oauth_expires_at" in row


def test_dead_refresh_token_marks_disconnected():
    db = FakeDB()
    acc = make_account(id="a7", email="dead@x.com",
                       oauth_access_token="old",
                       oauth_expires_at=(NOW - timedelta(hours=2)).isoformat(),
                       oauth_refresh_token="dead_refresh")

    class Resp:
        def json(self):
            return {"error": "invalid_grant"}  # no access_token!

    with patch.object(tokens, "_now", return_value=NOW):
        with patch("app.services.tokens.httpx.post", return_value=Resp()):
            with patch.dict("os.environ", {"AZURE_CLIENT_ID": "cid",
                                           "AZURE_CLIENT_SECRET": "csec"}):
                assert tokens.get_account_token(db, acc) is None
    # account disconnected + tokens wiped
    upd = [u for u in db.updates if u[0] == "sending_accounts"][0][2]
    assert upd["status"] == "disconnected"
    assert upd["oauth_access_token"] == ""
    # critical alert gaya
    assert any(i[0] == "alerts" for i in db.inserts)


def test_fallback_to_token_ref_env():
    db = FakeDB()
    acc = make_account(token_ref="GRAPH_TOKEN_ACC1")  # no DB tokens
    with patch.dict("os.environ", {"GRAPH_TOKEN_ACC1": "env_token_1"}):
        assert tokens.get_account_token(db, acc) == "env_token_1"


def test_no_tokens_returns_none():
    db = FakeDB()
    assert tokens.get_account_token(db, make_account()) is None
