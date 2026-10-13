from typing import Literal
from pydantic import BaseModel


class OrderItemCreate(BaseModel):
    menu_item_id: int
    quantity: int


class OrderCreate(BaseModel):
    items: list[OrderItemCreate]

class OrderStatusUpdate(BaseModel):
    status: Literal["pending", "preparing", "delivered","cancelled"]