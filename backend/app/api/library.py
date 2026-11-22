from typing import Annotated, Callable

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.config import Settings
from app.core.security import Principal
from app.db.gateway import Gateway, GatewayError, PostgrestGateway
from app.services.circulation import CirculationService
from app.services.rules import RuleError

GatewayFactory = Callable[[str], Gateway]


class BookBody(BaseModel):
    title: str
    authors: list[str] = Field(default_factory=list)
    categoryId: str
    year: int = 0
    publisher: str = ""
    isbn13: str = ""
    pages: int = 0
    description: str = ""


class CopyBody(BaseModel):
    accession: str


class CopyStatusBody(BaseModel):
    status: str


class ReserveBody(BaseModel):
    bookId: str


class IssueBody(BaseModel):
    email: str
    accession: str


class FineBody(BaseModel):
    status: str


def register_library(app: FastAPI, settings: Settings, principal, gateway_factory: GatewayFactory | None) -> None:
    def gateway_for(authorization: str | None) -> Gateway:
        token = "" if authorization is None else authorization.split(" ", 1)[1].strip()
        if gateway_factory is not None:
            return gateway_factory(token)
        return PostgrestGateway(settings, token)

    def service(authorization: str | None) -> CirculationService:
        return CirculationService(gateway_for(authorization))

    def fail(exc: Exception) -> None:
        if isinstance(exc, RuleError):
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
        if isinstance(exc, GatewayError):
            status = exc.status_code if exc.status_code in {401, 403, 404} else 400
            raise HTTPException(status_code=status, detail=exc.detail) from exc
        raise exc

    @app.get("/api/v1/library")
    async def library_bundle(
        authorization: Annotated[str | None, Header()] = None,
        user: Principal = Depends(principal),
        view: Annotated[str, Query()] = "",
    ) -> dict:
        try:
            return await service(authorization).bundle(user, shelf_only=view == "shelf")
        except (RuleError, GatewayError) as exc:
            fail(exc)

    @app.post("/api/v1/books", status_code=201)
    async def create_book(
        body: BookBody,
        authorization: Annotated[str | None, Header()] = None,
        user: Principal = Depends(principal),
    ) -> dict:
        try:
            return await service(authorization).create_book(user, body.model_dump())
        except (RuleError, GatewayError) as exc:
            fail(exc)

    @app.patch("/api/v1/books/{book_id}")
    async def update_book(
        book_id: str,
        body: BookBody,
        authorization: Annotated[str | None, Header()] = None,
        user: Principal = Depends(principal),
    ) -> dict:
        try:
            return await service(authorization).update_book(user, book_id, body.model_dump())
        except (RuleError, GatewayError) as exc:
            fail(exc)

    @app.delete("/api/v1/books/{book_id}", status_code=204)
    async def delete_book(
        book_id: str,
        authorization: Annotated[str | None, Header()] = None,
        user: Principal = Depends(principal),
    ) -> None:
        try:
            await service(authorization).delete_book(user, book_id)
        except (RuleError, GatewayError) as exc:
            fail(exc)

    @app.post("/api/v1/books/{book_id}/copies", status_code=201)
    async def add_copy(
        book_id: str,
        body: CopyBody,
        authorization: Annotated[str | None, Header()] = None,
        user: Principal = Depends(principal),
    ) -> dict:
        try:
            return await service(authorization).add_copy(user, book_id, body.accession)
        except (RuleError, GatewayError) as exc:
            fail(exc)

    @app.patch("/api/v1/copies/{copy_id}")
    async def set_copy_status(
        copy_id: str,
        body: CopyStatusBody,
        authorization: Annotated[str | None, Header()] = None,
        user: Principal = Depends(principal),
    ) -> dict:
        try:
            return await service(authorization).set_copy_status(user, copy_id, body.status)
        except (RuleError, GatewayError) as exc:
            fail(exc)

    @app.post("/api/v1/reservations", status_code=201)
    async def reserve(
        body: ReserveBody,
        authorization: Annotated[str | None, Header()] = None,
        user: Principal = Depends(principal),
    ) -> dict:
        try:
            return await service(authorization).reserve(user, body.bookId)
        except (RuleError, GatewayError) as exc:
            fail(exc)

    @app.post("/api/v1/reservations/{reservation_id}/cancel")
    async def cancel(
        reservation_id: str,
        authorization: Annotated[str | None, Header()] = None,
        user: Principal = Depends(principal),
    ) -> dict[str, str]:
        try:
            await service(authorization).cancel_reservation(user, reservation_id)
        except (RuleError, GatewayError) as exc:
            fail(exc)
        return {"status": "cancelled"}

    @app.post("/api/v1/reservations/{reservation_id}/approve")
    async def approve(
        reservation_id: str,
        authorization: Annotated[str | None, Header()] = None,
        user: Principal = Depends(principal),
    ) -> dict:
        try:
            return await service(authorization).approve_reservation(user, reservation_id)
        except (RuleError, GatewayError) as exc:
            fail(exc)

    @app.post("/api/v1/loans", status_code=201)
    async def issue(
        body: IssueBody,
        authorization: Annotated[str | None, Header()] = None,
        user: Principal = Depends(principal),
    ) -> dict:
        try:
            return await service(authorization).issue(user, body.email, body.accession)
        except (RuleError, GatewayError) as exc:
            fail(exc)

    @app.post("/api/v1/loans/{loan_id}/return")
    async def return_loan(
        loan_id: str,
        authorization: Annotated[str | None, Header()] = None,
        user: Principal = Depends(principal),
    ) -> dict:
        try:
            return await service(authorization).return_copy(user, loan_id)
        except (RuleError, GatewayError) as exc:
            fail(exc)

    @app.post("/api/v1/fines/{fine_id}/settle")
    async def settle(
        fine_id: str,
        body: FineBody,
        authorization: Annotated[str | None, Header()] = None,
        user: Principal = Depends(principal),
    ) -> dict:
        try:
            return await service(authorization).settle_fine(user, fine_id, body.status)
        except (RuleError, GatewayError) as exc:
            fail(exc)
