from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.security import Principal
from app.main import create_app

CONFIGURED = Settings(supabase_url="https://librimind.supabase.co", supabase_anon_key="anon-key")


def test_registration_creates_a_confirmed_account_without_mail() -> None:
    created: list[tuple[str, str, str]] = []

    async def creator(name: str, email: str, password: str) -> None:
        created.append((name, email, password))

    async def resolve(token: str, settings: Settings) -> Principal:
        raise AssertionError("registration does not require a session")

    async def save(token: str, user_id: str, payload: dict, settings: Settings) -> dict:
        return payload

    client = TestClient(create_app(CONFIGURED, resolve, save, account_creator=creator))
    response = client.post(
        "/api/v1/register",
        json={"name": "Amina Rahman", "email": "amina@example.edu", "password": "library-pass"},
    )
    assert response.status_code == 201
    assert created == [("Amina Rahman", "amina@example.edu", "library-pass")]
    short = client.post(
        "/api/v1/register",
        json={"name": "Amina Rahman", "email": "amina@example.edu", "password": "short"},
    )
    assert short.status_code == 400
    assert len(created) == 1
