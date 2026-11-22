import asyncio

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.security import Principal
from app.db.gateway import MemoryGateway
from app.db.storage import MemoryStorage
from app.main import create_app
from app.services.discovery import DiscoveryClient, DiscoveryService
from app.services.discovery_rules import archive_hits, download_refusal, gutenberg_hits, open_library_hits
from app.services.files import FileError

PDF = b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF"
STUDENT = Principal(user_id="student-1", email="amina@example.edu", role="student", full_name="Amina")
ADMIN = Principal(user_id="admin-1", email="desk@example.edu", role="admin", full_name="Duty")
CONFIGURED = Settings(supabase_url="https://librimind.supabase.co", supabase_anon_key="anon-key")


def test_only_an_explicit_open_file_on_an_approved_host_can_be_saved() -> None:
    assert download_refusal(
        source_name="Project Gutenberg",
        policy="permitted_open_access",
        enabled=True,
        rights="Public domain",
        file_url="https://www.gutenberg.org/files/1342/1342-pdf.pdf",
    ) is None
    assert download_refusal(
        source_name="Open Library",
        policy="metadata_only",
        enabled=True,
        rights="",
        file_url="https://openlibrary.org/book.pdf",
    )
    assert download_refusal(
        source_name="Internet Archive",
        policy="permitted_open_access",
        enabled=True,
        rights="All rights reserved",
        file_url="https://archive.org/download/item/item.pdf",
    )
    assert download_refusal(
        source_name="Project Gutenberg",
        policy="permitted_open_access",
        enabled=True,
        rights="Public domain",
        file_url="https://oceanofpdf.com/files/1342.pdf",
    )
    hits = gutenberg_hits({"results": [{"id": 1, "title": "Essay", "authors": [{"name": "Plato"}], "formats": {"application/pdf": "https://www.gutenberg.org/files/1/1.pdf"}}]})
    assert hits[0]["download"] == "available"
    library = open_library_hits({"docs": [{"key": "/works/OL1W", "title": "Essay", "author_name": ["Plato"]}]})
    assert library[0]["download"] == "unavailable"
    closed = archive_hits({"response": {"docs": [{"identifier": "item", "title": "Essay", "rights": "Copyright"}]}})
    assert closed[0]["fileUrl"] == ""
    opened = archive_hits({"response": {"docs": [{"identifier": "item", "title": "Essay", "rights": "Public Domain"}]}})
    assert opened[0]["download"] == "available"


class FakeClient(DiscoveryClient):
    def __init__(self) -> None:
        self.fetched: list[str] = []

    async def search_gutenberg(self, query: str) -> list[dict]:
        return gutenberg_hits(
            {"results": [{"id": 11, "title": query, "authors": [{"name": "Plato"}], "formats": {"application/pdf": "https://www.gutenberg.org/files/11/11.pdf"}}]}
        )

    async def search_open_library(self, query: str) -> list[dict]:
        return open_library_hits({"docs": [{"key": "/works/OL1W", "title": query, "author_name": ["Plato"]}]})

    async def search_archive(self, query: str) -> list[dict]:
        return archive_hits({"response": {"docs": [{"identifier": "item", "title": query, "rights": "Copyright"}]}})

    async def fetch(self, url: str) -> bytes:
        self.fetched.append(url)
        return PDF


def test_a_metadata_record_and_an_unapproved_host_are_not_fetched() -> None:
    async def run() -> None:
        gateway = MemoryGateway()
        await gateway.insert(
            "external_sources",
            {"id": "src-ol", "name": "Open Library", "base_url": "https://openlibrary.org", "download_policy": "metadata_only", "enabled": True, "notes": ""},
        )
        await gateway.insert(
            "external_sources",
            {"id": "src-pg", "name": "Project Gutenberg", "base_url": "https://www.gutenberg.org", "download_policy": "permitted_open_access", "enabled": True, "notes": ""},
        )
        client = FakeClient()
        service = DiscoveryService(gateway, MemoryStorage(), client)
        with pytest.raises(FileError):
            await service.save(STUDENT, {"source": "Open Library", "title": "Essay", "authors": ["Plato"], "fileUrl": "https://openlibrary.org/x.pdf", "rights": ""})
        with pytest.raises(FileError):
            await service.save(
                STUDENT,
                {"source": "Project Gutenberg", "title": "Essay", "authors": ["Plato"], "fileUrl": "https://oceanofpdf.com/essay.pdf", "rights": "Public domain"},
            )
        assert client.fetched == []
        saved = await service.save(
            STUDENT,
            {"source": "Project Gutenberg", "title": "Essay", "authors": ["Plato"], "fileUrl": "https://www.gutenberg.org/files/11/11.pdf", "rights": "Public domain"},
        )
        assert saved["scope"] == "personal"
        assert saved["coverUrl"] == "https://www.gutenberg.org/cache/epub/11/pg11.cover.medium.jpg"
        assert client.fetched == ["https://www.gutenberg.org/files/11/11.pdf"]
        found = await service.search("Essay")
        names = [group["source"] for group in found["groups"]]
        assert "Internet Archive" in names
        archive = next(group for group in found["groups"] if group["source"] == "Internet Archive")
        assert archive["error"] == "That source is turned off."

    asyncio.run(run())


def test_a_student_cannot_turn_a_source_off() -> None:
    gateway = MemoryGateway()

    async def resolve(token: str, settings: Settings) -> Principal:
        assert settings.auth_configured
        return STUDENT

    async def save(token: str, user_id: str, payload: dict, settings: Settings) -> dict:
        return payload

    client = TestClient(create_app(CONFIGURED, resolve, save, lambda token: gateway, lambda token: MemoryStorage(), FakeClient()))
    response = client.patch(
        "/api/v1/discovery/sources/src-1",
        headers={"Authorization": "Bearer student-token"},
        json={"enabled": False},
    )
    assert response.status_code == 403
