import uuid

from pydantic import ConfigDict

from survail.core.schemas import StrictModel


class UserRead(StrictModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid", strict=True)

    id: uuid.UUID
    discord_id: str
    username: str
    display_name: str | None
    avatar_hash: str | None
