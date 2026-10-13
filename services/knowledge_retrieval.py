
from sqlalchemy.orm import Session

from models.knowledge import Knowledge
from models.menu import MenuItem


def search_knowledge(
    query: str,
    db: Session,
    limit: int = 5
):
    keywords = query.lower().split()

    results = []

    for keyword in keywords:
        if len(keyword) < 3:
            continue

        matches = db.query(Knowledge).filter(
            Knowledge.content.ilike(f"%{keyword}%")
            | Knowledge.title.ilike(f"%{keyword}%")
        ).all()

        results.extend(matches)

    # Remove duplicate records
    unique_results = {
        item.id: item for item in results
    }

    return list(unique_results.values())[:limit]



def search_menu(
    db: Session,
    max_price: float | None = None,
    vegetarian_only: bool = False
):
    # Start with menu items that are currently available
    query = db.query(MenuItem).filter(
        MenuItem.is_available == True
    )

    # Apply a price limit if the customer provides one
    if max_price is not None:
       query = query.filter(MenuItem.price < max_price)

    # Show only vegetarian dishes when requested
    if vegetarian_only:
        query = query.filter(
            MenuItem.is_vegetarian == True
        )

    # Display cheaper dishes first
    return query.order_by(MenuItem.price.asc()).all()
