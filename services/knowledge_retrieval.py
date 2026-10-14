
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
    vegetarian_only: bool = False,
    non_vegetarian_only: bool = False,
    category: str | None = None,
    keyword: str | None = None,
    inclusive_price: bool = False
):
    # Start with menu items that are currently available
    query = db.query(MenuItem).filter(
        MenuItem.is_available == True
    )

    # Apply a price limit if the customer provides one
    if max_price is not None:
        if inclusive_price:
            query = query.filter(MenuItem.price <= max_price)
        else:
            query = query.filter(MenuItem.price < max_price)
    
    # Show only vegetarian dishes when requested
    if vegetarian_only:
        query = query.filter(
            MenuItem.is_vegetarian == True
        )

    # Show only non-vegetarian dishes when requested
    if non_vegetarian_only:
        query = query.filter(
            MenuItem.is_vegetarian == False
    )

    if category is not None:
     query = query.filter(
        MenuItem.category.ilike(f"%{category}%")
    )
    if keyword is not None:
      query = query.filter(
        MenuItem.name.ilike(f"%{keyword}%")
        | MenuItem.description.ilike(f"%{keyword}%")
    )
    # Display cheaper dishes first
    return query.order_by(MenuItem.price.asc()).all()


def find_meal_combinations(
    db: Session,
    budget: float,
    vegetarian_only: bool = False,
    non_vegetarian_only: bool = False
):
    # Get available items within the budget
    query = db.query(MenuItem).filter(
        MenuItem.is_available == True,
        MenuItem.price <= budget
    )

    if vegetarian_only:
      query = query.filter(
        MenuItem.is_vegetarian == True
    )
   
    
    print("Vegetarian filter:", vegetarian_only)
    print(
        "Eligible items:",
         [
        (item.name, float(item.price), item.is_vegetarian)
        for item in query.all()
         ]
     )

    menu_items = query.order_by(
        MenuItem.price.asc()
    ).all()

    
    # Define the role of each menu category
    category_roles = {
        "Main Course": "main",
        "Breakfast": "main",
        "Vegetarian": "main",
        "Breads": "side",
        "Starters": "side",
        "Beverages": "drink",
        "Desserts": "dessert"
    }

    # Group items by their category role
    mains = [
    item for item in menu_items
    if category_roles.get(item.category) == "main"
    and (not non_vegetarian_only or not item.is_vegetarian)
]
    sides = [
        item for item in menu_items
        if category_roles.get(item.category) == "side"
    ]

    drinks = [
        item for item in menu_items
        if category_roles.get(item.category) == "drink"
    ]

    desserts = [
        item for item in menu_items
        if category_roles.get(item.category) == "dessert"
    ]

    recommendations = []
    print("Mains:", [item.name for item in mains])
    print("Sides:", [item.name for item in sides])
    print("Drinks:", [item.name for item in drinks])
    print("Desserts:", [item.name for item in desserts])
    
    # Recommend a main dish with a side
    for main in mains:
        for side in sides:
            total = float(main.price) + float(side.price)

            if total <= budget:
                recommendations.append({
                    "items": [main.name, side.name],
                    "total_price": total
                })

    # Recommend a main dish with a drink
    for main in mains:
        for drink in drinks:
            total = float(main.price) + float(drink.price)

            if total <= budget:
                recommendations.append({
                    "items": [main.name, drink.name],
                    "total_price": total
                })

    # Recommend a main dish with dessert
    for main in mains:
        for dessert in desserts:
            total = float(main.price) + float(dessert.price)

            if total <= budget:
                recommendations.append({
                    "items": [main.name, dessert.name],
                    "total_price": total
                })

    # Also include individual dishes
    for item in menu_items:
      if non_vegetarian_only and item.is_vegetarian:
        continue

    recommendations.append({
        "items": [item.name],
        "total_price": item.price
    })

    
    # Separate meal combinations from individual dishes
    meal_pairs = [
        option for option in recommendations
        if len(option["items"]) == 2
    ]
    print("Generated meal pairs:", meal_pairs)

    individual_dishes = [
        option for option in recommendations
        if len(option["items"]) == 1
    ]

    # Prioritize combinations with different main dishes
    selected_pairs = []
    used_mains = set()

    for option in meal_pairs:
        main_name = next(
            (
                name for name in option["items"]
                if any(
                    item.name == name
                    and category_roles.get(item.category) == "main"
                    for item in menu_items
                )
            ),
            None
        )

        if main_name is None or main_name in used_mains:
            continue

        selected_pairs.append(option)
        used_mains.add(main_name)

        if len(selected_pairs) == 3:
            break

    # Show combinations first, followed by individual dishes
    selected = selected_pairs + individual_dishes

    return selected
