
import os

from dotenv import load_dotenv
from google import genai

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError(
        "GEMINI_API_KEY is missing from the .env file"
    )

client = genai.Client(api_key=api_key)



def generate_answer(question: str, context: str) -> str:
    prompt = f"""
You are RestRobot, a helpful restaurant chatbot.

Answer the customer's question using only the restaurant
information provided below.

If the information does not contain the answer, say that
you don't have enough information to answer accurately.
Do not invent prices, policies, or restaurant details.

Restaurant information:
{context}

Customer question:
{question}

Answer:
"""

    interaction = client.interactions.create(
        model="gemini-3.8-flash",
        input=prompt
    )

    return interaction.output_text

