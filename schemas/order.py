from typing import Literal
from pydantic import BaseModel


class OrderItemCreate(BaseModel):
    menu_item_id: int
    quantity: int


class OrderCreate(BaseModel):
    items: list[OrderItemCreate]

class OrderStatusUpdate(BaseModel):
    status: Literal[
        "pending",
        "preparing",
        "ready for delivery pickup",
        "out for delivery",
        "ready for customer pickup",
        "delivered",
        "cancelled",
    ]