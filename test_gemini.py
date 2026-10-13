from services.gemini_service import generate_answer

answer = generate_answer(
    "Explain what a restaurant chatbot does in two simple sentences."
)

print(answer)