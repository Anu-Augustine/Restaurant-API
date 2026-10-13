
from database import SessionLocal
from services.knowledge_retrieval import search_knowledge
from services.gemini_service import generate_answer


db = SessionLocal()

try:
    question = "Can I cancel my order?"

    results = search_knowledge(question, db)

    context = "\n\n".join(
        f"{item.title}: {item.content}"
        for item in results
    )

    if not context:
        print("No relevant restaurant information found.")
    else:
        answer = generate_answer(question, context)
        print("RestRobot:", answer)

finally:
    db.close()
