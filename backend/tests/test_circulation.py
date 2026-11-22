import asyncio

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.security import Principal
from app.db.gateway import MemoryGateway
from app.main import create_app
from app.services.circulation import CirculationService
from app.services.rules import RuleError

ADMIN = Principal(user_id="admin-1", email="desk@example.edu", role="admin", full_name="Duty")
STUDENT = Principal(user_id="student-1", email="amina@example.edu", role="student", full_name="Amina")
CONFIGURED = Settings(supabase_url="https://librimind.supabase.co", supabase_anon_key="anon-key")


async def seed() -> MemoryGateway:
    store = MemoryGateway()
    await store.insert(
        "system_settings",
        {"id": "1", "loan_period_days": 14, "max_active_loans": 5, "daily_fine_cents": 50, "reservation_hold_days": 3},
    )
    await store.insert("categories", {"id": "cat-1", "name": "Philosophy", "sort_order": 1})
    await store.insert(
        "profiles",
        {
            "id": "student-1",
            "email": "amina@example.edu",
            "full_name": "Amina Rahman",
            "programme": "Design",
            "reading_interests": ["Philosophy"],
            "role": "student",
        },
    )
    await store.insert(
        "profiles",
        {
            "id": "admin-1",
            "email": "desk@example.edu",
            "full_name": "Duty",
            "programme": "Library",
            "reading_interests": [],
            "role": "admin",
        },
    )
    await store.insert(
        "books",
        {
            "id": "book-1",
            "title": "The Republic",
            "authors": ["Plato"],
            "category_id": "cat-1",
            "isbn13": "9780140455113",
            "description": "A dialogue.",
            "publication_year": 2007,
            "publisher": "Penguin",
            "page_count": 496,
        },
    )
    await store.insert("book_copies", {"id": "copy-1", "book_id": "book-1", "accession": "LM-2401", "status": "available"})
    return store


def test_bundle_maps_the_signed_in_reader_and_hides_closed_holds() -> None:
    async def run() -> None:
        store = await seed()
        await store.insert(
            "reservations",
            {"id": "res-old", "book_id": "book-1", "user_id": "student-1", "status": "cancelled", "placed_at": "2026-01-01"},
        )
        snapshot = await CirculationService(store).bundle(STUDENT)
        assert snapshot["sessionReaderId"] == "student-1"
        assert snapshot["books"][0]["categoryId"] == "cat-1"
        assert snapshot["readers"][0]["interestIds"] == ["cat-1"]
        assert snapshot["reservations"] == []

    asyncio.run(run())


def test_reserve_issue_return_and_fine() -> None:
    async def run() -> None:
        store = await seed()
        service = CirculationService(store)
        await store.insert(
            "reservations",
            {"id": "res-wait", "book_id": "book-1", "user_id": "admin-1", "status": "pending", "placed_at": "2026-11-01"},
        )
        held = await service.reserve(STUDENT, "book-1")
        assert held["status"] == "pending"
        with pytest.raises(RuleError):
            await service.reserve(STUDENT, "book-1")

        loan = await service.issue(ADMIN, "amina@example.edu", "LM-2401")
        assert store.tables["book_copies"][0]["status"] == "borrowed"
        store.tables["loans"][0]["due_at"] = "2020-01-01T00:00:00+00:00"
        result = await service.return_copy(ADMIN, loan["id"])
        assert result["fine"]["amount_cents"] > 0
        assert result["fine"]["status"] == "open"
        ready = [row for row in store.tables["reservations"] if row["status"] == "ready"]
        assert len(ready) == 1
        assert store.tables["book_copies"][0]["status"] == "reserved"
        assert store.tables["notifications"][0]["kind"] == "reservation_ready"

        settled = await service.settle_fine(ADMIN, result["fine"]["id"], "paid")
        assert settled["status"] == "paid"

    asyncio.run(run())


def test_librarian_approves_a_waiting_hold() -> None:
    async def run() -> None:
        store = await seed()
        service = CirculationService(store)
        held = await service.reserve(STUDENT, "book-1")
        with pytest.raises(RuleError) as denied:
            await service.approve_reservation(STUDENT, held["id"])
        assert denied.value.status_code == 403
        approved = await service.approve_reservation(ADMIN, held["id"])
        assert approved["status"] == "ready"
        assert store.tables["book_copies"][0]["status"] == "reserved"
        with pytest.raises(RuleError):
            await service.approve_reservation(ADMIN, held["id"])

    asyncio.run(run())


def test_students_cannot_issue_and_a_missing_copy_cannot_be_reserved() -> None:
    async def run() -> None:
        store = await seed()
        service = CirculationService(store)
        with pytest.raises(RuleError) as denied:
            await service.issue(STUDENT, "amina@example.edu", "LM-2401")
        assert denied.value.status_code == 403
        await store.insert("books", {"id": "book-2", "title": "Empty", "authors": ["None"], "category_id": "cat-1"})
        with pytest.raises(RuleError):
            await service.reserve(STUDENT, "book-2")
        await store.insert(
            "reservations",
            {"id": "res-ready", "book_id": "book-1", "user_id": "student-1", "status": "ready", "placed_at": "2026-11-02"},
        )
        with pytest.raises(RuleError, match="desk"):
            await service.cancel_reservation(STUDENT, "res-ready")

    asyncio.run(run())


def test_student_token_cannot_issue_through_the_api() -> None:
    store = MemoryGateway()

    async def resolve(token: str, settings: Settings) -> Principal:
        assert settings.auth_configured
        if token == "student-token":
            return STUDENT
        return ADMIN

    async def save(token: str, user_id: str, payload: dict, settings: Settings) -> dict:
        return payload

    client = TestClient(create_app(CONFIGURED, resolve, save, lambda token: store))
    response = client.post(
        "/api/v1/loans",
        headers={"Authorization": "Bearer student-token"},
        json={"email": "amina@example.edu", "accession": "LM-2401"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Admin access is required."
