from sqlalchemy import select
from sqlalchemy.orm import Session

from survail.models import User, UserSession


class AuthRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def user_by_discord_id(self, discord_id: str) -> User | None:
        return self._db.scalar(select(User).where(User.discord_id == discord_id))

    def session_by_token_hash(self, token_hash: str) -> UserSession | None:
        return self._db.scalar(select(UserSession).where(UserSession.token_hash == token_hash))

    def add(self, value: object) -> None:
        self._db.add(value)

    def delete(self, value: object) -> None:
        self._db.delete(value)

    def commit(self) -> None:
        self._db.commit()

    def refresh(self, value: object) -> None:
        self._db.refresh(value)
