from app.core.security import Principal
from app.db.gateway import Gateway
from app.db.storage import Storage
from app.services.digital import DigitalService
from app.services.discovery_rules import download_refusal
from app.services.files import FileError, validate_pdf


class DiscoveryClient:
    async def search_gutenberg(self, query: str) -> list[dict]:
        return []

    async def search_open_library(self, query: str) -> list[dict]:
        return []

    async def search_archive(self, query: str) -> list[dict]:
        return []

    async def fetch(self, url: str) -> bytes:
        raise FileError("This record is not available for download.")


class DiscoveryService:
    def __init__(self, gateway: Gateway, storage: Storage, client: DiscoveryClient) -> None:
        self.gateway = gateway
        self.storage = storage
        self.client = client

    async def sources(self) -> list[dict]:
        rows = await self.gateway.select(
            "external_sources",
            {"select": "id,name,base_url,download_policy,enabled,notes", "order": "name.asc"},
        )
        return [
            {
                "id": row["id"],
                "name": row["name"],
                "baseUrl": row["base_url"],
                "policy": row["download_policy"],
                "enabled": bool(row["enabled"]),
                "notes": row.get("notes") or "",
            }
            for row in rows
        ]

    async def set_enabled(self, user: Principal, source_id: str, enabled: bool) -> dict:
        if user.role != "admin":
            raise FileError("Admin access is required.", status_code=403)
        rows = await self.gateway.update("external_sources", {"id": f"eq.{source_id}"}, {"enabled": enabled})
        if not rows:
            raise FileError("That source is not approved.", status_code=404)
        row = rows[0]
        return {"id": row["id"], "enabled": bool(row["enabled"])}

    async def search(self, query: str) -> dict:
        text = " ".join(query.split())
        if len(text) < 2:
            raise FileError("Enter at least two characters.")
        enabled = {row["name"]: row for row in await self.sources() if row["enabled"]}
        groups = []
        for name, method in (
            ("Project Gutenberg", self.client.search_gutenberg),
            ("Open Library", self.client.search_open_library),
            ("Internet Archive", self.client.search_archive),
        ):
            source = enabled.get(name)
            if source is None:
                groups.append({"source": name, "results": [], "error": "That source is turned off."})
                continue
            try:
                results = (await method(text))[:5]
            except Exception:
                groups.append({"source": name, "results": [], "error": "That source did not answer."})
                continue
            if not source["enabled"]:
                results = []
            groups.append({"source": name, "results": results, "error": ""})
        return {"query": text, "groups": groups}

    async def save(self, user: Principal, body: dict) -> dict:
        source_name = str(body.get("source") or "")
        rows = await self.gateway.select(
            "external_sources",
            {"name": f"eq.{source_name}", "select": "name,download_policy,enabled"},
        )
        if not rows:
            raise FileError("This record is not available for download.")
        source = rows[0]
        file_url = str(body.get("fileUrl") or "")
        rights = str(body.get("rights") or "")
        refusal = download_refusal(
            source_name=source["name"],
            policy=source["download_policy"],
            enabled=bool(source["enabled"]),
            rights=rights,
            file_url=file_url,
        )
        if refusal:
            raise FileError(refusal)
        data = await self.client.fetch(file_url)
        validate_pdf(data, "download.pdf")
        title = str(body.get("title") or "").strip() or "Untitled"
        authors = [str(name).strip() for name in body.get("authors") or [] if str(name).strip()]
        from app.services.covers import cover_for_title

        return await DigitalService(self.gateway, self.storage, cover_lookup=cover_for_title).upload(
            user,
            filename="download.pdf",
            data=data,
            scope="personal",
            title=title,
            authors=authors or ["Unknown"],
            description=f"Saved from {source_name}. {rights}".strip(),
            category_id="",
            book_id="",
            year=0,
            acknowledge=True,
            source_url=file_url,
        )
