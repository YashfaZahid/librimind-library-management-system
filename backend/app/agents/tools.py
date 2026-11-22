import time
from typing import Any

from app.core.security import Principal
from app.db.gateway import Gateway
from app.services.circulation import CirculationService
from app.services.learning import MODEL_VERSION, availability_sentence, copy_availability, rank_books, similar_titles
from app.services.discovery import DiscoveryService
from app.services.files import normalise_title
from app.services.rules import RuleError

STOP = {"the", "and", "for", "with", "find", "search", "book", "books", "about", "show", "what", "where"}


class LibraryTools:
    def __init__(self, gateway: Gateway, trace: Gateway, user: Principal, run_id: str, discovery: DiscoveryService | None) -> None:
        self.gateway = gateway
        self.trace = trace
        self.user = user
        self.run_id = run_id
        self.discovery = discovery
        self.events: list[dict[str, Any]] = []

    async def record(self, agent: str, tool: str, success: bool, detail: dict, started: float) -> dict:
        event = {
            "run_id": self.run_id,
            "agent": agent,
            "tool": tool,
            "success": success,
            "latency_ms": max(0, int((time.perf_counter() - started) * 1000)),
            "detail": detail,
        }
        stored = await self.trace.insert("agent_events", event)
        public = {
            "agent": agent,
            "tool": tool,
            "success": success,
            "latencyMs": event["latency_ms"],
            "detail": detail.get("summary") or detail.get("error") or "",
        }
        public["id"] = stored.get("id")
        self.events.append(public)
        return public

    async def search(self, message: str) -> dict:
        started = time.perf_counter()
        books = await self.gateway.select("books", {"select": "id,title,authors,description"})
        copies = await self.gateway.select("book_copies", {"select": "id,book_id,status"})
        tokens = [word for word in _words(message) if word not in STOP]
        hits = [book for book in books if _matches(book, tokens)]
        lines = []
        for book in hits[:5]:
            available, total = copy_availability(copies, book["id"])
            lines.append(f"- {book.get('title')} — {_authors(book.get('authors'))}. {availability_sentence(available, total)}")
        external: list[str] = []
        if not hits and self.discovery and len(message.strip()) >= 2:
            try:
                found = await self.discovery.search(message)
                for group in found["groups"]:
                    for hit in group["results"][:3]:
                        external.append(f"{hit['title']} at {hit['source']}: {hit['pageUrl']}")
            except Exception:
                external = []
        if lines:
            summary = "In the catalogue:\n" + "\n".join(lines)
        elif external:
            summary = "Nothing in the catalogue matched. Approved sources list: " + "; ".join(external) + "."
        else:
            summary = "Nothing in the catalogue matched."
        detail = {"summary": summary, "book_ids": [book["id"] for book in hits[:5]]}
        await self.record("search", "catalogue", True, detail, started)
        return {"answer": summary, "claims": {"book_ids": detail["book_ids"]}, "error": ""}

    async def metadata(self, message: str) -> dict:
        started = time.perf_counter()
        books = await self.gateway.select("books", {"select": "id,title,authors,isbn13"})
        groups: dict[str, list[str]] = {}
        for book in books:
            groups.setdefault(normalise_title(str(book.get("title") or "")), []).append(str(book.get("title")))
        duplicates = [titles for titles in groups.values() if len(titles) > 1 and titles[0]]
        mentioned = [book for book in books if normalise_title(str(book.get("title") or "")) and normalise_title(str(book.get("title"))) in message.casefold()]
        parts = []
        if mentioned:
            book = mentioned[0]
            parts.append(f"{book.get('title')} by {_authors(book.get('authors'))}. ISBN {book.get('isbn13') or 'not recorded'}.")
        if duplicates:
            parts.append("Duplicate titles: " + "; ".join(", ".join(titles) for titles in duplicates[:5]) + ".")
        summary = " ".join(parts) or "No duplicate titles were found."
        detail = {"summary": summary, "book_ids": [book["id"] for book in mentioned[:5]]}
        await self.record("metadata", "duplicates", True, detail, started)
        return {"answer": summary, "claims": {"book_ids": detail["book_ids"]}, "error": ""}

    async def recommend(self) -> dict:
        started = time.perf_counter()
        profiles = await self.gateway.select("profiles", {"id": f"eq.{self.user.user_id}", "select": "id,reading_interests"})
        interests = list((profiles[0].get("reading_interests") if profiles else None) or [])
        books = await self.gateway.select("books", {"select": "id,title,authors,description,category_id"})
        categories = await self.gateway.select("categories", {"select": "id,name"})
        loans = await self.gateway.select("loans", {"select": "id,copy_id,user_id,returned_at"})
        copies = await self.gateway.select("book_copies", {"select": "id,book_id,status"})
        chosen = rank_books(books, categories, loans, copies, self.user.user_id, interests)
        if not interests and not chosen:
            summary = "Add reading interests on your profile before asking for a recommendation."
        elif not chosen:
            summary = "Nothing on the shelf matches your interests that you do not already have out."
        else:
            summary = "These titles are in this library.\n" + "\n".join(f"- {item['explanation']}" for item in chosen)
            for item in chosen:
                await self.trace.insert(
                    "recommendation_logs",
                    {
                        "user_id": self.user.user_id,
                        "book_id": item["bookId"],
                        "score": item["score"],
                        "explanation": item["explanation"],
                        "model_version": MODEL_VERSION,
                    },
                )
        detail = {"summary": summary, "book_ids": [item["bookId"] for item in chosen], "model": MODEL_VERSION}
        await self.record("recommendation", "interests", True, detail, started)
        return {"answer": summary, "claims": {"book_ids": detail["book_ids"]}, "error": ""}

    async def similar(self, message: str) -> dict:
        started = time.perf_counter()
        books = await self.gateway.select("books", {"select": "id,title,authors,description,category_id"})
        categories = await self.gateway.select("categories", {"select": "id,name"})
        copies = await self.gateway.select("book_copies", {"select": "id,book_id,status"})
        chosen = similar_titles(books, categories, message)
        lines = []
        for item in chosen:
            available, total = copy_availability(copies, item["bookId"])
            lines.append(f"- {item['title']} - {availability_sentence(available, total)}")
        summary = "Closest titles in this library:\n" + "\n".join(lines) if lines else "Nothing else in this library is close to that title."
        detail = {"summary": summary, "book_ids": [item["bookId"] for item in chosen]}
        await self.record("similar", "wording", True, detail, started)
        return {"answer": summary, "claims": {"book_ids": detail["book_ids"]}, "error": ""}

    async def circulate(self, message: str) -> dict:
        started = time.perf_counter()
        text = message.casefold()
        if "issue" in text or "return" in text:
            if self.user.role != "admin":
                summary = "A librarian issues and returns copies at the desk."
            else:
                summary = "Use the circulation desk for a specific copy. The assistant will not guess an accession number."
            await self.record("circulation", "desk", True, {"summary": summary}, started)
            return {"answer": summary, "claims": {}, "error": ""}
        if "reserve" in text:
            books = await self.gateway.select("books", {"select": "id,title"})
            match = match_title(books, text)
            if match is None:
                summary = "Name the title you want reserved."
                await self.record("circulation", "reserve", False, {"summary": summary, "error": summary}, started)
                return {"answer": summary, "claims": {}, "error": summary}
            try:
                saved = await CirculationService(self.gateway).reserve(self.user, match["id"])
            except RuleError as exc:
                await self.record("circulation", "reserve", False, {"summary": exc.detail, "error": exc.detail}, started)
                return {"answer": exc.detail, "claims": {}, "error": exc.detail}
            summary = f"Reservation placed for {match['title']}. A librarian issues the copy."
            claims = {"book_ids": [match["id"]], "reservation_id": saved["id"]}
            await self.record("circulation", "reserve", True, {"summary": summary, **claims}, started)
            return {"answer": summary, "claims": claims, "error": ""}
        loans = await self.gateway.select("loans", {"user_id": f"eq.{self.user.user_id}", "returned_at": "is.null", "select": "id,due_at"})
        fines = await self.gateway.select("fines", {"user_id": f"eq.{self.user.user_id}", "status": "eq.open", "select": "id,amount_cents"})
        due = ", ".join(str(loan.get("due_at") or "")[:10] for loan in loans) or "none"
        owed = sum(int(fine.get("amount_cents") or 0) for fine in fines)
        summary = f"Open loans due on {due}. Open fines: {owed / 100:.2f}."
        await self.record("circulation", "account", True, {"summary": summary}, started)
        return {"answer": summary, "claims": {}, "error": ""}

    async def reserve_named(self, title: str) -> dict:
        return await self.circulate(f"reserve {title}")

    async def inventory(self) -> dict:
        started = time.perf_counter()
        books = await self.gateway.select("books", {"select": "id,title"})
        copies = await self.gateway.select("book_copies", {"select": "book_id,status"})
        low: list[str] = []
        for book in books:
            owned = [copy for copy in copies if copy.get("book_id") == book["id"]]
            available = [copy for copy in owned if copy.get("status") == "available"]
            if owned and not available:
                low.append(str(book.get("title")))
        shown = low[:8]
        extra = len(low) - len(shown)
        if not shown:
            summary = "Every title with a copy has one available."
        elif extra:
            summary = "Low stock: " + ", ".join(shown) + f", and {extra} more."
        else:
            summary = "Low stock: " + ", ".join(shown) + "."
        detail = {"summary": summary, "book_ids": [book["id"] for book in books if book.get("title") in low]}
        await self.record("inventory", "stock", True, detail, started)
        return {"answer": summary, "claims": {"book_ids": detail["book_ids"]}, "error": ""}

    async def verify(self, claims: dict) -> dict:
        started = time.perf_counter()
        missing: list[str] = []
        for book_id in claims.get("book_ids") or []:
            rows = await self.gateway.select("books", {"id": f"eq.{book_id}", "select": "id"})
            if not rows:
                missing.append(str(book_id))
        reservation_id = claims.get("reservation_id")
        reservation_ok = True
        if reservation_id:
            rows = await self.gateway.select("reservations", {"id": f"eq.{reservation_id}", "select": "id,status"})
            reservation_ok = bool(rows) and rows[0].get("status") in {"pending", "ready"}
        ok = not missing and reservation_ok
        if missing:
            reason = "A cited title is not in the catalogue."
        elif not reservation_ok:
            reason = "The reservation is not in the database."
        else:
            reason = "The cited records are still in the database."
        detail = {"summary": reason, "ok": ok}
        await self.record("verification", "reread", ok, detail, started)
        return {"ok": ok, "reason": reason}


def _authors(value: object) -> str:
    if isinstance(value, list):
        names = [str(name).strip() for name in value if str(name).strip()]
        return ", ".join(names) or "Unknown"
    text = str(value or "").strip()
    return text or "Unknown"


def match_title(books: list[dict], text: str) -> dict | None:
    needle = " ".join(text.casefold().split())
    contained = [
        book
        for book in books
        if (title := " ".join(str(book.get("title") or "").casefold().split())) and title in needle
    ]
    if contained:
        return max(contained, key=lambda book: len(str(book.get("title") or "")))
    tokens = [word for word in _words(text) if word not in STOP and len(word) > 3]
    best: tuple[int, dict] | None = None
    for book in books:
        title_words = {word for word in _words(str(book.get("title") or "")) if word not in STOP and len(word) > 2}
        if not title_words:
            continue
        overlap = title_words.intersection(tokens)
        if len(overlap) < max(1, len(title_words) - 1):
            continue
        if best is None or len(overlap) > best[0]:
            best = (len(overlap), book)
    return best[1] if best else None


def _words(message: str) -> list[str]:
    return ["".join(character for character in word.casefold() if character.isalnum()) for word in message.split()]


def _matches(book: dict, tokens: list[str]) -> bool:
    haystack = f"{book.get('title') or ''} {book.get('authors') or ''}".casefold()
    return bool(tokens) and all(token in haystack for token in tokens)
