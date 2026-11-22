from typing import Protocol
from urllib.parse import quote

import httpx

from app.core.config import Settings


class StorageError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail


class Storage(Protocol):
    async def upload(self, bucket: str, path: str, data: bytes, mime: str) -> None: ...

    async def download(self, bucket: str, path: str) -> bytes: ...

    async def remove(self, bucket: str, path: str) -> None: ...


class MemoryStorage:
    def __init__(self) -> None:
        self.objects: dict[tuple[str, str], bytes] = {}

    async def upload(self, bucket: str, path: str, data: bytes, mime: str) -> None:
        del mime
        self.objects[(bucket, path)] = data

    async def download(self, bucket: str, path: str) -> bytes:
        try:
            return self.objects[(bucket, path)]
        except KeyError as exc:
            raise StorageError(404, "The file is not in storage.") from exc

    async def remove(self, bucket: str, path: str) -> None:
        self.objects.pop((bucket, path), None)


class SupabaseStorage:
    def __init__(self, settings: Settings, token: str) -> None:
        self.base = f"{settings.supabase_url.rstrip('/')}/storage/v1/object"
        self.headers = {
            "apikey": settings.supabase_anon_key,
            "Authorization": f"Bearer {token}",
        }

    async def upload(self, bucket: str, path: str, data: bytes, mime: str) -> None:
        headers = {**self.headers, "Content-Type": mime, "x-upsert": "false"}
        await self._request("POST", bucket, path, content=data, headers=headers)

    async def download(self, bucket: str, path: str) -> bytes:
        response = await self._request("GET", bucket, path, headers=self.headers)
        return response.content

    async def remove(self, bucket: str, path: str) -> None:
        await self._request("DELETE", bucket, path, headers=self.headers)

    async def _request(
        self,
        method: str,
        bucket: str,
        path: str,
        content: bytes | None = None,
        headers: dict[str, str] | None = None,
    ) -> httpx.Response:
        target = f"{self.base}/{bucket}/{quote(path, safe='/')}"
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.request(method, target, content=content, headers=headers)
        if response.status_code >= 400:
            message = "The file store rejected the request."
            try:
                body = response.json()
                message = str(body.get("message") or body.get("error") or message)
            except Exception:
                if response.text:
                    message = response.text[:180]
            raise StorageError(response.status_code, message)
        return response
