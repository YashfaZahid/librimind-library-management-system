import asyncio

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.security import Principal
from app.db.gateway import MemoryGateway
from app.db.storage import MemoryStorage
from app.main import create_app
from app.services.insights import InsightService
from app.services.learning import demand, evaluate, forecast, popularity, rank_books, similar_titles, wording_search

STUDENT = Principal(user_id="student-1", email="amina@example.edu", role="student", full_name="Amina")
ADMIN = Principal(user_id="admin-1", email="desk@example.edu", role="admin", full_name="Duty")
CONFIGURED = Settings(supabase_url="https://librimind.supabase.co", supabase_anon_key="anon-key")

BOOKS = [
    {"id": "republic", "title": "The Republic", "authors": "Plato", "description": "Justice in the city and the soul", "category_id": "philosophy"},
    {"id": "essay", "title": "An Essay Concerning Human Understanding", "authors": "Locke", "description": "Ideas, knowledge, and the mind", "category_id": "philosophy"},
    {"id": "garden", "title": "The Secret Garden", "authors": "Burnett", "description": "A child finds a locked garden", "category_id": "literature"},
]
CATEGORIES = [{"id": "philosophy", "name": "Philosophy"}, {"id": "literature", "name": "Literature"}]
COPIES = [
    {"id": "c1", "book_id": "republic", "status": "available"},
    {"id": "c2", "book_id": "essay", "status": "available"},
    {"id": "c3", "book_id": "garden", "status": "borrowed"},
]


def test_wording_search_ranks_the_closer_title_first() -> None:
    ranked = wording_search(BOOKS, CATEGORIES, "justice and the soul")
    assert ranked[0]["bookId"] == "republic"
    assert "garden" not in {item["bookId"] for item in ranked}


def test_similar_titles_keep_the_close_book_and_drop_the_rest() -> None:
    books = [
        {"id": "odyssey", "title": "The Odyssey", "authors": "Homer", "description": "voyage home across the sea", "category_id": "literature"},
        {"id": "iliad", "title": "The Iliad", "authors": "Homer", "description": "voyage and war beside the sea", "category_id": "literature"},
        {"id": "garden", "title": "The Secret Garden", "authors": "Burnett", "description": "a child finds a locked garden", "category_id": "literature"},
    ]
    books.extend(
        {"id": f"ledger-{number}", "title": f"Ledger {number}", "authors": "Clerk", "description": f"accounts column {number}", "category_id": "literature"}
        for number in range(8)
    )
    ranked = similar_titles(books, CATEGORIES, "The Odyssey")
    assert [item["title"] for item in ranked] == ["The Iliad"]


def test_recommendations_explain_the_interest_and_skip_a_current_loan() -> None:
    loans = [
        {"id": "l1", "copy_id": "c1", "user_id": "student-1", "issued_at": "2026-10-01", "returned_at": "2026-10-10"},
        {"id": "l2", "copy_id": "c3", "user_id": "student-1", "issued_at": "2026-11-01", "returned_at": None},
    ]
    ranked = rank_books(BOOKS, CATEGORIES, loans, COPIES, "student-1", ["philosophy"])
    titles = [item["title"] for item in ranked]
    assert "The Secret Garden" not in titles
    assert any("matches an interest you listed" in item["explanation"] and "Available, 1 copy on the shelf." in item["explanation"] for item in ranked)
    assert ranked[0]["modelVersion"] == "tfidf-cosine-v1"


def test_popularity_demand_and_forecast_are_counted_from_loans() -> None:
    loans = [
        {"id": "l1", "copy_id": "c1", "user_id": "student-1", "issued_at": "2026-10-05", "returned_at": "2026-10-12"},
        {"id": "l2", "copy_id": "c1", "user_id": "student-1", "issued_at": "2026-10-19", "returned_at": "2026-10-26"},
        {"id": "l3", "copy_id": "c3", "user_id": "student-1", "issued_at": "2026-11-02", "returned_at": None},
    ]
    reservations = [{"id": "r1", "book_id": "republic", "user_id": "student-1", "status": "pending"}]
    assert popularity(BOOKS, COPIES, loans)[0] == {"bookId": "republic", "title": "The Republic", "loans": 2}
    assert demand(BOOKS, COPIES, loans, reservations)[0]["demand"] == 3
    projected = forecast(BOOKS, COPIES, loans)
    assert "average loans per week" in projected["method"]
    assert "latest week" in projected["check"]
    thin = forecast(BOOKS, COPIES, loans[:1])
    assert thin["check"] == "Not enough weeks of loans to check the forecast."


def test_evaluation_says_when_there_are_not_enough_loans() -> None:
    one = [{"id": "l1", "copy_id": "c1", "user_id": "student-1", "issued_at": "2026-10-01", "returned_at": None}]
    empty = evaluate(BOOKS, CATEGORIES, one, COPIES, [{"id": "student-1", "reading_interests": ["philosophy"]}])
    assert empty["readers"] == 0
    assert "Not enough loan history" in empty["sentence"]
    loans = [
        {"id": "l1", "copy_id": "c1", "user_id": "student-1", "issued_at": "2026-10-01", "returned_at": "2026-10-08"},
        {"id": "l2", "copy_id": "c2", "user_id": "student-1", "issued_at": "2026-11-01", "returned_at": "2026-11-08"},
    ]
    scored = evaluate(BOOKS, CATEGORIES, loans, COPIES, [{"id": "student-1", "reading_interests": ["philosophy"]}])
    assert scored["readers"] == 1
    assert "1 of 1" in scored["sentence"] or "0 of 1" in scored["sentence"]


def test_a_student_cannot_read_the_inventory_forecast() -> None:
    gateway = MemoryGateway()

    async def resolve(token: str, settings: Settings) -> Principal:
        return STUDENT

    async def save(token: str, user_id: str, payload: dict, settings: Settings) -> dict:
        return payload

    async def prepare() -> None:
        for book in BOOKS:
            await gateway.insert("books", book)
        for category in CATEGORIES:
            await gateway.insert("categories", category)
        await gateway.insert("profiles", {"id": "student-1", "reading_interests": ["philosophy"]})

    asyncio.run(prepare())
    client = TestClient(
        create_app(CONFIGURED, resolve, save, lambda token: gateway, lambda token: MemoryStorage(), None, lambda: gateway)
    )
    denied = client.get("/api/v1/insights", headers={"Authorization": "Bearer student-token"})
    assert denied.status_code == 403
    found = client.get("/api/v1/search/wording?q=justice", headers={"Authorization": "Bearer student-token"})
    assert found.status_code == 200
    assert found.json()["results"][0]["bookId"] == "republic"
    saved = asyncio.run(InsightService(gateway, gateway).recommendations(STUDENT))
    assert saved["recommendations"]
    logs = asyncio.run(gateway.select("recommendation_logs", {"select": "model_version"}))
    assert logs[0]["model_version"] == "tfidf-cosine-v1"
