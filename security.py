from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from database import get_db
from models.user import User


SECRET_KEY = "change-this-to-a-random-secret-key"
ALGORITHM = "HS256"


oauth2_scheme = HTTPBearer()
optional_oauth2_scheme = HTTPBearer(
    auto_error=False
)


def create_access_token(data: dict):
    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + timedelta(minutes=30)

    to_encode.update({
        "exp": expire
    })

    token = jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return token

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    payload = jwt.decode(
        token,
        SECRET_KEY,
        algorithms=[ALGORITHM]
    )
    user_id = payload.get("sub")
    if user_id is None:
      raise HTTPException(
        status_code=401,
        detail="Invalid authentication credentials"
    )

    current_user = db.query(User).filter(
    User.id == int(user_id)
    ).first()

    if current_user is None:
      raise HTTPException(
        status_code=401,
        detail="User not found"
    ) 

    return current_user


def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(
        optional_oauth2_scheme
    ),
    db: Session = Depends(get_db)
):
    if credentials is None:
        return None

    try:
        token = credentials.credentials

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("sub")

        if user_id is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication credentials"
            )

        current_user = db.query(User).filter(
            User.id == int(user_id)
        ).first()

        if current_user is None:
            raise HTTPException(
                status_code=401,
                detail="User not found"
            )

        return current_user

    except (JWTError, ValueError):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired authentication token"
        )


def require_admin(
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    return current_user