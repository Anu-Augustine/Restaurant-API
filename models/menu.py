from sqlalchemy import Column, Integer, String, Float, Boolean
from database import Base


class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(255))
    price = Column(Float, nullable=False)
    category = Column(String(50))
    is_available = Column(Boolean, default=True)
    is_vegetarian = Column(Boolean, default=False, nullable=False)
    is_vegan = Column(Boolean, default=False, nullable=False)
    spice_level = Column(Integer, default=0, nullable=False)# 0 = Not specified, 1 = Mild, 2 = Medium, 3 = Hot
    ingredients = Column(String(500), nullable=True)
    allergens = Column(String(255), nullable=True)
