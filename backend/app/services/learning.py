import math
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta

import numpy as np

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

MODEL_VERSION = "tfidf-cosine-v1"
FORECAST_WEEKS = 4


def rank_books(
    books: list[dict],
    categories: list[dict],
    loans: list[dict],
    copies: list[dict],
    user_id: str,
    interests: list[str],
    limit: int = 5,
) -> list[dict]:
    if not books:
        return []
    names = {row["id"]: row.get("name") or "" for row in categories}
    copy_book = {row["id"]: row.get("book_id") for row in copies}
    loan_counts = Counter(copy_book.get(row.get("copy_id")) for row in loans)
    borrowed_now = {
        copy_book.get(row.get("copy_id"))
        for row in loans
        if row.get("user_id") == user_id and row.get("returned_at") is None
    }
    history = [
        copy_book.get(row.get("copy_id"))
        for row in loans
        if row.get("user_id") == user_id and copy_book.get(row.get("copy_id"))
    ]
    matrix = _matrix(books, names)
    similarity = _similarity(matrix, [book["id"] for book in books], history)
    scored: list[dict] = []
    for index, book in enumerate(books):
        if book["id"] in borrowed_now:
            continue
        interest_names = {str(item).casefold() for item in interests}
        category_name = str(names.get(book.get("category_id"), "")).casefold()
        interest_hit = str(book.get("category_id") or "").casefold() in interest_names or category_name in interest_names
        sim = float(similarity[index]) if similarity is not None else 0.0
        score = sim + (0.3 if interest_hit else 0.0)
        if score <= 0:
            continue
        available, total = copy_availability(copies, book["id"])
        scored.append(
            {
                "bookId": book["id"],
                "title": book.get("title") or "Untitled",
                "score": round(score, 4),
                "explanation": _explain(
                    book,
                    names.get(book.get("category_id"), ""),
                    interest_hit,
                    sim,
                    loan_counts[book["id"]],
                    available,
                    total,
                ),
                "modelVersion": MODEL_VERSION,
            }
        )
    scored.sort(key=lambda item: (-item["score"], item["title"]))
    return scored[:limit]


def similar_titles(books: list[dict], categories: list[dict], seed: str, limit: int = 5) -> list[dict]:
    del categories
    text = " ".join(seed.split())
    if len(text) < 2 or not books:
        return []
    docs = [_wording(book) or "empty" for book in books]
    vectorizer = TfidfVectorizer(stop_words="english")
    try:
        matrix = vectorizer.fit_transform(docs)
    except ValueError:
        return []
    needle = " ".join(text.casefold().split())
    index = None
    matched = 0
    for position, book in enumerate(books):
        title = " ".join(str(book.get("title") or "").casefold().split())
        if title and title in needle and len(title) > matched:
            index = position
            matched = len(title)
    if index is None:
        scores = cosine_similarity(vectorizer.transform([text]), matrix).ravel()
        skip = None
    else:
        scores = cosine_similarity(matrix[index], matrix).ravel()
        skip = books[index]["id"]
    ranked = [
        {"bookId": book["id"], "title": book.get("title") or "Untitled", "score": round(float(scores[position]), 4)}
        for position, book in enumerate(books)
        if book["id"] != skip and scores[position] > 0
    ]
    ranked.sort(key=lambda item: (-item["score"], item["title"]))
    return ranked[:limit]


def wording_search(books: list[dict], categories: list[dict], query: str, limit: int = 8) -> list[dict]:
    text = " ".join(query.split())
    if len(text) < 2 or not books:
        return []
    names = {row["id"]: row.get("name") or "" for row in categories}
    vectorizer = _vectorizer(books, names)
    if vectorizer is None:
        return []
    query_matrix = vectorizer.transform([text])
    book_matrix = vectorizer.transform([_document(book, names) for book in books])
    scores = cosine_similarity(query_matrix, book_matrix).ravel()
    ranked = [
        {"bookId": book["id"], "title": book.get("title") or "Untitled", "score": round(float(scores[index]), 4)}
        for index, book in enumerate(books)
        if scores[index] > 0
    ]
    ranked.sort(key=lambda item: (-item["score"], item["title"]))
    return ranked[:limit]


def popularity(books: list[dict], copies: list[dict], loans: list[dict]) -> list[dict]:
    copy_book = {row["id"]: row.get("book_id") for row in copies}
    counts = Counter(copy_book.get(row.get("copy_id")) for row in loans)
    rows = [
        {"bookId": book["id"], "title": book.get("title") or "Untitled", "loans": int(counts[book["id"]])}
        for book in books
        if counts[book["id"]]
    ]
    rows.sort(key=lambda item: (-item["loans"], item["title"]))
    return rows


def demand(books: list[dict], copies: list[dict], loans: list[dict], reservations: list[dict]) -> list[dict]:
    copy_book = {row["id"]: row.get("book_id") for row in copies}
    counts = Counter(copy_book.get(row.get("copy_id")) for row in loans)
    for row in reservations:
        if row.get("status") in {"pending", "ready"}:
            counts[row.get("book_id")] += 1
    rows = [
        {"bookId": book["id"], "title": book.get("title") or "Untitled", "demand": int(counts[book["id"]])}
        for book in books
        if counts[book["id"]]
    ]
    rows.sort(key=lambda item: (-item["demand"], item["title"]))
    return rows


def forecast(books: list[dict], copies: list[dict], loans: list[dict]) -> dict:
    copy_book = {row["id"]: row.get("book_id") for row in copies}
    counts = Counter(copy_book.get(row.get("copy_id")) for row in loans)
    available = Counter(row.get("book_id") for row in copies if row.get("status") == "available")
    dates = [_date(row.get("issued_at")) for row in loans]
    dates = [item for item in dates if item is not None]
    weeks = 0.0
    if dates:
        span_days = max((max(dates) - min(dates)).days, 7)
        weeks = span_days / 7
    titles = []
    for book in books:
        projected = (counts[book["id"]] / weeks) * FORECAST_WEEKS if weeks else 0.0
        on_shelf = int(available[book["id"]])
        shortfall = max(0, math.ceil(projected - on_shelf))
        if counts[book["id"]] or shortfall:
            titles.append(
                {
                    "bookId": book["id"],
                    "title": book.get("title") or "Untitled",
                    "projectedLoans": round(projected, 2),
                    "available": on_shelf,
                    "shortfall": shortfall,
                }
            )
    titles.sort(key=lambda item: (-item["shortfall"], -item["projectedLoans"], item["title"]))
    return {
        "method": "Projected loans are that title's average loans per week, multiplied by 4. A shortfall is that number minus the copies available now.",
        "check": _forecast_check(loans),
        "titles": titles,
    }


def evaluate(
    books: list[dict],
    categories: list[dict],
    loans: list[dict],
    copies: list[dict],
    profiles: list[dict],
) -> dict:
    copy_book = {row["id"]: row.get("book_id") for row in copies}
    by_user: dict[str, list[dict]] = defaultdict(list)
    for row in loans:
        book_id = copy_book.get(row.get("copy_id"))
        if book_id:
            by_user[row.get("user_id")].append({**row, "book_id": book_id})
    interests = {row["id"]: list(row.get("reading_interests") or []) for row in profiles}
    readers = 0
    hits = 0
    for user_id, owned in by_user.items():
        if len(owned) < 2:
            continue
        owned.sort(key=lambda row: _date(row.get("issued_at")) or date.min)
        held = owned[-1]
        earlier = owned[:-1]
        readers += 1
        ranked = rank_books(books, categories, earlier, copies, user_id, interests.get(user_id, []))
        if held["book_id"] in {item["bookId"] for item in ranked}:
            hits += 1
    if readers == 0:
        sentence = "Not enough loan history to score this model. A reader needs at least two loans."
    else:
        sentence = f"Held out the latest loan for each reader with at least two loans. The borrowed title was in the top 5 for {hits} of {readers}."
    return {"readers": readers, "hits": hits, "modelVersion": MODEL_VERSION, "sentence": sentence}


def _wording(book: dict) -> str:
    return " ".join(str(part) for part in (book.get("title"), book.get("authors"), book.get("description")) if part)


def _document(book: dict, names: dict[str, str]) -> str:
    return " ".join(
        str(part)
        for part in (book.get("title"), book.get("authors"), book.get("description"), names.get(book.get("category_id"), ""))
        if part
    )


def _vectorizer(books: list[dict], names: dict[str, str]) -> TfidfVectorizer | None:
    docs = [_document(book, names) or "empty" for book in books]
    vectorizer = TfidfVectorizer(stop_words="english")
    try:
        vectorizer.fit(docs)
    except ValueError:
        return None
    return vectorizer


def _matrix(books: list[dict], names: dict[str, str]):
    vectorizer = _vectorizer(books, names)
    if vectorizer is None:
        return None
    return vectorizer.transform([_document(book, names) or "empty" for book in books])


def _similarity(matrix, ids: list[str], history: list[str]):
    if matrix is None or not history:
        return None
    indexes = [ids.index(book_id) for book_id in history if book_id in ids]
    if not indexes:
        return None
    centroid = np.asarray(matrix[indexes].mean(axis=0))
    return cosine_similarity(centroid, matrix).ravel()


def copy_availability(copies: list[dict], book_id: str) -> tuple[int, int]:
    owned = [copy for copy in copies if copy.get("book_id") == book_id]
    available = sum(1 for copy in owned if copy.get("status") == "available")
    return available, len(owned)


def availability_sentence(available: int, total: int) -> str:
    if available == 1:
        return "Available, 1 copy on the shelf."
    if available > 1:
        return f"Available, {available} copies on the shelf."
    if total:
        return "Not available. Every copy is out or held."
    return "No physical copy is recorded."


def _explain(
    book: dict,
    category: str,
    interest_hit: bool,
    similarity: float,
    loan_count: int,
    available: int,
    total: int,
) -> str:
    title = book.get("title") or "Untitled"
    if interest_hit:
        sentence = f"{title} matches an interest you listed ({category or 'a subject you listed'})."
    elif similarity > 0:
        sentence = f"{title} is close in wording to titles you have borrowed."
    else:
        sentence = f"{title} is in the catalogue."
    if loan_count:
        times = "time" if loan_count == 1 else "times"
        sentence = f"{sentence} It has been borrowed {loan_count} {times}."
    return f"{sentence} {availability_sentence(available, total)}"


def _forecast_check(loans: list[dict]) -> str:
    weeks: dict[date, int] = Counter()
    for row in loans:
        issued = _date(row.get("issued_at"))
        if issued is None:
            continue
        weeks[issued - timedelta(days=issued.weekday())] += 1
    if len(weeks) < 2:
        return "Not enough weeks of loans to check the forecast."
    ordered = [weeks[key] for key in sorted(weeks)]
    earlier = sum(ordered[:-1]) / (len(ordered) - 1)
    actual = ordered[-1]
    return f"The latest week had {actual} loans. The average of the earlier weeks was {earlier:.1f}."


def _date(value) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value)
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None
