from typing import Awaitable, Callable

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from app.core.config import Settings

Creator = Callable[[str, str, str], Awaitable[None]]


class RegisterBody(BaseModel):
    name: str
    email: str
    password: str


class AccountError(Exception):
    def __init__(self, detail: str, status_code: int = 400) -> None:
        self.detail = detail
        self.status_code = status_code


async def create_confirmed_user(settings: Settings, name: str, email: str, password: str) -> None:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise AccountError("Registration is not configured.", 503)
    key = settings.supabase_service_role_key
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users",
            headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {"full_name": name},
            },
        )
    body = response.json() if response.content else {}
    if response.status_code < 400:
        return
    message = ""
    if isinstance(body, dict):
        raw = body.get("msg") or body.get("message") or body.get("error_description") or ""
        message = raw if isinstance(raw, str) else ""
    if response.status_code in {409, 422} or "already" in message.lower():
        raise AccountError("An account with this email already exists. Sign in.")
    raise AccountError(message or "The account was not created.")


def register_accounts(app: FastAPI, settings: Settings, creator: Creator | None) -> None:
    create = creator or (lambda name, email, password: create_confirmed_user(settings, name, email, password))

    @app.post("/api/v1/register", status_code=201)
    async def register(body: RegisterBody) -> dict[str, str]:
        name = body.name.strip()
        email = body.email.strip()
        if len(name) < 2:
            raise HTTPException(status_code=400, detail="Enter the name you use at the library.")
        if "@" not in email or "." not in email.split("@")[-1]:
            raise HTTPException(status_code=400, detail="Enter a valid email address.")
        if len(body.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
        try:
            await create(name, email, body.password)
        except AccountError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
        return {"status": "created"}
