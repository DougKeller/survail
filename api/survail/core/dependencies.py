from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from survail.core.config import Settings, get_settings
from survail.core.db import get_db
from survail.core.models import User
from survail.core.security import get_current_user

DbSession = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]
AppSettings = Annotated[Settings, Depends(get_settings)]
