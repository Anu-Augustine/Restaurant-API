from pydantic import BaseModel, Field
from typing import Optional


class MenuItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    category: str
    is_vegetarian: bool = False
    is_vegan: bool = False
    spice_level: int = Field(default=0, ge=0, le=3)
    ingredients: Optional[str] = None
    allergens: Optional[str] = None


class MenuItemUpdate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    category: str
    is_available: bool
    is_vegetarian: bool = False
    is_vegan: bool = False
    spice_level: int = Field(default=0, ge=0, le=3)
    ingredients: Optional[str] = None
    allergens: Optional[str] = None
