from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from survail.core.config import get_settings
from survail.core.db import engine
from survail.core.telemetry import configure_telemetry
from survail.integrations.scryfall.client import ScryfallError, ScryfallNotFoundError
from survail.modules.agent.api.router import router as agent_router
from survail.modules.auth.api.router import router as auth_router
from survail.modules.cards.api.router import router as cards_router
from survail.modules.decks.api.router import router as decks_router
from survail.modules.decks.evaluations.api.annotations_router import (
    router as evaluation_annotations_router,
)
from survail.modules.decks.evaluations.api.router import router as evaluations_router
from survail.modules.decks.guidance.api.router import router as guidance_router
from survail.modules.decks.operations.api.router import router as operations_router
from survail.modules.formats.api.router import router as formats_router
from survail.modules.imports.api.router import router as imports_router

settings = get_settings()
app = FastAPI(title=settings.app_name)
configure_telemetry(app, engine, settings)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.web_base_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(cards_router)
app.include_router(decks_router)
app.include_router(operations_router)
app.include_router(formats_router)
app.include_router(imports_router)
app.include_router(agent_router)
app.include_router(guidance_router)
app.include_router(evaluations_router)
app.include_router(evaluation_annotations_router)


@app.exception_handler(ScryfallError)
def handle_scryfall_error(_: Request, exc: ScryfallError) -> JSONResponse:
    status_code = 404 if isinstance(exc, ScryfallNotFoundError) else 502
    return JSONResponse(status_code=status_code, content={"detail": str(exc)})


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ok"}
