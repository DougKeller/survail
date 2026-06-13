from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from survail.db import engine
from survail.integrations.scryfall import ScryfallError, ScryfallNotFoundError
from survail.routes import agent, auth, cards, decks, evaluations, formats, imports
from survail.settings import get_settings
from survail.telemetry import configure_telemetry

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
app.include_router(auth.router)
app.include_router(cards.router)
app.include_router(decks.router)
app.include_router(formats.router)
app.include_router(imports.router)
app.include_router(agent.router)
app.include_router(agent.guidance_router)
app.include_router(evaluations.router)


@app.exception_handler(ScryfallError)
def handle_scryfall_error(_: Request, exc: ScryfallError) -> JSONResponse:
    status_code = 404 if isinstance(exc, ScryfallNotFoundError) else 502
    return JSONResponse(status_code=status_code, content={"detail": str(exc)})


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ok"}
