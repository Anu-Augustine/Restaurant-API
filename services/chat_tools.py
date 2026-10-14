from sqlalchemy.orm import Session
from services.knowledge_retrieval import search_menu as retrieve_menu


def search_menu(
    db: Session,
    max_price: float | None = None,
    vegetarian_only: bool = False,
    non_vegetarian_only: bool = False,
    vegan_only: bool = False,
    category: str | None = None,
    keyword: str | None = None,
    spice_level: str | None = None,
    ingredient: str | None = None,
    allergen: str | None = None,
    exclude_allergens: list[str] | None = None,
    max_spice: int | None = None,
    inclusive_price: bool = False,
):
    """Search available menu items with dietary, price and ingredient filters."""
    if vegetarian_only and non_vegetarian_only:
        return []

    search_keyword = keyword
    if category and category.lower() in {"biryani", "dosa", "curry", "parotta"}:
        search_keyword, category = category, None

    items = retrieve_menu(
        db=db,
        max_price=max_price,
        vegetarian_only=vegetarian_only,
        non_vegetarian_only=non_vegetarian_only,
        category=category,
        keyword=search_keyword,
        inclusive_price=inclusive_price,
    )
    excluded = [a.strip().lower() for a in (exclude_allergens or []) if a.strip()]
    results = []
    for item in items:
        if vegan_only and not item.is_vegan:
            continue
        if spice_level is not None:
            mapping = {"not specified": 0, "mild": 1, "medium": 2, "hot": 3, "spicy": 3}
            requested = mapping.get(str(spice_level).lower())
            if requested is None:
                try:
                    requested = int(spice_level)
                except (ValueError, TypeError):
                    continue
            if item.spice_level != requested:
                continue
        if max_spice is not None and item.spice_level > max_spice:
            continue
        if ingredient and ingredient.lower() not in (item.ingredients or "").lower():
            continue
        allergens_text = (item.allergens or "").lower()
        if allergen and allergen.lower() not in allergens_text:
            continue
        # Unknown allergen information is not treated as proof that an item is safe.
        if excluded and (not item.allergens or any(a in allergens_text for a in excluded)):
            continue
        results.append({
            "id": item.id, "name": item.name, "description": item.description,
            "price": float(item.price), "category": item.category,
            "is_vegetarian": item.is_vegetarian, "is_vegan": item.is_vegan,
            "spice_level": item.spice_level, "ingredients": item.ingredients,
            "allergens": item.allergens, "is_available": item.is_available,
        })
    return results


def get_menu_item_details(db: Session, item_id: int | None = None, item_name: str | None = None):
    """Get details for one available menu item by ID or exact name."""
    from models.menu import MenuItem
    query = db.query(MenuItem).filter(MenuItem.is_available.is_(True))
    if item_id is not None:
        item = query.filter(MenuItem.id == item_id).first()
    elif item_name:
        item = query.filter(MenuItem.name.ilike(item_name.strip())).first()
        if item is None:
            item = query.filter(MenuItem.name.ilike(f"%{item_name.strip()}%")).first()
    else:
        item = None
    if item is None:
        return {"found": False, "message": "No matching available menu item was found."}
    return {
        "found": True, "id": item.id, "name": item.name,
        "description": item.description, "price": float(item.price),
        "category": item.category, "is_available": item.is_available,
        "is_vegetarian": item.is_vegetarian, "is_vegan": item.is_vegan,
        "spice_level": item.spice_level, "ingredients": item.ingredients,
        "allergens": item.allergens,
    }


def get_restaurant_info(question: str, db: Session):
    from services.knowledge_retrieval import search_knowledge
    results = search_knowledge(question, db)
    if not results:
        return {"found": False, "message": "I couldn't find relevant restaurant information."}
    return {"found": True, "question": question, "context": [
        {"id": x.id, "title": x.title, "content": x.content} for x in results
    ]}


def get_my_orders(db: Session, user_id: int):
    from services.order_service import get_my_orders as retrieve_my_orders
    orders = retrieve_my_orders(db=db, user_id=user_id)
    return {"found": bool(orders), "orders": [
        {"id": o.id, "status": str(o.status), "total_amount": float(o.total_amount)}
        for o in orders
    ], "message": "Orders retrieved successfully." if orders else "You have no orders yet."}


def get_order_status(db: Session, order_id: int, user_id: int):
    from services.order_service import get_order_details
    order = get_order_details(db=db, order_id=order_id, user_id=user_id)
    return {"found": True, **order, "total_amount": float(order["total_amount"]),
            "message": f"Your order #{order_id} is currently {order['status']}."}


def place_order(db: Session, user_id: int, items: list[dict]):
    """Prepare an order for confirmation; this function does not write to the DB."""
    from schemas.order import OrderCreate
    from models.menu import MenuItem
    order_data = OrderCreate(items=items)
    if not order_data.items:
        return {"success": False, "message": "An order must contain at least one item."}
    preview, total = [], 0.0
    for entry in order_data.items:
        if entry.quantity <= 0:
            return {"success": False, "message": "Each quantity must be greater than zero."}
        menu_item = db.query(MenuItem).filter(
            MenuItem.id == entry.menu_item_id, MenuItem.is_available.is_(True)
        ).first()
        if menu_item is None:
            return {"success": False, "message": f"Menu item {entry.menu_item_id} is unavailable."}
        subtotal = float(menu_item.price) * entry.quantity
        total += subtotal
        preview.append({"menu_item_id": menu_item.id, "name": menu_item.name,
                        "quantity": entry.quantity, "unit_price": float(menu_item.price),
                        "subtotal": subtotal})
    return {"success": True, "requires_confirmation": True, "action": "place_order",
            "items": [{"menu_item_id": x["menu_item_id"], "quantity": x["quantity"]} for x in preview],
            "preview": preview, "total_amount": total,
            "message": "Please review these items and total. To place the order, explicitly confirm using POST /chat/confirm with action='place_order', confirmed=true, and the returned items."}


def cancel_my_order(db: Session, order_id: int, user_id: int):
    """Prepare a cancellation for confirmation; this function does not write to the DB."""
    from services.order_service import get_order_details
    order = get_order_details(db=db, order_id=order_id, user_id=user_id)
    if order["status"] != "pending":
        return {"success": False, "message": "Only pending orders can be cancelled."}
    return {"success": True, "requires_confirmation": True, "action": "cancel_order",
            "order_id": order_id, "status": order["status"],
            "message": f"Order #{order_id} is pending. To cancel it, explicitly confirm using POST /chat/confirm with action='cancel_order', order_id={order_id}, and confirmed=true."}
