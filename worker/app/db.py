"""
db.py — Supabase se baat karne ka patla (thin) layer.

Simple me: Supabase ka har table ek REST API endpoint bhi hota hai
(PostgREST). Ye class us API ko call karti hai — SELECT/INSERT/UPDATE —
taake workers ko SQL likhne ki zaroorat na pare.

Service-role key sirf yahan (server side) istemal hoti hai.
Ye key kabhi browser / frontend / git me NAHI jayegi.

Seekhne ke liye: ye "repository pattern" ka simple version hai —
database ki detail ek jagah band, baqi code sirf `db.table("leads").select(...)`
jaise saaf calls karta hai.
"""
from __future__ import annotations

import httpx

from .config import settings


class SupabaseTable:
    """Ek table par basic operations. `db.table("leads")` se banta hai."""

    def __init__(self, client: "SupabaseDB", name: str):
        self._client = client
        self._name = name
        self._params: list[tuple[str, str]] = []
        self._headers: dict[str, str] = {}

    # -- query building (ye sirf sawal tayyar karta hai, bhejta nahi) --
    def select(self, columns: str = "*") -> "SupabaseTable":
        self._headers["Accept"] = "application/json"
        self._params.append(("select", columns))
        return self

    def eq(self, column: str, value: object) -> "SupabaseTable":
        self._params.append((column, f"eq.{value}"))
        return self

    def lte(self, column: str, value: object) -> "SupabaseTable":
        self._params.append((column, f"lte.{value}"))
        return self

    def order(self, column: str, desc: bool = False) -> "SupabaseTable":
        self._params.append(("order", f"{column}.{'desc' if desc else 'asc'}"))
        return self

    def limit(self, n: int) -> "SupabaseTable":
        self._params.append(("limit", str(n)))
        return self

    # -- execution (ab sawal bhejo aur jawab lo) --
    def all(self) -> list[dict]:
        resp = self._client._request("GET", f"/rest/v1/{self._name}",
                                     params=self._params, headers=self._headers)
        return resp.json()

    def one(self) -> dict | None:
        rows = self.limit(1).all()
        return rows[0] if rows else None

    def insert(self, row: dict) -> dict:
        resp = self._client._request(
            "POST", f"/rest/v1/{self._name}", json=row,
            headers={"Prefer": "return=representation"})
        data = resp.json()
        return data[0] if isinstance(data, list) else data

    def upsert(self, row: dict, on_conflict: str) -> dict:
        resp = self._client._request(
            "POST", f"/rest/v1/{self._name}", json=row,
            params=[("on_conflict", on_conflict)],
            headers={"Prefer": "resolution=merge-duplicates,return=representation"})
        data = resp.json()
        return data[0] if isinstance(data, list) else data

    def update(self, values: dict) -> list[dict]:
        # NOTE: hamesha .eq(...) filter ke sath use karo, warna poori table update ho jayegi!
        resp = self._client._request(
            "PATCH", f"/rest/v1/{self._name}", json=values,
            params=self._params, headers={"Prefer": "return=representation"})
        return resp.json()


class SupabaseDB:
    """Connection + auth header sambhalta hai."""

    def __init__(self, url: str | None = None, service_key: str | None = None):
        self.base = (url or settings.supabase_url).rstrip("/")
        self.key = service_key or settings.supabase_service_key
        self._http = httpx.Client(timeout=30.0)

    def _request(self, method: str, path: str, **kwargs) -> httpx.Response:
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }
        headers.update(kwargs.pop("headers", {}))
        resp = self._http.request(method, self.base + path, headers=headers, **kwargs)
        resp.raise_for_status()  # 4xx/5xx par exception — chupke se fail nahi hoga
        return resp

    def table(self, name: str) -> SupabaseTable:
        return SupabaseTable(self, name)

    def rpc(self, fn: str, params: dict | None = None) -> object:
        resp = self._request("POST", f"/rest/v1/rpc/{fn}", json=params or {})
        return resp.json()
