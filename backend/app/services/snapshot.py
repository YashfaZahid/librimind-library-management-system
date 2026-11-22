def date_only(value: object) -> str:
    text = str(value or "")
    return text[:10]


def interest_ids(names: list[str], categories: list[dict]) -> list[str]:
    by_name = {str(category["name"]).casefold(): str(category["id"]) for category in categories}
    return [by_name[name.casefold()] for name in names if name.casefold() in by_name]


def to_snapshot(
    *,
    user_id: str,
    today: str,
    categories: list[dict],
    books: list[dict],
    copies: list[dict],
    profiles: list[dict],
    loans: list[dict],
    reservations: list[dict],
    fines: list[dict],
) -> dict:
    category_rows = [
        {"id": row["id"], "name": row["name"]}
        for row in sorted(categories, key=lambda item: (item.get("sort_order") or 0, item.get("name") or ""))
    ]
    return {
        "today": today,
        "sessionReaderId": user_id,
        "categories": category_rows,
        "books": [
            {
                "id": row["id"],
                "title": row.get("title") or "",
                "authors": row.get("authors") or [],
                "categoryId": row.get("category_id") or "",
                "year": row.get("publication_year") or 0,
                "publisher": row.get("publisher") or "",
                "isbn13": row.get("isbn13") or "",
                "pages": row.get("page_count") or 0,
                "description": row.get("description") or "",
                "coverUrl": row.get("cover_path") or "",
            }
            for row in books
        ],
        "copies": [
            {
                "id": row["id"],
                "bookId": row["book_id"],
                "accession": row["accession"],
                "status": row["status"],
            }
            for row in copies
        ],
        "readers": [_reader(row, category_rows) for row in profiles],
        "loans": [
            {
                "id": row["id"],
                "copyId": row["copy_id"],
                "readerId": row["user_id"],
                "issuedOn": date_only(row.get("issued_at")),
                "dueOn": date_only(row.get("due_at")),
                "returnedOn": date_only(row["returned_at"]) if row.get("returned_at") else None,
            }
            for row in loans
        ],
        "reservations": [
            {
                "id": row["id"],
                "bookId": row["book_id"],
                "readerId": row["user_id"],
                "status": "ready" if row.get("status") == "ready" else "waiting",
                "placedOn": date_only(row.get("placed_at")),
            }
            for row in reservations
            if row.get("status") in {"pending", "ready"}
        ],
        "fines": [
            {
                "id": row["id"],
                "loanId": row["loan_id"],
                "readerId": row["user_id"],
                "amountCents": row.get("amount_cents") or 0,
                "reason": row.get("reason") or "",
                "status": row.get("status") or "open",
                "createdOn": date_only(row.get("created_at")),
            }
            for row in fines
        ],
    }


def _reader(row: dict, categories: list[dict]) -> dict:
    interests = [str(item) for item in (row.get("reading_interests") or [])]
    return {
        "id": row["id"],
        "name": row.get("full_name") or row.get("email") or "Reader",
        "email": row.get("email") or "",
        "programme": row.get("programme") or "",
        "interestIds": interest_ids(interests, categories),
        "interests": interests,
    }
