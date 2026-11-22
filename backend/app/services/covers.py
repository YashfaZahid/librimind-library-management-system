import re

import httpx

_GUTENBERG = re.compile(r"gutenberg\.org/(?:files|ebooks|cache/epub)/(\d+)")
_ARCHIVE = re.compile(r"archive\.org/(?:download|details)/([^/?#]+)")


def isbn_digits(isbn: str) -> str:
    digits = re.sub(r"[^0-9Xx]", "", isbn or "")
    return digits if len(digits) in {10, 13} else ""


def cover_for_isbn(isbn: str) -> str:
    digits = isbn_digits(isbn)
    if not digits:
        return ""
    return f"https://covers.openlibrary.org/b/isbn/{digits}-L.jpg"


def cover_for_url(url: str) -> str:
    """A cover image published by the same permitted source as the file."""
    gutenberg = _GUTENBERG.search(url or "")
    if gutenberg:
        book_id = gutenberg.group(1)
        return f"https://www.gutenberg.org/cache/epub/{book_id}/pg{book_id}.cover.medium.jpg"
    archive = _ARCHIVE.search(url or "")
    if archive:
        return f"https://archive.org/services/img/{archive.group(1)}"
    return ""


def _plain_title(title: str) -> str:
    text = re.sub(r"[^a-z0-9 ]", "", (title or "").casefold())
    text = re.sub(r"\s+", " ", text).strip()
    if text.startswith("the "):
        return text[4:]
    return text


def _cover_from_docs(docs: list[dict], wanted: str) -> str:
    for doc in docs:
        name = _plain_title(str(doc.get("title") or ""))
        if not name or (name != wanted and wanted not in name and name not in wanted):
            continue
        cover_id = doc.get("cover_i")
        if cover_id:
            return f"https://covers.openlibrary.org/b/id/{cover_id}-L.jpg"
        isbns = doc.get("isbn") or []
        if isbns:
            found = cover_for_isbn(str(isbns[0]))
            if found:
                return found
    return ""


async def _search_open_library(params: dict[str, str]) -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get("https://openlibrary.org/search.json", params=params)
            response.raise_for_status()
            docs = response.json().get("docs") or []
    except (httpx.HTTPError, ValueError):
        return []
    return [doc for doc in docs if isinstance(doc, dict)]


async def cover_for_title(title: str, authors: list[str] | None = None) -> str:
    """An Open Library cover when the title matches a catalogued book."""
    wanted = _plain_title(title)
    if len(wanted) < 3:
        return ""
    params = {"title": title.strip(), "limit": "5"}
    if authors and authors[0].strip():
        params["author"] = authors[0].strip()
    found = _cover_from_docs(await _search_open_library(params), wanted)
    if found or "author" not in params:
        return found
    return _cover_from_docs(await _search_open_library({"title": title.strip(), "limit": "5"}), wanted)
