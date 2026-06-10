import hashlib
from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from survail.db import get_db
from survail.models import User, UserSession
from survail.settings import Settings, get_settings


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def get_current_user(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> User:
    if settings.auth_strategy == "mock":
        user = db.scalar(select(User).where(User.discord_id == "mock-local-user"))
        if user is None:
            user = User(
                discord_id="mock-local-user",
                username="local-developer",
                display_name="Local Developer",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        return user

    session_cookie = request.cookies.get(settings.session_cookie_name)
    if not session_cookie:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    session = db.scalar(
        select(UserSession).where(UserSession.token_hash == hash_session_token(session_cookie))
    )
    if session is None or session.expires_at <= datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    return session.user
