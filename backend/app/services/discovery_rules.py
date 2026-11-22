from urllib.parse import urlparse

from app.services.covers import cover_for_url

APPROVED_SOURCES = ("Project Gutenberg", "Open Library", "Internet Archive")
GUTENBERG_HOSTS = {"gutenberg.org", "www.gutenberg.org"}
ARCHIVE_HOSTS = {"archive.org", "www.archive.org"}
OPEN_RIGHTS = ("public domain", "cc0", "creative commons", "cc-by", "cc by")

UNAVAILABLE = "This record is not available for download."
RIGHTS_BLOCK = "The rights on this copy are not an explicit public-domain or open license, so the file was not saved."
PDF_ONLY = "This library only saves a PDF from an approved source."


def host_of(url: str) -> str:
    parsed = urlparse(url.strip())
    if parsed.scheme != "https":
        return ""
    return (parsed.hostname or "").lower()


def rights_allow_download(rights: str) -> bool:
    text = rights.casefold()
    return any(marker in text for marker in OPEN_RIGHTS)


def download_refusal(*, source_name: str, policy: str, enabled: bool, rights: str, file_url: str) -> str | None:
    if source_name not in APPROVED_SOURCES:
        return UNAVAILABLE
    if not enabled:
        return "That source is turned off."
    if policy != "permitted_open_access":
        return UNAVAILABLE
    host = host_of(file_url)
    if source_name == "Project Gutenberg":
        if host not in GUTENBERG_HOSTS:
            return UNAVAILABLE
        if not file_url.lower().split("?", 1)[0].endswith(".pdf"):
            return PDF_ONLY
        return None
    if source_name == "Internet Archive":
        if host not in ARCHIVE_HOSTS:
            return UNAVAILABLE
        if not rights_allow_download(rights):
            return RIGHTS_BLOCK
        if not file_url.lower().split("?", 1)[0].endswith(".pdf"):
            return PDF_ONLY
        return None
    return UNAVAILABLE


def gutenberg_hits(payload: dict) -> list[dict]:
    hits: list[dict] = []
    for row in payload.get("results") or []:
        formats = row.get("formats") or {}
        file_url = ""
        for key, value in formats.items():
            if "pdf" in key.casefold() and host_of(str(value)) in GUTENBERG_HOSTS:
                file_url = str(value)
                break
        book_id = row.get("id")
        authors = [str(item.get("name") or "") for item in row.get("authors") or [] if item.get("name")]
        refusal = download_refusal(
            source_name="Project Gutenberg",
            policy="permitted_open_access",
            enabled=True,
            rights="Public domain",
            file_url=file_url,
        )
        hits.append(
            {
                "id": f"gutenberg:{book_id}",
                "source": "Project Gutenberg",
                "title": str(row.get("title") or "Untitled"),
                "authors": authors,
                "rights": "Public domain",
                "pageUrl": f"https://www.gutenberg.org/ebooks/{book_id}",
                "fileUrl": file_url,
                "coverUrl": cover_for_url(file_url or f"https://www.gutenberg.org/ebooks/{book_id}"),
                "download": "available" if refusal is None else "unavailable",
                "reason": refusal or "",
            }
        )
    return hits


def open_library_hits(payload: dict) -> list[dict]:
    hits: list[dict] = []
    for row in payload.get("docs") or []:
        key = str(row.get("key") or "")
        cover_id = row.get("cover_i")
        isbn = ""
        raw_isbn = row.get("isbn") or []
        if isinstance(raw_isbn, list) and raw_isbn:
            isbn = str(raw_isbn[0])
        cover = ""
        if cover_id:
            cover = f"https://covers.openlibrary.org/b/id/{cover_id}-L.jpg"
        elif isbn:
            cover = f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg"
        hits.append(
            {
                "id": f"openlibrary:{key}",
                "source": "Open Library",
                "title": str(row.get("title") or "Untitled"),
                "authors": [str(name) for name in row.get("author_name") or []],
                "rights": "",
                "pageUrl": f"https://openlibrary.org{key}" if key.startswith("/") else "https://openlibrary.org",
                "fileUrl": "",
                "coverUrl": cover,
                "download": "unavailable",
                "reason": UNAVAILABLE,
            }
        )
    return hits


def archive_hits(payload: dict) -> list[dict]:
    hits: list[dict] = []
    docs = (payload.get("response") or {}).get("docs") or []
    for row in docs:
        identifier = str(row.get("identifier") or "")
        rights = row.get("rights") or ""
        if isinstance(rights, list):
            rights = " ".join(str(item) for item in rights)
        creator = row.get("creator") or []
        if isinstance(creator, str):
            authors = [creator]
        else:
            authors = [str(item) for item in creator]
        file_url = f"https://archive.org/download/{identifier}/{identifier}.pdf" if identifier else ""
        refusal = download_refusal(
            source_name="Internet Archive",
            policy="permitted_open_access",
            enabled=True,
            rights=str(rights),
            file_url=file_url,
        )
        hits.append(
            {
                "id": f"archive:{identifier}",
                "source": "Internet Archive",
                "title": str(row.get("title") or "Untitled"),
                "authors": authors,
                "rights": str(rights),
                "pageUrl": f"https://archive.org/details/{identifier}" if identifier else "https://archive.org",
                "fileUrl": file_url if refusal is None else "",
                "coverUrl": f"https://archive.org/services/img/{identifier}" if identifier else "",
                "download": "available" if refusal is None else "unavailable",
                "reason": refusal or "",
            }
        )
    return hits
