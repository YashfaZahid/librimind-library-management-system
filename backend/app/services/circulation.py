import asyncio

from app.core.security import Principal
from app.db.gateway import Gateway, GatewayError
from app.services.rules import (
    RuleError,
    assert_can_issue,
    assert_can_reserve,
    due_at,
    fine_amount,
    hold_expires,
    overdue_days,
    utcnow,
)
from app.services.covers import cover_for_isbn
from app.services.snapshot import to_snapshot

OPEN_LOAN = {"returned_at": "is.null"}
OPEN_RESERVATION = {"status": "in.(pending,ready)"}


class CirculationService:
    def __init__(self, gateway: Gateway) -> None:
        self.gateway = gateway

    async def bundle(self, user: Principal, *, shelf_only: bool = False) -> dict:
        today = utcnow().date().isoformat()
        if shelf_only:
            categories, books, copies = await asyncio.gather(
                self.gateway.select("categories", {"select": "id,name,sort_order", "order": "sort_order.asc"}),
                self.gateway.select(
                    "books",
                    {
                        "select": "id,title,authors,category_id,isbn13,description,publication_year,publisher,page_count,cover_path",
                        "order": "title.asc",
                    },
                ),
                self.gateway.select("book_copies", {"select": "id,book_id,accession,status", "order": "accession.asc"}),
            )
            return to_snapshot(
                user_id=user.user_id,
                today=today,
                categories=categories,
                books=books,
                copies=copies,
                profiles=[],
                loans=[],
                reservations=[],
                fines=[],
            )
        categories, books, copies, profiles, loans, reservations, fines = await asyncio.gather(
            self.gateway.select("categories", {"select": "id,name,sort_order", "order": "sort_order.asc"}),
            self.gateway.select(
                "books",
                {
                    "select": "id,title,authors,category_id,isbn13,description,publication_year,publisher,page_count,cover_path",
                    "order": "title.asc",
                },
            ),
            self.gateway.select("book_copies", {"select": "id,book_id,accession,status", "order": "accession.asc"}),
            self.gateway.select(
                "profiles",
                {"select": "id,email,full_name,programme,reading_interests,role", "order": "full_name.asc"},
            ),
            self.gateway.select(
                "loans",
                {"select": "id,copy_id,user_id,issued_at,due_at,returned_at", "order": "issued_at.desc"},
            ),
            self.gateway.select(
                "reservations",
                {"select": "id,book_id,user_id,status,placed_at", **OPEN_RESERVATION, "order": "placed_at.asc"},
            ),
            self.gateway.select(
                "fines",
                {"select": "id,loan_id,user_id,amount_cents,reason,status,created_at", "order": "created_at.desc"},
            ),
        )
        return to_snapshot(
            user_id=user.user_id,
            today=today,
            categories=categories,
            books=books,
            copies=copies,
            profiles=profiles,
            loans=loans,
            reservations=reservations,
            fines=fines,
        )

    async def create_book(self, user: Principal, payload: dict) -> dict:
        self._require_admin(user)
        title = str(payload.get("title") or "").strip()
        authors = [part.strip() for part in payload.get("authors") or [] if str(part).strip()]
        category_id = str(payload.get("categoryId") or "").strip()
        if not title or not authors or not category_id:
            raise RuleError("A title needs a name, at least one author, and a subject.")
        year = int(payload.get("year") or 0)
        pages = int(payload.get("pages") or 0)
        isbn = str(payload.get("isbn13") or "").strip()
        row = {
            "title": title,
            "authors": authors,
            "category_id": category_id,
            "publication_year": year or None,
            "publisher": str(payload.get("publisher") or "").strip(),
            "page_count": pages or None,
            "description": str(payload.get("description") or "").strip(),
            "created_by": user.user_id,
        }
        if isbn:
            row["isbn13"] = isbn
        cover = cover_for_isbn(isbn)
        if cover:
            row["cover_path"] = cover
        try:
            return await self.gateway.insert("books", row)
        except GatewayError as exc:
            raise self._translate(exc, "A book with that ISBN already exists.") from exc

    async def update_book(self, user: Principal, book_id: str, payload: dict) -> dict:
        self._require_admin(user)
        patch = {
            "title": str(payload.get("title") or "").strip(),
            "authors": [part.strip() for part in payload.get("authors") or [] if str(part).strip()],
            "category_id": str(payload.get("categoryId") or "").strip(),
            "publication_year": int(payload.get("year") or 0) or None,
            "publisher": str(payload.get("publisher") or "").strip(),
            "page_count": int(payload.get("pages") or 0) or None,
            "description": str(payload.get("description") or "").strip(),
            "isbn13": str(payload.get("isbn13") or "").strip() or None,
        }
        if not patch["title"] or not patch["authors"] or not patch["category_id"]:
            raise RuleError("A title needs a name, at least one author, and a subject.")
        cover = cover_for_isbn(str(payload.get("isbn13") or ""))
        if cover:
            patch["cover_path"] = cover
        try:
            rows = await self.gateway.update("books", {"id": f"eq.{book_id}"}, patch)
        except GatewayError as exc:
            raise self._translate(exc, "A book with that ISBN already exists.") from exc
        if not rows:
            raise RuleError("That title is not in the catalogue.")
        return rows[0]

    async def delete_book(self, user: Principal, book_id: str) -> None:
        self._require_admin(user)
        try:
            await self.gateway.delete("books", {"id": f"eq.{book_id}"})
        except GatewayError as exc:
            if exc.code == "23503":
                raise RuleError("This title has loans or copies, so it stays in the catalogue.") from exc
            raise

    async def add_copy(self, user: Principal, book_id: str, accession: str) -> dict:
        self._require_admin(user)
        label = accession.strip()
        if not label:
            raise RuleError("A copy needs an accession number.")
        books = await self.gateway.select("books", {"id": f"eq.{book_id}", "select": "id"})
        if not books:
            raise RuleError("That title is not in the catalogue.")
        try:
            return await self.gateway.insert(
                "book_copies",
                {"book_id": book_id, "accession": label, "status": "available", "condition": "good"},
            )
        except GatewayError as exc:
            raise self._translate(exc, "That accession number is already in use.") from exc

    async def set_copy_status(self, user: Principal, copy_id: str, status: str) -> dict:
        self._require_admin(user)
        if status not in {"available", "maintenance", "lost"}:
            raise RuleError("Set a copy to available, maintenance, or lost. Loans change the other states.")
        copies = await self.gateway.select("book_copies", {"id": f"eq.{copy_id}", "select": "id,status"})
        if not copies:
            raise RuleError("That copy is not on the shelf.")
        if copies[0]["status"] in {"borrowed", "reserved"}:
            raise RuleError("Return the loan or clear the reservation before changing this copy.")
        rows = await self.gateway.update("book_copies", {"id": f"eq.{copy_id}"}, {"status": status})
        return rows[0]

    async def reserve(self, user: Principal, book_id: str) -> dict:
        copies = await self.gateway.select("book_copies", {"book_id": f"eq.{book_id}", "select": "id"})
        loans = await self._open_loans_for_book(book_id, user.user_id)
        held = await self.gateway.select(
            "reservations",
            {"book_id": f"eq.{book_id}", "user_id": f"eq.{user.user_id}", **OPEN_RESERVATION, "select": "id"},
        )
        assert_can_reserve(copy_count=len(copies), has_open_loan=bool(loans), has_open_reservation=bool(held))
        try:
            return await self.gateway.insert(
                "reservations",
                {"book_id": book_id, "user_id": user.user_id, "status": "pending"},
            )
        except GatewayError as exc:
            raise self._translate(exc, "You already have an open reservation for this title.") from exc

    async def approve_reservation(self, user: Principal, reservation_id: str) -> dict:
        self._require_admin(user)
        rows = await self.gateway.select(
            "reservations",
            {"id": f"eq.{reservation_id}", "select": "id,book_id,user_id,status"},
        )
        if not rows or rows[0].get("status") != "pending":
            raise RuleError("That reservation is not waiting.")
        reservation = rows[0]
        copies = await self.gateway.select(
            "book_copies",
            {"book_id": f"eq.{reservation['book_id']}", "status": "eq.available", "select": "id"},
        )
        if not copies:
            raise RuleError("No copy is on the shelf. Approve this hold when one comes back.")
        settings = await self._settings()
        ready_time = utcnow()
        expires = hold_expires(ready_time, int(settings["reservation_hold_days"]))
        copy_id = copies[0]["id"]
        claimed = await self.gateway.update(
            "book_copies",
            {"id": f"eq.{copy_id}", "status": "eq.available"},
            {"status": "reserved"},
        )
        if not claimed:
            raise RuleError("That copy was taken. Refresh and try again.")
        updated = await self.gateway.update(
            "reservations",
            {"id": f"eq.{reservation_id}", "status": "eq.pending"},
            {"status": "ready", "ready_at": ready_time.isoformat(), "expires_at": expires.isoformat()},
        )
        if not updated:
            await self.gateway.update("book_copies", {"id": f"eq.{copy_id}"}, {"status": "available"})
            raise RuleError("That reservation is no longer waiting.")
        await self.gateway.insert(
            "notifications",
            {
                "user_id": reservation["user_id"],
                "kind": "reservation_ready",
                "payload": {
                    "title": "A reserved book is ready",
                    "body": "Your reservation is at the desk. Ask a librarian to issue it before the hold ends.",
                },
            },
        )
        return updated[0]

    async def cancel_reservation(self, user: Principal, reservation_id: str) -> None:
        rows = await self.gateway.select(
            "reservations",
            {"id": f"eq.{reservation_id}", "select": "id,book_id,user_id,status"},
        )
        if not rows:
            raise RuleError("That reservation is not open.")
        reservation = rows[0]
        if user.role != "admin" and reservation["user_id"] != user.user_id:
            raise RuleError("You can cancel only your own reservation.")
        if reservation["status"] not in {"pending", "ready"}:
            raise RuleError("That reservation is already closed.")
        if user.role != "admin" and reservation["status"] == "ready":
            raise RuleError("A ready hold is released at the desk.")
        await self.gateway.update("reservations", {"id": f"eq.{reservation_id}"}, {"status": "cancelled"})
        if reservation["status"] == "ready":
            still_ready = await self.gateway.select(
                "reservations",
                {"book_id": f"eq.{reservation['book_id']}", "status": "eq.ready", "select": "id"},
            )
            if not still_ready:
                reserved = await self.gateway.select(
                    "book_copies",
                    {"book_id": f"eq.{reservation['book_id']}", "status": "eq.reserved", "select": "id"},
                )
                if reserved:
                    await self.gateway.update("book_copies", {"id": f"eq.{reserved[0]['id']}"}, {"status": "available"})

    async def issue(self, user: Principal, email: str, accession: str) -> dict:
        self._require_admin(user)
        readers = await self.gateway.select("profiles", {"email": f"ilike.{email.strip()}", "select": "id,email"})
        if not readers:
            raise RuleError("No reader has that email.")
        borrower_id = readers[0]["id"]
        copies = await self.gateway.select(
            "book_copies",
            {"accession": f"eq.{accession.strip()}", "select": "id,book_id,status,accession"},
        )
        if not copies:
            raise RuleError("No copy has that accession number.")
        copy = copies[0]
        open_for_borrower = await self.gateway.select(
            "reservations",
            {
                "book_id": f"eq.{copy['book_id']}",
                "user_id": f"eq.{borrower_id}",
                **OPEN_RESERVATION,
                "select": "id,status",
            },
        )
        ready = [row for row in open_for_borrower if row["status"] == "ready"]
        settings = await self._settings()
        active = await self.gateway.select("loans", {"user_id": f"eq.{borrower_id}", **OPEN_LOAN, "select": "id"})
        same_title = await self._open_loans_for_book(copy["book_id"], borrower_id)
        assert_can_issue(
            copy_status=copy["status"],
            ready_for_borrower=bool(ready),
            active_loans=len(active),
            max_active_loans=int(settings["max_active_loans"]),
            already_borrowed=bool(same_title),
        )
        claimed = await self.gateway.update(
            "book_copies",
            {"id": f"eq.{copy['id']}", "status": f"eq.{copy['status']}"},
            {"status": "borrowed"},
        )
        if not claimed:
            raise RuleError("That copy was taken by another loan. Refresh and try again.")
        issued = utcnow()
        due = due_at(issued, int(settings["loan_period_days"]))
        try:
            loan = await self.gateway.insert(
                "loans",
                {
                    "copy_id": copy["id"],
                    "user_id": borrower_id,
                    "issued_by": user.user_id,
                    "issued_at": issued.isoformat(),
                    "due_at": due.isoformat(),
                },
            )
        except GatewayError as exc:
            await self.gateway.update("book_copies", {"id": f"eq.{copy['id']}"}, {"status": copy["status"]})
            raise self._translate(exc, "That copy already has an open loan.") from exc
        if open_for_borrower:
            await self.gateway.update(
                "reservations",
                {"id": f"eq.{open_for_borrower[0]['id']}"},
                {"status": "fulfilled", "fulfilled_loan_id": loan["id"]},
            )
        return loan

    async def return_copy(self, user: Principal, loan_id: str) -> dict:
        self._require_admin(user)
        loans = await self.gateway.select(
            "loans",
            {"id": f"eq.{loan_id}", "select": "id,copy_id,user_id,due_at,returned_at"},
        )
        if not loans or loans[0].get("returned_at"):
            raise RuleError("That loan is already closed.")
        loan = loans[0]
        returned = utcnow()
        updated = await self.gateway.update(
            "loans",
            {"id": f"eq.{loan_id}", "returned_at": "is.null"},
            {"returned_at": returned.isoformat()},
        )
        if not updated:
            raise RuleError("That loan is already closed.")
        copies = await self.gateway.select("book_copies", {"id": f"eq.{loan['copy_id']}", "select": "id,book_id"})
        book_id = copies[0]["book_id"] if copies else ""
        waiting = await self.gateway.select(
            "reservations",
            {"book_id": f"eq.{book_id}", "status": "eq.pending", "select": "id,user_id", "order": "placed_at.asc"},
        )
        next_status = "available"
        if waiting:
            settings = await self._settings()
            ready_time = returned
            expires = hold_expires(ready_time, int(settings["reservation_hold_days"]))
            await self.gateway.update(
                "reservations",
                {"id": f"eq.{waiting[0]['id']}"},
                {"status": "ready", "ready_at": ready_time.isoformat(), "expires_at": expires.isoformat()},
            )
            await self.gateway.insert(
                "notifications",
                {
                    "user_id": waiting[0]["user_id"],
                    "kind": "reservation_ready",
                    "payload": {
                        "title": "A reserved book is ready",
                        "body": "Your reservation is at the desk. Ask a librarian to issue it before the hold ends.",
                    },
                },
            )
            next_status = "reserved"
        await self.gateway.update("book_copies", {"id": f"eq.{loan['copy_id']}"}, {"status": next_status})
        settings = await self._settings()
        days = overdue_days(_parse(loan["due_at"]), returned)
        amount = fine_amount(days, int(settings["daily_fine_cents"]))
        fine = None
        if amount > 0:
            fine = await self.gateway.insert(
                "fines",
                {
                    "loan_id": loan_id,
                    "user_id": loan["user_id"],
                    "amount_cents": amount,
                    "reason": f"Returned {days} day(s) after the due date.",
                    "status": "open",
                },
            )
        return {"loan": updated[0], "fine": fine}

    async def settle_fine(self, user: Principal, fine_id: str, status: str) -> dict:
        self._require_admin(user)
        if status not in {"paid", "waived"}:
            raise RuleError("A fine can be marked paid or waived.")
        rows = await self.gateway.update(
            "fines",
            {"id": f"eq.{fine_id}", "status": "eq.open"},
            {"status": status},
        )
        if not rows:
            raise RuleError("That fine is not open.")
        return rows[0]

    async def _settings(self) -> dict:
        rows = await self.gateway.select(
            "system_settings",
            {"id": "eq.1", "select": "loan_period_days,max_active_loans,daily_fine_cents,reservation_hold_days"},
        )
        if not rows:
            return {
                "loan_period_days": 14,
                "max_active_loans": 5,
                "daily_fine_cents": 50,
                "reservation_hold_days": 3,
            }
        return rows[0]

    async def _open_loans_for_book(self, book_id: str, user_id: str) -> list[dict]:
        copies = await self.gateway.select("book_copies", {"book_id": f"eq.{book_id}", "select": "id"})
        if not copies:
            return []
        loans = await self.gateway.select("loans", {"user_id": f"eq.{user_id}", **OPEN_LOAN, "select": "id,copy_id"})
        copy_ids = {row["id"] for row in copies}
        return [loan for loan in loans if loan["copy_id"] in copy_ids]

    @staticmethod
    def _require_admin(user: Principal) -> None:
        if user.role != "admin":
            raise RuleError("Admin access is required.", status_code=403)

    @staticmethod
    def _translate(exc: GatewayError, unique_message: str) -> RuleError | GatewayError:
        if exc.code == "23505":
            return RuleError(unique_message)
        return exc


def _parse(value: str):
    from datetime import datetime

    text = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        from datetime import timezone

        return parsed.replace(tzinfo=timezone.utc)
    return parsed
