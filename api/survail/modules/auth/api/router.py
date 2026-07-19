from typing import Annotated
from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse
from itsdangerous import BadSignature, URLSafeTimedSerializer

from survail.core.config import Settings
from survail.core.dependencies import AppSettings, CurrentUser, DbSession
from survail.core.models import User
from survail.modules.auth.api.schemas import UserRead, UserSettingsUpdate
from survail.modules.auth.service.login import AuthService, DiscordOAuthError

router = APIRouter(prefix="/auth", tags=["auth"])

DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize"


def _serializer(settings: Settings, salt: str) -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(settings.session_secret, salt=salt)


@router.get("/discord/login")
def discord_login(settings: AppSettings) -> RedirectResponse:
    if not settings.discord_configured:
        raise HTTPException(status_code=503, detail="Discord OAuth is not configured")

    state = _serializer(settings, "discord-oauth-state").dumps({"purpose": "discord-login"})
    query = urlencode(
        {
            "client_id": settings.discord_oauth_client_id,
            "redirect_uri": settings.discord_redirect_uri,
            "response_type": "code",
            "scope": "identify",
            "state": state,
        }
    )
    response = RedirectResponse(f"{DISCORD_AUTHORIZE_URL}?{query}", status_code=302)
    response.set_cookie(
        "discord_oauth_state",
        state,
        max_age=600,
        httponly=True,
        secure=settings.environment != "development",
        samesite="lax",
    )
    return response


@router.get("/discord/callback")
def discord_callback(
    request: Request,
    code: Annotated[str, Query(min_length=1)],
    state: Annotated[str, Query(min_length=1)],
    db: DbSession,
    settings: AppSettings,
) -> RedirectResponse:
    state_cookie = request.cookies.get("discord_oauth_state")
    if state_cookie != state:
        raise HTTPException(status_code=400, detail="OAuth state mismatch")
    try:
        state_payload = _serializer(settings, "discord-oauth-state").loads(state, max_age=600)
        if state_payload.get("purpose") != "discord-login":
            raise BadSignature("Invalid OAuth state purpose")
    except (BadSignature, AttributeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid OAuth state") from exc

    try:
        _user, session_token = AuthService(db).complete_discord_login(code, settings)
    except DiscordOAuthError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    response = RedirectResponse(f"{settings.web_base_url.rstrip('/')}/decks", status_code=302)
    response.delete_cookie("discord_oauth_state")
    response.set_cookie(
        settings.session_cookie_name,
        session_token,
        max_age=settings.session_max_age_seconds,
        httponly=True,
        secure=settings.environment != "development",
        samesite="lax",
    )
    return response


@router.get("/me", response_model=UserRead)
def me(user: CurrentUser) -> User:
    return user


@router.patch("/me/settings", response_model=UserRead)
def update_settings(payload: UserSettingsUpdate, db: DbSession, user: CurrentUser) -> User:
    return AuthService(db).update_scoring_setting(user, enabled=payload.scoring_enabled)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    db: DbSession,
    settings: AppSettings,
) -> Response:
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        AuthService(db).logout(token)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(settings.session_cookie_name)
    return response
