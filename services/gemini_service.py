import os
import time
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY is missing from the .env file")

client = genai.Client(api_key=api_key, http_options=types.HttpOptions(
    timeout=30000, retry_options=types.HttpRetryOptions(attempts=1)))


def generate_answer(question: str, context: str) -> str:
    prompt = f"""You are RestRobot, a helpful restaurant chatbot.
Answer using only the restaurant information below. Do not invent prices, policies, or details.
If the answer is not present, say you do not have enough information.

Restaurant information:
{context}

Customer question: {question}
Answer:"""
    response = client.interactions.create(model="gemini-3.5-flash-lite", input=prompt)
    return response.output_text or "I couldn't generate an answer from the available information."

search_menu_declaration = {"type": "function", "name": "search_menu", "description": "Search available menu items. Supports category, keyword, price, vegetarian, vegan, allergen exclusions and spice filters.", "parameters": {"type": "object", "properties": {
    "max_price": {"type": "number", "description": "Maximum price in rupees."},
    "vegetarian_only": {"type": "boolean"}, "non_vegetarian_only": {"type": "boolean"},
    "vegan_only": {"type": "boolean"}, "category": {"type": "string"}, "keyword": {"type": "string"},
    "spice_level": {"type": "string", "description": "Not specified, mild, medium, hot, or 0-3."},
    "max_spice": {"type": "integer", "description": "Maximum spice level from 0 to 3."},
    "ingredient": {"type": "string"}, "allergen": {"type": "string", "description": "Find items listing this allergen."},
    "exclude_allergens": {"type": "array", "items": {"type": "string"}, "description": "Exclude items listing any of these allergens. Items with unknown allergen data are excluded too."},
    "inclusive_price": {"type": "boolean", "description": "True means price <= max_price; otherwise price is strictly below."}}, "required": []}}
get_menu_item_details_declaration = {"type": "function", "name": "get_menu_item_details", "description": "Get details of a specific available menu item by item ID or name.", "parameters": {"type": "object", "properties": {"item_id": {"type": "integer"}, "item_name": {"type": "string"}}, "required": []}}
get_restaurant_info_declaration = {"type": "function", "name": "get_restaurant_info", "description": "Search stored restaurant knowledge for hours, delivery, policies and FAQs. Do not use for live menu prices.", "parameters": {"type": "object", "properties": {"question": {"type": "string"}}, "required": ["question"]}}
get_my_orders_declaration = {"type": "function", "name": "get_my_orders", "description": "List the logged-in customer's orders. Never request or provide a user ID.", "parameters": {"type": "object", "properties": {}}}
get_order_status_declaration = {"type": "function", "name": "get_order_status", "description": "Get the status and items of a specific order belonging to the logged-in customer. Never request or provide a user ID.", "parameters": {"type": "object", "properties": {"order_id": {"type": "integer"}}, "required": ["order_id"]}}
place_order_declaration = {"type": "function", "name": "place_order", "description": "Prepare an order preview for the logged-in customer. This tool must not place the order; the customer must confirm separately.", "parameters": {"type": "object", "properties": {"items": {"type": "array", "items": {"type": "object", "properties": {"menu_item_id": {"type": "integer"}, "quantity": {"type": "integer"}}, "required": ["menu_item_id", "quantity"]}},}, "required": ["items"]}}
cancel_order_declaration = {"type": "function", "name": "cancel_order", "description": "Prepare a cancellation confirmation for a pending order belonging to the logged-in customer. This tool must not cancel the order; the customer must confirm separately.", "parameters": {"type": "object", "properties": {"order_id": {"type": "integer"}}, "required": ["order_id"]}}
menu_tool = [search_menu_declaration, get_menu_item_details_declaration, get_restaurant_info_declaration,
             get_my_orders_declaration, get_order_status_declaration, place_order_declaration, cancel_order_declaration]


def test_menu_tool_call(question: str):
    start = time.time()
    response = client.interactions.create(model="gemini-3.5-flash-lite", input=question, tools=menu_tool)
    print(f"Gemini tool-selection took {time.time() - start:.2f} seconds")
    return response


def execute_menu_tool_call(db: Session, response, user_id: int | None = None):
    from services.chat_tools import (search_menu, get_menu_item_details, get_restaurant_info,
        get_my_orders, get_order_status, place_order, cancel_my_order)
    for step in response.steps:
        if getattr(step, "type", None) != "function_call":
            continue
        args = step.arguments or {}
        print("Gemini tool:", step.name, "arguments:", args)
        if step.name == "search_menu":
            return search_menu(db=db, **args)
        if step.name == "get_menu_item_details":
            if not args.get("item_id") and not args.get("item_name"):
                return {"found": False, "message": "Please specify a menu item ID or name."}
            return get_menu_item_details(db=db, **args)
        if step.name == "get_restaurant_info":
            return get_restaurant_info(question=args["question"], db=db)
        if step.name in {"get_my_orders", "get_order_status", "place_order", "cancel_order"} and user_id is None:
            return {"found": False, "success": False, "message": "Please log in to manage or view your orders."}
        if step.name == "get_my_orders":
            return get_my_orders(db=db, user_id=user_id)
        if step.name == "get_order_status":
            return get_order_status(db=db, order_id=args["order_id"], user_id=user_id)
        if step.name == "place_order":
            return place_order(db=db, user_id=user_id, items=args["items"])
        if step.name == "cancel_order":
            return cancel_my_order(db=db, order_id=args["order_id"], user_id=user_id)
    return None



def _prepare_order_from_explicit_request(db: Session, question: str, user_id: int | None):
    """Prepare (never submit) an order when the user clearly asks to order named menu items."""
    import re
    from models.menu import MenuItem
    from services.chat_tools import place_order

    lowered = question.lower()
    order_phrases = (
        "i want to order", "i'd like to order", "i would like to order",
        "i want an order", "place an order", "i want to buy", "i'll have",
        "i will have", "can i order", "could i order", "order me",
    )
    if not any(phrase in lowered for phrase in order_phrases):
        return None

    if user_id is None:
        return "Please log in before placing an order."

    menu_items = db.query(MenuItem).filter(MenuItem.is_available.is_(True)).all()
    matched = []
    quantity_words = {
        "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
        "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    }
    for item in menu_items:
        if not item.name or item.name.lower() not in lowered:
            continue
        name_lower = item.name.lower()
        name_start = lowered.find(name_lower)
        prefix = lowered[:name_start]
        quantity_match = re.search(
            r"(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*$",
            prefix,
        )
        quantity = 1
        if quantity_match:
            raw_quantity = quantity_match.group(1)
            quantity = int(raw_quantity) if raw_quantity.isdigit() else quantity_words[raw_quantity]
        suffix = lowered[name_start + len(name_lower):]
        after_match = re.match(r"\s*(?:x|×|for)\s*(\d+)\b", suffix)
        if after_match:
            quantity = int(after_match.group(1))
        matched.append({"menu_item_id": item.id, "quantity": quantity})

    if not matched:
        return None

    items_by_id = {}
    for entry in matched:
        items_by_id[entry["menu_item_id"]] = items_by_id.get(entry["menu_item_id"], 0) + entry["quantity"]
    order_items = [{"menu_item_id": item_id, "quantity": quantity}
                   for item_id, quantity in items_by_id.items()]

    result = place_order(db=db, user_id=user_id, items=order_items)
    if not result.get("success"):
        return result.get("message", "I couldn't prepare that order.")
    lines = ["Please review your order. Nothing has been placed yet."]
    for entry in result.get("preview", []):
        lines.append(f"- {entry['name']} × {entry['quantity']}: ₹{entry['subtotal']:.2f}")
    lines.append(f"Total: ₹{result['total_amount']:.2f}")
    lines.append(
        "To place it, confirm explicitly through POST /chat/confirm with "
        "action='place_order', confirmed=true, and these items: "
        + str(result["items"])
    )
    return "\n".join(lines)

def run_menu_tool_flow(db: Session, question: str, user_id: int | None = None) -> str:
    try:
        # Explicit order requests are handled deterministically so Gemini cannot
        # accidentally stop after only searching the menu. This prepares a preview;
        # it never creates an order without the separate confirmation endpoint.
        order_preview = _prepare_order_from_explicit_request(db, question, user_id)
        if order_preview is not None:
            return order_preview

        response = test_menu_tool_call(question)
        result = execute_menu_tool_call(db=db, response=response, user_id=user_id)
        if result is None:
            return response.output_text or "I couldn't find an answer to that question."
        if isinstance(result, dict):
            if "orders" in result:
                if not result["orders"]:
                    return result.get("message", "You have no orders yet.")
                return "Here are your orders:\n" + "\n".join(
                    f"Order #{o['id']} — {o['status']} — ₹{o['total_amount']:.2f}" for o in result["orders"])
            if "context" in result:
                if not result.get("found"):
                    return result.get("message", "I couldn't find relevant restaurant information.")
                return "Here is the relevant restaurant information:\n" + "\n\n".join(
                    f"{x['title']}\n{x['content']}" for x in result["context"])
            if "order_id" in result and ("items" in result or "requires_confirmation" in result):
                if not result.get("found", result.get("success", False)):
                    return result.get("message", "I couldn't retrieve that order.")
                if result.get("requires_confirmation"):
                    preview = result.get("preview", [])
                    lines = [result["message"]]
                    for x in preview:
                        lines.append(f"- {x['name']} × {x['quantity']}: ₹{x['subtotal']:.2f}")
                    if "total_amount" in result:
                        lines.append(f"Total: ₹{result['total_amount']:.2f}")
                    return "\n".join(lines)
                answer = f"Order #{result['order_id']}\nStatus: {result.get('status', 'unknown')}\nTotal: ₹{result.get('total_amount', 0):.2f}"
                for item in result.get("items", []):
                    answer += f"\n- {item.get('name', 'Menu item')} × {item.get('quantity', 1)} — ₹{float(item.get('subtotal', 0)):.2f}"
                return answer
            if result.get("requires_confirmation"):
                lines = [result.get("message", "Confirmation is required.")]
                for x in result.get("preview", []):
                    lines.append(f"- {x['name']} × {x['quantity']}: ₹{x['subtotal']:.2f}")
                if "total_amount" in result:
                    lines.append(f"Total: ₹{result['total_amount']:.2f}")
                return "\n".join(lines)
            if "name" in result and "price" in result:
                if not result.get("found", True):
                    return result.get("message", "Sorry, I couldn't find that dish.")
                return (f"{result['name']}\nDescription: {result.get('description') or 'Not available'}\nPrice: ₹{result['price']}\nCategory: {result.get('category') or 'Not available'}\nAvailable: {'Yes' if result.get('is_available') else 'No'}\nVegetarian: {'Yes' if result.get('is_vegetarian') else 'No'}\nVegan: {'Yes' if result.get('is_vegan') else 'No'}\nSpice level: {result.get('spice_level', 'Unknown')}\nIngredients: {result.get('ingredients') or 'Not available'}\nAllergens: {result.get('allergens') or 'Unknown'}")
            if "message" in result and result.get("found") is False:
                return result["message"]
        if isinstance(result, list):
            if not result:
                return "Sorry, I couldn't find any matching available dishes."
            return "Here are the matching menu items:\n" + "\n".join(
                f"- {x['name']} — ₹{x['price']:.2f}" for x in result)
        return str(result)
    except Exception as exc:
        print(f"Gemini tool flow error: {type(exc).__name__}: {exc}")
        return "Sorry, the restaurant chatbot is temporarily unavailable. Please try again shortly."
