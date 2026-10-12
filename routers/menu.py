from fastapi import APIRouter, Depends, HTTPException
from fastapi import HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.menu import MenuItem
from schemas.menu import MenuItemCreate, MenuItemUpdate
from security import require_admin

router = APIRouter()


@router.post("/menu")
def create_menu_item(
    item: MenuItemCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    new_item = MenuItem(
        name=item.name,
        description=item.description,
        price=item.price,
        category=item.category
    )

    db.add(new_item)
    db.commit()
    db.refresh(new_item)

    return {
        "message": "Menu item added successfully",
        "id": new_item.id,
        "name": new_item.name,
        "description": new_item.description,
        "price": new_item.price,
        "category": new_item.category,
        "is_available": new_item.is_available
    }


@router.get("/menu")
def get_menu(db: Session = Depends(get_db)):
    menu_items = db.query(MenuItem).filter(
        MenuItem.is_available == True
    ).all()

    return menu_items



@router.put("/menu/{item_id}")
def update_menu_item(
    item_id: int,
    item: MenuItemUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    menu_item = db.query(MenuItem).filter(
        MenuItem.id == item_id
    ).first()

    if menu_item is None:
        raise HTTPException(
            status_code=404,
            detail="Menu item not found"
        )

    menu_item.name = item.name
    menu_item.description = item.description
    menu_item.price = item.price
    menu_item.category = item.category
    menu_item.is_available = item.is_available

    db.commit()
    db.refresh(menu_item)

    return {
        "message": "Menu item updated successfully",
        "id": menu_item.id,
        "name": menu_item.name,
        "description": menu_item.description,
        "price": menu_item.price,
        "category": menu_item.category,
        "is_available": menu_item.is_available
    }

@router.delete("/menu/{item_id}")
def delete_menu_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):
    menu_item = db.query(MenuItem).filter(
        MenuItem.id == item_id
    ).first()

    if menu_item is None:
        raise HTTPException(
            status_code=404,
            detail="Menu item not found"
        )

    db.delete(menu_item)
    db.commit()

    return {
        "message": "Menu item deleted successfully",
        "id": item_id
    }
