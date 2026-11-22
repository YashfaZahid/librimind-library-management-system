from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.config import Settings
from app.core.security import Principal
from app.db.gateway import Gateway, GatewayError, PostgrestGateway
from app.db.storage import Storage, StorageError, SupabaseStorage
from app.services.discovery import DiscoveryClient, DiscoveryService
from app.services.discovery_live import LiveDiscoveryClient
from app.services.files import FileError


class SourceToggle(BaseModel):
    enabled: bool


class SaveBody(BaseModel):
    source: str
    title: str = ""
    authors: list[str] = Field(default_factory=list)
    rights: str = ""
    fileUrl: str = ""


def register_discovery(
    app: FastAPI,
    settings: Settings,
    principal,
    gateway_factory,
    storage_factory,
    client: DiscoveryClient | None,
) -> None:
    def service_for(authorization: str | None) -> DiscoveryService:
        token = "" if authorization is None else authorization.split(" ", 1)[1].strip()
        gateway: Gateway = gateway_factory(token) if gateway_factory else PostgrestGateway(settings, token)
        storage: Storage = storage_factory(token) if storage_factory else SupabaseStorage(settings, token)
        return DiscoveryService(gateway, storage, client or LiveDiscoveryClient())

    def fail(exc: Exception) -> None:
        if isinstance(exc, FileError):
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
        if isinstance(exc, (GatewayError, StorageError)):
            status = exc.status_code if exc.status_code in {401, 403, 404} else 400
            raise HTTPException(status_code=status, detail=exc.detail) from exc
        raise exc

    @app.get("/api/v1/discovery/sources")
    async def list_sources(
        authorization: Annotated[str | None, Header()] = None,
        user: Principal = Depends(principal),
    ) -> dict:
        del user
        try:
            return {"sources": await service_for(authorization).sources()}
        except (FileError, GatewayError, StorageError) as exc:
            fail(exc)

    @app.patch("/api/v1/discovery/sources/{source_id}")
    async def toggle_source(
        source_id: str,
        body: SourceToggle,
        authorization: Annotated[str | None, Header()] = None,
        user: Principal = Depends(principal),
    ) -> dict:
        try:
            return await service_for(authorization).set_enabled(user, source_id, body.enabled)
        except (FileError, GatewayError, StorageError) as exc:
            fail(exc)

    @app.get("/api/v1/discovery/search")
    async def search(
        q: str = Query(min_length=2, max_length=120),
        authorization: Annotated[str | None, Header()] = None,
        user: Principal = Depends(principal),
    ) -> dict:
        del user
        try:
            return await service_for(authorization).search(q)
        except (FileError, GatewayError, StorageError) as exc:
            fail(exc)

    @app.post("/api/v1/discovery/save", status_code=201)
    async def save_permitted(
        body: SaveBody,
        authorization: Annotated[str | None, Header()] = None,
        user: Principal = Depends(principal),
    ) -> dict:
        try:
            return await service_for(authorization).save(user, body.model_dump())
        except (FileError, GatewayError, StorageError) as exc:
            fail(exc)
