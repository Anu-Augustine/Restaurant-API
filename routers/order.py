
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.order import Order
from models.order_item import OrderItem
from models.menu import MenuItem
from schemas.order import OrderCreate,  OrderStatusUpdate
from security import get_current_user,  require_admin

router = APIRouter()

@router.post("/orders")
def create_order(
    order_data: OrderCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if not order_data.items:
        raise HTTPException(
            status_code=400,
            detail="An order must contain at least one item"
        )

    new_order = Order(
        user_id=current_user.id,
        total_amount=0
    )

    db.add(new_order)
    db.flush()

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
                detail=f"Available menu item {item.menu_item_id} not found"
            )

        order_item = OrderItem(
            order_id=new_order.id,
            menu_item_id=menu_item.id,
            quantity=item.quantity,
            price_at_purchase=menu_item.price
        )

        db.add(order_item)

        total += menu_item.price * item.quantity

    new_order.total_amount = total

    db.commit()
    db.refresh(new_order)

    return {
        "message": "Order placed successfully",
        "order_id": new_order.id,
        "total_amount": new_order.total_amount,
        "status": new_order.status
    }


@router.get("/orders/my-orders")
def get_my_orders(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    orders = db.query(Order).filter(
        Order.user_id == current_user.id
    ).all()

    return orders



@router.get("/orders/{order_id}")
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id
    ).first()

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Order not found"
        )

    order_items = db.query(OrderItem).filter(
        OrderItem.order_id == order.id
    ).all()

    items = []

    for order_item in order_items:
        menu_item = db.query(MenuItem).filter(
            MenuItem.id == order_item.menu_item_id
        ).first()

        items.append({
            "menu_item_id": order_item.menu_item_id,
            "name": menu_item.name if menu_item else "Deleted menu item",
            "quantity": order_item.quantity,
            "price_at_purchase": order_item.price_at_purchase,
            "subtotal": order_item.quantity * order_item.price_at_purchase
        })

    return {
        "order_id": order.id,
        "user_id": order.user_id,
        "total_amount": order.total_amount,
        "status": order.status,
        "items": items
    }


@router.patch("/orders/{order_id}/status")
def update_order_status(
    order_id: int,
    status_data: OrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    order = db.query(Order).filter(
        Order.id == order_id
    ).first()

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Order not found"
        )

    order.status = status_data.status

    db.commit()
    db.refresh(order)

    return {
        "message": "Order status updated successfully",
        "order_id": order.id,
        "status": order.status
    }


@router.patch("/orders/{order_id}/cancel")
def cancel_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id
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

    order.status = "cancelled"

    db.commit()
    db.refresh(order)

    return {
        "message": "Order cancelled successfully",
        "order_id": order.id,
        "status": order.status
    }

@router.get("/admin/orders")
def get_all_orders(
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    orders = db.query(Order).all()

    return orders
