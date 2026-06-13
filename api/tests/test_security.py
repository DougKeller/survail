from typing import cast

from sqlalchemy.orm import Session
from starlette.requests import Request

from survail.models import User
from survail.security import get_current_user
from survail.settings import Settings


class ExistingUserSession:
    def __init__(self, user: User) -> None:
        self.user = user

    def scalar(self, statement: object) -> User:
        del statement
        return self.user


def test_mock_auth_returns_local_user_without_session_cookie() -> None:
    user = User(discord_id="mock-local-user", username="local-developer")
    request = Request({"type": "http", "headers": []})
    db = cast("Session", ExistingUserSession(user))
    settings = Settings(auth_strategy="mock")

    assert get_current_user(request, db, settings) is user
