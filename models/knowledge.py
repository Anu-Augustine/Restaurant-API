
from sqlalchemy import Column, Integer, String, Text
from database import Base


class Knowledge(Base):
    __tablename__ = "restaurant_knowledge"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String(200), nullable=False)

    category = Column(String(100), nullable=False)

    content = Column(Text, nullable=False)
