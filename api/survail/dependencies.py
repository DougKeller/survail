from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from survail.db import get_db
from survail.models import User
from survail.security import get_current_user
from survail.settings import Settings, get_settings

DbSession = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]
AppSettings = Annotated[Settings, Depends(get_settings)]
