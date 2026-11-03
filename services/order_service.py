from fastapi import HTTPException
from sqlalchemy.orm import Session, load_only

from models.order import Order
from models.order_item import OrderItem
from models.menu import MenuItem
from models.user import User


def create_order(
    db: Session,
    user_id: int,
    order_data
):
    if not order_data.items:
        raise HTTPException(
            status_code=400,
            detail="An order must contain at least one item"
        )

    # Validate quantities and menu items before creating the order
    validated_items = []
    total = 0

    for item in order_data.items:
        if item.quantity <= 0:
            raise HTTPException(
                status_code=400,
                detail="Quantity must be greater than zero"
            )

        menu_item = db.query(MenuItem).filter(
            MenuItem.id == item.menu_item_id,
            MenuItem.is_available == True
        ).first()

        if menu_item is None:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"Available menu item "
                    f"{item.menu_item_id} not found"
                )
            )

        validated_items.append((item, menu_item))
        total += menu_item.price * item.quantity

    try:
        new_order = Order(
            user_id=user_id,
            total_amount=total
        )

        db.add(new_order)
        db.flush()

        for item, menu_item in validated_items:
            order_item = OrderItem(
                order_id=new_order.id,
                menu_item_id=menu_item.id,
                quantity=item.quantity,
                price_at_purchase=menu_item.price
            )
            db.add(order_item)

        db.commit()
        db.refresh(new_order)
        return new_order

    except Exception:
        db.rollback()
        raise


def cancel_order(db: Session, order_id: int, user_id: int):
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == user_id
    ).first()

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Order not found"
        )

    if order.status != "pending":
        raise HTTPException(
            status_code=400,
            detail="Only pending orders can be cancelled"
        )

    try:
        order.status = "cancelled"
        db.commit()
        db.refresh(order)
        return order

    except Exception:
        db.rollback()
        raise


def get_order_details(db: Session, order_id: int, user_id: int):
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == user_id
    ).first()

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Order not found"
        )

    return {
        "order_id": order.id,
        "user_id": order.user_id,
        "total_amount": order.total_amount,
        "status": order.status,
        "items": _items_for_order(db, order.id)
    }


def get_my_orders(db: Session, user_id: int):
    orders = db.query(Order).filter(
        Order.user_id == user_id
    ).all()

    return orders


def update_order_status(db: Session, order_id: int, status: str):
    order = db.query(Order).filter(
        Order.id == order_id
    ).first()

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Order not found"
        )

    try:
        order.status = status
        db.commit()
        db.refresh(order)
        return order

    except Exception:
        db.rollback()
        raise

def _serialize_order_item(order_item, menu_item):
    quantity = order_item.quantity
    price = order_item.price_at_purchase
    return {
        "menu_item_id": order_item.menu_item_id,
        "name": menu_item.name if menu_item else "Deleted menu item",
        "quantity": quantity,
        "price_at_purchase": price,
        "subtotal": quantity * price,
    }


def _items_for_order(db: Session, order_id: int):
    order_items = db.query(OrderItem).filter(
        OrderItem.order_id == order_id
    ).all()

    items = []
    for order_item in order_items:
        menu_item = db.query(MenuItem).filter(
            MenuItem.id == order_item.menu_item_id
        ).first()
        items.append(_serialize_order_item(order_item, menu_item))
    return items


def get_all_orders(db: Session):
    orders = db.query(Order).all()
    user_ids = {order.user_id for order in orders}
    customers_by_id = {}

    if user_ids:
        customers = (
            db.query(User)
            .options(load_only(User.id, User.name, User.email, User.phone))
            .filter(User.id.in_(list(user_ids)))
            .all()
        )
        customers_by_id = {customer.id: customer for customer in customers}

    payload = []
    for order in orders:
        customer = customers_by_id.get(order.user_id)
        payload.append({
            "id": order.id,
            "order_id": order.id,
            "user_id": order.user_id,
            "total_amount": order.total_amount,
            "status": order.status,
            "name": customer.name if customer else "",
            "phone": (customer.phone or "") if customer else "",
            "email": customer.email if customer else "",
            "items": _items_for_order(db, order.id),
        })
    return payload
