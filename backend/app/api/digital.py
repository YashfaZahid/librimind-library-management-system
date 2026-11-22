from typing import Annotated, Callable
from urllib.parse import quote

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from app.core.config import Settings
from app.core.security import Principal
from app.db.gateway import Gateway, GatewayError
from app.db.storage import Storage, StorageError, SupabaseStorage
from app.services.covers import cover_for_title
from app.services.digital import DigitalService
from app.services.files import FileError, safe_filename

StorageFactory = Callable[[str], Storage]
GatewayFactory = Callable[[str], Gateway]


class ShelfBody(BaseModel):
    assetId: str = ""
    bookId: str = ""


def register_digital(
    app: FastAPI,
    settings: Settings,
    principal,
    gateway_factory: GatewayFactory | None,
    storage_factory: StorageFactory | None,
) -> None:
    def gateway_for(authorization: str | None) -> Gateway:
        from app.db.gateway import PostgrestGateway

        token = "" if authorization is None else authorization.split(" ", 1)[1].strip()
        if gateway_factory is not None:
            return gateway_factory(token)
        return PostgrestGateway(settings, token)

    def files(authorization: str | None) -> DigitalService:
        return DigitalService(gateway_for(authorization), storage_for(authorization), cover_lookup=cover_for_title)

    def storage_for(authorization: str | None) -> Storage:
        token = "" if authorization is None else authorization.split(" ", 1)[1].strip()
        if storage_factory is not None:
            return storage_factory(token)
        return SupabaseStorage(settings, token)

    def fail(exc: Exception) -> None:
        if isinstance(exc, FileError):
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
        if isinstance(exc, (GatewayError, StorageError)):
            status = exc.status_code if exc.status_code in {401, 403, 404} else 400
            raise HTTPException(status_code=status, detail=exc.detail) from exc
        raise exc

    @app.get("/api/v1/digital")
    async def digital_library(
        authorization: Annotated[str | None, Header()] = None,
        user: Principal = Depends(principal),
    ) -> dict:
        try:
            return await files(authorization).library(user)
        except (FileError, GatewayError, StorageError) as exc:
            fail(exc)

    @app.post("/api/v1/digital", status_code=201)
    async def upload_pdf(
        authorization: Annotated[str | None, Header()] = None,
        user: Principal = Depends(principal),
        file: UploadFile = File(...),
        scope: str = Form(...),
        title: str = Form(...),
        authors: str = Form(""),
        description: str = Form(""),
        categoryId: str = Form(""),
        bookId: str = Form(""),
        year: int = Form(0),
        acknowledge: bool = Form(False),
        isbn: str = Form(""),
    ) -> dict:
        data = await _read_limited(file)
        names = [part.strip() for part in authors.split(",") if part.strip()]
        try:
            asset = await files(authorization).upload(
                user,
                filename=file.filename or "book.pdf",
                data=data,
                scope=scope,
                title=title,
                authors=names,
                description=description,
                category_id=categoryId,
                book_id=bookId,
                year=year,
                acknowledge=acknowledge,
                isbn=isbn,
            )
        except (FileError, GatewayError, StorageError) as exc:
            fail(exc)
        return asset

    @app.delete("/api/v1/digital/{asset_id}", status_code=204)
    async def remove_pdf(
        asset_id: str,
        authorization: Annotated[str | None, Header()] = None,
        user: Principal = Depends(principal),
    ) -> None:
        try:
            await files(authorization).remove(user, asset_id)
        except (FileError, GatewayError, StorageError) as exc:
            fail(exc)

    @app.get("/api/v1/digital/{asset_id}/file")
    async def read_pdf(
        asset_id: str,
        download: bool = False,
        authorization: Annotated[str | None, Header()] = None,
        user: Principal = Depends(principal),
    ) -> Response:
        try:
            data, title = await files(authorization).read(
                user, asset_id, download
            )
        except (FileError, GatewayError, StorageError) as exc:
            fail(exc)
        disposition = "attachment" if download else "inline"
        filename = quote(safe_filename(title))
        return Response(
            content=data,
            media_type="application/pdf",
            headers={"Content-Disposition": f"{disposition}; filename*=UTF-8''{filename}"},
        )

    @app.post("/api/v1/shelf", status_code=201)
    async def save_shelf(
        body: ShelfBody,
        authorization: Annotated[str | None, Header()] = None,
        user: Principal = Depends(principal),
    ) -> dict:
        try:
            return await files(authorization).save_shelf(
                user,
                asset_id=body.assetId,
                book_id=body.bookId,
            )
        except (FileError, GatewayError, StorageError) as exc:
            fail(exc)

    @app.delete("/api/v1/shelf/{item_id}", status_code=204)
    async def remove_shelf(
        item_id: str,
        authorization: Annotated[str | None, Header()] = None,
        user: Principal = Depends(principal),
    ) -> None:
        try:
            await files(authorization).remove_shelf(user, item_id)
        except (FileError, GatewayError, StorageError) as exc:
            fail(exc)


async def _read_limited(file: UploadFile) -> bytes:
    chunks: list[bytes] = []
    size = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        size += len(chunk)
        if size > 20 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="A PDF must be 20 MB or smaller.")
        chunks.append(chunk)
    return b"".join(chunks)
