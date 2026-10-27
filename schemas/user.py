from pydantic import BaseModel


class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    phone: str | None = None

class UserLogin(BaseModel):
    email: str
    password: str