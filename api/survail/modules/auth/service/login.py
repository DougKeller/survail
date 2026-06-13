import secrets
from datetime import UTC, datetime, timedelta

import httpx
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from survail.core.config import Settings
from survail.core.models import User, UserSession
from survail.core.security import hash_session_token
from survail.modules.auth.repository.users import AuthRepository

DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"
DISCORD_ME_URL = "https://discord.com/api/users/@me"


class DiscordOAuthError(RuntimeError):
    pass


class DiscordTokenResponse(BaseModel):
    model_config = ConfigDict(extra="ignore", strict=True)
    access_token: str


class DiscordUserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore", strict=True)
    id: str
    username: str
    global_name: str | None = None
    avatar: str | None = None


class AuthService:
    def __init__(self, db: Session) -> None:
        self._repository = AuthRepository(db)

    def complete_discord_login(self, code: str, settings: Settings) -> tuple[User, str]:
        discord_user = self._discord_user(code, settings)
        user = self._repository.user_by_discord_id(discord_user.id)
        if user is None:
            user = User(discord_id=discord_user.id, username=discord_user.username)
            self._repository.add(user)
        user.username = discord_user.username
        user.display_name = discord_user.global_name
        user.avatar_hash = discord_user.avatar
        self._repository.commit()
        self._repository.refresh(user)

        session_token = secrets.token_urlsafe(32)
        self._repository.add(
            UserSession(
                user_id=user.id,
                token_hash=hash_session_token(session_token),
                expires_at=datetime.now(UTC) + timedelta(seconds=settings.session_max_age_seconds),
            )
        )
        self._repository.commit()
        return user, session_token

    def logout(self, token: str) -> None:
        session = self._repository.session_by_token_hash(hash_session_token(token))
        if session is not None:
            self._repository.delete(session)
            self._repository.commit()

    def _discord_user(self, code: str, settings: Settings) -> DiscordUserResponse:
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
                    raise DiscordOAuthError("Discord token exchange failed")
                token = DiscordTokenResponse.model_validate(token_response.json())
                me_response = client.get(
                    DISCORD_ME_URL, headers={"Authorization": f"Bearer {token.access_token}"}
                )
                if me_response.is_error:
                    raise DiscordOAuthError("Discord user lookup failed")
                return DiscordUserResponse.model_validate(me_response.json())
        except (httpx.HTTPError, ValueError) as exc:
            raise DiscordOAuthError("Discord OAuth request failed") from exc
