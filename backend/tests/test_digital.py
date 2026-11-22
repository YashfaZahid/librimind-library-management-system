import asyncio

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.security import Principal
from app.db.gateway import MemoryGateway
from app.db.storage import MemoryStorage
from app.main import create_app
from app.services.digital import DigitalService
from app.services.files import FileError

ADMIN = Principal(user_id="admin-1", email="desk@example.edu", role="admin", full_name="Duty")
STUDENT = Principal(user_id="student-1", email="amina@example.edu", role="student", full_name="Amina")
PDF = b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF"
CONFIGURED = Settings(supabase_url="https://librimind.supabase.co", supabase_anon_key="anon-key")


def test_upload_reads_back_and_rejects_the_same_file() -> None:
    async def run() -> None:
        gateway = MemoryGateway()
        storage = MemoryStorage()
        await gateway.insert("categories", {"id": "cat-1", "name": "Philosophy", "sort_order": 1})
        service = DigitalService(gateway, storage)
        asset = await service.upload(
            ADMIN,
            filename="republic.pdf",
            data=PDF,
            scope="institutional",
            title="The Republic",
            authors=["Plato"],
            description="A dialogue.",
            category_id="cat-1",
            book_id="",
            year=2007,
            acknowledge=False,
        )
        assert asset["hasFile"] is True
        assert asset["title"] == "The Republic"
        data, title = await service.read(STUDENT, asset["id"], download=True)
        assert data == PDF
        assert title == "The Republic"
        assert gateway.tables["reading_events"][0]["event"] == "download"
        with pytest.raises(FileError, match="already"):
            await service.upload(
                ADMIN,
                filename="republic.pdf",
                data=PDF,
                scope="institutional",
                title="Another copy",
                authors=["Plato"],
                description="",
                category_id="cat-1",
                book_id="",
                year=0,
                acknowledge=True,
            )
        with pytest.raises(FileError) as warning:
            await service.upload(
                ADMIN,
                filename="other.pdf",
                data=b"%PDF-1.4 other",
                scope="institutional",
                title="The Republic",
                authors=["Plato"],
                description="",
                category_id="cat-1",
                book_id="",
                year=0,
                acknowledge=False,
            )
        assert warning.value.status_code == 409

    asyncio.run(run())


def test_a_student_cannot_publish_to_the_library_collection() -> None:
    async def run() -> None:
        service = DigitalService(MemoryGateway(), MemoryStorage())
        with pytest.raises(FileError) as denied:
            await service.upload(
                STUDENT,
                filename="notes.pdf",
                data=PDF,
                scope="institutional",
                title="Notes",
                authors=["Amina"],
                description="",
                category_id="",
                book_id="",
                year=0,
                acknowledge=True,
            )
        assert denied.value.status_code == 403
        personal = await service.upload(
            STUDENT,
            filename="notes.pdf",
            data=PDF,
            scope="personal",
            title="Notes",
            authors=["Amina"],
            description="Mine.",
            category_id="",
            book_id="",
            year=0,
            acknowledge=True,
        )
        library = await service.library(ADMIN)
        assert all(item["id"] != personal["id"] for item in library["assets"])
        own = await service.library(STUDENT)
        assert any(item["id"] == personal["id"] for item in own["assets"])

    asyncio.run(run())


def test_a_file_without_a_link_takes_a_cover_from_its_title() -> None:
    async def run() -> None:
        gateway = MemoryGateway()
        book = await gateway.insert(
            "books",
            {"title": "Journey to the West", "cover_path": "", "isbn13": ""},
        )
        await gateway.insert(
            "digital_assets",
            {
                "book_id": book["id"],
                "owner_id": None,
                "scope": "institutional",
                "format": "pdf",
                "file_size": 12,
                "checksum": "abc",
                "title": "Journey to the West",
                "authors": ["Wu Cheng'en"],
                "description": "",
                "source_url": "",
            },
        )

        async def lookup(title: str, authors: list[str]) -> str:
            assert title == "Journey to the West"
            assert authors == ["Wu Cheng'en"]
            return "https://covers.openlibrary.org/b/id/240726-L.jpg"

        service = DigitalService(gateway, MemoryStorage(), cover_lookup=lookup)
        library = await service.library(ADMIN)
        assert library["assets"][0]["coverUrl"] == "https://covers.openlibrary.org/b/id/240726-L.jpg"
        assert gateway.tables["books"][0]["cover_path"] == library["assets"][0]["coverUrl"]

    asyncio.run(run())


def test_a_new_digital_book_keeps_the_title_cover_ahead_of_an_isbn_link() -> None:
    async def run() -> None:
        gateway = MemoryGateway()
        await gateway.insert("categories", {"id": "cat-1", "name": "Literature", "sort_order": 1})

        async def lookup(title: str, authors: list[str]) -> str:
            assert title == "Pride and Prejudice"
            assert authors == ["Austen"]
            return "https://covers.openlibrary.org/b/id/42-L.jpg"

        service = DigitalService(gateway, MemoryStorage(), cover_lookup=lookup)
        asset = await service.upload(
            ADMIN,
            filename="pride.pdf",
            data=PDF,
            scope="institutional",
            title="Pride and Prejudice",
            authors=["Austen"],
            description="",
            category_id="cat-1",
            book_id="",
            year=1813,
            acknowledge=True,
            isbn="978-0-14-143951-8",
        )
        assert asset["coverUrl"] == "https://covers.openlibrary.org/b/id/42-L.jpg"
        assert gateway.tables["books"][0]["cover_path"] == asset["coverUrl"]

    asyncio.run(run())


def test_student_upload_to_the_library_is_rejected_by_the_api() -> None:
    gateway = MemoryGateway()
    storage = MemoryStorage()

    async def resolve(token: str, settings: Settings) -> Principal:
        assert settings.auth_configured
        return STUDENT if token == "student-token" else ADMIN

    async def save(token: str, user_id: str, payload: dict, settings: Settings) -> dict:
        return payload

    client = TestClient(create_app(CONFIGURED, resolve, save, lambda token: gateway, lambda token: storage))
    response = client.post(
        "/api/v1/digital",
        headers={"Authorization": "Bearer student-token"},
        data={"scope": "institutional", "title": "Notes", "acknowledge": "true"},
        files={"file": ("notes.pdf", PDF, "application/pdf")},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Admin access is required."
