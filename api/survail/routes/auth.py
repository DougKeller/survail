import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse
from itsdangerous import BadSignature, URLSafeTimedSerializer
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select

from survail.dependencies import AppSettings, CurrentUser, DbSession
from survail.models import User, UserSession
from survail.schemas import UserRead
from survail.security import hash_session_token
from survail.settings import Settings

router = APIRouter(prefix="/auth", tags=["auth"])

DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize"
DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"
DISCORD_ME_URL = "https://discord.com/api/users/@me"


class DiscordTokenResponse(BaseModel):
    model_config = ConfigDict(extra="ignore", strict=True)
    access_token: str


class DiscordUserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore", strict=True)
    id: str
    username: str
    global_name: str | None = None
    avatar: str | None = None


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
        with httpx.Client(timeout=10.0) as client:
            token_response = client.post(
                DISCORD_TOKEN_URL,
                data={
                    "client_id": settings.discord_oauth_client_id,
                    "client_secret": settings.discord_oauth_client_secret,
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": settings.discord_redirect_uri,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            if token_response.is_error:
                raise HTTPException(status_code=502, detail="Discord token exchange failed")

            token = DiscordTokenResponse.model_validate(token_response.json())
            me_response = client.get(
                DISCORD_ME_URL, headers={"Authorization": f"Bearer {token.access_token}"}
            )
            if me_response.is_error:
                raise HTTPException(status_code=502, detail="Discord user lookup failed")
            discord_user = DiscordUserResponse.model_validate(me_response.json())
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Discord OAuth request failed") from exc

    user = db.scalar(select(User).where(User.discord_id == discord_user.id))
    if user is None:
        user = User(discord_id=discord_user.id, username=discord_user.username)
        db.add(user)

    user.username = discord_user.username
    user.display_name = discord_user.global_name
    user.avatar_hash = discord_user.avatar
    db.commit()
    db.refresh(user)

    session_token = secrets.token_urlsafe(32)
    db.add(
        UserSession(
            user_id=user.id,
            token_hash=hash_session_token(session_token),
            expires_at=datetime.now(UTC) + timedelta(seconds=settings.session_max_age_seconds),
        )
    )
    db.commit()
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


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    db: DbSession,
    settings: AppSettings,
) -> Response:
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        session = db.scalar(
            select(UserSession).where(UserSession.token_hash == hash_session_token(token))
        )
        if session:
            db.delete(session)
            db.commit()
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(settings.session_cookie_name)
    return response
