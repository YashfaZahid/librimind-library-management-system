from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel

from app.agents.openai_desk import OpenAIDesk
from app.agents.service import AssistantService
from app.core.config import Settings
from app.core.security import Principal
from app.db.gateway import Gateway, GatewayError, PostgrestGateway
from app.services.files import FileError


class AskBody(BaseModel):
    message: str


def register_assistant(app: FastAPI, settings: Settings, principal, gateway_factory, trace_factory) -> None:
    def library_for(authorization: str | None) -> Gateway:
        token = "" if authorization is None else authorization.split(" ", 1)[1].strip()
        return gateway_factory(token) if gateway_factory else PostgrestGateway(settings, token)

    def trace_for() -> Gateway:
        if trace_factory:
            return trace_factory()
        if not settings.supabase_service_role_key:
            raise FileError("The assistant log is not configured.", status_code=503)
        key = settings.supabase_service_role_key
        return PostgrestGateway(settings, key, apikey=key)

    def fail(exc: Exception) -> None:
        if isinstance(exc, FileError):
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
        if isinstance(exc, GatewayError):
            status = exc.status_code if exc.status_code in {401, 403, 404} else 400
            raise HTTPException(status_code=status, detail=exc.detail) from exc
        raise exc

    @app.post("/api/v1/assistant")
    async def ask(
        body: AskBody,
        authorization: Annotated[str | None, Header()] = None,
        user: Principal = Depends(principal),
    ) -> dict:
        try:
            model = OpenAIDesk(settings) if settings.model_configured else None
            return await AssistantService(library_for(authorization), trace_for(), model=model).ask(user, body.message)
        except (FileError, GatewayError) as exc:
            fail(exc)

    @app.get("/api/v1/assistant/runs")
    async def runs(
        authorization: Annotated[str | None, Header()] = None,
        user: Principal = Depends(principal),
    ) -> dict:
        del user
        try:
            return {"runs": await AssistantService(library_for(authorization), trace_for()).runs()}
        except (FileError, GatewayError) as exc:
            fail(exc)
