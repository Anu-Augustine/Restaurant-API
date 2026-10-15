import time
import re
from pathlib import Path
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from database import Base, engine, get_db
from security import get_optional_current_user, get_current_user
from models.user import User
from models.menu import MenuItem
from models.order import Order
from models.order_item import OrderItem
from models.knowledge import Knowledge
from models.chat_message import ChatMessage
from routers.users import router as users_router
from routers.menu import router as menu_router
from routers.order import router as order_router
from schemas.chat import ChatRequest, ChatConfirmRequest
from services.knowledge_retrieval import search_knowledge
from services.gemini_service import generate_answer, run_menu_tool_flow
from services.chat_tools import get_my_orders, get_order_status

# Import models before create_all so SQLAlchemy knows their tables.

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(users_router)
app.include_router(menu_router)
app.include_router(order_router)

public_dir = Path(__file__).resolve().parent / "public"
(public_dir / "images").mkdir(parents=True, exist_ok=True)
app.mount("/public", StaticFiles(directory=str(public_dir)), name="public")


@app.get("/")
def root():
    return {"message": "Restaurant API is running"}


@app.middleware("http")
async def log_requests(request, call_next):
    start = time.time()
    response = await call_next(request)
    print(f"{request.method} {request.url.path} - {time.time() - start:.4f} seconds")
    return response


@app.get("/test-knowledge")
def test_knowledge(query: str, db: Session = Depends(get_db)):
    return [{"title": item.title, "category": item.category, "content": item.content}
            for item in search_knowledge(query, db)]




def _save_chat_message(db: Session, user_id: int | None, session_id: str,
                       role: str, content: str) -> None:
    """Persist one message in the conversation history."""
    db.add(ChatMessage(user_id=user_id, session_id=session_id, role=role, content=content))
    db.commit()


def _chat_response(db: Session, user_id: int | None, session_id: str,
                   question: str, answer: str, sources: list[dict]):
    _save_chat_message(db, user_id, session_id, "assistant", answer)
    return {"question": question, "answer": answer, "sources": sources,
            "session_id": session_id}


@app.post("/chat")
def chat(request: ChatRequest, db: Session = Depends(get_db),
         current_user=Depends(get_optional_current_user)):
    question = request.question.strip()
    lowered = question.lower()
    user_id = current_user.id if current_user else None
    import uuid
    session_id = request.session_id or str(uuid.uuid4())
    _save_chat_message(db, user_id, session_id, "user", question)

    # Route explicit order-status requests directly to the database-backed tool.
    # This avoids relying on Gemini to recognize phrases such as "status of order 7".
    order_match = re.search(r"\border\s*#?\s*(\d+)\b", lowered)
    status_intent = any(phrase in lowered for phrase in (
        "order status", "status of order", "status of my order", "track my order",
        "track order", "where is my order", "what is happening with order",
    ))
    history_intent = any(phrase in lowered for phrase in (
        "my orders", "order history", "show my orders", "list my orders", "all my orders",
    ))

    if status_intent and order_match:
        if user_id is None:
            answer = "Please log in to check your order status."
        else:
            try:
                result = get_order_status(db=db, order_id=int(order_match.group(1)), user_id=user_id)
                answer = f"Order #{result['order_id']}\nStatus: {result['status']}\nTotal: ₹{result['total_amount']:.2f}"
                for item in result.get("items", []):
                    answer += f"\n- {item.get('name', 'Menu item')} × {item.get('quantity', 1)} — ₹{float(item.get('subtotal', 0)):.2f}"
            except HTTPException as exc:
                if exc.status_code == 404:
                    answer = "I couldn't find that order under your account. Please check the order number."
                else:
                    raise
        return _chat_response(db, user_id, session_id, request.question, answer,
                              [{"title": "Order database", "category": "order"}])

    if history_intent:
        if user_id is None:
            answer = "Please log in to view your order history."
        else:
            result = get_my_orders(db=db, user_id=user_id)
            orders = result.get("orders", [])
            answer = ("Here are your orders:\n" + "\n".join(
                f"Order #{order['id']} — {order['status']} — ₹{order['total_amount']:.2f}"
                for order in orders)) if orders else result.get("message", "You have no orders yet.")
        return _chat_response(db, user_id, session_id, request.question, answer,
                              [{"title": "Order database", "category": "order"}])

    # Use Gemini function calling for menu, restaurant FAQ, and other supported requests.
    try:
        answer = run_menu_tool_flow(db=db, question=question, user_id=user_id)
    except Exception as exc:
        print("Chat tool calling error:", type(exc).__name__, exc)
        raise HTTPException(status_code=502, detail="The chatbot could not process the question.")
    return _chat_response(db, user_id, session_id, request.question, answer,
                          [{"title": "RestRobot tools", "category": "menu/order/knowledge"}])




@app.get("/chat/history")
def get_chat_history(
    session_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return only the authenticated user's messages for one conversation."""
    messages = (db.query(ChatMessage)
                .filter(ChatMessage.user_id == current_user.id,
                        ChatMessage.session_id == session_id)
                .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
                .all())
    return [{
        "id": message.id,
        "session_id": message.session_id,
        "role": message.role,
        "content": message.content,
        "created_at": message.created_at.isoformat(),
    } for message in messages]


@app.post("/chat/confirm")
def confirm_chat_action(
    request: ChatConfirmRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Explicit authenticated confirmation endpoint for order mutations.

    This endpoint does not trust any user_id from the request. Confirmation is
    represented by a separate authenticated POST with confirmed=true.
    """
    if not request.confirmed:
        return {"success": False, "message": "No changes were made because confirmation was not provided."}

    if request.action == "place_order":
        if not request.items:
            raise HTTPException(status_code=400, detail="Provide the items from the order preview.")
        from schemas.order import OrderCreate
        from services.order_service import create_order
        try:
            order_data = OrderCreate(items=request.items)
            order = create_order(db=db, user_id=current_user.id, order_data=order_data)
        except HTTPException:
            raise
        return {"success": True, "message": "Order placed successfully.",
                "order_id": order.id, "status": str(order.status),
                "total_amount": float(order.total_amount)}

    if request.action == "cancel_order":
        if request.order_id is None:
            raise HTTPException(status_code=400, detail="order_id is required to cancel an order.")
        from services.order_service import cancel_order
        order = cancel_order(db=db, order_id=request.order_id, user_id=current_user.id)
        return {"success": True, "message": "Order cancelled successfully.",
                "order_id": order.id, "status": str(order.status)}

    raise HTTPException(status_code=400, detail="Unsupported action.")
