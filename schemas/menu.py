from pydantic import BaseModel


class MenuItemCreate(BaseModel):
    name: str
    description: str
    price: float
    category: str


class MenuItemUpdate(BaseModel):
    name: str
    description: str
    price: float
    category: str
    is_available: bool
