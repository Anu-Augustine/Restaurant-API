import time

from fastapi import FastAPI, Depends, HTTPException
from database import Base, engine, get_db
from models.user import User
from routers.users import router as users_router
from models.menu import MenuItem
from routers.menu import router as menu_router
from models.order import Order
from models.order_item import OrderItem
from routers.order import router as order_router
from models.knowledge import Knowledge
from sqlalchemy.orm import Session
from services.knowledge_retrieval import search_knowledge, search_menu
from schemas.chat import ChatRequest
from services.gemini_service import generate_answer


Base.metadata.create_all(bind=engine)

app = FastAPI()

app.include_router(users_router)
app.include_router(menu_router)
app.include_router(order_router)

@app.get("/")
def root():
    return {"message": "Restaurant API is running"}

@app.middleware("http")
async def log_requests(request, call_next):

    start_time = time.time()

    response = await call_next(request)

    process_time = time.time() - start_time

    print(
        f"{request.method} {request.url.path} "
        f"- {process_time:.4f} seconds"
    )

    return response


@app.get("/test-knowledge")
def test_knowledge(
    query: str,
    db: Session = Depends(get_db)
):
    results = search_knowledge(query, db)

    return [
        {
            "title": item.title,
            "category": item.category,
            "content": item.content
        }
        for item in results
    ]


@app.post("/chat")
def chat(
    request: ChatRequest,
    db: Session = Depends(get_db)
):
    question = request.question
    question_lower = question.lower()

    # Step 1: Check whether this is a menu search question
    if "vegetarian" in question_lower or "veg" in question_lower:

        # Step 2: Look for a price limit, such as 150
        import re

        price_match = re.search(
            r"(?:under|below|less than|within|under rs\.?|under ₹)\s*₹?\s*(\d+(?:\.\d+)?)|₹\s*(\d+(?:\.\d+)?)",
            question_lower
        )

        max_price = None

        if price_match:
            price_value = next(
                (value for value in price_match.groups() if value),
                None
            )
            if price_value:
                max_price = float(price_value)

        # Step 3: Retrieve current menu data from MySQL
        menu_items = search_menu(
            db=db,
            max_price=max_price,
            vegetarian_only=True
        )

        # Step 4: Build an answer from the database results
        if not menu_items:
            answer = "Sorry, no matching vegetarian dishes were found."
        else:
            answer = "Here are the available vegetarian dishes:\n"
            for item in menu_items:
                answer += f"\n- {item.name}: ₹{item.price:.2f}"

        return {
            "question": question,
            "answer": answer,
            "sources": [{"title": "Live Menu", "category": "menu"}]
        }

    # Step 5: For other questions, use the existing knowledge retrieval
    results = search_knowledge(question, db)

    if not results:
        return {
            "question": question,
            "answer": (
                "Sorry, I couldn't find relevant information "
                "in the restaurant knowledge base."
            )
        }

    context = "\n\n".join(
        f"{item.title}: {item.content}"
        for item in results
    )

    try:
        answer = generate_answer(question, context)
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="The chatbot could not generate a response."
        )

    return {
        "question": question,
        "answer": answer,
        "sources": [
            {
                "title": item.title,
                "category": item.category
            }
            for item in results
        ]
    }
