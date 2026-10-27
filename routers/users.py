from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from schemas.user import UserCreate,UserLogin
from database import get_db
from models.user import User

from auth import hash_password, verify_password
from security import (
    create_access_token,
    get_current_user,
    require_admin
)

router = APIRouter()


@router.post("/register")
def register(
    user: UserCreate,
    db: Session = Depends(get_db)
):
    new_user = User(
        name=user.name,
        email=user.email,
        phone=user.phone,
        password=hash_password(user.password)
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "User registered successfully",
        "id": new_user.id,
        "name": new_user.name,
        "email": new_user.email
    }

@router.post("/login")
def login(
    user: UserLogin,
    db: Session = Depends(get_db)
):
    existing_user = db.query(User).filter(
        User.email == user.email
    ).first()

    if not existing_user:
        return {"message": "Invalid email or password"}

    if not verify_password(
        user.password,
        existing_user.password
    ):
        return {"message": "Invalid email or password"}

    access_token = create_access_token(
    data={
        "sub": str(existing_user.id),
        "role": existing_user.role
    }
)

    return {
    "message": "Login successful",
    "access_token": access_token,
    "token_type": "bearer"
     }

@router.get("/profile")
def profile(
    current_user: User = Depends(get_current_user)
):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "phone": current_user.phone,
        "role": current_user.role
    }

@router.get("/admin")
def admin_area(
    current_user: User = Depends(require_admin)
):
    return {
        "message": "Welcome to the admin area",
        "user": current_user.name,
        "role": current_user.role
    }