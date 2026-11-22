from collections.abc import Awaitable, Callable
from uuid import uuid4

from app.core.security import Principal
from app.db.gateway import Gateway, GatewayError
from app.db.storage import Storage, StorageError
from app.services.covers import cover_for_isbn, cover_for_url, isbn_digits
from app.services.files import FileError, checksum, duplicate_title, validate_pdf
from app.services.snapshot import date_only


CoverLookup = Callable[[str, list[str]], Awaitable[str]]


class DigitalService:
    def __init__(self, gateway: Gateway, storage: Storage, cover_lookup: CoverLookup | None = None) -> None:
        self.gateway = gateway
        self.storage = storage
        self.cover_lookup = cover_lookup

    async def library(self, user: Principal) -> dict:
        assets = await self.gateway.select(
            "digital_assets",
            {
                "select": "id,book_id,owner_id,scope,format,file_size,checksum,title,authors,description,source_url,created_at",
                "order": "created_at.desc",
            },
        )
        shelf = await self.gateway.select(
            "personal_shelf_items",
            {"select": "id,user_id,book_id,digital_asset_id,added_at", "order": "added_at.desc"},
        )
        visible = [
            row
            for row in assets
            if row.get("scope") == "institutional" or row.get("owner_id") == user.user_id
        ]
        mine = [row for row in shelf if row.get("user_id") == user.user_id]
        books = await self.gateway.select("books", {"select": "id,cover_path,isbn13"})
        by_book = {row["id"]: row for row in books}
        listed = []
        for row in visible:
            listed.append(self._asset(row, await self._cover_for_row(row, by_book)))
        return {
            "assets": listed,
            "shelf": [
                {
                    "id": row["id"],
                    "bookId": row.get("book_id"),
                    "assetId": row.get("digital_asset_id"),
                    "addedOn": date_only(row.get("added_at")),
                }
                for row in mine
            ],
        }

    async def upload(
        self,
        user: Principal,
        *,
        filename: str,
        data: bytes,
        scope: str,
        title: str,
        authors: list[str],
        description: str,
        category_id: str,
        book_id: str,
        year: int,
        acknowledge: bool,
        source_url: str = "",
        isbn: str = "",
    ) -> dict:
        validate_pdf(data, filename)
        clean_title = title.strip()
        if not clean_title:
            raise FileError("A digital book needs a title.")
        if scope not in {"institutional", "personal"}:
            raise FileError("Choose the library collection or your personal collection.")
        if scope == "institutional" and user.role != "admin":
            raise FileError("Admin access is required.", status_code=403)
        digest = checksum(data)
        await self._reject_checksum(digest, scope, user.user_id)
        if not acknowledge:
            names = await self._titles(scope, user.user_id)
            warning = duplicate_title(names, clean_title)
            if warning:
                raise FileError(warning, status_code=409)
        linked = book_id.strip()
        stored_cover, stored_isbn = await self._book_cover(linked) if linked else ("", "")
        cover = await self._resolve_cover(source_url, isbn or stored_isbn, clean_title, authors, stored_cover)
        if scope == "institutional" and not linked:
            linked = await self._create_book(
                user,
                clean_title,
                authors,
                description,
                category_id,
                year,
                cover,
                isbn,
            )
        elif linked:
            found = await self.gateway.select("books", {"id": f"eq.{linked}", "select": "id"})
            if not found:
                raise FileError("That catalogue title is not in the library.")
        if cover and linked:
            await self._fill_cover(linked, cover)
        asset_id = str(uuid4())
        bucket = "institutional" if scope == "institutional" else "personal"
        path = f"{asset_id}.pdf" if scope == "institutional" else f"{user.user_id}/{asset_id}.pdf"
        await self.storage.upload(bucket, path, data, "application/pdf")
        row = {
            "id": asset_id,
            "scope": scope,
            "format": "pdf",
            "storage_path": path,
            "file_size": len(data),
            "checksum": digest,
            "mime_type": "application/pdf",
            "source": "upload",
            "title": clean_title,
            "authors": authors,
            "description": description.strip(),
            "source_url": source_url.strip() or None,
        }
        if linked:
            row["book_id"] = linked
        if scope == "personal":
            row["owner_id"] = user.user_id
        try:
            saved = await self.gateway.insert("digital_assets", row)
        except GatewayError as exc:
            await self.storage.remove(bucket, path)
            if exc.code == "23505":
                raise FileError("This file is already in the library.") from exc
            raise
        return self._asset(saved, cover)

    async def remove(self, user: Principal, asset_id: str) -> None:
        rows = await self.gateway.select(
            "digital_assets",
            {"id": f"eq.{asset_id}", "select": "id,scope,owner_id,storage_path"},
        )
        if not rows:
            raise FileError("That file is not in the library.", status_code=404)
        asset = rows[0]
        self._can_change(user, asset)
        bucket = "institutional" if asset["scope"] == "institutional" else "personal"
        await self.gateway.delete("digital_assets", {"id": f"eq.{asset_id}"})
        await self.storage.remove(bucket, asset["storage_path"])

    async def read(self, user: Principal, asset_id: str, download: bool) -> tuple[bytes, str]:
        rows = await self.gateway.select(
            "digital_assets",
            {"id": f"eq.{asset_id}", "select": "id,scope,owner_id,storage_path,title,book_id"},
        )
        if not rows:
            raise FileError("That file is not in the library.", status_code=404)
        asset = rows[0]
        bucket = "institutional" if asset["scope"] == "institutional" else "personal"
        try:
            data = await self.storage.download(bucket, asset["storage_path"])
        except StorageError as exc:
            raise FileError("The file could not be opened.", status_code=404) from exc
        event = {"user_id": user.user_id, "event": "download" if download else "view"}
        if asset.get("book_id"):
            event["book_id"] = asset["book_id"]
        try:
            await self.gateway.insert("reading_events", event)
        except GatewayError:
            pass
        return data, str(asset.get("title") or "book")

    async def save_shelf(self, user: Principal, *, asset_id: str, book_id: str) -> dict:
        if not asset_id and not book_id:
            raise FileError("Choose a book or a file to keep.")
        if asset_id:
            found = await self.gateway.select("digital_assets", {"id": f"eq.{asset_id}", "select": "id"})
            if not found:
                raise FileError("That file is not in the library.")
        if book_id:
            found = await self.gateway.select("books", {"id": f"eq.{book_id}", "select": "id"})
            if not found:
                raise FileError("That title is not in the catalogue.")
        params = {"user_id": f"eq.{user.user_id}", "select": "id,book_id,digital_asset_id,added_at"}
        if asset_id:
            params["digital_asset_id"] = f"eq.{asset_id}"
        if book_id:
            params["book_id"] = f"eq.{book_id}"
        existing = await self.gateway.select("personal_shelf_items", params)
        if existing:
            row = existing[0]
        else:
            payload: dict[str, str] = {"user_id": user.user_id}
            if asset_id:
                payload["digital_asset_id"] = asset_id
            if book_id:
                payload["book_id"] = book_id
            row = await self.gateway.insert("personal_shelf_items", payload)
            event = {"user_id": user.user_id, "event": "add_shelf"}
            if book_id:
                event["book_id"] = book_id
            try:
                await self.gateway.insert("reading_events", event)
            except GatewayError:
                pass
        return {
            "id": row["id"],
            "bookId": row.get("book_id"),
            "assetId": row.get("digital_asset_id"),
            "addedOn": date_only(row.get("added_at")),
        }

    async def remove_shelf(self, user: Principal, item_id: str) -> None:
        rows = await self.gateway.select(
            "personal_shelf_items",
            {"id": f"eq.{item_id}", "select": "id,user_id"},
        )
        if not rows:
            raise FileError("That shelf item is already gone.", status_code=404)
        if rows[0]["user_id"] != user.user_id and user.role != "admin":
            raise FileError("You can change only your own shelf.", status_code=403)
        await self.gateway.delete("personal_shelf_items", {"id": f"eq.{item_id}"})

    async def _reject_checksum(self, digest: str, scope: str, user_id: str) -> None:
        params = {"checksum": f"eq.{digest}", "scope": f"eq.{scope}", "select": "id"}
        if scope == "personal":
            params["owner_id"] = f"eq.{user_id}"
        found = await self.gateway.select("digital_assets", params)
        if found:
            raise FileError("This file is already in the library.")

    async def _titles(self, scope: str, user_id: str) -> list[str]:
        books = await self.gateway.select("books", {"select": "title"})
        params = {"select": "title,scope,owner_id"}
        assets = await self.gateway.select("digital_assets", params)
        names = [str(row.get("title") or "") for row in books]
        for row in assets:
            if row.get("scope") == "institutional" or (scope == "personal" and row.get("owner_id") == user_id):
                names.append(str(row.get("title") or ""))
        return names

    async def _create_book(
        self,
        user: Principal,
        title: str,
        authors: list[str],
        description: str,
        category_id: str,
        year: int,
        cover: str = "",
        isbn: str = "",
    ) -> str:
        if not authors or not category_id:
            raise FileError("A new library title needs an author and a subject.")
        saved = await self.gateway.insert(
            "books",
            {
                "title": title,
                "authors": authors,
                "category_id": category_id,
                "description": description.strip(),
                "publication_year": year or None,
                "cover_path": cover or None,
                "created_by": user.user_id,
                **({"isbn13": isbn_digits(isbn)} if isbn_digits(isbn) else {}),
            },
        )
        return str(saved["id"])

    async def _fill_cover(self, book_id: str, cover: str) -> None:
        rows = await self.gateway.select("books", {"id": f"eq.{book_id}", "select": "id,cover_path"})
        if not rows or not cover:
            return
        current = str(rows[0].get("cover_path") or "")
        if current and not ("/b/isbn/" in current and "/b/isbn/" not in cover):
            return
        await self.gateway.update("books", {"id": f"eq.{book_id}"}, {"cover_path": cover})

    @staticmethod
    def _can_change(user: Principal, asset: dict) -> None:
        if asset.get("scope") == "institutional":
            if user.role != "admin":
                raise FileError("Admin access is required.", status_code=403)
            return
        if asset.get("owner_id") != user.user_id and user.role != "admin":
            raise FileError("You can remove only your own file.", status_code=403)

    async def _book_cover(self, book_id: str) -> tuple[str, str]:
        rows = await self.gateway.select("books", {"id": f"eq.{book_id}", "select": "id,cover_path,isbn13"})
        if not rows:
            return "", ""
        return str(rows[0].get("cover_path") or ""), str(rows[0].get("isbn13") or "")

    async def _resolve_cover(self, source_url: str, isbn: str, title: str, authors: list[str], existing: str = "") -> str:
        """Prefer a source cover, then a title match, then an ISBN image already on the book."""
        cover = cover_for_url(source_url)
        if cover:
            return cover
        kept = existing if existing and "/b/isbn/" not in existing else ""
        if not kept and self.cover_lookup:
            kept = await self.cover_lookup(title, authors)
        if kept:
            return kept
        return existing or cover_for_isbn(isbn)

    async def _cover_for_row(self, row: dict, by_book: dict) -> str:
        book = by_book.get(row.get("book_id")) or {}
        existing = str(book.get("cover_path") or "")
        cover = await self._resolve_cover(
            str(row.get("source_url") or ""),
            str(book.get("isbn13") or ""),
            str(row.get("title") or ""),
            list(row.get("authors") or []),
            existing,
        )
        if cover and book and cover != existing and (not existing or "/b/isbn/" in existing):
            try:
                await self.gateway.update("books", {"id": f"eq.{book['id']}"}, {"cover_path": cover})
                book["cover_path"] = cover
            except GatewayError:
                pass
        return cover

    @staticmethod
    def _asset(row: dict, cover: str = "") -> dict:
        return {
            "id": row["id"],
            "bookId": row.get("book_id"),
            "scope": row.get("scope"),
            "title": row.get("title") or "",
            "authors": row.get("authors") or [],
            "description": row.get("description") or "",
            "format": row.get("format") or "pdf",
            "fileSize": row.get("file_size") or 0,
            "checksum": row.get("checksum") or "",
            "createdOn": date_only(row.get("created_at")),
            "hasFile": True,
            "coverUrl": cover or cover_for_url(str(row.get("source_url") or "")),
        }
