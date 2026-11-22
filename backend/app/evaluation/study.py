import time

from app.agents.graph import build_graph
from app.agents.intent import classify
from app.agents.tools import LibraryTools
from app.core.security import Principal
from app.db.gateway import MemoryGateway
from app.services.circulation import CirculationService
from app.services.files import normalise_title
from app.services.rules import RuleError

STUDENT = Principal(user_id="student-1", email="amina@example.edu", role="student", full_name="Amina")
TASKS = ("search", "reserve", "issue", "stock", "recommend", "duplicates", "ghost")
MESSAGES = {
    "search": "Find Plato",
    "reserve": "Please reserve Essay",
    "issue": "Issue Essay to me",
    "stock": "Which titles are low stock?",
    "recommend": "What should I read?",
    "duplicates": "Are there duplicate titles?",
    "ghost": "Please reserve Ghost",
}
EXPECTED_TOOLS = {
    "search": {"catalogue", "search"},
    "reserve": {"reserve"},
    "issue": {"desk"},
    "stock": {"stock"},
    "recommend": {"interests", "recommend"},
    "duplicates": {"duplicates"},
    "ghost": {"reserve"},
}
NOTE = "These figures come from one run of the fixed tasks on a private catalogue, kept apart from the library records."


async def run_study() -> dict:
    workflows = []
    for name in ("baseline", "single-agent", "multi-agent"):
        rows = []
        for task_id in TASKS:
            rows.append(await _run_task(name, task_id))
        verified = [row for row in rows if row["verificationMatch"] is not None]
        workflows.append(
            {
                "name": name,
                "completed": sum(row["completed"] for row in rows),
                "toolMatches": sum(row["toolMatch"] for row in rows),
                "policyPasses": sum(row["policyPass"] for row in rows),
                "policyTasks": len(rows),
                "verificationMatches": None if not verified else sum(bool(row["verificationMatch"]) for row in verified),
                "verificationTasks": len(verified),
                "elapsedMs": sum(row["elapsedMs"] for row in rows),
                "tasks": rows,
            }
        )
    return {"tasks": len(TASKS), "note": NOTE, "workflows": workflows}


async def _run_task(workflow: str, task_id: str) -> dict:
    library = MemoryGateway()
    trace = MemoryGateway()
    await _seed(library)
    run = await trace.insert(
        "agent_runs",
        {"user_id": STUDENT.user_id, "workflow": workflow, "status": "running", "request": MESSAGES[task_id]},
    )
    tools = LibraryTools(library, trace, STUDENT, run["id"], None)
    started = time.perf_counter()
    if workflow == "baseline":
        answer = await _baseline(library, trace, run["id"], MESSAGES[task_id])
    elif workflow == "single-agent":
        answer = await _single(tools, MESSAGES[task_id])
    else:
        final = await build_graph(tools).ainvoke(
            {"request": MESSAGES[task_id], "intent": "", "answer": "", "claims": {}, "error": "", "verified": False, "verification": ""}
        )
        answer = final.get("answer") or ""
    elapsed = max(0, int((time.perf_counter() - started) * 1000))
    events = await trace.select("agent_events", {"run_id": f"eq.{run['id']}", "select": "agent,tool,success,detail"})
    loans = await library.select("loans", {"select": "id"})
    reservations = await library.select("reservations", {"select": "id,book_id,status"})
    books = await library.select("books", {"select": "id"})
    outcome = {"answer": answer, "events": events, "loans": len(loans), "reservations": reservations, "books": len(books)}
    return {
        "id": task_id,
        "completed": _completed(task_id, outcome),
        "toolMatch": _tool_match(task_id, events),
        "policyPass": _policy(task_id, outcome),
        "verificationMatch": _verification(outcome),
        "elapsedMs": elapsed,
    }


async def _seed(gateway: MemoryGateway) -> None:
    await gateway.insert("categories", {"id": "philosophy", "name": "Philosophy"})
    await gateway.insert("books", {"id": "republic", "title": "The Republic", "authors": "Plato", "description": "Justice in the city", "category_id": "philosophy"})
    await gateway.insert("books", {"id": "essay", "title": "Essay", "authors": "Locke", "description": "Ideas and knowledge", "category_id": "philosophy"})
    await gateway.insert("book_copies", {"id": "c1", "book_id": "republic", "status": "borrowed"})
    await gateway.insert("book_copies", {"id": "c2", "book_id": "essay", "status": "available"})
    await gateway.insert("loans", {"id": "loan-1", "copy_id": "c1", "user_id": STUDENT.user_id, "returned_at": None, "issued_at": "2026-11-01", "due_at": "2026-11-15"})
    await gateway.insert("profiles", {"id": STUDENT.user_id, "reading_interests": ["philosophy"]})


async def _single(tools: LibraryTools, message: str) -> str:
    intent = classify(message)
    await tools.record("orchestrator", "route", True, {"summary": intent}, time.perf_counter())
    result = await _specialist(tools, intent, message)
    return result["answer"]


async def _specialist(tools: LibraryTools, intent: str, message: str) -> dict:
    if intent == "metadata":
        return await tools.metadata(message)
    if intent == "recommendation":
        return await tools.recommend()
    if intent == "similar":
        return await tools.similar(message)
    if intent == "circulation":
        return await tools.circulate(message)
    if intent == "inventory":
        return await tools.inventory()
    return await tools.search(message)


async def _baseline(library: MemoryGateway, trace: MemoryGateway, run_id: str, message: str) -> str:
    intent = classify(message)

    async def record(tool: str, success: bool, detail: dict) -> None:
        await trace.insert(
            "agent_events",
            {"run_id": run_id, "agent": "baseline", "tool": tool, "success": success, "latency_ms": 0, "detail": detail},
        )

    if intent == "circulation" and ("issue" in message.casefold() or "return" in message.casefold()):
        summary = "A librarian issues and returns copies at the desk."
        await record("desk", True, {"summary": summary})
        return summary
    if intent == "circulation" and "reserve" in message.casefold():
        books = await library.select("books", {"select": "id,title"})
        match = next((book for book in books if str(book["title"]).casefold() in message.casefold()), None)
        if match is None:
            summary = "Name the title you want reserved."
            await record("reserve", False, {"summary": summary})
            return summary
        try:
            saved = await CirculationService(library).reserve(STUDENT, match["id"])
        except RuleError as exc:
            await record("reserve", False, {"summary": exc.detail})
            return exc.detail
        summary = f"Reservation placed for {match['title']}. A librarian issues the copy."
        await record("reserve", True, {"summary": summary, "book_ids": [match["id"]], "reservation_id": saved["id"]})
        return summary
    if intent == "inventory":
        books = await library.select("books", {"select": "id,title"})
        copies = await library.select("book_copies", {"select": "book_id,status"})
        low = []
        for book in books:
            owned = [copy for copy in copies if copy["book_id"] == book["id"]]
            if owned and not any(copy["status"] == "available" for copy in owned):
                low.append(book["title"])
        summary = "Low stock: " + ", ".join(low) + "." if low else "Every title with a copy has one available."
        await record("stock", True, {"summary": summary, "book_ids": [book["id"] for book in books if book["title"] in low]})
        return summary
    if intent == "recommendation":
        books = await library.select("books", {"select": "id,title,category_id"})
        chosen = [book["title"] for book in books if book["category_id"] == "philosophy" and book["id"] != "republic"]
        summary = " ".join(f"{title} matches an interest you listed." for title in chosen) or "Nothing on the shelf matches your interests."
        await record("recommend", True, {"summary": summary, "book_ids": ["essay"] if chosen else []})
        return summary
    if intent == "metadata":
        books = await library.select("books", {"select": "title"})
        groups: dict[str, int] = {}
        for book in books:
            key = normalise_title(str(book["title"]))
            groups[key] = groups.get(key, 0) + 1
        summary = "Duplicate titles are on the shelf." if any(count > 1 for count in groups.values()) else "No duplicate titles were found."
        await record("duplicates", True, {"summary": summary})
        return summary
    books = await library.select("books", {"select": "id,title,authors"})
    tokens = [word.strip("?.") for word in message.casefold().split() if word.strip("?.") not in {"find", "the", "a"}]
    hits = [book for book in books if all(token in f"{book['title']} {book['authors']}".casefold() for token in tokens)]
    summary = "In the catalogue: " + "; ".join(f"{book['title']} — {book['authors']}" for book in hits) + "." if hits else "Nothing in the catalogue matched."
    await record("search", True, {"summary": summary, "book_ids": [book["id"] for book in hits]})
    return summary


def _completed(task_id: str, outcome: dict) -> bool:
    text = outcome["answer"]
    if task_id == "search":
        return "The Republic" in text
    if task_id == "reserve":
        return _has_reservation(outcome, "essay")
    if task_id == "issue":
        return "librarian" in text.casefold()
    if task_id == "stock":
        return "The Republic" in text
    if task_id == "recommend":
        return "Essay" in text and "The Republic" not in text
    if task_id == "duplicates":
        return "No duplicate titles" in text
    return not _has_reservation(outcome, "essay") and outcome["reservations"] == []


def _policy(task_id: str, outcome: dict) -> bool:
    if outcome["loans"] != 1 or outcome["books"] != 2:
        return False
    if task_id == "reserve":
        return _has_reservation(outcome, "essay")
    return outcome["reservations"] == []


def _has_reservation(outcome: dict, book_id: str) -> bool:
    return any(row.get("book_id") == book_id and row.get("status") == "pending" for row in outcome["reservations"])


def _tool_match(task_id: str, events: list[dict]) -> bool:
    tools = {event.get("tool") for event in events}
    return bool(tools & EXPECTED_TOOLS[task_id])


def _verification(outcome: dict) -> bool | None:
    verify = [event for event in outcome["events"] if event.get("tool") == "reread"]
    if not verify:
        return None
    specialist = [event for event in outcome["events"] if event.get("tool") not in {"route", "reread"}]
    if not specialist or not specialist[-1].get("success"):
        return verify[-1].get("success") is False
    detail = specialist[-1].get("detail") or {}
    ids_ok = all(book_id in {"republic", "essay"} for book_id in detail.get("book_ids") or [])
    reservation_id = detail.get("reservation_id")
    reservation_ok = True
    if reservation_id:
        reservation_ok = any(row.get("id") == reservation_id and row.get("status") in {"pending", "ready"} for row in outcome["reservations"])
    return bool(verify[-1].get("success")) is (ids_ok and reservation_ok)
