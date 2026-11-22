from pathlib import Path
from typing import Annotated, Awaitable, Callable

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.api.accounts import register_accounts
from app.api.assistant import register_assistant
from app.api.evaluation import register_evaluation
from app.api.insights import register_insights
from app.api.digital import StorageFactory, register_digital
from app.api.discovery import register_discovery
from app.services.discovery import DiscoveryClient
from app.api.library import GatewayFactory, register_library
from app.core.access import access_decision, profile_write
from app.core.config import Settings
from app.core.security import AuthFailure, Principal, ProfileUpdate, resolve_principal, save_profile

Resolver = Callable[[str, Settings], Awaitable[Principal]]
Saver = Callable[[str, str, dict[str, object], Settings], Awaitable[dict[str, object]]]


def create_app(
    settings: Settings | None = None,
    resolver: Resolver = resolve_principal,
    saver: Saver = save_profile,
    gateway_factory: GatewayFactory | None = None,
    storage_factory: StorageFactory | None = None,
    discovery_client: DiscoveryClient | None = None,
    trace_gateway_factory: Callable[[], object] | None = None,
    account_creator: Callable[[str, str, str], Awaitable[None]] | None = None,
) -> FastAPI:
    active = settings or Settings()
    app = FastAPI(title="LibriMind", version="0.2.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=active.origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    async def principal(authorization: Annotated[str | None, Header()] = None) -> Principal:
        if not active.auth_configured:
            raise HTTPException(status_code=503, detail="Authentication is not configured.")
        if authorization is None or not authorization.lower().startswith("bearer "):
            raise HTTPException(status_code=401, detail="Sign in is required.")
        token = authorization.split(" ", 1)[1].strip()
        if not token:
            raise HTTPException(status_code=401, detail="Sign in is required.")
        try:
            return await resolver(token, active)
        except AuthFailure as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    @app.get("/api/v1/health")
    def health() -> dict[str, object]:
        return {
            "status": "ok",
            "auth_configured": active.auth_configured,
            "model_configured": active.model_configured,
        }

    @app.get("/api/v1/me", response_model=Principal)
    async def me(user: Principal = Depends(principal)) -> Principal:
        return user

    @app.patch("/api/v1/me")
    async def update_me(
        body: ProfileUpdate,
        authorization: Annotated[str | None, Header()] = None,
        user: Principal = Depends(principal),
    ) -> dict[str, object]:
        written = profile_write(body.full_name, body.programme, body.reading_interests)
        token = "" if authorization is None else authorization.split(" ", 1)[1].strip()
        saved = await saver(token, user.user_id, written, active)
        return {"user_id": user.user_id, "role": user.role, "profile": saved}

    @app.get("/api/v1/admin/session")
    async def admin_session(user: Principal = Depends(principal)) -> dict[str, str]:
        if access_decision(user.role, "admin") != "allowed":
            raise HTTPException(status_code=403, detail="Admin access is required.")
        return {"status": "ok", "role": user.role}

    register_library(app, active, principal, gateway_factory)
    register_digital(app, active, principal, gateway_factory, storage_factory)
    register_discovery(app, active, principal, gateway_factory, storage_factory, discovery_client)
    register_assistant(app, active, principal, gateway_factory, trace_gateway_factory)
    register_insights(app, active, principal, gateway_factory, trace_gateway_factory)
    register_evaluation(app, principal)
    register_accounts(app, active, account_creator)
    _mount_interface(app, active.static_dir)
    return app


def _mount_interface(app: FastAPI, directory: str) -> None:
    root = Path(directory)
    index = root / "index.html"
    if not directory or not index.is_file():
        return
    base = root.resolve()

    @app.get("/{full_path:path}", include_in_schema=False)
    async def interface(full_path: str) -> FileResponse:
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found.")
        candidate = (root / full_path).resolve()
        try:
            candidate.relative_to(base)
        except ValueError:
            raise HTTPException(status_code=404, detail="Not found.") from None
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(index)


app = create_app()
