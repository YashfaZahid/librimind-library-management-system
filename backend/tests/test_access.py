import asyncio

import httpx
import pytest
from pydantic import ValidationError

from app.core.access import access_decision, profile_write
from app.core.config import Settings
from app.core.security import ProfileUpdate, resolve_principal


def test_students_cannot_open_the_desk() -> None:
    assert access_decision(None, "member") == "unauthenticated"
    assert access_decision("student", "member") == "allowed"
    assert access_decision("student", "admin") == "forbidden"
    assert access_decision("admin", "admin") == "allowed"
    assert access_decision("guest", "member") == "forbidden"


def test_profile_writes_never_include_a_role() -> None:
    written = profile_write("  Amina Rahman ", " Design ", [" Literature ", "Literature", "Design"])
    assert written == {
        "full_name": "Amina Rahman",
        "programme": "Design",
        "reading_interests": ["Literature", "Design"],
    }
    assert "role" not in written


def test_profile_update_rejects_a_short_name() -> None:
    with pytest.raises(ValidationError):
        ProfileUpdate(full_name="A")


def test_resolve_principal_reads_the_profile_role() -> None:
    settings = Settings(supabase_url="https://librimind.supabase.co", supabase_anon_key="anon-key")

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/auth/v1/user":
            assert request.headers["authorization"] == "Bearer student-token"
            return httpx.Response(200, json={"id": "user-1", "email": "amina@example.edu"})
        if request.url.path == "/rest/v1/profiles":
            return httpx.Response(
                200,
                json=[{"id": "user-1", "email": "amina@example.edu", "full_name": "Amina Rahman", "role": "student"}],
            )
        return httpx.Response(404)

    async def run() -> None:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler), timeout=5) as client:
            principal = await resolve_principal("student-token", settings, client)
            assert principal.role == "student"
            assert principal.user_id == "user-1"

    asyncio.run(run())


def test_rejected_token_does_not_become_a_user() -> None:
    settings = Settings(supabase_url="https://librimind.supabase.co", supabase_anon_key="anon-key")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"message": "bad"})

    async def run() -> None:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler), timeout=5) as client:
            with pytest.raises(Exception) as caught:
                await resolve_principal("nope", settings, client)
            assert getattr(caught.value, "status_code", None) == 401

    asyncio.run(run())
