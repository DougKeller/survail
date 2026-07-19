from typing import cast

from sqlalchemy.orm import Session

from survail.core.models import User
from survail.modules.auth.api.router import update_settings
from survail.modules.auth.api.schemas import UserSettingsUpdate


class FakeSettingsSession:
    def __init__(self) -> None:
        self.committed = False
        self.refreshed: User | None = None

    def commit(self) -> None:
        self.committed = True

    def refresh(self, user: User) -> None:
        self.refreshed = user


def test_update_settings_persists_scoring_preference() -> None:
    user = User(discord_id="discord", username="user", scoring_enabled=True)
    session = FakeSettingsSession()

    result = update_settings(
        UserSettingsUpdate(scoring_enabled=False),
        cast("Session", session),
        user,
    )

    assert result is user
    assert not user.scoring_enabled
    assert session.committed
    assert session.refreshed is user
