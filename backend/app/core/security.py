from typing import Literal

import httpx
from pydantic import BaseModel, Field

from app.core.config import Settings


class Principal(BaseModel):
    user_id: str
    email: str
    role: Literal["student", "admin"]
    full_name: str = ""


class ProfileUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    programme: str | None = Field(default=None, max_length=160)
    reading_interests: list[str] = Field(default_factory=list, max_length=12)


class AuthFailure(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail


async def resolve_principal(
    token: str,
    settings: Settings,
    client: httpx.AsyncClient | None = None,
) -> Principal:
    if not settings.auth_configured:
        raise AuthFailure(503, "Authentication is not configured.")

    owns_client = client is None
    http = client or httpx.AsyncClient(timeout=10)
    try:
        user_response = await http.get(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": settings.supabase_anon_key},
        )
        if user_response.status_code != 200:
            raise AuthFailure(401, "Sign-in could not be verified.")
        user = user_response.json()
        user_id = user.get("id")
        if not isinstance(user_id, str) or not user_id:
            raise AuthFailure(401, "Sign-in could not be verified.")

        profile_response = await http.get(
            f"{settings.supabase_url.rstrip('/')}/rest/v1/profiles",
            params={"id": f"eq.{user_id}", "select": "id,email,full_name,role"},
            headers={
                "apikey": settings.supabase_anon_key,
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
            },
        )
        if profile_response.status_code != 200:
            raise AuthFailure(401, "The profile could not be read.")
        rows = profile_response.json()
        if not rows:
            raise AuthFailure(403, "This account has no library profile.")
        profile = rows[0]
        role = profile.get("role")
        if role not in ("student", "admin"):
            raise AuthFailure(403, "This account has no library role.")
        email = profile.get("email") or user.get("email") or ""
        return Principal(user_id=profile["id"], email=email, role=role, full_name=profile.get("full_name") or "")
    finally:
        if owns_client:
            await http.aclose()


async def save_profile(
    token: str,
    user_id: str,
    payload: dict[str, object],
    settings: Settings,
    client: httpx.AsyncClient | None = None,
) -> dict[str, object]:
    if "role" in payload:
        raise AuthFailure(400, "A profile save cannot change a role.")
    owns_client = client is None
    http = client or httpx.AsyncClient(timeout=10)
    try:
        response = await http.patch(
            f"{settings.supabase_url.rstrip('/')}/rest/v1/profiles",
            params={"id": f"eq.{user_id}"},
            json=payload,
            headers={
                "apikey": settings.supabase_anon_key,
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
        )
        if response.status_code not in (200, 204):
            raise AuthFailure(400, "The profile could not be saved.")
        rows = response.json() if response.content else []
        if isinstance(rows, list) and rows:
            return {
                "full_name": rows[0].get("full_name", ""),
                "programme": rows[0].get("programme"),
                "reading_interests": rows[0].get("reading_interests") or [],
            }
        return payload
    finally:
        if owns_client:
            await http.aclose()
