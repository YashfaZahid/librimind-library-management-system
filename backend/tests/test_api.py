from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.security import AuthFailure, Principal
from app.main import create_app

CONFIGURED = Settings(supabase_url="https://librimind.supabase.co", supabase_anon_key="anon-key")


def student_resolver(token: str, settings: Settings) -> Principal:
    if token == "student-token":
        return _ready(Principal(user_id="user-1", email="amina@example.edu", role="student", full_name="Amina"))
    if token == "admin-token":
        return _ready(Principal(user_id="user-2", email="desk@example.edu", role="admin", full_name="Duty"))
    raise AuthFailure(401, "Sign-in could not be verified.")


def _ready(principal: Principal) -> Principal:
    return principal


def _client_with(resolver) -> TestClient:
    async def resolve(token: str, settings: Settings) -> Principal:
        result = resolver(token, settings)
        if isinstance(result, Principal):
            return result
        return await result

    async def save(token: str, user_id: str, payload: dict[str, object], settings: Settings) -> dict[str, object]:
        assert "role" not in payload
        assert token
        assert user_id
        assert settings.auth_configured
        return payload

    return TestClient(create_app(CONFIGURED, resolve, save))


def test_interface_serves_the_page_and_leaves_the_api(tmp_path: Path) -> None:
    (tmp_path / "index.html").write_text("<!doctype html><title>LibriMind</title>", encoding="utf-8")
    assets = tmp_path / "assets"
    assets.mkdir()
    (assets / "app.js").write_text("console.log(1)", encoding="utf-8")
    client = TestClient(create_app(Settings(supabase_url="", supabase_anon_key="", static_dir=str(tmp_path))))
    page = client.get("/library/loans")
    script = client.get("/assets/app.js")
    health = client.get("/api/v1/health")
    assert page.status_code == 200
    assert "LibriMind" in page.text
    assert script.status_code == 200
    assert "console.log" in script.text
    assert health.status_code == 200
    assert health.json()["status"] == "ok"


def test_health_does_not_require_a_session() -> None:
    client = TestClient(create_app(Settings(supabase_url="", supabase_anon_key="")))
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["auth_configured"] is False


def test_missing_token_is_rejected_when_auth_is_configured() -> None:
    client = _client_with(student_resolver)
    response = client.get("/api/v1/me")
    assert response.status_code == 401


def test_student_can_read_their_profile_and_not_the_desk() -> None:
    client = _client_with(student_resolver)
    me = client.get("/api/v1/me", headers={"Authorization": "Bearer student-token"})
    assert me.status_code == 200
    assert me.json()["role"] == "student"

    desk = client.get("/api/v1/admin/session", headers={"Authorization": "Bearer student-token"})
    assert desk.status_code == 403
    assert desk.json()["detail"] == "Admin access is required."


def test_admin_can_open_the_desk() -> None:
    client = _client_with(student_resolver)
    response = client.get("/api/v1/admin/session", headers={"Authorization": "Bearer admin-token"})
    assert response.status_code == 200
    assert response.json()["role"] == "admin"


def test_profile_patch_returns_the_safe_fields_only() -> None:
    client = _client_with(student_resolver)
    response = client.patch(
        "/api/v1/me",
        headers={"Authorization": "Bearer student-token"},
        json={"full_name": "Amina Rahman", "programme": "Design", "reading_interests": ["Literature"], "role": "admin"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "student"
    assert body["profile"] == {
        "full_name": "Amina Rahman",
        "programme": "Design",
        "reading_interests": ["Literature"],
    }
    assert "role" not in body["profile"]
