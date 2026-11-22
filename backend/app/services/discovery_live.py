import httpx

from app.services.discovery_rules import archive_hits, gutenberg_hits, host_of, open_library_hits
from app.services.discovery_rules import ARCHIVE_HOSTS, GUTENBERG_HOSTS
from app.services.files import FileError, MAX_PDF_BYTES


class LiveDiscoveryClient:
    def __init__(self, http: httpx.AsyncClient | None = None) -> None:
        self.http = http

    async def search_gutenberg(self, query: str) -> list[dict]:
        payload = await self._get_json("https://gutendex.com/books", {"search": query})
        return gutenberg_hits(payload)

    async def search_open_library(self, query: str) -> list[dict]:
        payload = await self._get_json("https://openlibrary.org/search.json", {"q": query, "limit": 5})
        return open_library_hits(payload)

    async def search_archive(self, query: str) -> list[dict]:
        payload = await self._get_json(
            "https://archive.org/advancedsearch.php",
            [
                ("q", f"{query} AND mediatype:texts"),
                ("fl[]", "identifier"),
                ("fl[]", "title"),
                ("fl[]", "creator"),
                ("fl[]", "rights"),
                ("rows", "5"),
                ("page", "1"),
                ("output", "json"),
            ],
        )
        return archive_hits(payload)

    async def fetch(self, url: str) -> bytes:
        if host_of(url) not in GUTENBERG_HOSTS | ARCHIVE_HOSTS:
            raise FileError("This record is not available for download.")
        client = self.http or httpx.AsyncClient(timeout=20)
        owns = self.http is None
        try:
            response = await client.get(url, follow_redirects=False)
        finally:
            if owns:
                await client.aclose()
        if response.status_code >= 300:
            raise FileError("The source did not provide the file directly, so nothing was saved.")
        if len(response.content) > MAX_PDF_BYTES:
            raise FileError("A PDF must be 20 MB or smaller.")
        return response.content

    async def _get_json(self, url: str, params: dict | list[tuple[str, str]]) -> dict:
        client = self.http or httpx.AsyncClient(timeout=15)
        owns = self.http is None
        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
            body = response.json()
        finally:
            if owns:
                await client.aclose()
        return body if isinstance(body, dict) else {}
