from typing import Protocol

import httpx

from app.core.config import Settings

_pool: httpx.AsyncClient | None = None


def shared_client() -> httpx.AsyncClient:
    global _pool
    if _pool is None or _pool.is_closed:
        _pool = httpx.AsyncClient(timeout=20)
    return _pool


class GatewayError(Exception):
    def __init__(self, status_code: int, detail: str, code: str = "") -> None:
        self.status_code = status_code
        self.detail = detail
        self.code = code


class Gateway(Protocol):
    async def select(self, table: str, params: dict[str, str]) -> list[dict]: ...

    async def insert(self, table: str, row: dict) -> dict: ...

    async def update(self, table: str, params: dict[str, str], row: dict) -> list[dict]: ...

    async def delete(self, table: str, params: dict[str, str]) -> None: ...


class PostgrestGateway:
    def __init__(self, settings: Settings, token: str, apikey: str | None = None) -> None:
        self.base = f"{settings.supabase_url.rstrip('/')}/rest/v1"
        self.headers = {
            "apikey": apikey or settings.supabase_anon_key,
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        }

    async def select(self, table: str, params: dict[str, str]) -> list[dict]:
        return await self._request("GET", table, params=params)

    async def insert(self, table: str, row: dict) -> dict:
        rows = await self._request("POST", table, params={}, json=row, representation=True)
        if not rows:
            raise GatewayError(400, "The record was not saved.")
        return rows[0]

    async def update(self, table: str, params: dict[str, str], row: dict) -> list[dict]:
        return await self._request("PATCH", table, params=params, json=row, representation=True)

    async def delete(self, table: str, params: dict[str, str]) -> None:
        await self._request("DELETE", table, params=params)

    async def _request(
        self,
        method: str,
        table: str,
        params: dict[str, str],
        json: dict | None = None,
        representation: bool = False,
    ) -> list[dict]:
        headers = dict(self.headers)
        if representation:
            headers["Prefer"] = "return=representation"
        if json is not None:
            headers["Content-Type"] = "application/json"
        response = await shared_client().request(
            method, f"{self.base}/{table}", params=params, json=json, headers=headers
        )
        if response.status_code >= 400:
            body = response.json() if response.content else {}
            message = body.get("message") or body.get("detail") or "The database rejected the change."
            raise GatewayError(response.status_code, str(message), str(body.get("code") or ""))
        if not response.content:
            return []
        payload = response.json()
        if isinstance(payload, list):
            return payload
        return [payload]


def _matches(row: dict, params: dict[str, str]) -> bool:
    for key, raw in params.items():
        if key in {"select", "order"}:
            continue
        value = row.get(key)
        if raw == "is.null":
            if value is not None:
                return False
        elif raw == "not.is.null":
            if value is None:
                return False
        elif raw.startswith("eq."):
            if str(value) != raw[3:]:
                return False
        elif raw.startswith("ilike."):
            if str(value).lower() != raw[6:].lower():
                return False
        elif raw.startswith("in.(") and raw.endswith(")"):
            options = {item.strip() for item in raw[4:-1].split(",") if item.strip()}
            if str(value) not in options:
                return False
        else:
            raise GatewayError(400, f"Unsupported filter {key}={raw}")
    return True


class MemoryGateway:
    """In-memory PostgREST stand-in for circulation tests."""

    def __init__(self) -> None:
        self.tables: dict[str, list[dict]] = {}

    async def select(self, table: str, params: dict[str, str]) -> list[dict]:
        return [dict(row) for row in self.tables.get(table, []) if _matches(row, params)]

    async def insert(self, table: str, row: dict) -> dict:
        stored = dict(row)
        stored.setdefault("id", f"{table}-{len(self.tables.get(table, [])) + 1}")
        self.tables.setdefault(table, []).append(stored)
        return dict(stored)

    async def update(self, table: str, params: dict[str, str], row: dict) -> list[dict]:
        changed: list[dict] = []
        for current in self.tables.get(table, []):
            if _matches(current, params):
                current.update(row)
                changed.append(dict(current))
        return changed

    async def delete(self, table: str, params: dict[str, str]) -> None:
        self.tables[table] = [row for row in self.tables.get(table, []) if not _matches(row, params)]
