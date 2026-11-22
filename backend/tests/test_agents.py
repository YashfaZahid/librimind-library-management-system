import asyncio

from fastapi.testclient import TestClient

from app.agents.intent import classify
from app.agents.service import AssistantService
from app.agents.tools import LibraryTools
from app.core.config import Settings
from app.core.security import Principal
from app.db.gateway import MemoryGateway
from app.db.storage import MemoryStorage
from app.main import create_app

STUDENT = Principal(user_id="student-1", email="amina@example.edu", role="student", full_name="Amina")
ADMIN = Principal(user_id="admin-1", email="desk@example.edu", role="admin", full_name="Duty")
CONFIGURED = Settings(supabase_url="https://librimind.supabase.co", supabase_anon_key="anon-key")


def test_the_orchestrator_picks_a_specialist_from_the_question() -> None:
    assert classify("Where is The Republic?") == "search"
    assert classify("What should I read?") == "recommendation"
    assert classify("Books similar to The Republic") == "similar"
    assert classify("Please reserve The Republic") == "circulation"
    assert classify("Which titles are low stock?") == "inventory"
    assert classify("Are there duplicate titles?") == "metadata"


async def seed() -> MemoryGateway:
    gateway = MemoryGateway()
    await gateway.insert("books", {"id": "republic", "title": "The Republic", "authors": "Plato", "category_id": "philosophy", "isbn13": None})
    await gateway.insert("books", {"id": "essay", "title": "Essay", "authors": "Plato", "category_id": "philosophy", "isbn13": None})
    await gateway.insert("book_copies", {"id": "copy-1", "book_id": "republic", "accession": "R-1", "status": "borrowed"})
    await gateway.insert("book_copies", {"id": "copy-2", "book_id": "essay", "accession": "E-1", "status": "available"})
    await gateway.insert("profiles", {"id": "student-1", "reading_interests": ["philosophy"]})
    return gateway


def test_a_reservation_is_written_by_circulation_and_reread_by_verification() -> None:
    async def run() -> None:
        gateway = await seed()
        result = await AssistantService(gateway, gateway).ask(STUDENT, "Please reserve The Republic")
        assert result["intent"] == "circulation"
        assert result["verified"] is True
        assert "Reservation placed" in result["response"]
        agents = [event["agent"] for event in result["events"]]
        assert agents == ["orchestrator", "circulation", "verification"]
        held = await gateway.select("reservations", {"book_id": "eq.republic", "select": "id,status"})
        assert held[0]["status"] == "pending"
        loans = await gateway.select("loans", {"select": "id"})
        assert loans == []

    asyncio.run(run())


def test_a_student_cannot_make_the_assistant_issue_a_copy() -> None:
    async def run() -> None:
        gateway = await seed()
        result = await AssistantService(gateway, gateway).ask(STUDENT, "Issue The Republic to me")
        assert "librarian" in result["response"].lower()
        assert await gateway.select("loans", {"select": "id"}) == []

    asyncio.run(run())


def test_verification_rejects_a_title_that_is_not_in_the_catalogue() -> None:
    async def run() -> None:
        gateway = await seed()
        run_row = await gateway.insert("agent_runs", {"user_id": "student-1", "workflow": "multi-agent", "status": "running", "request": ""})
        tools = LibraryTools(gateway, gateway, STUDENT, run_row["id"], None)
        result = await tools.verify({"book_ids": ["missing-title"]})
        assert result["ok"] is False
        assert "not in the catalogue" in result["reason"]

    asyncio.run(run())


def test_recommendation_and_inventory_read_the_catalogue() -> None:
    async def run() -> None:
        gateway = await seed()
        await gateway.insert("loans", {"id": "loan-1", "copy_id": "copy-1", "user_id": "student-1", "returned_at": None})
        recommended = await AssistantService(gateway, gateway).ask(STUDENT, "What should I read?")
        assert "Essay matches an interest" in recommended["response"]
        assert "\n- " in recommended["response"]
        assert "Available, 1 copy on the shelf." in recommended["response"]
        assert "The Republic" not in recommended["response"]
        stock = await AssistantService(gateway, gateway).ask(ADMIN, "Which titles are low stock?")
        assert "The Republic" in stock["response"]
        assert stock["verified"] is True

    asyncio.run(run())


def test_search_answers_from_the_catalogue() -> None:
    async def run() -> None:
        gateway = await seed()
        result = await AssistantService(gateway, gateway).ask(STUDENT, "Find Plato")
        assert result["intent"] == "search"
        assert "The Republic" in result["response"]
        assert result["verified"] is True

    asyncio.run(run())


def test_a_partial_title_is_enough_to_reserve() -> None:
    async def run() -> None:
        gateway = MemoryGateway()
        await gateway.insert("books", {"id": "west", "title": "Journey To the West", "authors": ["Wu Cheng'en"]})
        await gateway.insert("book_copies", {"id": "copy-west", "book_id": "west", "accession": "W-1", "status": "available"})
        result = await AssistantService(gateway, gateway).ask(STUDENT, "Please reserve journey to the west")
        assert "Reservation placed" in result["response"]
        assert result["verified"] is True

    asyncio.run(run())


def test_a_model_reserves_by_calling_a_tool() -> None:
    class Scripted:
        def __init__(self) -> None:
            self.turn = 0

        async def reply(self, messages: list, tools: list) -> dict:
            del messages, tools
            self.turn += 1
            if self.turn == 1:
                return {
                    "content": None,
                    "tool_calls": [{"id": "call-1", "name": "reserve_book", "arguments": {"title": "Journey to the West"}}],
                    "raw": {"role": "assistant", "content": None, "tool_calls": []},
                }
            return {
                "content": "Journey To the West is reserved for you.",
                "tool_calls": [],
                "raw": {"role": "assistant", "content": "Journey To the West is reserved for you."},
            }

    async def run() -> None:
        gateway = MemoryGateway()
        await gateway.insert("books", {"id": "west", "title": "Journey To the West", "authors": ["Wu Cheng'en"]})
        await gateway.insert("book_copies", {"id": "copy-west", "book_id": "west", "accession": "W-1", "status": "available"})
        result = await AssistantService(gateway, gateway, model=Scripted()).ask(STUDENT, "Can you hold that Chinese novel for me?")
        assert result["response"] == "Journey To the West is reserved for you."
        assert result["verified"] is True
        held = await gateway.select("reservations", {"select": "id,book_id"})
        assert held[0]["book_id"] == "west"

    asyncio.run(run())


def test_similar_titles_sent_to_the_model_are_a_short_list() -> None:
    class Scripted:
        def __init__(self) -> None:
            self.sent: list[str] = []

        async def reply(self, messages: list, tools: list) -> dict:
            del tools
            payloads = [str(item.get("content") or "") for item in messages if item.get("role") == "tool"]
            if payloads:
                self.sent.extend(payloads)
                return {"content": payloads[-1], "tool_calls": [], "raw": {"role": "assistant", "content": payloads[-1]}}
            return {
                "content": None,
                "tool_calls": [{"id": "call-similar", "name": "similar_titles", "arguments": {"title": "The Odyssey"}}],
                "raw": {"role": "assistant", "content": None, "tool_calls": []},
            }

    async def run() -> None:
        gateway = MemoryGateway()
        await gateway.insert("categories", {"id": "lit", "name": "Literature"})
        await gateway.insert("books", {"id": "odyssey", "title": "The Odyssey", "authors": "Homer", "description": "voyage home across the sea", "category_id": "lit"})
        await gateway.insert("books", {"id": "iliad", "title": "The Iliad", "authors": "Homer", "description": "voyage and war beside the sea", "category_id": "lit"})
        await gateway.insert("book_copies", {"id": "copy-iliad", "book_id": "iliad", "status": "available"})
        for number in range(12):
            await gateway.insert(
                "books",
                {
                    "id": f"other-{number}",
                    "title": f"Ledger {number}",
                    "authors": "Clerk",
                    "description": f"accounts column {number} tally {number}",
                    "category_id": "lit",
                },
            )
        model = Scripted()
        result = await AssistantService(gateway, gateway, model=model).ask(STUDENT, "What is similar to The Odyssey?")
        assert model.sent
        payload = model.sent[0]
        assert "The Iliad" in payload
        assert payload.count("\n- ") <= 5
        assert "Ledger" not in payload
        assert "The Iliad" in result["response"]

    asyncio.run(run())


def test_the_assistant_route_records_a_run() -> None:
    gateway = MemoryGateway()

    async def resolve(token: str, settings: Settings) -> Principal:
        return STUDENT

    async def save(token: str, user_id: str, payload: dict, settings: Settings) -> dict:
        return payload

    async def prepare() -> None:
        await gateway.insert("books", {"id": "republic", "title": "The Republic", "authors": "Plato", "category_id": "philosophy"})
        await gateway.insert("book_copies", {"id": "copy-1", "book_id": "republic", "status": "available"})

    asyncio.run(prepare())
    client = TestClient(
        create_app(CONFIGURED, resolve, save, lambda token: gateway, lambda token: MemoryStorage(), None, lambda: gateway)
    )
    response = client.post("/api/v1/assistant", headers={"Authorization": "Bearer student-token"}, json={"message": "Find Plato"})
    assert response.status_code == 200
    body = response.json()
    assert body["verified"] is True
    listed = client.get("/api/v1/assistant/runs", headers={"Authorization": "Bearer student-token"})
    assert listed.status_code == 200
    assert listed.json()["runs"][0]["id"] == body["runId"]
