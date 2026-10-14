from typing import Literal
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000, description="The customer's question")
    session_id: str | None = Field(default=None, min_length=1, max_length=64,
                                   description="Conversation session ID; reuse it to continue a conversation")


class ChatConfirmRequest(BaseModel):
    action: Literal["place_order", "cancel_order"]
    confirmed: bool
    order_id: int | None = Field(default=None, gt=0)
    items: list[dict] | None = None


class ChatMessageResponse(BaseModel):
    id: int
    session_id: str
    role: Literal["user", "assistant"]
    content: str
    created_at: str
