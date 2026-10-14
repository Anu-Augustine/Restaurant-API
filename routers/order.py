from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.order import Order
from models.order_item import OrderItem
from models.menu import MenuItem
from schemas.order import OrderCreate,  OrderStatusUpdate
from security import get_current_user,  require_admin
from services.order_service import (
    create_order,
    cancel_order,
    get_order_details,
    get_my_orders,
    update_order_status,
     get_all_orders
)

router = APIRouter()

@router.post("/orders")
def create_order_endpoint(
    order_data: OrderCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    new_order = create_order(
        db=db,
        user_id=current_user.id,
        order_data=order_data
    )

    return {
        "message": "Order placed successfully",
        "order_id": new_order.id,
        "total_amount": new_order.total_amount,
        "status": new_order.status
    }




@router.get("/orders/my-orders")
def get_my_orders_endpoint(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return get_my_orders(
        db=db,
        user_id=current_user.id
    )



@router.get("/orders/{order_id}")
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return get_order_details(
        db=db,
        order_id=order_id,
        user_id=current_user.id
    )



@router.patch("/orders/{order_id}/status")
def update_order_status_endpoint(
    order_id: int,
    status_data: OrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    order = update_order_status(
        db=db,
        order_id=order_id,
        status=status_data.status
    )

    return {
        "message": "Order status updated successfully",
        "order_id": order.id,
        "status": order.status
    }



@router.patch("/orders/{order_id}/cancel")
def cancel_order_endpoint(
    order_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    order = cancel_order(
        db=db,
        order_id=order_id,
        user_id=current_user.id
    )

    return {
        "message": "Order cancelled successfully",
        "order_id": order.id,
        "status": order.status
    }


@router.get("/admin/orders")
def get_all_orders_endpoint(
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    return get_all_orders(db=db)

